/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net)
 * A tool for the creation  of legal bundles.
 *  * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 * 
 * buntoolConfig.js
 * Configuration class for BunTool generator. Takes options from frontend
 * for parsing during bundle processing. 
 */

export const validFonts = [
    "serif",
    "traditional",
    "sansSerif",
    "monospaced",
    "times", 
    "helvetica", 
    "courier"
  ];

export const fontDisplayNames = {
  "serif": "Serif (Noto Serif)",
  "traditional": "Traditional (EB Garamond)",
  "sansSerif": "Sans Serif (Plus Jakarta)",
  "monospaced": "Monospaced (Ubuntu Mono)",
  "times": "Times New Roman",
  "helvetica": "Helvetica",
  "courier": "Courier"
};

export const validFontSize = [
  "small",
  "medium",
  "large"
  ];

export const validAlignments = [
    "left", 
    "centre", 
    "center",
    "right"
  ];

export const validNumberingStyles = [
    "PageX",
    "PageXofY",
    "X",
    "XslashY",
    "XofY",
    "None",
  ];

export const numberingStyleDisplayNames = {
    "PageX": "Page X",
    "PageXofY": "Page X of Y",
    "X": "X",
    "XslashY": "X/Y",
    "XofY": "X of Y",
    "None": "None",
};

export const validDateStyles = [
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "MM/DD/YYYY",
    "DD Mon. YYYY",
    "DD Month YYYY",
    "Mon DD, YYYY",
    "Month DD, YYYY",
    "None",
  ];

export const validOutlineStyles = [
    "plain", 
    "withPage", 
    "withDate", 
    "withDateandPage",
  ];

export const outlineStyleDisplayNames = {
    "plain": "Document title",
    "withPage": "Document title [page no]",
    "withDate": "Document title [date]",
    "withDateandPage": "Document title (date) [page no]",
  };
export const validTableBorders = [
    true,
    false,
  ];
export const validPrintableBundle = [
    true,
    false,
  ];

export const validPageNumberColours = [
    "black",
    "red",
    "blue",
  ];

export const justTheIndex = [
    true,
    false,
  ];

export const validCoversheet = [
    true,
    false,
  ];

class Config {
  /* 
  * Initialise with default configuration
  */
  constructor() {
    this.options = {
      heading: {
        claimNumber: "", // Default: blank
        bundleTitle: "Bundle", // Default: "Bundle"
        projectName: "", // Default: blank
        confidential: false, // Default: false
        fontSize: "medium", // Default: medium
      },
      pageNumbering: {
        footerFont: "helvetica", // Default: helvetica
        footerFontSize: "medium", // Default: medium
        alignment: "right", // Default: Right
        numberingStyle: "PageX", // Default: Page [X]
        footerPrefix: "", // Default: blank
        pageNumberColour: "black", // Default: black
      },
      index: {
        fontFace: "helvetica", // Default: helvetica
        fontSize: "medium", // Default: medium
        dateStyle: "YYYY-MM-DD", // Default: YYYY-MM-DD
        outlineItemStyle: "withPage", // Default: with page
        showTableBorders: true, // Default: true
        justTheIndex: false, // Default: false
      },
      pageOptions: {
        printableBundle: false, // Default: false
        coversheet: false, // Default: false
      }
    };
  }
  
  /**
   * Method to update options
   * Options mainly passed in from frontend.
   */
    updateOptions(newOptions) {
      this.options = {
        heading: { ...this.options.heading, ...newOptions.heading },
        pageNumbering: { ...this.options.pageNumbering, ...newOptions.pageNumbering },
        index: { ...this.options.index, ...newOptions.index },
        pageOptions: { ...this.options.pageOptions, ...newOptions.pageOptions },
      };
    }

  /**
   * Method to validate options
   * Defines valid values
   * Errors thrown for invalid options
  */
  validateOptions() {
    if (!validFonts.includes(this.options.index.fontFace)) {
      throw new Error(`Invalid index font: ${this.options.index.fontFace}`);
    }
    if (!validFonts.includes(this.options.pageNumbering.footerFont)) {
        throw new Error(`Invalid footer font: ${this.options.pageNumbering.footerFont}`);
    }
    if (!validFontSize.includes(this.options.pageNumbering.footerFontSize)) {
      throw new Error(`Invalid footer font size: ${this.options.pageNumbering.footerFontSize}`);
    }
    if (!validFontSize.includes(this.options.heading.fontSize)) {
      throw new Error(`Invalid heading font size: ${this.options.heading.fontSize}`);
    }
    if (!validFontSize.includes(this.options.index.fontSize)) {
      throw new Error(`Invalid index font size: ${this.options.index.fontSize}`);
    }
    if (!validAlignments.includes(this.options.pageNumbering.alignment)) {
      throw new Error(`Invalid alignment: ${this.options.pageNumbering.alignment}`);
    }
    if (!validNumberingStyles.includes(this.options.pageNumbering.numberingStyle)) {
      throw new Error(`Invalid numbering style: ${this.options.pageNumbering.numberingStyle}`);
    }
    if (!validDateStyles.includes(this.options.index.dateStyle)) {
      throw new Error(`Invalid date style: ${this.options.index.dateStyle}`);
    }
    if (!validOutlineStyles.includes(this.options.index.outlineItemStyle)) {
      throw new Error(`Invalid outline item style: ${this.options.index.outlineItemStyle}`);
    }
    if (!validPrintableBundle.includes(this.options.pageOptions.printableBundle)) {
      throw new Error(`Invalid printable bundle option: ${this.options.pageOptions.printableBundle}`);
    }
    if (!validCoversheet.includes(this.options.pageOptions.coversheet)) {
      throw new Error(`Invalid coversheet option: ${this.options.pageOptions.coversheet}`);
    }
    if (!validPageNumberColours.includes(this.options.pageNumbering.pageNumberColour)) {
      throw new Error(`Invalid page number colour: ${this.options.pageNumbering.pageNumberColour}`);
    }
    if (!validTableBorders.includes(this.options.index.showTableBorders)) {
      throw new Error(`Invalid show table borders option: ${this.options.index.showTableBorders}`);
    }
    if (!justTheIndex.includes(this.options.index.justTheIndex)) {
      throw new Error(`Invalid justTheIndex option: ${this.options.index.justTheIndex}`);
    }
  }
      
  /**
   * Method to validate structure
   * Defines required fields
   * Errors thrown for missing fields
  */  
 validateStructure() {
    const requiredPaths = {
      heading: ["claimNumber", "bundleTitle", "projectName", "confidential", "fontSize"],
      pageNumbering: ["footerFont", "footerFontSize", "alignment", "numberingStyle", "footerPrefix", "pageNumberColour"],
      index: ["fontFace", "fontSize", "dateStyle", "outlineItemStyle", "showTableBorders", "justTheIndex"],
      pageOptions: ["printableBundle", "coversheet"],
    };
    
    for (const [section, fields] of Object.entries(requiredPaths)) {
      if (!this.options[section]) {
        throw new Error(`Invalid config: Missing configuration section: ${section}`);
      }
      for (const field of fields) {
        if (this.options[section][field] === undefined) {
          throw new Error(`Invalid config: Missing configuration field: ${section}.${field}`);
        }
      }
    }
  }

  /**
   * Method to retrieve option by key path
   * returns value, or null if not found
   */
  getOption(key) {
    return key.split(".").reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), this.options);
    }
  }

export default Config;