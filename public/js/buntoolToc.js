/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net)
 * A tool for the creation  of legal bundles.
 *  * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 *
 * buntoolToc.js
 * This module handles the creation of Table of Contents pages using jsPDF to generate new pdf documents.
 */

import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/+esm'
import jspdfAutotable from 'https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.7/+esm'
import Config from './buntoolConfig.js';
import { validFonts } from './buntoolConfig.js';

const autoTable = jspdfAutotable;

/**
 * Formats a date string according to the specified style.
 * @param {string} entryDate - Date string in YYYY-MM-DD format
 * @param {string} style - Desired date format style (e.g., "YYYY-MM-DD", "DD-MM-YYYY", "DD Mon. YYYY", etc.)
 * @returns {string} Formatted date string, or empty string if style is "None"
 */
function formatDate(entryDate, style) {

  const monthFullName = [
    "January", 
    "February", 
    "March",    
    "April",
    "May",     
    "June",     
    "July",     
    "August",
    "September",
    "October", 
    "November", 
    "December"
  ];
  const monthShortName = [
    "Jan.", 
    "Feb", 
    "Mar",  
    "Apr",
    "May",   
    "Jun",   
    "Jul",   
    "Aug",
    "Sep",   
    "Oct",   
    "Nov",   
    "Dec"
  ];

  if (!entryDate || entryDate === '') {
    return '';
  }
  
  const [y, m, d] = entryDate.split("-");
  const year = y;
  const monthNumber = Number(m) - 1;
  const day = d.padStart(2, "0");
  switch (style) {
    case "YYYY-MM-DD":
      return `${year}-${m}-${d}`;
    case "DD-MM-YYYY":
      return `${day}-${m}-${year}`;
    case "MM/DD/YYYY":
      return `${m}/${day}/${year}`;
    case "DD Mon. YYYY":
      return `${day} ${monthShortName[monthNumber]} ${year}`;
    case "DD Month YYYY":
      return `${day} ${monthFullName[monthNumber]} ${year}`;
    case "Mon. DD, YYYY":
      return `${monthShortName[monthNumber]} ${day}, ${year}`;
    case "Month DD, YYYY":
      return `${monthFullName[monthNumber]} ${day}, ${year}`;
    case "None":
      return "";
    default:
      return entryDate;
  }
}

/**
 * Creates table of contents entries from index data.
 * Processes input documents and section headings, calculating page numbers and tab numbers.
 * @param {Array<Object>} indexData - Array of index entry objects with filename, title, date, pageCount, and secti|| !e.sectionMarkeronMarker
 * @param {Config} config - Configuration object containing pageOptions.printableBundle flag
 * @returns {Promise<Array<Object>>} Array of TOC entry objects with tab numbers, titles, dates, page references, and blankPageAfter flag
 */
/**
 * parse the user's input index data and the provided pdfs
 * to create a table of contents (TOC) entries.
 * input an array of objects filename, title, date, section
 * output an object (mapping) of input documents and section headings
 * each element to contain:
 *   tab number or section number
 *   title,
 *   date,
 *   first page number
 *   filename
**/
export async function createTocEntries(indexData, config) {
  let tocEntries = [];
  let pdfPageCountTracker = 0;
  let tabNumberTracker = 0;
  let sectionNumberTracker = 0;
  let sectionBeginPage= 0;
  const coversheetOffset = config.getOption('pageOptions.coversheet') ? 1 : 0;

  for (const [index, entry] of indexData.entries()) {
    if (entry.sectionMarker === 1) { // section marker test
      sectionNumberTracker++;

      // Check if there are any file entries (sectionMarker === 0) after this point
      const hasFilesAfter = indexData.slice(index + 1).some(e => e.sectionMarker === 0  || !e.sectionMarker);
      sectionBeginPage = hasFilesAfter ? pdfPageCountTracker + 1 + coversheetOffset : pdfPageCountTracker + coversheetOffset;
      tocEntries.push({
        tabNumber: ``,
        sectionBreak:`Section ${sectionNumberTracker}`,
        title: entry.title,
        date: null,
        thisPage: `${sectionBeginPage}`,
        filename: null
      });
    } else { // for files
      tabNumberTracker++;
      const willAddBlankPage = config.getOption('pageOptions.printableBundle') && (entry.pageCount % 2 === 1);

      tocEntries.push({
        tabNumber: tabNumberTracker,
        sectionBreak: null,
        title: entry.title,
        date: entry.date,
        thisPage: pdfPageCountTracker + 1 + coversheetOffset,
        filename: entry.filename,
        blankPageAfter: willAddBlankPage
      });
      
      pdfPageCountTracker += entry.pageCount;
      if (willAddBlankPage) {
        pdfPageCountTracker += 1; // Account for blank page
      }
    }
  }
  console.log(`TOC entries created: `, tocEntries);
  return tocEntries;
}

