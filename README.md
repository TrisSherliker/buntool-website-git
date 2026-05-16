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

- **buntoolMain.js** - Main orchestration logic for bundle creation.
- **buntoolConfig.js** - Configuration. Data structure and validator for data passed from frontend to backend.
- **buntoolPages.js** - Input PDF management. Page counting, validation, cover page handling, and page numbering (depends on pdf-lib and fontkit).
- **buntoolMerge.js** - PDF merging using mupdf. Grafts source documents one at a time so peak memory stays at ~(destination + 1 source) rather than all sources simultaneously. Provides both direct and worker-based variants.
- **buntoolToc.js** - Index generation. Creates the table of contents PDF pages and manages date formatting (depends on jspdf and jspdf-autotable).
- **buntoolMeta.js** - Metadata and navigation. Adds internal hyperlinks, PDF bookmarks/outlines, and bundle metadata/annotations (depends on mupdf WASM).

### Workers

Each worker runs in an isolated thread and is terminated after use, freeing its entire wasm/JS heap.

- **workers/buntoolMergeWorker.js** - Runs mupdf PDF merge operations (mergePdfsByTOC, mergeTwoPdfs).
- **workers/buntoolFooterWorker.js** - Runs pdf-lib page numbering so the large pdf-lib heap is isolated and freed after each run.
- **workers/buntoolMetaWorker.js** - Runs the full metadata pipeline (hyperlinks → bookmarks → metadata annotation) in a single worker pass.

### Frontend modules

- **frontend.js** - Frontend logic
- **buntoolTutorial.js** - Tutorial logic
- **buntoolRestore.js** - Restore and edit a bundle.
