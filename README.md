This is the public repo for the website at https://buntool.co.uk.


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
