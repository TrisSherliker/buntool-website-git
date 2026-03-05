/**
 * buntoolRestore.js
 *
 * Functions for unpacking and restoring previously-created BunTool bundle PDFs.
 * Extracts embedded metadata, splits bundle into individual documents, and restores configuration.
 */

import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.3.6/dist/mupdf.js';
import { PDFDocument, PDFName } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

/**
 * Extracts BunTool metadata from a bundle PDF's hidden annotation.
 * Searches for a FreeText annotation containing "BundleIndexData" on the first page.
 *
 * @param {Uint8Array} pdfBytes - The bundle PDF as a Uint8Array
 * @returns {Array|null} The parsed bundle index metadata array, or null if not found
 */
export function extractBundleMetadata(pdfBytes) {
  try {
    const pdfCopy = new Uint8Array(pdfBytes);
    let doc = mupdf.Document.openDocument(pdfCopy, "application/pdf");

    // Try to get metadata from document metadata field first
    const metadataString = doc.getMetaData("Bundle Index");
    if (metadataString) {
      console.log('Found Bundle Index in PDF metadata');
      console.log('Raw metadata string length:', metadataString.length);
      const parsed = JSON.parse(metadataString);
      console.log('Parsed metadata:', parsed);
      console.log('Is array?', Array.isArray(parsed), 'Length:', parsed?.length);
      // Ensure we return an array
      if (Array.isArray(parsed)) {
        return parsed;
      } else {
        console.warn('Bundle Index metadata is not an array, wrapping it');
        return [parsed];
      }
    }

    // Fall back to reading from hidden annotation
    const firstPage = doc.loadPage(0);
    const annotations = firstPage.getAnnotations();

    for (const annot of annotations) {
      const contents = annot.getContents();
      if (typeof contents === 'string' && contents.includes("BundleIndexData:")) {
        // Extract JSON from "BundleIndexData: [...]" or "BundleIndexData: {...}" format
        // Look for either '[' or '{' as the start of JSON
        const bracketIdx = contents.indexOf('[');
        const braceIdx = contents.indexOf('{');

        // Use whichever comes first (and exists)
        let startIdx = -1;
        let isArray = false;
        if (bracketIdx !== -1 && (braceIdx === -1 || bracketIdx < braceIdx)) {
          startIdx = bracketIdx;
          isArray = true;
        } else if (braceIdx !== -1) {
          startIdx = braceIdx;
          isArray = false;
        }

        if (startIdx === -1) continue;

        // Find the matching closing bracket/brace
        let depth = 0;
        let endIdx = -1;
        const openChar = isArray ? '[' : '{';
        const closeChar = isArray ? ']' : '}';

        for (let i = startIdx; i < contents.length; i++) {
          if (contents[i] === openChar) depth++;
          if (contents[i] === closeChar) {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }

        if (endIdx === -1) {
          console.warn('Could not find matching closing bracket/brace for JSON in annotation');
          continue;
        }

        const jsonString = contents.substring(startIdx, endIdx);
        console.log('Found BundleIndexData in annotation');
        console.log('Extracted JSON string length:', jsonString.length);
        const parsed = JSON.parse(jsonString);
        console.log('Parsed annotation data:', parsed);
        console.log('Is array?', Array.isArray(parsed), 'Length:', parsed?.length);
        // Ensure we return an array
        if (Array.isArray(parsed)) {
          return parsed;
        } else {
          console.warn('BundleIndexData is not an array, wrapping it');
          return [parsed];
        }
      }
    }

    console.warn('No BunTool metadata found in PDF');
    return null;
  } catch (error) {
    console.error('Error extracting bundle metadata:', error);
    return null;
  }
}

/**
 * Splits a bundle PDF into individual documents based on metadata.
 * Uses pdf-lib to extract page ranges for each document.
 *
 * @param {Uint8Array} bundleBytes - The bundle PDF as a Uint8Array
 * @param {Array} metadata - The bundle index metadata array
 * @returns {Promise<Map<string, Uint8Array>>} Map of filename → PDF bytes for each extracted document
 */
export async function splitBundlePdf(bundleBytes, metadata) {
  try {
    // Validate metadata is an array
    if (!Array.isArray(metadata)) {
      console.error('splitBundlePdf received non-array metadata:', typeof metadata, metadata);
      throw new Error(`Invalid metadata: expected array, got ${typeof metadata}`);
    }

    // Load the bundle PDF with pdf-lib
    const bundlePdf = await PDFDocument.load(bundleBytes);
    const totalPages = bundlePdf.getPageCount();

    console.log(`Splitting bundle PDF (${totalPages} pages) into ${metadata.length} items...`);
    console.log('Metadata entries:', metadata);

    // Filter out section breaks - we only split actual documents
    // Section breaks have section: true (and filename: null)
    // Regular documents have section: false and a valid filename
    const documentEntries = metadata.filter(entry => {
      // Only exclude entries that are explicitly marked as sections
      return entry.section !== true;
    });

    if (documentEntries.length === 0) {
      console.warn('No document entries found in metadata');
      return new Map();
    }

    // Calculate TOC length: first document's page number - 1
    // (e.g., if first doc starts at page 3, TOC is pages 1-2, so tocLength = 2)
    const tocLength = documentEntries[0].page - 1;
    console.log(`  TOC length: ${tocLength} pages (first doc starts at page ${documentEntries[0].page})`);

    const extractedFiles = new Map();

    for (let i = 0; i < documentEntries.length; i++) {
      const entry = documentEntries[i];
      const nextEntry = documentEntries[i + 1];

      // Skip entries with invalid filename or page
      if (!entry.filename || entry.page === null || entry.page === undefined) {
        console.warn(`Skipping entry with invalid filename or page:`, entry);
        continue;
      }

      // Calculate page range in bundle (0-indexed)
      // entry.page is 1-indexed bundle page number
      const bundleStartPage = entry.page - 1;
      const bundleEndPage = nextEntry ? nextEntry.page - 1 : totalPages;

      // Create a new PDF for this document
      const docPdf = await PDFDocument.create();

      // Copy pages from bundle to new document
      const pageIndices = [];
      for (let p = bundleStartPage; p < bundleEndPage; p++) {
        pageIndices.push(p);
      }

      const copiedPages = await docPdf.copyPages(bundlePdf, pageIndices);
      copiedPages.forEach(page => docPdf.addPage(page));

      // Save as Uint8Array
      let pdfBytes = await docPdf.save();

      // Remove page numbering (async operation)
      pdfBytes = await removePageNumbering(pdfBytes);

      // Store with filename from metadata
      extractedFiles.set(entry.filename, pdfBytes);

      console.log(`  ✓ Extracted: ${entry.filename} (bundle pages ${bundleStartPage + 1}-${bundleEndPage}, ${bundleEndPage - bundleStartPage} pages)`);
    }

    console.log(`✓ Successfully split bundle into ${extractedFiles.size} documents`);
    return extractedFiles;

  } catch (error) {
    console.error('Error splitting bundle PDF:', error);
    throw new Error(`Failed to split bundle: ${error.message}`);
  }
}

/**
 * Removes page numbering from a PDF by finding text containing zero-width space marker
 * and redacting those areas. Page numbers use zero-width space U+200B as identifier.
 *
 * @param {Uint8Array} pdfBytes - The PDF as a Uint8Array
 * @returns {Promise<Uint8Array>} The PDF with page numbers removed
 */
async function removePageNumbering(pdfBytes) {
  try {
    // Step 1: Use muPDF to find pages with page numbers
    const pdfCopy = new Uint8Array(pdfBytes);
    const doc = mupdf.Document.openDocument(pdfCopy, "application/pdf");

    const pagesWithPageNumbers = [];

    for (let pageNum = 0; pageNum < doc.countPages(); pageNum++) {
      const page = doc.loadPage(pageNum);
      const stext = page.toStructuredText();
      const pageText = stext.asText();

      if (pageText.includes('\u200B')) {
        pagesWithPageNumbers.push(pageNum);
      }
    }

    if (pagesWithPageNumbers.length === 0) {
      return pdfBytes; // No page numbers to remove
    }

    // Step 2: Use pdf-lib to parse and modify content streams
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const pageIndex of pagesWithPageNumbers) {
      const page = pages[pageIndex];

      // Get the page's content stream
      const contentStream = page.node.Contents();

      // Parse content stream into operators
      const operators = parseContentStream(contentStream);

      // Filter out operators that draw page number text
      const filteredOperators = filterPageNumberOperators(operators);

      // Rebuild content stream
      const newContentStream = buildContentStream(filteredOperators, pdfDoc);

      // Set the modified content stream back to the page
      page.node.set(PDFName.of('Contents'), newContentStream);
    }

    const modifiedBytes = await pdfDoc.save();
    console.log(`Removed page numbers from ${pagesWithPageNumbers.length} pages`);
    return new Uint8Array(modifiedBytes);

  } catch (error) {
    console.error('Error removing page numbering:', error);
    return pdfBytes; // Return original if deletion fails
  }
}

