# BunTool Bugs & Issues Tracker

## Critical Bugs

### 🔴 Bug #1: Blank Bundle on Early Submit (CONFIRMED ROOT CAUSE)
**File**: `js/buntoolMain.js:54`
**Status**: Identified
**Priority**: HIGH

**Description**:
When config validation fails, `processTheBundle()` returns `undefined` instead of throwing an error or returning error information. The frontend expects a Uint8Array (PDF bytes), so this causes a blank/broken download.

**Code**:
```javascript
} catch (error) {
    console.error(`[ERROR] Config validation error: `, error.message);
    return;  // ⚠️ Returns undefined
}
```

**Impact**:
- User clicks submit before files are ready → validation fails → `undefined` returned
- Frontend tries to create Blob from `undefined` → blank/corrupted PDF download
- This is likely the "submit button too early returns blank bundle" bug from MVP notes

**Fix**:
Return proper error state or throw error that frontend can catch and display to user.

---

## High Priority Issues

### 🟡 Issue #2: No Error Handling for PDF Operations
**File**: `js/buntoolMain.js:58-75`
**Status**: Identified
**Priority**: HIGH

**Description**:
All async PDF operations (merge, paginate, hyperlink, etc.) lack try-catch blocks. If any operation fails (corrupt PDF, memory issue, etc.), errors bubble up uncaught.

**Affected Operations**:
- `createTocEntries()`
- `makeTocPages()`
- `mergePdfsByTOC()`
- `mergeTwoPdfs()`
- `addPageNumberingToPdf()`
- `addHyperlinks()`
- `addOutlineItems()`
- `setMetadata()`

**Fix**:
Wrap pipeline in try-catch and return structured error response.

---


## Code Quality Improvements

### ✅ Improvement #3: Avoid Global State
**File**: `js/buntoolMain.js:23` (REMOVED)
**Priority**: LOW
**Status**: COMPLETED

**Description**:
Using `globalThis.config` created implicit coupling. While JavaScript is single-threaded, this could break if code is refactored for workers.

**Solution Implemented**:
Removed global state and passed `config` explicitly as a parameter to all functions that need it:

**Updated Function Signatures**:
- `addPageNumberingToPdf(pdfDocBytes, config)`
- `formatOutlineItem(entry, config)`
- `addOutlineItems(pdfBytes, tocEntries, config)`
- `setMetadata(pdfBytes, tocEntries, config)` - Also removed unused `title`, `author`, `subject` parameters (fixes Issue #14)
- `makeTocPages(data, options, config)`

**Benefits**:
- ✓ Explicit dependencies - clear which functions need config
- ✓ Testable - easy to pass mock configs in tests
- ✓ Thread-safe - works with Web Workers
- ✓ No side effects - functions don't rely on global state
- ✓ Better IDE support - type hints and autocomplete work better

---

## Known Issues from Notes

### From `notes/buntool-js-status.md`:

- [ ] **Section breaks** - Not yet implemented
- [ ] **TTF fonts embedding** - Need verification they're properly embedded
- [ ] **Async/blocking flow** - Inconsistent use of await (noted as "hacky")
- [ ] **document.isPDF() checks** - Missing before editing each PDF
- [ ] **Error catching** - General lack throughout codebase
- [ ] **Validate PDF files** - Should check by mime type

---

## Testing Recommendations

1. **Test empty inputs** - What happens with no files or config?
2. **Test validation failure** - Deliberately pass invalid config
3. **Test corrupted PDF** - Upload non-PDF file renamed as .pdf
4. **Test large files** - Memory management under stress
5. **Test rapid clicking** - Click submit multiple times quickly

---

---

# Issues in buntoolFunctions.js

## Critical Bugs

### 🔴 Bug #7: Silent Failure in mergePdfsByTOC
**File**: `js/buntoolFunctions.js:32`
**Status**: Identified
**Priority**: CRITICAL

**Description**:
When PDF merge fails, function returns `undefined` instead of throwing or returning partial result with error info.

**Code**:
```javascript
} catch (error) {
    console.error(`[ERROR] Processing error for file:' ${entry.filename}: `, error);
    return;  // ⚠️ Returns undefined - same pattern as Bug #1
}
```

**Impact**:
- If any single PDF fails to load/merge, entire bundle fails silently
- Caller receives `undefined` instead of expected Uint8Array
- Creates cascading failures in pipeline (same root cause as blank bundle issue)

**Fix**:
Throw error or return structured error response. Consider partial merge with error report.

## High Priority Issues

### 🟡 Issue #7: Unused Import
**File**: `js/buntoolFunctions.js:6`
**Status**: Identified
**Priority**: HIGH (file size impact)

**Description**:
The entire `docx` library is imported but never used in the file.

**Code**:
```javascript
import * as docx from "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"
```

**Impact**:
- Unnecessary network request (~200-500KB)
- Slower initial page load
- Wasted browser memory

**Fix**:
Remove import unless future feature needs it (notes mention "option to just make the index not the whole bundle (pdf? docx?)")

---

### 🟡 Issue #8: Typo in Function Name
**File**: `js/buntoolFunctions.js:40`
**Status**: Identified
**Priority**: MEDIUM

**Description**:
Function name has typo: `makeIntentonallyBlankPage` should be `makeIntentionallyBlankPage`

**Code**:
```javascript
export async function makeIntentonallyBlankPage () {
```

**Impact**:
- Professional appearance
- Function appears unused - may be for future "printable bundle" feature

**Fix**:
Rename to `makeIntentionallyBlankPage` (or remove if truly unused)

---

### 🟡 Issue #9: No Error Handling for Font Loading
**File**: `js/buntoolFunctions.js:135-157, 612-726`
**Status**: Identified
**Priority**: HIGH

**Description**:
Font fetch operations lack error handling. If font files are missing or network fails, functions crash.

**Affected Functions**:
- `addPageNumberingToPdf()` - Lines 135-157
- `makeTocPages()` - Lines 612-726

**Code Example**:
```javascript
fontBytes = await fetch('./fonts//serif/NotoSerif-Regular.ttf').then(res => res.arrayBuffer());
// ⚠️ No error handling for 404, network failure, etc.
```

**Impact**:
- Bundle generation fails silently if fonts missing
- No fallback to standard fonts
- Hard to debug for users

**Fix**:
Wrap font fetches in try-catch with fallback to standard fonts.

---

### 🟡 Issue #10: formatDate Doesn't Validate Input
**File**: `js/buntoolFunctions.js:467`
**Status**: Identified
**Priority**: HIGH

**Description**:
Function assumes date string is in `YYYY-MM-DD` format but doesn't validate before splitting.

**Code**:
```javascript
const [y, m, d] = entryDate.split("-");
// ⚠️ No check that entryDate is valid, contains dashes, or has 3 parts
```

**Impact**:
- Crashes if date is in wrong format (null, empty string, different format)
- `monthNumber` could be negative if `m` is undefined → array index error

**Fix**:
Add validation:
```javascript
if (!entryDate || typeof entryDate !== 'string') return '';
const parts = entryDate.split('-');
if (parts.length !== 3) return entryDate; // Return original if can't parse
```

---

### 🟡 Issue #11: Missing Validation in createTocEntries
**File**: `js/buntoolFunctions.js:422`
**Status**: Identified
**Priority**: HIGH

**Description**:
Function doesn't validate that `entry.pageCount` exists or is a number before math operations.

**Code**:
```javascript
pdfPageCountTracker += entry.pageCount;  // Line 460
// ⚠️ No check that pageCount is defined or is a number
```

**Impact**:
- If pageCount is missing/null/NaN, calculations break
- `thisPage` values become incorrect (NaN + number = NaN)
- Hyperlinks point to wrong pages

**Fix**:
Validate entry has required fields and pageCount is a positive number.

---

## Medium Priority Issues

### 🟢 Issue #12: Inconsistent Comparison Operators
**File**: `js/buntoolFunctions.js:111, 167-178, 197-208, 441`
**Status**: Identified
**Priority**: LOW

**Description**:
Mix of `==` (loose equality) and `===` (strict equality) throughout file.

**Examples**:
```javascript
if (pageNumberingStyle == "None") { // Line 111 - loose
if (entry.sectionMarker == 1) {     // Line 441 - loose
```

**Impact**:
- Type coercion could cause unexpected behavior
- Inconsistent code style

**Fix**:
Use `===` and `!==` consistently throughout (JavaScript best practice).

---

### 🟢 Issue #13: Double Slashes in Font Paths
**File**: `js/buntoolFunctions.js:135, 140, 145, 150, 155, etc.`
**Status**: Identified (cosmetic)
**Priority**: LOW

**Description**:
Font paths contain double slashes: `'./fonts//serif/...'`

**Code**:
```javascript
fontBytes = await fetch('./fonts//serif/NotoSerif-Regular.ttf').then(...)
//                              ^^
```

**Impact**:
- Works fine (browsers normalize paths)
- Looks unprofessional
- Inconsistent (line 646 has single slash: `'./fonts/sans/static/...'`)

**Fix**:
Remove double slashes for consistency.

---

### ✅ Issue #14: Unused Function Parameters
**File**: `js/buntoolFunctions.js:351`
**Status**: FIXED
**Priority**: LOW

**Description**:
`setMetadata()` declared `title`, `author`, `subject` parameters but never used them.

**Old Code**:
```javascript
export function setMetadata(pdfBytes, tocEntries, title, author, subject) {
  // title, author, subject are never referenced - config values used instead
```

**New Code**:
```javascript
export function setMetadata(pdfBytes, tocEntries, config) {
  // Uses config.getOption() to access metadata values
```

**Fix Applied**:
Removed unused parameters from function signature. This was fixed as part of the global state refactoring (see Improvement #3).

---

### 🟢 Issue #15: Missing Semicolons
**File**: Multiple locations throughout
**Status**: Identified
**Priority**: LOW

**Description**:
Inconsistent semicolon usage. Some statements have them, others don't.

**Examples**:
```javascript
const pdfCopy = new Uint8Array(pdfBytes)  // No semicolon (line 252)
let doc = mupdf.Document.openDocument(pdfCopy, "application/pdf");  // Has semicolon (line 253)
```

**Impact**:
- Could cause ASI (Automatic Semicolon Insertion) bugs
- Inconsistent code style

**Fix**:
Either use semicolons consistently or remove all (pick a style guide).

---

### 🟢 Issue #16: copyPage/copyAllPages Functions Unused
**File**: `js/buntoolFunctions.js:75-96`
**Status**: Identified
**Priority**: LOW

**Description**:
Functions `copyPage()` and `copyAllPages()` are exported but never used anywhere in codebase.

**Impact**:
- Dead code
- Possibly legacy from earlier implementation

**Fix**:
Remove if truly unused, or document why they're kept (future feature?).

---

## Code Quality Issues

### 📋 Quality #4: Very Long Function (makeTocPages)
**File**: `js/buntoolFunctions.js:551-924`
**Status**: Identified
**Priority**: MEDIUM

**Description**:
`makeTocPages()` is 373 lines long with deeply nested logic and multiple responsibilities.

**Issues**:
- Font loading switch (case blocks are repetitive ~100 lines)
- Title rendering logic for confidential marking
- Table generation
- Complex coordinate calculations

**Impact**:
- Hard to understand and maintain
- Difficult to test individual pieces
- Repeated code in font switch cases

**Recommendations**:
1. Extract font loading to separate function: `loadFont(fontType)`
2. Extract confidential title rendering: `renderConfidentialTitle(doc, title, options)`
3. Extract table setup: `setupTableStyles(fontForIndex, tocInternalConfig)`

---

### 📋 Quality #5: Magic Numbers Throughout
**File**: `js/buntoolFunctions.js` (multiple locations)
**Status**: Identified
**Priority**: LOW

**Examples**:
```javascript
x: 50,              // Line 44 - what is 50?
y: 400,             // Line 45 - what is 400?
textLabelSize = 18  // Line 161 - why 18?
const a4Width = 595.28;  // Line 184 - OK, but should be constant
```

**Fix**:
Define named constants at top of file:
```javascript
const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const DEFAULT_FOOTER_SIZE = 18;
```

---

### 📋 Quality #6: No Input Validation
**File**: Most functions
**Status**: Identified
**Priority**: MEDIUM

**Description**:
Functions don't validate inputs before processing.

**Examples**:
- `mergeTwoPdfs()` - doesn't check if pdfAbytes/pdfBbytes are valid
- `addHyperlinks()` - doesn't check if pdfBytes is valid Uint8Array
- `addOutlineItems()` - doesn't check if tocEntries is empty

**Fix**:
Add guards at start of functions:
```javascript
if (!pdfBytes || !(pdfBytes instanceof Uint8Array)) {
  throw new TypeError('pdfBytes must be a Uint8Array');
}
```

---

### 📋 Quality #7: Comment Typos and Grammar
**File**: Multiple locations
**Status**: Identified
**Priority**: LOW

**Examples**:
```javascript
// Line 101: "in a conigured style" → "in a configured style"
// Line 828: "abovet title" → "above title"
// Line 807: "meaasure" → "measure"
```

---
