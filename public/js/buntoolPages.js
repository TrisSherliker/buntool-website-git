/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net)
 * A tool for the creation  of legal bundles.
 *  * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 * 
 * buntoolPages.js
 * This module handles manipulation of existing pages using pdf-lib to merge, edit etc.
 */

import * as cantoopdfLib from 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.6.5/+esm'
import fontkit from 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm'
import Config from './buntoolConfig.js';

const pdflib = cantoopdfLib;

/**
 * Font configuration mapping for embedding fonts in PDFs.
 * Fonts are either 'standard' or loaded from a URL. 
 */
const FONT_CONFIG = {
    helvetica: { url: '/fonts/arialalt/liberation_sans/LiberationSans-Regular.ttf'},
    times: { url: '/fonts/timesalt/CharisSILR.ttf' },
    courier: { standard: pdflib.StandardFonts.Courier },
    serif: { url: '/fonts/serif/NotoSerif-Regular.ttf' },
    sansSerif: { url: '/fonts/sans/static/PlusJakartaSans-Regular.ttf' },
    monospaced: { url: '/fonts/mono/UbuntuMono-Regular.ttf' },
    traditional: { url: '/fonts/trad/EBGaramond-VariableFont_wght.ttf' },
};

async function loadFontBytes(pdfDoc, fontName) {
  const fontConfig = FONT_CONFIG[fontName] || FONT_CONFIG['helvetica'];
  if (fontConfig.standard) {
    return await pdfDoc.embedFont(fontConfig.standard);
  } else if (fontConfig.url) {
    const fontBytes = await fetch(fontConfig.url).then(res => res.arrayBuffer());
    return await pdfDoc.embedFont(fontBytes);
  }
}

/**
 * Creates a single actually-blank PDF page with no content.
 * Used for printable bundle mode to ensure proper double-sided alignment.
 * @returns {Promise<Uint8Array>} A single-page blank PDF as a Uint8Array
 */
async function makeBlankPage() {
  const blankPdf = await pdflib.PDFDocument.create();
  blankPdf.addPage([595.28, 841.89]); // A4 size in points
  return blankPdf.save();
}

/**
 * Creates a single 'blank' PDF page with "This page intentionally left blank" text. Unused in current implementation but 
 * to be developed into a config option.
 * @returns {Promise<Uint8Array>} A single-page blank PDF as a Uint8Array
 */
async function makeIntentionallyBlankPage () {
  const blankPage = await pdflib.PDFDocument.create();
  const page = blankPage.addPage([595.28, 841.89]); // A4 size in points
  page.drawText('This page intentionally left blank.', {
    x: 50,
    y: 400,
    size: 12,
    color: pdflib.rgb(0, 0, 0),
  });
  return blankPage.save();
}


/**
 * Counts the number of pages in a PDF file.
 * @param {File} file - The PDF file to count pages from
 * @returns {Promise<number>} The number of pages in the PDF
 */