/**
 * Generate a PDF with a title, project name and a table that can span multiple pages.
 * Thits is a long function which operates on a single pdf document, and so is self-contained rather than being split into sub-functions.
 * @param {string} title - The title to display at the top of the PDF
 * @param {string} project - The project name to display below the title
 * @param {Array<Array>} tocEntries - Array of arrays containing table data (first array is used as header)
 * @param {Object} options - Configuration options for the PDF
 * @param {Object} options.font - Font configuration
 * @param {string} options.font.family - Font family (default: 'helvetica')
 * @param {number} options.font.sizeTitle - Font size for title (default: 16)
 * @param {number} options.font.sizeProject - Font size for project name (default: 14)
 * @param {number} options.font.sizeTable - Font size for table content (default: 10)
 * @param {Object} options.color - Color configuration
 * @param {string} options.color.headerFill - Background color for header row (default: '#f8f8f8')
 * @param {string} options.color.headerText - Text color for header row (default: '#000000')
 * @param {string} options.color.text - Main text color (default: '#000000')
 * @param {Object} options.table - Table configuration
 * @param {number} options.table.cellPadding - Cell padding in mm (default: 3)
 * @param {Object} options.margins - Page margin configuration in mm
 * @param {number} options.margins.top - Top margin (default: 20)
 * @param {number} options.margins.right - Right margin (default: 15)
 * @param {number} options.margins.bottom - Bottom margin (default: 20)
 * @param {number} options.margins.left - Left margin (default: 15)
 * @returns {jsPDF} - The generated PDF document object
 */
