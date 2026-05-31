/**
 * BunTool
 * Copyright (c) 2025-2026 Tris Sherliker (tris@sherliker.net)
 * Licensed under the Mozilla Public License Version 2.0.
 *
 * buntoolMetaWorker.js
 * Web Worker for mupdf-based metadata operations.
 * Runs addHyperlinks → addOutlineItems → setMetadata in sequence on a single
 * transferred ArrayBuffer, sending interim { progress } messages between stages.
 */

console.log('[MetaWorker] script loading…');

import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.27.0/dist/mupdf.js';
import { BUNTOOL_VERSION } from '../buntoolVersion.js';

console.log('[MetaWorker] mupdf imported, ready =', typeof mupdf.ready);


// --- helpers ---

function groupRowsByPage(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.pageNumber]) acc[row.pageNumber] = [];
    acc[row.pageNumber].push(row);
    return acc;
  }, {});
}

function formatOutlineItem(entry, section, cv) {
  const style = cv['index.outlineItemStyle'];
  const { title, date } = entry;
  const page = cv['pageNumbering.pageNumberPerSection']
    ? `${section?.sectionLabel || ''}${entry.beginsOnPageOfSection}`
    : (entry.actualPdfStartPageWithToc ?? entry.beginsOnPdfPage);
  switch (style) {
    case 'withPage':        return `${title} - pg. ${page}`;
    case 'withDate':        return date ? `${title} (${date})` : title;
    case 'withDateandPage': return date ? `${title} - (${date}) - pg ${page}` : `${title} - pg. ${page}`;
    case 'plain':
    default:                return title;
  }
}


// --- operations (same logic as buntoolMeta.js, using cv dict instead of config.getOption) ---

function doAddHyperlinks(pdfBytes, tocTableRowCoordinates, tocEntries, cv) {
  const pts = 72 / 25.4;
  const rowsByPage = groupRowsByPage(tocTableRowCoordinates);
  const coversheetOffset = cv['pageOptions.coversheet'] ? 1 : 0;

  const entryByTabNumber = new Map();
  for (const section of tocEntries) {
    for (const entry of section.entries) entryByTabNumber.set(entry.tabNumber, entry);
  }

  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf');
  for (const [pageNumber, rows] of Object.entries(rowsByPage)) {
    const page = doc.loadPage(Number(pageNumber) - 1 + coversheetOffset);
    for (const row of rows) {
      const { x, y, width, height, tabNumber } = row;
      const tocEntry = tabNumber ? entryByTabNumber.get(tabNumber) : null;
      if (!tocEntry) continue;
      const destinationPageNumber = (tocEntry.actualPdfStartPageWithToc || tocEntry.beginsOnPdfPage) - 1;
      page.createLink(
        [x * pts, y * pts, x * pts + width * pts, y * pts + height * pts],
        doc.formatLinkURI({ type: 'XYZ', page: destinationPageNumber, x: 0, y: 0, zoom: 100 })
      );
    }
    page.update();
    page.destroy();
  }
  console.log('[MetaWorker] hyperlinks added');
  const buf = doc.saveToBuffer('incremental');
  const result = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return result;
}

function doAddOutlineItems(pdfBytes, tocEntries, cv) {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf');
  const outlineIterator = doc.outlineIterator();
  const coversheetOffset = cv['pageOptions.coversheet'] ? 1 : 0;

  let maxTabNumber = 0;
  for (const section of tocEntries) {
    for (const entry of section.entries) {
      if (entry.tabNumber > maxTabNumber) maxTabNumber = entry.tabNumber;
    }
  }
  const maxTabNumberLength = maxTabNumber > 0 ? maxTabNumber.toString().length : 1;

  outlineIterator.insert({
    title: `[${'0'.padStart(maxTabNumberLength, '0')}] Index`,
    open: true,
    uri: doc.formatLinkURI({ page: coversheetOffset, type: 'XYZ', zoom: 100 }),
  });

  for (const section of tocEntries) {
    if (section.sectionID !== '0000') {
      const sectionTitle = [section.sectionLabel, section.sectionTitle].filter(Boolean).join(': ') || `Section ${section.sectionNumber}`;
      const outlinePage = (section.actualPdfStartPageWithToc || section.beginsOnPdfPage) - 1;
      outlineIterator.insert({
        title: sectionTitle,
        open: true,
        uri: doc.formatLinkURI({ page: outlinePage, type: 'XYZ', x: 0, y: 0, zoom: 100 }),
      });
    }
    for (const entry of section.entries) {
      const formattedTitle = formatOutlineItem(entry, section, cv);
      const outlinePage = (entry.actualPdfStartPageWithToc || entry.beginsOnPdfPage) - 1;
      outlineIterator.insert({
        title: `[${entry.tabNumber.toString().padStart(maxTabNumberLength, '0')}] ${formattedTitle}`,
        open: true,
        uri: doc.formatLinkURI({ page: outlinePage, type: 'XYZ', x: 0, y: 0, zoom: 100 }),
      });
    }
  }

  outlineIterator.destroy();
  console.log('[MetaWorker] outline items added');
  const buf = doc.saveToBuffer('incremental');
  const result = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return result;
}

