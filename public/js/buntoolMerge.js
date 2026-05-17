/**
 * BunTool
 * Copyright (c) 2025-2026 Tris Sherliker (tris@sherliker.net)
 * A tool for the creation of legal bundles.
 * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 *
 * buntoolMerge.js
 * Functions to merge documents together.
 */

import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.27.0/dist/mupdf.js';
import { makeBlankPage } from './buntoolPages.js';


/**
 * Grafts a single page from srcDoc into dstDoc (appended at end).
 * @param {Object} dstDoc - mupdf destination document
 * @param {Object} srcDoc - mupdf source document
 * @param {number} pageIndex - zero-based page index in srcDoc
 * @param {Object} graft - mupdf graft map (reused across pages for efficiency)
 */
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

/**
 * Grafts all pages from srcDoc into dstDoc, then destroys srcDoc and the graft map.
 * @param {Object} dstDoc - mupdf destination document
 * @param {Object} srcDoc - mupdf source document (will be destroyed)
 * @returns {number} The number of pages grafted
 */
function graftAllAndDestroy(dstDoc, srcDoc) {
  const pageCount = srcDoc.countPages();
  const graft = dstDoc.newGraftMap();
  for (let i = 0; i < pageCount; i++) {
    graftPage(dstDoc, srcDoc, i, graft);
  }
  graft.destroy();
  srcDoc.destroy();
  return pageCount;
}

/**
 * Saves a mupdf document to a Uint8Array on the JS heap, then destroys both the
 * save buffer and the document. Always call this instead of saveToBuffer directly
 * to ensure cleanup.
 * @param {Object} doc - mupdf document (will be destroyed)
 * @returns {Uint8Array} The saved PDF bytes (on JS heap, safe to hold)
 */
function saveAndDestroy(doc) {
  const buf = doc.saveToBuffer("pdf");
  const result = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return result;
}


/**
 * Appends a single blank A4 page to dstDoc (used in printable bundle mode).
 * @param {Object} dstDoc - mupdf destination document
 */
async function appendBlankPage(dstDoc) {
  const blankBytes = await makeBlankPage();
  const blankDoc = mupdf.Document.openDocument(blankBytes, "application/pdf");
  graftAllAndDestroy(dstDoc, blankDoc);
}


/**
 * Merges multiple PDF files according to the order specified in the TOC entries.
 * Each source document is destroyed immediately after its pages are grafted, keeping
 * peak memory at ~(destination + 1 source) rather than all sources simultaneously.
 *
 * Drop-in replacement for mergePdfsByTOC in buntoolPages.js.
 *
 * @param {Array<Object>} tocEntries - Array of TOC entry objects
 * @param {Map<string, File>} filesMap - Map of filenames to File objects
 * @param {Object} config - BunTool Config instance
 * @returns {Promise<Uint8Array>} The merged PDF as a Uint8Array
 */
export async function mergePdfsByTOC(tocEntries, filesMap, config) {
  const printable = config.getOption('pageOptions.printableBundle');
  let dst = null;

  console.log(`Starting PDF merge (mupdf). tocEntries: `, tocEntries);

  for (const entry of tocEntries) {
    if (entry.sectionBreak) {
      console.log(`Skipping section header '${entry.title}' in PDF merging`);
      continue;
    }

    const pdfFile = filesMap.get(entry.filename);
    if (!pdfFile) throw new Error(`File not found in filesMap: ${entry.filename}`);

    const srcBytes = new Uint8Array(await pdfFile.arrayBuffer());
    console.log(`Processing entry: '${entry.title}' (filename: '${entry.filename}')`);

    if (dst === null) {
      // First document: open it directly as the destination
      dst = mupdf.Document.openDocument(srcBytes, "application/pdf");
      if (printable && dst.countPages() % 2 === 1) {
        console.log(`Adding blank page after '${entry.filename}' (odd page count)`);
        await appendBlankPage(dst);
      }
    } else {
      // Subsequent documents: open as source, graft into destination, destroy immediately
      const src = mupdf.Document.openDocument(srcBytes, "application/pdf");
      const pageCount = graftAllAndDestroy(dst, src);
      if (printable && pageCount % 2 === 1) {
        console.log(`Adding blank page after '${entry.filename}' (${pageCount} pages)`);
        await appendBlankPage(dst);
      }
    }
  }

  if (!dst) throw new Error('No documents were merged — tocEntries contained no document entries');

  const result = saveAndDestroy(dst);
  console.log(`PDFs merged successfully by index (mupdf)`);
  return result;
}


