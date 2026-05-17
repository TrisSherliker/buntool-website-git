/**
 * BunTool
 * Copyright (c) 2025-2026 Tris Sherliker (tris@sherliker.net)
 * Licensed under the Mozilla Public License Version 2.0.
 *
 * buntoolMergeWorker.js
 * Web Worker for mupdf-based PDF merge operations.
 * Each worker instance handles a single operation then is terminated by the
 * caller, freeing the entire mupdf wasm heap.
 *
 * Handles two operations (dispatched by 'op' field in the message):
 *   mergePdfsByTOC  — merge N ordered source PDFs into one
 *   mergeTwoPdfs    — concatenate two PDFs
 */

console.log('[MergeWorker] script loading…');

import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.27.0/dist/mupdf.js';

console.log('[MergeWorker] mupdf imported, ready =', typeof mupdf.ready);


// --- mupdf helpers (same logic as buntoolMerge.js) ---

function graftPage(dstDoc, srcDoc, pageIndex, graft) {
  const srcPage = srcDoc.findPage(pageIndex);
  const dstPage = dstDoc.newDictionary();
  dstPage.put("Type", dstDoc.newName("Page"));
  if (srcPage.get("MediaBox"))  dstPage.put("MediaBox",  graft.graftObject(srcPage.get("MediaBox")));
  if (srcPage.get("Rotate"))    dstPage.put("Rotate",    graft.graftObject(srcPage.get("Rotate")));
  if (srcPage.get("Resources")) dstPage.put("Resources", graft.graftObject(srcPage.get("Resources")));
  if (srcPage.get("Contents"))  dstPage.put("Contents",  graft.graftObject(srcPage.get("Contents")));
  dstDoc.insertPage(-1, dstDoc.addObject(dstPage));
}

function graftAllAndDestroy(dstDoc, srcDoc) {
  const pageCount = srcDoc.countPages();
  const graft = dstDoc.newGraftMap();
  for (let i = 0; i < pageCount; i++) graftPage(dstDoc, srcDoc, i, graft);
  graft.destroy();
  srcDoc.destroy();
  return pageCount;
}

function saveAndDestroy(doc) {
  const buf = doc.saveToBuffer("pdf");
  const result = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return result;
}

// Creates a single blank A4 page using mupdf — no pdf-lib dependency needed.
function makeBlankPage() {
  const doc = new mupdf.PDFDocument();
  const pageObj = doc.addPage([0, 0, 595.28, 841.89], 0, {}, "");
  doc.insertPage(-1, pageObj);
  return saveAndDestroy(doc);
}


// --- operations ---

/**
 * Merges PDFs in order. fileEntries is [{filename, buffer: ArrayBuffer}] with
 * section breaks already filtered out by the caller.
 * printable: add a blank page after any document with an odd page count.
 *
 * @param {Array<{filename: string, buffer: ArrayBuffer}>} fileEntries
 * @param {boolean} printable
 * @returns {Uint8Array}
 */
function doMergePdfsByTOC(fileEntries, printable) {
  console.log('[MergeWorker] doMergePdfsByTOC start, files =', fileEntries.length);
  let dst = null;

  for (const { filename, buffer } of fileEntries) {
    console.log('[MergeWorker] opening:', filename, 'buffer byteLength =', buffer.byteLength);
    const srcBytes = new Uint8Array(buffer);

    if (dst === null) {
      dst = mupdf.Document.openDocument(srcBytes, "application/pdf");
      if (printable && dst.countPages() % 2 === 1) {
        const blankDoc = mupdf.Document.openDocument(makeBlankPage(), "application/pdf");
        graftAllAndDestroy(dst, blankDoc);
      }
    } else {
      const src = mupdf.Document.openDocument(srcBytes, "application/pdf");
      const pageCount = graftAllAndDestroy(dst, src);
      if (printable && pageCount % 2 === 1) {
        const blankDoc = mupdf.Document.openDocument(makeBlankPage(), "application/pdf");
        graftAllAndDestroy(dst, blankDoc);
      }
    }

    console.log(`[MergeWorker] Grafted: ${filename}`);
  }

  if (!dst) throw new Error('No documents to merge');
  return saveAndDestroy(dst);
}

/**
 * Concatenates two PDFs. Both buffers are transferred from the caller (zero-copy).
 *
 * @param {ArrayBuffer} bufA
 * @param {ArrayBuffer} bufB
 * @returns {Uint8Array}
 */
function doMergeTwoPdfs(bufA, bufB) {
  const dst = mupdf.Document.openDocument(new Uint8Array(bufA), "application/pdf");
  const src = mupdf.Document.openDocument(new Uint8Array(bufB), "application/pdf");
  graftAllAndDestroy(dst, src);
  return saveAndDestroy(dst);
}


// Signal to the main thread that the worker is fully loaded and ready to receive work.
self.postMessage({ ready: true });

// --- message handler ---

self.addEventListener('message', async (e) => {
  console.log('[MergeWorker] onmessage received, op =', e.data?.op);
  // mupdf wasm initialises asynchronously — must await before use
  try { if (mupdf.ready) await mupdf.ready; } catch {}

  // Track this worker's heap peak throughout the operation.
  // performance.memory is Chrome/Edge main-thread only — undefined in workers; silently skipped.
  let workerPeakBytes = performance?.memory?.usedJSHeapSize ?? null;
  const peakPoll = setInterval(() => {
    const b = performance?.memory?.usedJSHeapSize;
    if (b != null && b > (workerPeakBytes ?? 0)) workerPeakBytes = b;
  }, 50);

  const { op } = e.data;
  try {
    let result;

    if (op === 'mergePdfsByTOC') {
      result = doMergePdfsByTOC(e.data.fileEntries, e.data.printable);

    } else if (op === 'mergeTwoPdfs') {
      result = doMergeTwoPdfs(e.data.bufA, e.data.bufB);

    } else {
      throw new Error(`Unknown operation: ${op}`);
    }

    clearInterval(peakPoll);
    const finalSample = performance?.memory?.usedJSHeapSize ?? null;
    if (finalSample != null && finalSample > (workerPeakBytes ?? 0)) workerPeakBytes = finalSample;
    const workerPeakMB = workerPeakBytes != null ? workerPeakBytes / (1024 * 1024) : null;

    // Transfer result back — zero-copy, caller receives owned buffer
    self.postMessage({ result, workerPeakMB }, [result.buffer]);

  } catch (err) {
    clearInterval(peakPoll);
    self.postMessage({ error: err.message, stack: err.stack });
  }
});
