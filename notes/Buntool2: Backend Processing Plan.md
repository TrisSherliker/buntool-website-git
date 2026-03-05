# Buntool2: Backend Processing Plan

## Overall Aim

Buntool2 is the backend logic for an online court-bundle creation app.

The backend will:

- Be written entirely in **TypeScript**
- Run **fully in-browser** (no server-side processing)
- Ensure **perfect privacy** (no files uploaded anywhere)
- Accept multiple PDF documents and structured metadata
- Produce a **single merged PDF bundle** suitable for use in **English courts**

The output PDF will include:
- Correct pagination
- A cover/title page
- A hyperlinked index
- Bookmarks
- Optional document separators
- Court-appropriate formatting

---

## Design Constraints & Principles

- **In-browser only** (JS and WASM-friendly libraries only)
- **Deterministic output** (same inputs → same PDF output)
- **Memory-aware** (handle large bundles carefully)
- **Composable pipeline** (each step isolated and testable)

## Workflow overview

The user wil provide PDF documents. The frontend will organise the documents and allow for the user to enter information like dates, document titles, etc. The pdfs will be merged to create a digital court bundle. As part of that process, the app will add an automatically-created index (front pages, with hyperlinks to documents), continuous pagination, and bookmarks (outline items). 

## Step by step plan

1. Validate input files
   1. Check overall filesize
   2. Check filetypes
2. Validate metadata data structure (used for later processing)
   1. Check all required data present
   2. Sanitise strings
3. Merge PDFs
   1. Combine in correct order
   2. check output matches expected number of pages
4. Create dummy index and count how many pages it requires
5. Create real index including page numbers (offset according to index length)
6. Paginate merged PDF (add page number overlayed onto each page.)
7. Add hyperlinks to index
8. Add bookmarks (outline items)
9.  Check resulting filesize