/**
 * Merges two PDF documents into a single PDF.
 * Document B is grafted into document A and destroyed; A is saved and destroyed.
 *
 * Drop-in replacement for mergeTwoPdfs in buntoolPages.js.
 *
 * @param {Uint8Array} pdfAbytes - First PDF document as Uint8Array
 * @param {Uint8Array} pdfBbytes - Second PDF document as Uint8Array
 * @returns {Uint8Array} The merged PDF as a Uint8Array
 */
export function mergeTwoPdfs(pdfAbytes, pdfBbytes) {
  const dst = mupdf.Document.openDocument(new Uint8Array(pdfAbytes), "application/pdf");
  const src = mupdf.Document.openDocument(new Uint8Array(pdfBbytes), "application/pdf");
  graftAllAndDestroy(dst, src);
  const result = saveAndDestroy(dst);
  console.log(`Two PDFs merged successfully (mupdf)`);
  return result;
}


// --- worker-based versions ---
// Each spawns a fresh Worker instance, transfers data, and terminates the worker
// on completion. The worker's entire mupdf wasm heap is freed on termination.

const WORKER_URL = new URL('./workers/buntoolMergeWorker.js', import.meta.url);

// Worker peak memory readings from the most recent bundle run.
// Keyed by op name ('mergePdfsByTOC', 'mergeTwoPdfs').
// Useful for memtest: the main thread's performance.memory doesn't include worker heaps.
export const workerPeaks = {};

/**
 * Runs mergePdfsByTOC inside a dedicated worker.
 * Reads all source files to ArrayBuffers on the main thread, transfers them
 * to the worker (zero-copy), and terminates the worker after receiving the result.
 *
 * @param {Array<Object>} tocEntries
 * @param {Map<string, File>} filesMap
 * @param {Object} config
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfsByTOCViaWorker(tocEntries, filesMap, config) {
  const printable = config.getOption('pageOptions.printableBundle');

  // Read all source files to ArrayBuffers. Section breaks have no file, so skip them.
  // .arrayBuffer() returns a copy — the File objects in filesMap remain intact for re-bundling.
  const fileEntries = [];
  const transferables = [];
  for (const entry of tocEntries) {
    if (entry.sectionBreak) continue;
    const file = filesMap.get(entry.filename);
    if (!file) throw new Error(`File not found in filesMap: ${entry.filename}`);
    const buffer = await file.arrayBuffer();
    fileEntries.push({ filename: entry.filename, buffer });
    transferables.push(buffer);
  }

  return runWorkerOp(
    { op: 'mergePdfsByTOC', fileEntries, printable },
    transferables
  );
}

/**
 * Runs mergeTwoPdfs inside a dedicated worker.
 * Transfers both input buffers to the worker (zero-copy); caller must not use
 * the original Uint8Arrays after this call.
 *
 * @param {Uint8Array} pdfAbytes
 * @param {Uint8Array} pdfBbytes
 * @returns {Promise<Uint8Array>}
 */
export function mergeTwoPdfsViaWorker(pdfAbytes, pdfBbytes) {
  // Ensure both inputs have their own backing buffer before transferring.
  // (Slicing is free if the Uint8Array already owns its buffer, and safe if it doesn't.)
  const bufA = pdfAbytes.buffer.byteLength === pdfAbytes.byteLength
    ? pdfAbytes.buffer : pdfAbytes.slice().buffer;
  const bufB = pdfBbytes.buffer.byteLength === pdfBbytes.byteLength
    ? pdfBbytes.buffer : pdfBbytes.slice().buffer;

  return runWorkerOp(
    { op: 'mergeTwoPdfs', bufA, bufB },
    [bufA, bufB]
  );
}

/**
 * Spawns a merge worker, posts a message with transferables, waits for the
 * result, then terminates the worker.
 *
 * @param {Object} message
 * @param {Transferable[]} transferables
 * @returns {Promise<Uint8Array>}
 */
function runWorkerOp(message, transferables) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data?.ready) {
        // Worker has finished loading — now safe to send work
        worker.postMessage(message, transferables);
        return;
      }
      worker.terminate();
      if (e.data?.workerPeakMB != null) workerPeaks[message.op] = e.data.workerPeakMB;
      if (e.data?.error) { const err = new Error(e.data.error); if (e.data.stack) err.stack = e.data.stack; reject(err); }
      else resolve(e.data.result);
    };

    worker.onerror = (e) => {
      console.error('[MergeWorker] onerror:', e.message, e);
      worker.terminate();
      reject(new Error(e.message ?? 'Worker error'));
    };

    worker.addEventListener('messageerror', (e) => {
      console.error('[MergeWorker] messageerror:', e);
      worker.terminate();
      reject(new Error('Worker messageerror'));
    });

    // Work message is sent after the worker signals {ready: true} — see onmessage above.
  });
}