export async function countPdfPages(file) {
  const pdfBytes = await file.arrayBuffer();
  const pdfDoc = await pdflib.PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

/**
 * Validates a coversheet PDF and returns its first page as a Uint8Array.
 * If the file has more than one page, only the first page is extracted.
 * @param {File} file - The PDF file to use as a coversheet
 * @returns {Promise<Uint8Array>} The first page of the PDF as a Uint8Array
 * @throws {Error} If the file cannot be loaded as a valid PDF
 */
export async function validateCoverPage(file) {
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const inputPdf = await pdflib.PDFDocument.load(pdfBytes);
  if (inputPdf.getPageCount() === 1) {
    return pdfBytes;
  }
  const singlePagePdf = await pdflib.PDFDocument.create();
  const [firstPage] = await singlePagePdf.copyPages(inputPdf, [0]);
  singlePagePdf.addPage(firstPage);
  return new Uint8Array(await singlePagePdf.save());
}

/**
 * Merges multiple PDF files according to the order specified in the TOC entries.
 * @param {Array<Object>} indexData - Array of TOC entry objects containing filename and metadata (and section headers)
 * @param {Map<string, File>} filesMap - Map of filenames to File objects
 * @param {Config} config - Configuration object containing pageOptions.printableBundle flag
 * @returns {Promise<Uint8Array>} The merged PDF as a Uint8Array
 * @throws {Error} If a file is not found in filesMap or if PDF processing fails
 */
export async function mergePdfsByTOC(tocEntries, filesMap, config) {
  let mergedPdf = await pdflib.PDFDocument.create();
  const printable = config.getOption('pageOptions.printableBundle');
  console.log(`Starting PDF merge. tocEntries: `, tocEntries);
  for (const entry of tocEntries) {
    console.log(`Processing entry: '${entry.title}' (filename: '${entry.filename}')`);
    if (entry.sectionBreak) {
      // section headers don't correspond to files, so we skip them in the merging process
      console.log(`Skipping section header '${entry.title}' in PDF merging`);
    } 
    else {
      let pdfFile;
      try {
        pdfFile = filesMap.get(entry.filename);
        if (!pdfFile) {
          throw new Error(`File not found in filesMap: ${entry.filename}`);
        }
        const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
        const inputPdf = await pdflib.PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(inputPdf, inputPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));

        // Add blank page if printable mode is enabled and document has odd pages
        // (for printing double-sided allowing tab insertion)
        if (printable) {
          const pageCount = inputPdf.getPageCount();
          if (pageCount % 2 === 1) {
            console.log(`Adding blank page after '${entry.filename}' (${pageCount} pages)`);
            const blankPageBytes = await makeBlankPage();
            const blankPdf = await pdflib.PDFDocument.load(blankPageBytes);
            const [blankPage] = await mergedPdf.copyPages(blankPdf, [0]);
            mergedPdf.addPage(blankPage);
        }
      }

    } catch (error) {
      console.error(`[ERROR] Processing error for file:' ${entry.filename}: `, error);
      throw error;
      }
    }
  }
  const mergedPdfBytes = await mergedPdf.save();
  console.log(`PDFs merged successfully by index`);
  return mergedPdfBytes;
}



/**
 * Merges two PDF documents into a single PDF.
 * @param {Uint8Array} pdfAbytes - First PDF document as Uint8Array
 * @param {Uint8Array} pdfBbytes - Second PDF document as Uint8Array
 * @returns {Promise<Uint8Array>} The merged PDF as a Uint8Array
 */
export async function mergeTwoPdfs(pdfAbytes, pdfBbytes) {
  //the docs
  const mergedPdf = await pdflib.PDFDocument.create();
  const pdfA = await pdflib.PDFDocument.load(pdfAbytes);
  const pdfB = await pdflib.PDFDocument.load(pdfBbytes);
  // handle A
  const copiedPagesA = await mergedPdf.copyPages(pdfA, pdfA.getPageIndices());
  copiedPagesA.forEach((page) => mergedPdf.addPage(page));
  // handle B
  const copiedPagesB = await mergedPdf.copyPages(pdfB, pdfB.getPageIndices());
  copiedPagesB.forEach((page) => mergedPdf.addPage(page));
  // do the thing
  const mergedPdfBytes = await mergedPdf.save();
  console.log(`Two PDFs merged successfully`);
  return mergedPdfBytes;
}

/**
 * Adds page numbering to each page of a PDF document based on config.
 * @param {Uint8Array} pdfDocBytes - The PDF document as a Uint8Array
 * @param {Config} config - Configuration object containing page numbering options
 * @returns {Promise<Uint8Array>} The PDF with page numbers added as a Uint8Array
 */