/**
 * Parse content stream into operator objects
 * @param {PDFStream|Array<PDFStream>} contentStream - The content stream(s) from the page
 * @returns {Array} Array of operator objects with {operator: string, operands: Array}
 */
function parseContentStream(contentStream) {
  const operators = [];
  const streams = Array.isArray(contentStream) ? contentStream : [contentStream];

  for (const stream of streams) {
    try {
      const bytes = stream.decode(); // Get decompressed bytes
      const content = new TextDecoder().decode(bytes);

      // Parse PDF operators using simple tokenization
      const tokens = tokenizePDFContent(content);
      operators.push(...tokens);
    } catch (error) {
      console.warn('Failed to parse content stream:', error);
    }
  }

  return operators;
}

/**
 * Tokenize PDF content stream into operators
 * @param {string} content - The decompressed content stream text
 * @returns {Array} Array of operator objects
 */
function tokenizePDFContent(content) {
  const operators = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Simple parser - matches operators like "Tj", "TJ", "'", etc.
    // Operands come before the operator on the same line
    const parts = trimmed.split(/\s+/);
    if (parts.length === 0) continue;

    const operator = parts[parts.length - 1];
    const operands = parts.slice(0, -1);

    // Parse operands to extract strings and handle special cases
    const parsedOperands = [];
    let currentString = '';
    let inString = false;

    for (const part of operands) {
      if (part.startsWith('(')) {
        inString = true;
        currentString = part.substring(1);
        if (part.endsWith(')')) {
          parsedOperands.push(currentString.substring(0, currentString.length - 1));
          currentString = '';
          inString = false;
        }
      } else if (inString) {
        if (part.endsWith(')')) {
          currentString += ' ' + part.substring(0, part.length - 1);
          parsedOperands.push(currentString);
          currentString = '';
          inString = false;
        } else {
          currentString += ' ' + part;
        }
      } else {
        parsedOperands.push(part);
      }
    }

    operators.push({
      operator: operator,
      operands: parsedOperands,
      rawLine: trimmed
    });
  }

  return operators;
}

