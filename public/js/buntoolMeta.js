/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net)
 * A tool for the creation  of legal bundles.
 * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 * 
 * buntoolMeta.js
 * This module handles metadata functions like tag setting, hyperlinking and annotation. Uses mupdf-wasm's useful features.
 */

import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.27.0/dist/mupdf.js'
import Config from './buntoolConfig.js';



/**
 * Groups table row coordinates by page number for hyperlink creation.
 * @param {Array<Object>} rows - Array of row objects with pageNumber property
 * @returns {Object} Object mapping page numbers to arrays of row coordinates
 */
function groupRowsByPage(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.pageNumber]) acc[row.pageNumber] = [];
    acc[row.pageNumber].push(row);
    return acc;
  }, {});
}

/**
 * Formats a TOC entry title according to the config outline item style.
 * @param {Object} entry - TOC entry object containing title, date, and page information
 * @param {Config} config - Configuration object containing outline item style preference
 * @returns {string} Formatted outline item text
 */
function formatOutlineItem(entry, config) {
  const style = config.getOption('index.outlineItemStyle');
  const title = entry.title;
  const date = entry.date;
  const page = entry.actualStartPage ? entry.actualStartPage : entry.thisPage; // fallback to thisPage if actualStartPage is not set (e.g. for section breaks)

  switch (style) {
    case 'withPage':
      return `${title} - pg. ${page}`;

    case 'withDate':
      return date
        ? `${title} (${date})`
        : title;

    case 'withDateandPage':
      return date
        ? `${title} - (${date}) - pg ${page}`
        : `${title}  -pg. ${page}`;

    case 'plain':
    default:
      return title;
  }
}

/**
 * Copies a single page from a source PDF document to a destination PDF document.
 * Uses muPDF API for grafting objects between documents.
 * @param {Object} dstDoc - Destination muPDF document object
 * @param {Object} srcDoc - Source muPDF document object
 * @param {number} pageNumber - Zero-indexed page number to copy
 * @param {Object} dstFromSrc - muPDF graft map for object copying
 */
function copyPage(dstDoc, srcDoc, pageNumber, dstFromSrc) {
  const srcPage = srcDoc.findPage(pageNumber)
  const dstPage = dstDoc.newDictionary()
  dstPage.put("Type", dstDoc.newName("Page"))
  if (srcPage.get("MediaBox"))
    dstPage.put("MediaBox", dstFromSrc.graftObject(srcPage.get("MediaBox")))
  if (srcPage.get("Rotate"))
    dstPage.put("Rotate", dstFromSrc.graftObject(srcPage.get("Rotate")))
  if (srcPage.get("Resources"))
    dstPage.put("Resources", dstFromSrc.graftObject(srcPage.get("Resources")))
  if (srcPage.get("Contents"))
    dstPage.put("Contents", dstFromSrc.graftObject(srcPage.get("Contents")))
  dstDoc.insertPage(-1, dstDoc.addObject(dstPage))
}

/**
 * Copies all pages from a source PDF document to a destination PDF document. Dead code but useful for testing and dev.
 * Uses muPDF API for grafting objects between documents.
 * @param {Object} dstDoc - Destination muPDF document object
 * @param {Object} srcDoc - Source muPDF document object
 */
/**
 * Validates a PDF by attempting to open and read it with MuPDF.
 * @param {Uint8Array} pdfBytes - File bytes to validate
 * @returns {boolean} True if MuPDF can open and page-count the document
 */
export function validatePdf(pdfBytes) {
  try {
    const doc = mupdf.Document.openDocument(new Uint8Array(pdfBytes), "application/pdf");
    doc.countPages();
    doc.destroy();
    return true;
  } catch {
    return false;
  }
}

export function copyAllPages(dstDoc, srcDoc) {
  const dstFromSrc = dstDoc.newGraftMap()
  const n = srcDoc.countPages()
  for (let k = 0; k < n; ++k)
    copyPage(dstDoc, srcDoc, k, dstFromSrc)
}


/**
 * Adds clickable hyperlinks to TOC entries that navigate to their corresponding pages.
 * @param {Uint8Array} pdfBytes - The PDF document as a Uint8Array
 * @param {Array<Object>} tocTableRowCoordinates - Array of row coordinate objects with position and dimensions
 * @param {Array<Object>} tocEntries - Array of TOC entry objects containing page references
 * @returns {Uint8Array} The PDF with hyperlinks added as a Uint8Array
 */
