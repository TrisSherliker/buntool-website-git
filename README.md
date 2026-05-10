This is the public repo for the website at https://buntool.co.uk.

# BunTool

**Automatically create court bundles in seconds.**

Software to take in PDFs and produce perfect English Court bundles.

BunTool2 is the privacy-focussed update to the previous [BunTool](https://github.com/TrisSherliker/buntool). It is a JavaScript library for creating professional PDF court bundles. It processes PDF files and generates merged outputs with:

- Automatic index/table of contents
- Hyperlinked page numbers
- PDF bookmarks/outlines
- Consistent page numbering
- Section breaks

Bundles comply with English court requirements but work well for any context requiring organised PDF compilation.

## Easiest Way to Use

It's hosted at [buntool.co.uk](https://buntool.co.uk) - no installation required, software runs locally on your machine.

## Privacy

BunTool runs entirely in your browser. Your documents are **never uploaded** to any third party server by BunTool - all processing happens locally on your device.

## Taxonomy

### Backend modules

- **buntoolMain.js** - Main logic for bundle creation.
- **buntoolConfig.js** - Configuration. Data structure and validator for data passed from frontend to backend. 
- **buntoolPages.js** - Manage input PDF pages. Merge, organise, measure and page numbering functions (depends on pdf-lib and fontkit)
- **buntoolToc.js** - Create new PDF pages. Functions for table of contents / index generation and date management (depends on jspdf and jspdf-autotable).
- **buntoolMeta.js** - Metadata and innards management. Functions for internal hyperlinking, bookmarking and annotation of bundles (depends on mupdf WASM).


### Frontend modules

- **frontend.js** - Frontend logic
- **buntoolTutorial.js** - Tutorial logic
- **buntoolRestore.js** - Restore and edit a bundle.