/**
 * Filter out text operators containing zero-width space
 * @param {Array} operators - Array of operator objects
 * @returns {Array} Filtered operators without page number text
 */
function filterPageNumberOperators(operators) {
  const filtered = [];
  let inTextObject = false;
  let skipUntilET = false;

  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];

    // Track text object boundaries
    if (op.operator === 'BT') {
      inTextObject = true;
      filtered.push(op);
      continue;
    }

    if (op.operator === 'ET') {
      if (!skipUntilET) {
        filtered.push(op);
      }
      inTextObject = false;
      skipUntilET = false;
      continue;
    }

    // Check if this text operator contains zero-width space
    if (inTextObject && isTextOperator(op.operator)) {
      if (containsZeroWidthSpace(op.operands)) {
        // Skip this operator and mark to skip entire text object
        skipUntilET = true;
        continue;
      }
    }

    // Keep all other operators
    if (!skipUntilET) {
      filtered.push(op);
    }
  }

  return filtered;
}

/**
 * Check if operator is a text-showing operator
 * @param {string} op - The operator name
 * @returns {boolean} True if this is a text operator
 */
function isTextOperator(op) {
  return ['Tj', 'TJ', "'", '"'].includes(op);
}

/**
 * Check if operands contain zero-width space marker
 * @param {Array} operands - The operator's operands
 * @returns {boolean} True if zero-width space found
 */
