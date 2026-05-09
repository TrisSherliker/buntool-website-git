/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net)
 * A tool for the creation  of legal bundles.
 *  * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 * 
 * buntoolMain.js
 * Main logic pipeline module
 */
import Config from './buntoolConfig.js';
import {
  createTocEntries,
  makeTocPages,
  makeDummyTocPages,
  } from './buntoolToc.js';
import {
  addPageNumberingToPdf,
  mergeTwoPdfs,
  mergePdfsByTOC,
  validateCoverPage,
  } from './buntoolPages.js';
import {
  addHyperlinks,
  addOutlineItems,
  setMetadata,
} from './buntoolMeta.js';

/**
 * Function to process the bundle of PDFs according to the provided configuration.
 * @param {Map<string, File>} filesMap
 * @param {Array<Object>} indexData
 * @param {Config} config
 * @param {Function} [onProgress]
 * @param {Uint8Array|null} [coversheetPdf] - Pre-validated single-page coversheet PDF, required when config.pageOptions.coversheet is true
 * @returns {Promise<Uint8Array>} The processed payload PDF as a Uint8Array.
 */
export async function processTheBundle(filesMap, indexData, config, onProgress, coversheetFile = null){

  if (!filesMap || filesMap.size === 0) {
    throw new Error('Error: No files provided');
  }

  if (!indexData || indexData.length === 0) {
    throw new Error('Error: No index data provided');
  }

  if (!config) {
    throw new Error('Error: No configuration provided');
  }

  if (config.getOption('pageOptions.coversheet') && !coversheetFile) {
    throw new Error('Error: Coversheet is enabled but no coversheet file was provided');
  }

  let payloadPdf = new Uint8Array();

  // TODO: 
  // This internal toc Options config is sketched out but - 
  // for now - is hardcoded defaults. It's designed for 
  // future expansion. Used in the makeTocPages function.
  const tocOptions = {
    font: {
      family: 'helvetica',
      sizeTitle: 18,
      sizeProject: 14,
      sizeTable: 11
    },
    color: {
      headerFill: [200, 200, 200],
      //  headerText: 150,
      //  text: 250
    },
    table: {
      showBorders: true,
      cellPadding: 2,
      lineHeight: 1.3
    },
    margins: {
      top: 25,
      right: 22,
      bottom: 25,
      left: 22
    }
  };


  console.log('[1/13] Validating configuration structure...');
  try //validate structure with method from buntoolConfig
  {
    config.validateStructure();
  } catch (error) {
      console.error(`[ERROR] Config structure validation error: `, error.message);
      throw error;
  }
  console.log('[1/13]...done')
  onProgress?.('Validating configuration…');

  console.log('[2/13] Validating configuration options...');
  try { //validate options with method from buntoolConfig
    config.validateOptions();
  } catch (error) {
      console.error(`[ERROR] Config validation error: `, error.message);
      throw error;
  }
  console.log('[2/13]...done')

  let validatedCoversheet = null;
  if (coversheetFile) {
    console.log('[3/13] Validating coversheet...');
    try {
      validatedCoversheet = await validateCoverPage(coversheetFile);
      console.log('[3/13]...done');
    } catch (error) {
      console.error('[ERROR] Failed to validate coversheet: ', error.message);
      throw error;
    }
  }

  onProgress?.('Creating table of contents…');

  console.log('[4/13] Creating TOC entries...');
  let tocEntries;
  try {
    tocEntries = await createTocEntries(indexData, config);
    console.log('[4/13]...done')
  } catch (error) {
    console.error(`[ERROR] Failed to create TOC entries: `, error.message);
    throw error;
  }
  onProgress?.('Generating index pages…');

  console.log('[5/13] Generating dummy TOC pages...');
  let expectedLengthOfToc = 0;
  try {
    expectedLengthOfToc = await makeDummyTocPages(tocEntries, tocOptions, config);
    console.log(`[5/13]...done - dummy TOC PDF length: ${expectedLengthOfToc} pages`)
  } catch (error) {
    console.error(`[ERROR] Failed to generate dummy TOC pages: `, error.message);
    throw error;
  }

  console.log('[6/13] Generating TOC pages...');
  let tocPdf, tocTableRowCoordinates;
  try {
    [tocPdf, tocTableRowCoordinates] = await makeTocPages(tocEntries, tocOptions, config, expectedLengthOfToc);
    console.log(`[6/13]...done - TOC PDF size: ${tocPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to generate TOC pages: `, error.message);
    throw error;
  }

  if (config.getOption('index.justTheIndex')) {
    console.log('Config option justTheIndex is true - returning TOC PDF without merging content PDFs');
    let justIndexPdf = tocPdf;
    if (validatedCoversheet) {
      justIndexPdf = await mergeTwoPdfs(validatedCoversheet, justIndexPdf);
      console.log(`...prepended coversheet - PDF size: ${justIndexPdf?.length || 0} bytes`);
    }
    onProgress?.('Adding page numbering…');
    justIndexPdf = await addPageNumberingToPdf(justIndexPdf, config);
    console.log(`...added page numbering - TOC PDF size: ${justIndexPdf?.length || 0} bytes`);
    return justIndexPdf;
  }

  onProgress?.('Merging documents…');

// PDF HANDLING:
  console.log('[7/13] Merging input PDFs...');
  try {
    payloadPdf = await mergePdfsByTOC(tocEntries, filesMap, config);
    console.log(`[7/13]...done - Merged PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to merge input PDFs: `, error.message);
    throw error;
  }

  // Note: filesMap is owned by the frontend — do not clear it here
  onProgress?.('Merging index with documents…');

  console.log('[8/13] Merging TOC with content PDF...');
  try {
    payloadPdf = await mergeTwoPdfs(tocPdf, payloadPdf);
    console.log(`[8/13]...done - Combined PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to merge TOC with content: `, error.message);
    throw error;
  }

  if (validatedCoversheet) {
    console.log('[9/13] Prepending coversheet...');
    try {
      payloadPdf = await mergeTwoPdfs(validatedCoversheet, payloadPdf);
      console.log(`[9/13]...done - PDF size with coversheet: ${payloadPdf?.length || 0} bytes`);
    } catch (error) {
      console.error('[ERROR] Failed to prepend coversheet: ', error.message);
      throw error;
    }
  }

  onProgress?.('Adding page numbering…');

  console.log('[10/13] Adding page numbering...');
  try {
    payloadPdf = await addPageNumberingToPdf(payloadPdf, config);
    console.log(`[10/13]...done - PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to add page numbering: `, error.message);
    throw error;
  }
  onProgress?.('Adding hyperlinks…');

  console.log('[11/13] Adding hyperlinks to TOC entries...');
  try {
    payloadPdf = addHyperlinks(payloadPdf, tocTableRowCoordinates, tocEntries, config);
    console.log(`[11/13]...done - PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to add hyperlinks: `, error.message);
    throw error;
  }
  onProgress?.('Adding bookmarks…');

  console.log('[12/13] Adding outline items and metadata...');
  try {
    payloadPdf = addOutlineItems(payloadPdf, tocEntries, config);
    console.log(`[12/13]...done - PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to add outline items: `, error.message);
    throw error;
  }
  onProgress?.('Preparing file for save…');

  console.log('[13/13] Setting PDF metadata...');
  try {
    payloadPdf = setMetadata(payloadPdf, tocEntries, config);
    console.log(`[13/13]...done - Final PDF size: ${payloadPdf?.length || 0} bytes`)
  } catch (error) {
    console.error(`[ERROR] Failed to set metadata: `, error.message);
    throw error;
  }

  //This is a stump of metadata recovery function
  // getBundleIndexMetadata(payloadPdf);  // DISABLED: muPDF clears the buffer, making payloadPdf empty

  console.log(`✓ Bundle processing complete! Returning PDF of size: ${payloadPdf?.length || 0} bytes`);

  // // Save the final PDF to a file
  // fs.writeFileSync(path.join(outputDirPath,"output.pdf"), payloadPdf);
  // console.log(`PDF saved to ${outputDirPath}`);
  return payloadPdf;
}