export async function makeTocPages(tocEntries, options = {}, config, expectedTocLength = 1) {

  const title = config.getOption('heading.bundleTitle');
  const project = config.getOption('heading.projectName');
  const claimNumber = config.getOption('heading.claimNumber');
  const dateStyle = config.getOption('index.dateStyle');
  const indexFontSize = config.getOption('index.fontSize');
  const titleFontSize = config.getOption('heading.fontSize');
  const showBorders = config.getOption('index.showTableBorders');
  const lineHeight = {large: 1.2, medium: 1.1, small: 1}[indexFontSize] || 1.2;

  // First, add formattedDate property
  tocEntries.forEach(entry => {
    if (entry.date && !entry.formattedDate) {
      entry.formattedDate = formatDate(entry.date, dateStyle);
    }
  });
  

    // For now, toc fine tuning is via an internal config 
    // intended for future development
    // TODO
    const tocInternalConfig = {
      font: {
        family: options.font?.family || 'helvetica',
        sizeTitle: options.font?.sizeTitle || 24,
        sizeProject: options.font?.sizeProject || 18,
        sizeClaimNumber: options.font?.sizeClaimNumber || 14,
        sizeTable: options.font?.sizeTable || 12
      },
      color: {
        headerFill: options.color?.headerFill || [200, 200, 200],
        headerText: options.color?.headerText || [0, 0, 0],
        text: options.color?.text || 0,
      },
      table: {
        cellPadding: options.table?.cellPadding || 3,
        // lineHeight: options.table?.lineHeight || 1.2
      },
      margins: {
        top: options.margins?.top || 10,
        right: options.margins?.right || 25,
        bottom: options.margins?.bottom || 20,
        left: options.margins?.left || 25,
        parPadding: 9
      }
    };

    // Create new PDF document with A4 size
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set font for the document
    let fontForIndexBytes = [];
    let fontForTitleBytes = [];
    let fontForIndex = 'helvetica';
    let fontForTitle = 'helvetica';

    if (!validFonts.includes(config.getOption('index.fontFace'))) {
      console.warn(`[WARNING] Invalid fontFace option '${config.getOption('index.fontFace')}'. Reverting to 'sansSerif'.`);
      config.updateOptions({ index: { fontFace: 'sansSerif' } });
    }

    switch (config.getOption('index.fontFace')) {
      
      case "times": {
        //Get and set main font:
        fontForIndexBytes = await fetch('/fonts/timesalt/CharisSILR.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('CharisSILR.ttf', base64SerifFont);
        doc.addFont('CharisSILR.ttf', 'CharisSILR', 'normal');
        fontForIndex = 'CharisSILR';

        //Get and set title font:
        fontForTitleBytes = await fetch('/fonts/timesalt/CharisSILB.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifTitleFont = btoa(
          new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('CharisSILB.ttf', base64SerifTitleFont);
        doc.addFont('CharisSILB.ttf', 'CharisSILB', 'bold');
        fontForTitle = 'CharisSILB';

        //set font sizes for serif:
        tocInternalConfig.font.sizeClaimNumber = { large: 16, medium: 14, small: 12 }[titleFontSize] || 14;
        tocInternalConfig.font.sizeTitle = { large: 26, medium: 24, small: 22 } [titleFontSize] || 24;
        tocInternalConfig.font.sizeProject = { large: 20, medium: 18, small: 16 } [titleFontSize] || 18;
        //set table font size:
        tocInternalConfig.font.sizeTable = { large: 13, medium: 12, small: 10 } [indexFontSize] || 12;
      break; }

      case "helvetica": {
        //Get and set main font:
        fontForIndexBytes = await fetch('/fonts/arialalt/liberation_sans/LiberationSans-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('LiberationSans-Regular.ttf', base64SerifFont);
        doc.addFont('LiberationSans-Regular.ttf', 'LiberationSans-Regular', 'normal');
        fontForIndex = 'LiberationSans-Regular';

        //Get and set title font:
        fontForTitleBytes = await fetch('/fonts/arialalt/liberation_sans/LiberationSans-Bold.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifTitleFont = btoa(
          new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('LiberationSans-Bold.ttf', base64SerifTitleFont);
        doc.addFont('LiberationSans-Bold.ttf', 'LiberationSans-Bold', 'bold');
        fontForTitle = 'LiberationSans-Bold';

          //set font sizes for sans-serif:
          tocInternalConfig.font.sizeClaimNumber = { large: 16, medium: 14, small: 12 }[titleFontSize] || 14;
          tocInternalConfig.font.sizeTitle = { large: 24, medium: 22, small: 20 } [titleFontSize] || 22;
          tocInternalConfig.font.sizeProject = { large: 18, medium: 16, small: 14 } [titleFontSize] || 16;
          //set table font size:
          tocInternalConfig.font.sizeTable = { large: 12, medium: 11, small: 10 } [indexFontSize] || 11;
      break; }

      case "serif": {
        //Get and set main font:
        fontForIndexBytes = await fetch('/fonts/serif/NotoSerif-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('NotoSerif.ttf', base64SerifFont);
        doc.addFont('NotoSerif.ttf', 'NotoSerif', 'normal');
        fontForIndex = 'NotoSerif';

        //Get and set title font:
        fontForTitleBytes = await fetch('/fonts/serif/NotoSerif-Bold.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64SerifTitleFont = btoa(
          new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('NotoSerifBold.ttf', base64SerifTitleFont);
        doc.addFont('NotoSerifBold.ttf', 'NotoSerifBold', 'bold');
        fontForTitle = 'NotoSerifBold';

        //set font sizes for serif:
        tocInternalConfig.font.sizeClaimNumber = { large: 16, medium: 14, small: 12 }[titleFontSize] || 14;
        tocInternalConfig.font.sizeTitle = { large: 26, medium: 24, small: 22 } [titleFontSize] || 24;
        tocInternalConfig.font.sizeProject = { large: 20, medium: 18, small: 16 } [titleFontSize] || 18;
        //set table font size:
        tocInternalConfig.font.sizeTable = { large: 13, medium: 12, small: 10 } [indexFontSize] || 12;
      break; }

      case "sansSerif": {
          fontForIndexBytes = await fetch('/fonts/sans/static/PlusJakartaSans-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
          const base64SansFont = btoa(
            new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
          );
          doc.addFileToVFS('PlusJakartaSans.ttf', base64SansFont);
          doc.addFont('PlusJakartaSans.ttf', 'PlusJakartaSans', 'normal');
          fontForIndex = 'PlusJakartaSans';

          fontForTitleBytes = await fetch('/fonts/sans/static/PlusJakartaSans-Bold.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
          const base64SansTitleFont = btoa(
            new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
          );
          doc.addFileToVFS('PlusJakartaSansBold.ttf', base64SansTitleFont);
          doc.addFont('PlusJakartaSansBold.ttf', 'PlusJakartaSansBold', 'bold');
          fontForTitle = 'PlusJakartaSansBold';

          //set font sizes for sans-serif:
          tocInternalConfig.font.sizeClaimNumber = { large: 16, medium: 14, small: 12 }[titleFontSize] || 14;
          tocInternalConfig.font.sizeTitle = { large: 24, medium: 22, small: 20 } [titleFontSize] || 22;
          tocInternalConfig.font.sizeProject = { large: 18, medium: 16, small: 14 } [titleFontSize] || 16;
          //set table font size:
          tocInternalConfig.font.sizeTable = { large: 12, medium: 11, small: 10 } [indexFontSize] || 11;
      break; }

      case "monospaced": {
        //Get and set main font:
        fontForIndexBytes = await fetch('/fonts/mono/UbuntuMono-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64MonoFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('UbuntuMono.ttf', base64MonoFont);
        doc.addFont('UbuntuMono.ttf', 'UbuntuMono', 'normal');
        fontForIndex = 'UbuntuMono';

        //Get and set title font:
        fontForTitleBytes = await fetch('/fonts/mono/UbuntuMono-Bold.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64MonoTitleFont = btoa(
          new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('UbuntuMonoBold.ttf', base64MonoTitleFont);
        doc.addFont('UbuntuMonoBold.ttf', 'UbuntuMonoBold', 'bold');
        fontForTitle = 'UbuntuMonoBold';
        //set font sizes for mono:
        tocInternalConfig.font.sizeClaimNumber = { large: 16, medium: 14, small: 12 }[titleFontSize] || 14;
        tocInternalConfig.font.sizeTitle = { large: 24, medium: 22, small: 20 } [titleFontSize] || 22;
        tocInternalConfig.font.sizeProject = { large: 18, medium: 16, small: 14 } [titleFontSize] || 16;
        //set table font size:
        tocInternalConfig.font.sizeTable = { large: 12, medium: 11, small: 10 } [indexFontSize] || 11;
      break; }


      case "traditional": {
        //Get and set main font:
        fontForIndexBytes = await fetch('/fonts/trad/static/EBGaramond-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64TradFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('EBGaramond.ttf', base64TradFont);
        doc.addFont('EBGaramond.ttf', 'EBGaramond', 'normal');
        fontForIndex = 'EBGaramond';

        //Get and set title font:
        fontForTitleBytes = await fetch('/fonts/trad/static/EBGaramond-Bold.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64TradTitleFont = btoa(
          new Uint8Array(fontForTitleBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('EBGaramondBold.ttf', base64TradTitleFont);
        doc.addFont('EBGaramondBold.ttf', 'EBGaramondBold', 'bold');
        fontForTitle = 'EBGaramondBold';
        //set font sizes for trad:
        tocInternalConfig.font.sizeClaimNumber = { large: 18, medium: 16, small: 14 }[titleFontSize] || 16;
        tocInternalConfig.font.sizeTitle = { large: 26, medium: 24, small: 22 } [titleFontSize] || 24;
        tocInternalConfig.font.sizeProject = { large: 20, medium: 18, small: 16 } [titleFontSize] || 18;
        //set table font size:
        tocInternalConfig.font.sizeTable = { large: 14, medium: 13, small: 12 } [indexFontSize] || 13;
      break; }

      default: {
        fontForIndexBytes = await fetch('/fonts/sans/static/PlusJakartaSans-Regular.ttf').then(res => { if (!res.ok) throw new Error(`Font fetch failed: ${res.url} (${res.status})`); return res.arrayBuffer(); });
        const base64DefaultFont = btoa(
          new Uint8Array(fontForIndexBytes).reduce((s,b)=> s+String.fromCharCode(b), '')
        );
        doc.addFileToVFS('PlusJakartaSans.ttf', base64DefaultFont);
        doc.addFont('PlusJakartaSans.ttf', 'PlusJakartaSans', 'normal');
        fontForIndex = 'PlusJakartaSans';
      break; }
    }

    doc.setFont(fontForIndex);

    // Get page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const borderToggle = { top: 0, right: 0, bottom: 0.1, left: 0 };

    // Add Claim No, right-aligned at the top: 
    doc.setFontSize(tocInternalConfig.font.sizeClaimNumber);
    doc.setTextColor(tocInternalConfig.color.text);
    doc.text(
      claimNumber,
      pageWidth - tocInternalConfig.margins.right,
      tocInternalConfig.margins.top,
      { maxWidth: pageWidth * 0.8, align: 'right' }
    );

    //measure claim number height for positioning of next element, with padding = padding:
    const claimNumberHeight = doc.getTextDimensions(claimNumber, {
      maxWidth: pageWidth * 0.8,
      align: 'right',
    }).h;
    const projectNameYOffset = tocInternalConfig.margins.top + claimNumberHeight + tocInternalConfig.margins.parPadding-5;

    // Add project name
    doc.setFontSize(tocInternalConfig.font.sizeProject);
    doc.text(
      project,
      (pageWidth) / 2,
      projectNameYOffset,
      { maxWidth: pageWidth * 0.9, align: 'center' }
    );

    //measure dims forr positioning of next elements
    const projectNameDimensions = doc.getTextDimensions(project, {
      maxWidth: pageWidth * 0.9,
      align: 'center',
    });

    const titleYOffset = projectNameYOffset + projectNameDimensions.h + tocInternalConfig.margins.parPadding;

    // Add bundle title with or without confidential laabel
    doc.setFontSize(tocInternalConfig.font.sizeTitle)
    doc.setFont(fontForTitle, 'bold'); //setfotstyle deprecated
    let titleDimensions = {};
    if (config.getOption('heading.confidential')) { //if confidential, some measuring is needed since the red text must be separately rendered. Solution: write all in black, then overwrite the confidential part in red:
      const confiPlusTitle = `CONFIDENTIAL ${config.getOption('heading.bundleTitle')}`;
      const confiPlusTitleDimensions = doc.getTextDimensions(confiPlusTitle, {
        maxWidth: pageWidth * 0.7,
        align: 'center'
      });
      //first write the full line in black:
      doc.setTextColor(tocInternalConfig.color.text);
      doc.text(
        confiPlusTitle,
        pageWidth / 2,
        titleYOffset,
        { maxWidth: pageWidth * 0.7, align: 'center' }
      );

      //Need to get x coordinate of the start of the title, which can vary. So split to strings and measure the width of the first part:
      const linesOfTitle = doc.splitTextToSize(confiPlusTitle, pageWidth * 0.7);
      const firstLineOfTitle = linesOfTitle[0];
      const widthOfFirstLine = doc.getTextDimensions(firstLineOfTitle, {
        maxWidth: pageWidth * 0.7,
        align: 'center'
      }).w;

      const startxOfTitle = (pageWidth - widthOfFirstLine) / 2;

      //now apply red text, overwriting the black:
      doc.setTextColor(210, 43, 43); // Set text color to red
      const confidentialLabel = "CONFIDENTIAL";
      doc.text(
        confidentialLabel,
        startxOfTitle,
        titleYOffset,
        { maxWidth: pageWidth * 0.7, align: 'left' }
      );
      //meaasure title height and width for positioning of next element
      titleDimensions = confiPlusTitleDimensions;

    } else { //if not confidential, just use the title
      doc.setTextColor(tocInternalConfig.color.text); // Reset text color to default
      doc.text(
        title,
        pageWidth / 2,
        titleYOffset,
        { maxWidth: pageWidth * 0.7, align: 'center' }
      );
      //meaasure title height and width for positioning of next element
      titleDimensions = doc.getTextDimensions(title,
        {
          maxWidth: pageWidth * 0.7,
          align: 'center'
        });
    }

    // add tramlines: 
    // width = title width
    // first line positioned abovet title: titleYOffset-5, 
    // second line goes under the title: titleYOffset + titleDimensions.h + 5
    // The -5 and +5 in the x coordinates just extend the lines beyond the title a little
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(
      ((pageWidth - titleDimensions.w) / 2) - 5,
      titleYOffset - tocInternalConfig.margins.parPadding,
      ((pageWidth + titleDimensions.w) / 2) + 5,
      titleYOffset - tocInternalConfig.margins.parPadding
    );
    doc.line(
      ((pageWidth - titleDimensions.w) / 2) - 5,
      titleYOffset + titleDimensions.h - 3,
      ((pageWidth + titleDimensions.w) / 2) + 5,
      titleYOffset + titleDimensions.h - 3
    );

    // Now move on to set up the table of entries:
    const indexTableYOffset = titleYOffset + titleDimensions.h + tocInternalConfig.margins.parPadding - 4;
    
    // Prepare table data
    // Set actualStartPage on original tocEntries so addHyperlinks/addOutlineItems can use them
    for (const entry of tocEntries) {
      entry.actualStartPage = Number(entry.thisPage) + expectedTocLength;
    }

    const body = tocEntries.map(({ filename, ...rest }) => rest); // Remove the filename field from the tocEntries
    for (const entry of body) { // Clear page number for section breaks in table display
      if (entry.sectionBreak) {
        entry.thisPage = '';
        entry.actualStartPage = '';
      }
    }

    //define autotable content by reference to headers
    const showDate = config.getOption('index.dateStyle') !== 'None';
    const headers = {
      tabNumber: 'Tab',
      title: 'Title',
      ...(showDate && {formattedDate: 'Date'}),
      actualStartPage: 'Page'
    }

    const tableWidthSetting = pageWidth - tocInternalConfig.margins.left - tocInternalConfig.margins.right;
    const rowCoordinates = [];

    // Configure autoTable
    autoTable(doc, {
      head: [headers],
      body: body,
      startY: indexTableYOffset, // Start below the title and project name
      margin: {
        top: tocInternalConfig.margins.top,
        right: tocInternalConfig.margins.right,
        bottom: tocInternalConfig.margins.bottom,
        left: tocInternalConfig.margins.left
      },
      styles: {
        fontSize: tocInternalConfig.font.sizeTable,
        cellPadding: tocInternalConfig.table.cellPadding,
        lineColor: showBorders ? tocInternalConfig.color.text : false,
        // lineColor: tocInternalConfig.table.showBorders ? 40 : false,
        // lineWidth: tocInternalConfig.table.showBorders ? 0.1 : 0,
        lineWidth: showBorders ? borderToggle : 0,
        font: fontForIndex,
        textColor: tocInternalConfig.color.text,
        lineHeight: lineHeight
      },
      headStyles: {
        fillColor: tocInternalConfig.color.headerFill,
        textColor: tocInternalConfig.color.headerText,
        font: fontForTitle,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      // Customize colums
      columnStyles: {
        0: { halign: 'right' },
        ...(showDate && { 2: { minCellWidth: 28 } }), //date if exists
        [showDate ? 3 : 2]: { halign: 'right' }, //index shifts ith showdate
      },
      tableWidth: tableWidthSetting,
      
      //Shading for section breaks
      didParseCell: (data) => {
        if (data.section === "body" && data.row.raw.sectionBreak) {
          data.cell.styles.fillColor = [225, 225, 225];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.font = fontForTitle;
          data.cell.styles.halign = 'left';
        }
      },

      // Handle page breaks automatically
      willDrawPage: function (data) {
        // Reset font and colors for each page
        doc.setFont(tocInternalConfig.font.family);
        doc.setTextColor(tocInternalConfig.color.text);
      },

      //Wonderfully, jsPDF autotable reports what it did so the coords can be used later:
      didDrawCell: (data) => {
        // Check if this is the first cell in the row (push once per row)
        if (data.section === "body" && data.column.index === 0) {
          const rowInfo = {
            rowNumber: data.row.index + 1, // Row number (1-based index)
            tabNumber: data.cell.raw, // Tab number from the cell
            x: data.cell.x, // X-coords of the row
            y: data.cell.y, // Y-coords of the row
            width: tableWidthSetting,  // Width of the row (=entire table width)
            height: data.row.height, // Height of the row
            pageNumber: data.pageNumber, // Page number where the row is located
            sectionMarker: data.row.raw.sectionBreak ? true : false // Whether this row is a section break
          };
          rowCoordinates.push(rowInfo);
        }
      },
    });
    console.log(`drew autotable with row coordinates: `, rowCoordinates);
    const docBytes = doc.output('arraybuffer'); // Get the PDF as an ArrayBuffer
    const uint8Array = new Uint8Array(docBytes); // Convert ArrayBuffer to Uint8Array
    const pageCount = doc.internal.getNumberOfPages();
    return [uint8Array, rowCoordinates, pageCount];
  }

/** 
 * Generates dummy TOC pages to determine how many pages the TOC will take up.
 * This is necessary to calculate the correct page numbers for the actual TOC entries.
 * @param {Array<Object>} tocEntries - Array of TOC entry objects
 * @param {Object} options - Configuration options for the PDF
 * @param {Object} config - Configuration object containing heading and index options
 * @returns {Promise<number>} The number of pages the TOC will occupy
 */
export async function makeDummyTocPages (tocEntries, options = {}, config) {
  let dummyTocEntries = tocEntries;
  const [dummyTocPdf, _, pageCount] = await makeTocPages(dummyTocEntries, options, config, 1);
  return pageCount;
}

