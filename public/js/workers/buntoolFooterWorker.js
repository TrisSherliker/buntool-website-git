/**
 * BunTool
 * Copyright (c) 2025-2026 Tris Sherliker (tris@sherliker.net)
 * Licensed under the Mozilla Public License Version 2.0.
 *
 * buntoolFooterWorker.js
 * Web Worker for pdf-lib-based page numbering.
 * Receives an ArrayBuffer (transferred), adds footer page numbers, returns result.
 */

console.log('[FooterWorker] script loading…');

import * as cantoopdfLib from 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.6.5/+esm';
import fontkit from 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm';

const pdflib = cantoopdfLib;

const FONT_CONFIG = {
  helvetica:   { url: '/fonts/arialalt/liberation-sans/LiberationSans-Regular.ttf' },
  times:       { url: '/fonts/timesalt/CharisSILR.ttf' },
  courier:     { standard: pdflib.StandardFonts.Courier },
  serif:       { url: '/fonts/serif/NotoSerif-Regular.ttf' },
  sansSerif:   { url: '/fonts/sans/static/PlusJakartaSans-Regular.ttf' },
  monospaced:  { url: '/fonts/mono/UbuntuMono-Regular.ttf' },
  traditional: { url: '/fonts/trad/EBGaramond-VariableFont_wght.ttf' },
};

async function loadFont(pdfDoc, fontName) {
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG.helvetica;
  if (fontConfig.standard) {
    return pdfDoc.embedFont(fontConfig.standard);
  }
  const fontBytes = await fetch(fontConfig.url).then(r => r.arrayBuffer());
  return pdfDoc.embedFont(fontBytes);
}

/**
 * @param {ArrayBuffer} buffer - transferred PDF bytes
 * @param {Object} cv - flat configValues dict keyed by config path strings
 * @returns {Promise<Uint8Array>}
 */
async function doAddPageNumbering(buffer, cv) {
  const pageNumberingStyle = cv['pageNumbering.numberingStyle'];
  const footerLabelText    = cv['pageNumbering.footerPrefix'] ?? '';
  const footerAlignment    = cv['pageNumbering.alignment'];
  const footerFont         = cv['pageNumbering.footerFont'];

  const pdfDoc = await pdflib.PDFDocument.load(new Uint8Array(buffer));
  const pages  = pdfDoc.getPages();
  pdfDoc.registerFontkit(fontkit);
  const textLabelFont = await loadFont(pdfDoc, footerFont);

  let textLabelSize = ({ large: 25, medium: 18, small: 14 })[cv['pageNumbering.footerFontSize']] || 18;

  const totalPageCount    = pages.length;
  const widestDummyNumber = '8'.repeat(totalPageCount.toString().length);

  const labelFormats = {
    PageX:    `Page ${widestDummyNumber}`,
    PageXofY: `Page ${widestDummyNumber} of ${widestDummyNumber}`,
    X:        `${widestDummyNumber}`,
    XofY:     `${widestDummyNumber} of ${widestDummyNumber}`,
    XslashY:  `${widestDummyNumber}/${widestDummyNumber}`,
  };
  const longestLabel = `${footerLabelText} ${labelFormats[pageNumberingStyle] || labelFormats.PageX}`;
  let maxLabelWidth  = textLabelFont.widthOfTextAtSize(longestLabel, textLabelSize);
  let maxLabelHeight = textLabelFont.heightAtSize(textLabelSize);

  const a4Width = 595.28;
  while (maxLabelWidth > (2 * a4Width / 3)) {
    textLabelSize -= 1;
    maxLabelWidth  = textLabelFont.widthOfTextAtSize(longestLabel, textLabelSize);
    maxLabelHeight = textLabelFont.heightAtSize(textLabelSize);
  }

  const colourMap = {
    black: pdflib.rgb(0.072, 0.021, 0.073),
    red:   pdflib.rgb(0.872, 0.032, 0.101),
    blue:  pdflib.rgb(0.083, 0.221, 0.873),
  };
  const footerColour = colourMap[cv['pageNumbering.pageNumberColour']] ?? colourMap.black;

  for (const [pageIdx, thisPage] of pages.entries()) {
    const footerTextFormats = {
      PageX:    `Page ${pageIdx + 1}`,
      PageXofY: `Page ${pageIdx + 1} of ${totalPageCount}`,
      X:        `${pageIdx + 1}`,
      XofY:     `${pageIdx + 1} of ${totalPageCount}`,
      XslashY:  `${pageIdx + 1}/${totalPageCount}`,
    };
    const baseFooterText = footerTextFormats[pageNumberingStyle] || footerTextFormats.PageX;
    const footerText = `​​${footerLabelText ? `${footerLabelText} ` : ''}${baseFooterText}`;

    const marginSidePadding = 30;
    const { width, height } = thisPage.getSize();
    const rotation = thisPage.getRotation().angle;
    const footerAxisSize = (rotation === 90 || rotation === 270) ? height : width;

    let leftEdgeOfLabel;
    if (footerAlignment === 'left') {
      leftEdgeOfLabel = marginSidePadding;
    } else if (footerAlignment === 'right') {
      leftEdgeOfLabel = footerAxisSize - maxLabelWidth - marginSidePadding;
    } else if (footerAlignment === 'center' || footerAlignment === 'centre') {
      const actualLabelWidth = textLabelFont.widthOfTextAtSize(footerText, textLabelSize);
      leftEdgeOfLabel = (footerAxisSize - actualLabelWidth) / 2;
    } else {
      leftEdgeOfLabel = footerAxisSize - maxLabelWidth - 5;
    }

    if (rotation === 90) {
      thisPage.drawText(footerText, { x: width - maxLabelHeight, y: leftEdgeOfLabel,                  size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(90)  });
    } else if (rotation === 270) {
      thisPage.drawText(footerText, { x: maxLabelHeight,         y: footerAxisSize - leftEdgeOfLabel, size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(-90) });
    } else if (rotation === 180) {
      thisPage.drawText(footerText, { x: footerAxisSize - leftEdgeOfLabel, y: height - maxLabelHeight, size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(180) });
    } else {
      thisPage.drawText(footerText, { x: leftEdgeOfLabel,        y: maxLabelHeight,                   size: textLabelSize, font: textLabelFont, color: footerColour });
    }
  }

  console.log('[FooterWorker] page numbering applied');
  const saveResult = await pdfDoc.save();
  return saveResult.slice(); // ensure owned buffer before transfer
}

console.log('[FooterWorker] ready');
self.postMessage({ ready: true });

self.addEventListener('message', async (e) => {
  console.log('[FooterWorker] onmessage received');
  const { buffer, configValues } = e.data;

  let workerPeakBytes = performance?.memory?.usedJSHeapSize ?? null;
  const peakPoll = setInterval(() => {
    const b = performance?.memory?.usedJSHeapSize;
    if (b != null && b > (workerPeakBytes ?? 0)) workerPeakBytes = b;
  }, 50);

  try {
    const result = await doAddPageNumbering(buffer, configValues);
    clearInterval(peakPoll);
    const finalSample = performance?.memory?.usedJSHeapSize ?? null;
    if (finalSample != null && finalSample > (workerPeakBytes ?? 0)) workerPeakBytes = finalSample;
    const workerPeakMB = workerPeakBytes != null ? workerPeakBytes / (1024 * 1024) : null;
    self.postMessage({ result, workerPeakMB }, [result.buffer]);
  } catch (err) {
    clearInterval(peakPoll);
    console.error('[FooterWorker] error:', err);
    self.postMessage({ error: err.message });
  }
});