export function addHyperlinks(pdfBytes, tocTableRowCoordinates, tocEntries, config = null) {
  const pts = (72 / 25.4); //jspdf outputs mm on creation, but mupdf uses pts
  const rowsByPage = groupRowsByPage(tocTableRowCoordinates);
  const coversheetOffset = config?.getOption('pageOptions.coversheet') ? 1 : 0;

  let doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  for (const [pageNumber, rows] of Object.entries(rowsByPage)) {
    const page = doc.loadPage(pageNumber - 1 + coversheetOffset);
    for (const row of rows) {
      const { x, y, width, height, tabNumber} = row;
      const tocEntry = tabNumber
        ? tocEntries.find(entry => entry.tabNumber === tabNumber) : null //blank for section beaks, no hyperlink needed
      if (!tocEntry) continue; // skip if no matching TOC entry is found
      const destinationPageNumber = (tocEntry.actualStartPage || tocEntry.thisPage) - 1; // mupdf pages are 0-indexed

      page.createLink(
        [x * pts, y * pts, x * pts + width * pts, y * pts + height * pts],
        doc.formatLinkURI(
          {
            type: "XYZ",
            page: destinationPageNumber,
            x: 0,
            y: 0,
            zoom: 100
          }
        )
      );
    }
    page.update();
    page.destroy();
  }
  console.log(`Hyperlinks added`);
  const buf = doc.saveToBuffer("incremental");
  const outputPdf = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return outputPdf;
}



/**
 * Adds PDF outline (bookmark) items for navigation.
 * Creates an index entry and individual bookmarks for each TOC entry.
 * @param {Uint8Array} pdfBytes - The PDF document as a Uint8Array
 * @param {Array<Object>} tocEntries - Array of TOC entry objects
 * @param {Config} config - Configuration object
 * @returns {Uint8Array} The PDF with outline items added as a Uint8Array
 */
export function addOutlineItems(pdfBytes, tocEntries, config) {

  let doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  const outlineIterator = doc.outlineIterator();
  const coversheetOffset = config.getOption('pageOptions.coversheet') ? 1 : 0;
  // find how many digits in the largest tab number for padding
  const validTabNumbers = tocEntries.map(e => e.tabNumber).filter(n => typeof n === 'number');
  const maxTabNumber = validTabNumbers.length > 0 ? Math.max(...validTabNumbers) : 1;
  const maxTabNumberLength = maxTabNumber.toString().length;

  // outline item for index
  outlineIterator.insert({
    title: `[${"0".toString().padStart(maxTabNumberLength, '0')}] Index`,
    open: true,
    uri: doc.formatLinkURI({
      page: coversheetOffset,
      type: "XYZ",
      zoom: 100
    })
  });

  // outline item for each document

  
  tocEntries.forEach(entry => {
    const formattedTitle = formatOutlineItem(entry, config);
    const outlinePage = (entry.actualStartPage || entry.thisPage) - 1; // mupdf pages are 0-indexed
    if (entry.sectionBreak) {
        outlineIterator.insert({
        title: `${formattedTitle}`,
        open: true,
        uri: doc.formatLinkURI({
          page: outlinePage,
          type: "XYZ",
          x: 0,
          y: 0,
          zoom: 100
        })
      });
    } else {
      outlineIterator.insert({
        title: `[${entry.tabNumber.toString().padStart(maxTabNumberLength, '0')}] ${formattedTitle}`,
        open: true,
        uri: doc.formatLinkURI({
          page: outlinePage,
          type: "XYZ",
          x: 0,
          y: 0,
          zoom: 100
        })
      });
    }
  });

  outlineIterator.destroy();
  console.log(`Outline items added`);
  const buf = doc.saveToBuffer("incremental");
  const outputPdf = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return outputPdf;
}

/**
 * Sets PDF metadata including title, subject, producer, and custom bundle index data.
 * @param {Uint8Array} pdfBytes - The PDF document as a Uint8Array
 * @param {Array<Object>} tocEntries - Array of TOC entry objects to store as metadata
 * @param {Config} config - Configuration object containing heading and project information
 * @returns {Uint8Array} The PDF with metadata set as a Uint8Array
 */