function containsZeroWidthSpace(operands) {
  for (const operand of operands) {
    if (typeof operand === 'string' && operand.includes('\u200B')) {
      return true;
    }
    // Handle array operands (for TJ operator)
    if (Array.isArray(operand)) {
      for (const item of operand) {
        if (typeof item === 'string' && item.includes('\u200B')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Rebuild content stream from operators
 * @param {Array} operators - Filtered operator objects
 * @param {PDFDocument} pdfDoc - The PDF document (for creating streams)
 * @returns {PDFStream} New content stream
 */
function buildContentStream(operators, pdfDoc) {
  const lines = operators.map(op => op.rawLine);
  const content = lines.join('\n');

  // Create new stream with the modified content
  const bytes = new TextEncoder().encode(content);
  return pdfDoc.context.stream(bytes);
}

/**
 * Parses configuration from PDF metadata fields.
 * Extracts bundle title, project name, and confidential flag.
 *
 * @param {Uint8Array} pdfBytes - The bundle PDF as a Uint8Array
 * @returns {Object} Config object with heading, index, page, and outline options
 */
export function parseConfigFromMetadata(pdfBytes) {
  try {
    const pdfCopy = new Uint8Array(pdfBytes);
    let doc = mupdf.Document.openDocument(pdfCopy, "application/pdf");

    // Extract standard metadata fields
    const title = doc.getMetaData("Title") || "";
    const subject = doc.getMetaData("Subject") || "";

    // Parse confidential flag from title
    const isConfidential = title.startsWith("CONFIDENTIAL ");
    const bundleTitle = isConfidential ? title.substring("CONFIDENTIAL ".length) : title;

    // Build config object matching Config class structure
    const config = {
      heading: {
        claimNumber: "", // Not stored in PDF metadata - user will need to re-enter
        bundleTitle: bundleTitle,
        projectName: subject,
        confidential: isConfidential
      },
      // Default values - these aren't stored in PDF metadata
      index: {
        fontFace: "sansSerif",
        dateStyle: "DD Mon. YYYY",
        outlineItemStyle: "plain"
      },
      page: {
        footerFont: "sansSerif",
        alignment: "centre",
        numberingStyle: "PageX", // Valid option from validNumberingStyles
        footerPrefix: "",
        prefaceRomanNumerals: false
      },
      outline: {
        outlineItemStyle: "plain"
      }
    };

    console.log('Parsed config from PDF metadata:', config);
    return config;

  } catch (error) {
    console.error('Error parsing config from metadata:', error);
    // Return default config on error
    return {
      heading: {
        claimNumber: "",
        bundleTitle: "",
        projectName: "",
        confidential: false
      },
      index: {
        fontFace: "sansSerif",
        dateStyle: "DD Mon. YYYY",
        outlineItemStyle: "plain"
      },
      page: {
        footerFont: "sansSerif",
        alignment: "centre",
        numberingStyle: "PageX", // Valid option from validNumberingStyles
        footerPrefix: "",
        prefaceRomanNumerals: false
      },
      outline: {
        outlineItemStyle: "plain"
      }
    };
  }
}