function doSetMetadata(pdfBytes, tocEntries, cv) {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf');

  doc.setMetaData('Producer', `BunTool v${BUNTOOL_VERSION} (https://buntool.co.uk)`);
  doc.setMetaData('Creator',  `BunTool v${BUNTOOL_VERSION} (https://buntool.co.uk)`);
  doc.setMetaData('Title',
    cv['heading.confidential']
      ? `CONFIDENTIAL ${cv['heading.bundleTitle']}`
      : cv['heading.bundleTitle']
  );
  doc.setMetaData('Subject',  cv['heading.projectName']  || '');
  doc.setMetaData('Keywords', cv['heading.claimNumber']  || '');

  const buntoolIndexMetadata = tocEntries.map(section => ({
    sectionID:    section.sectionID,
    sectionLabel: section.sectionLabel || '',
    sectionName:  section.sectionTitle || '',
    files: section.entries.map(entry => ({
      tab:      entry.tabNumber,
      filename: entry.filename,
      title:    entry.title,
      date:     entry.date,
      page:     entry.actualPdfStartPageWithToc || entry.beginsOnPdfPage,
    })),
  }));

  doc.setMetaData('info:BundleIndex', JSON.stringify({
    version: 2,
    softwareVersion: BUNTOOL_VERSION,
    config: {
      heading: {
        claimNumber:  cv['heading.claimNumber']  || '',
        bundleTitle:  cv['heading.bundleTitle']  || '',
        projectName:  cv['heading.projectName']  || '',
        confidential: cv['heading.confidential'] || false,
      },
      pageNumbering: {
        footerFont:     cv['pageNumbering.footerFont']     || 'serif',
        alignment:      cv['pageNumbering.alignment']      || 'centre',
        numberingStyle: cv['pageNumbering.numberingStyle'] || 'PageX',
        footerPrefix:   cv['pageNumbering.footerPrefix']   || '',
      },
      index: {
        fontFace:         cv['index.fontFace']         || 'serif',
        dateStyle:        cv['index.dateStyle']        || 'DD Mon. YYYY',
        outlineItemStyle: cv['index.outlineItemStyle'] || 'plain',
      },
      pageOptions: {
        printableBundle: cv['pageOptions.printableBundle'] ?? false,
        coversheet:      cv['pageOptions.coversheet']      ?? false,
      },
    },
  }));

  const firstPage = doc.loadPage(0);
  const metadataAnnotation = firstPage.createAnnotation('FreeText');
  metadataAnnotation.setContents(`BundleIndexData v${BUNTOOL_VERSION}: ${JSON.stringify(buntoolIndexMetadata)}`);
  metadataAnnotation.setRect([0, 0, 0, 0]);
  metadataAnnotation.setOpacity(0);
  metadataAnnotation.setFlags(2);
  metadataAnnotation.setHiddenForEditing(true);
  firstPage.destroy();

  console.log('[MetaWorker] metadata added');
  const buf = doc.saveToBuffer('incremental');
  const result = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return result;
}


// Signal ready before installing message handler.
self.postMessage({ ready: true });

self.addEventListener('message', async (e) => {
  console.log('[MetaWorker] onmessage received');
  try { if (mupdf.ready) await mupdf.ready; } catch {}

  const { buffer, tocTableRowCoordinates, tocEntries, configValues } = e.data;

  let workerPeakBytes = performance?.memory?.usedJSHeapSize ?? null;
  const peakPoll = setInterval(() => {
    const b = performance?.memory?.usedJSHeapSize;
    if (b != null && b > (workerPeakBytes ?? 0)) workerPeakBytes = b;
  }, 50);

  try {
    let bytes = new Uint8Array(buffer);

    bytes = doAddHyperlinks(bytes, tocTableRowCoordinates, tocEntries, configValues);
    self.postMessage({ progress: 'Adding bookmarks…' });

    bytes = doAddOutlineItems(bytes, tocEntries, configValues);
    self.postMessage({ progress: 'Preparing file for save…' });

    bytes = doSetMetadata(bytes, tocEntries, configValues);

    clearInterval(peakPoll);
    const finalSample = performance?.memory?.usedJSHeapSize ?? null;
    if (finalSample != null && finalSample > (workerPeakBytes ?? 0)) workerPeakBytes = finalSample;
    const workerPeakMB = workerPeakBytes != null ? workerPeakBytes / (1024 * 1024) : null;

    self.postMessage({ result: bytes, workerPeakMB }, [bytes.buffer]);
  } catch (err) {
    clearInterval(peakPoll);
    console.error('[MetaWorker] error:', err);
    self.postMessage({ error: err.message, stack: err.stack });
  }
});