export function setMetadata(pdfBytes, tocEntries, config) {
  let doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  doc.setMetaData("Producer", "BunTool (https://buntool.co.uk)");
  doc.setMetaData("Creator", "BunTool (https://buntool.co.uk)");
  doc.setMetaData(
    "Title",
    config.getOption('heading.confidential')
      ? `CONFIDENTIAL ${config.getOption('heading.bundleTitle')}`
      : config.getOption('heading.bundleTitle')
  );
  doc.setMetaData(
    "Subject",
    config.getOption('heading.projectName')
      ? config.getOption('heading.projectName')
      : ""
  );
  doc.setMetaData(
    "Keywords",
    config.getOption('heading.claimNumber')
      ? config.getOption('heading.claimNumber')
      : ""
  );

  // add custom document metadata field "Bundle Index" which stores tocEntries object:
  const buntoolIndexMetadata = tocEntries.map(entry => ({
    // new index property for ordering (based on position within tocEntries):
    index:  tocEntries.indexOf(entry),
    tab: entry.sectionBreak ? null : entry.tabNumber,
    title: entry.title,
    date: entry.sectionBreak ? null : entry.date,
    section: entry.sectionBreak ? true : false,
    // Use actualStartPage (includes TOC offset) instead of thisPage
    page: entry.sectionBreak ? null : (entry.actualStartPage || entry.thisPage),
    // make new filename to avoid betraying data:
    filename: entry.sectionBreak ? null : `${entry.tabNumber}. ${entry.title} (${entry.date}).pdf`
  }));
  // Store only config in info:BundleIndex (entries are in the annotation below).
  // mupdf getMetaData truncates at ~500 chars; config alone is ~290 chars and fits safely.
  doc.setMetaData("info:BundleIndex", JSON.stringify({
    version: 2,
    config: {
      heading: {
        claimNumber: config.getOption('heading.claimNumber') || '',
        bundleTitle: config.getOption('heading.bundleTitle') || '',
        projectName: config.getOption('heading.projectName') || '',
        confidential: config.getOption('heading.confidential') || false,
      },
      pageNumbering: {
        footerFont: config.getOption('pageNumbering.footerFont') || 'serif',
        alignment: config.getOption('pageNumbering.alignment') || 'centre',
        numberingStyle: config.getOption('pageNumbering.numberingStyle') || 'PageX',
        footerPrefix: config.getOption('pageNumbering.footerPrefix') || '',
      },
      index: {
        fontFace: config.getOption('index.fontFace') || 'serif',
        dateStyle: config.getOption('index.dateStyle') || 'DD Mon. YYYY',
        outlineItemStyle: config.getOption('index.outlineItemStyle') || 'plain',
      },
      pageOptions: {
        printableBundle: config.getOption('pageOptions.printableBundle') ?? false,
        coversheet: config.getOption('pageOptions.coversheet') ?? false,
      },
    },
  }));

  // add invisibile annotation to first page which stores buntoolIndex as metadata (the annot itself is empty):  
  const firstPage = doc.loadPage(0);
  const metadataAnnotation = firstPage.createAnnotation("FreeText")
  metadataAnnotation.setContents(`BundleIndexData: ${JSON.stringify(buntoolIndexMetadata)}`);
  metadataAnnotation.setRect([0, 0, 0, 0]); // set to zero size
  metadataAnnotation.setOpacity(0) // set to transparent
  metadataAnnotation.setFlags(2) // set to hidden
  metadataAnnotation.setHiddenForEditing(true)
  firstPage.destroy();

  console.log(`Metadata added`);
  const buf = doc.saveToBuffer("incremental");
  const outputPdf = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return outputPdf;
}


// --- worker-based version ---

const META_WORKER_URL = new URL('./workers/buntoolMetaWorker.js', import.meta.url);

// Worker peak reading from the most recent meta worker run (mupdf wasm heap — likely 0 in performance.memory).
export const metaWorkerPeaks = {};

/**
 * Runs addHyperlinks → addOutlineItems → setMetadata inside a single dedicated worker.
 * Transfers the input buffer to the worker (zero-copy).
 * Sends interim { progress } messages between stages for UI updates.
 *
 * @param {Uint8Array} pdfBytes
 * @param {Array<Object>} tocTableRowCoordinates
 * @param {Array<Object>} tocEntries
 * @param {Object} config - BunTool Config instance
 * @param {Function} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export function runMetaViaWorker(pdfBytes, tocTableRowCoordinates, tocEntries, config, onProgress) {
  const configValues = {
    'pageOptions.coversheet':        config.getOption('pageOptions.coversheet'),
    'pageOptions.printableBundle':   config.getOption('pageOptions.printableBundle'),
    'index.outlineItemStyle':        config.getOption('index.outlineItemStyle'),
    'index.fontFace':                config.getOption('index.fontFace'),
    'index.dateStyle':               config.getOption('index.dateStyle'),
    'heading.confidential':          config.getOption('heading.confidential'),
    'heading.bundleTitle':           config.getOption('heading.bundleTitle'),
    'heading.projectName':           config.getOption('heading.projectName'),
    'heading.claimNumber':           config.getOption('heading.claimNumber'),
    'pageNumbering.footerFont':      config.getOption('pageNumbering.footerFont'),
    'pageNumbering.alignment':       config.getOption('pageNumbering.alignment'),
    'pageNumbering.numberingStyle':  config.getOption('pageNumbering.numberingStyle'),
    'pageNumbering.footerPrefix':    config.getOption('pageNumbering.footerPrefix'),
  };

  const buf = pdfBytes.buffer.byteLength === pdfBytes.byteLength
    ? pdfBytes.buffer : pdfBytes.slice().buffer;

  return new Promise((resolve, reject) => {
    const worker = new Worker(META_WORKER_URL, { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data?.ready) {
        worker.postMessage({ buffer: buf, tocTableRowCoordinates, tocEntries, configValues }, [buf]);
        return;
      }
      if (e.data?.progress) {
        onProgress?.(e.data.progress);
        return;
      }
      worker.terminate();
      if (e.data?.workerPeakMB != null) metaWorkerPeaks.meta = e.data.workerPeakMB;
      if (e.data?.error) reject(new Error(e.data.error));
      else resolve(e.data.result);
    };

    worker.onerror = (e) => {
      console.error('[MetaWorker] onerror:', e.message, e);
      worker.terminate();
      reject(new Error(e.message ?? 'Worker error'));
    };

    worker.addEventListener('messageerror', (e) => {
      console.error('[MetaWorker] messageerror:', e);
      worker.terminate();
      reject(new Error('Worker messageerror'));
    });
  });
}