export async function addPageNumberingToPdf(pdfDocBytes, config) {
  /* This adds a footer to each pdf page, containing the
  * page number with marking (in a configured style), preceded by
  * a prefix if specified.
  * Strategy: use PDF-lib to add a text label to each page.
  */
  const footerLabelText = config.getOption('pageNumbering.footerPrefix')
  const footerAlignment = config.getOption('pageNumbering.alignment')
  const pageNumberingStyle = config.getOption('pageNumbering.numberingStyle')
  const footerFont = config.getOption('pageNumbering.footerFont')
  
  if (pageNumberingStyle === "None") {
    console.log(`No page numbering applied`);
    return pdfDocBytes;
  }
  
  //setup the gubbins
  const pdfDoc = await pdflib.PDFDocument.load(pdfDocBytes);
  let textLabelFont = await pdfDoc.embedFont(pdflib.StandardFonts.Helvetica); 
  let fontBytes = [ ];
  const pages = pdfDoc.getPages();
  pdfDoc.registerFontkit(fontkit);

  textLabelFont = await loadFontBytes(pdfDoc, footerFont);

  //Measurements and sizes
  let textLabelSize = 18
  let totalPageCount = pages.length
  const widestDummyNumber = '8'.repeat(totalPageCount.toString().length); // how wide could the page numbers go? 8 is a big glyph

  // The longest theoreical label is footerLabelText + a big number:
  const labelFormats = {
    'PageX': `Page ${widestDummyNumber}`,
    'PageXofY': `Page ${widestDummyNumber} of ${widestDummyNumber}`,
    'X': `${widestDummyNumber}`,
    'XofY': `${widestDummyNumber} of ${widestDummyNumber}`,
    'XslashY': `${widestDummyNumber}/${widestDummyNumber}`
  };
  const longestLabel = `${footerLabelText} ${labelFormats[pageNumberingStyle] || labelFormats['PageX']}`;
  let maxLabelWidth = textLabelFont.widthOfTextAtSize(longestLabel, textLabelSize)
  let maxLabelHeight = textLabelFont.heightAtSize(textLabelSize)

  //if maxlabelwidth is wider than half the width of a standard a4 portrait page, try decreasing font sizes until it fits:
  const a4Width = 595.28; // A4 width in points
  if (maxLabelWidth > (2 * a4Width / 3)) {
    while (maxLabelWidth > (2 * a4Width / 3)) {
      textLabelSize -= 1;
      maxLabelWidth = textLabelFont.widthOfTextAtSize(longestLabel, textLabelSize);
      maxLabelHeight = textLabelFont.heightAtSize(textLabelSize);
    }
  }

  for (const [pageIdx, thisPage] of pages.entries()) {
    // Construct footer text
    const footerTextFormats = {
      'PageX': `Page ${pageIdx + 1}`,
      'PageXofY': `Page ${pageIdx + 1} of ${totalPageCount}`,
      'X': `${pageIdx + 1}`,
      'XofY': `${pageIdx + 1} of ${totalPageCount}`,
      'XslashY': `${pageIdx + 1}/${totalPageCount}`
    };
    const baseFooterText = footerTextFormats[pageNumberingStyle] || footerTextFormats['PageX'];
    //add zero-width spaces for later searchability, plus any footerLabelText prefix
    const footerText = `\u200B\u200B${footerLabelText ? `${footerLabelText} ` : ''}${baseFooterText}`;

    //alignment calcs
    const marginSidePadding = 30;
    const { width, height } = thisPage.getSize();
    const rotation = thisPage.getRotation().angle; // 0, 90, 180, 270
    const footerAxisSize = (rotation === 90 || rotation === 270) ? height : width; // footer runs along width normally, height when rotated 90/270
    let leftEdgeOfLabel;
    if (footerAlignment === "left") {
      leftEdgeOfLabel = marginSidePadding;
    } else if (footerAlignment === "right") {
      leftEdgeOfLabel = footerAxisSize - maxLabelWidth - marginSidePadding;
    } else if (footerAlignment === "center" || footerAlignment === "centre") {
      const actualLabelWidth = textLabelFont.widthOfTextAtSize(footerText, textLabelSize)
      leftEdgeOfLabel = ((footerAxisSize - actualLabelWidth) / 2);
    } else {
      leftEdgeOfLabel = footerAxisSize - maxLabelWidth - 5;
    }

    //apply text - position and rotation depend on page /Rotate flag
    const pageNumberColourSetting = config.getOption('pageNumbering.pageNumberColour');
    const colourMap = {
      black: pdflib.rgb(0.072, 0.021, 0.073),
      red:   pdflib.rgb(0.872, 0.032, 0.101),
      blue:  pdflib.rgb(0.083, 0.221, 0.873),
    };
    const footerColour = colourMap[pageNumberColourSetting] ?? colourMap.black;

    if (rotation === 90) {
      thisPage.drawText(footerText, { x: width - maxLabelHeight, y: leftEdgeOfLabel,                  size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(90) });
    } else if (rotation === 270) {
      thisPage.drawText(footerText, { x: maxLabelHeight,         y: footerAxisSize - leftEdgeOfLabel, size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(-90) });
    } else if (rotation === 180) {
      thisPage.drawText(footerText, { x: footerAxisSize - leftEdgeOfLabel, y: height - maxLabelHeight, size: textLabelSize, font: textLabelFont, color: footerColour, rotate: pdflib.degrees(180) });
    } else {
      thisPage.drawText(footerText, { x: leftEdgeOfLabel,        y: maxLabelHeight,                   size: textLabelSize, font: textLabelFont, color: footerColour });
    }
  }
  const pdfOutputBytes = new Uint8Array(await pdfDoc.save());
  
  console.log(`Payload paginated successfully`);
  return pdfOutputBytes;
}
