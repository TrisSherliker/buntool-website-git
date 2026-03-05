# Buntool Javascript Dev log

## Overall status

Site:
- [ ] Review frontend
- [ ] homepage content
- [ ] how to guide content and merge with tips
- [ ] legal page
- [ ] resources
- [ ] contact
- [ ] github repo links
- [ ] donation links
- [ ] donation in top bar?

Bugs:

Data handling:
- [x] ingest csv
- [x] create toc entries
- [x] Data structure to carry options
- [x] parse options
- [x] sanitise all text

PDF manipulation:
- [ ] Make sure ttf fonts are embedded somehow. How?
- [ ] Check that the code handles input pdfs of different page sizes properly
- [ ] validate pdf files (by mime type)
- [x] count pdf pages
- [x] merge pdfs
- [x] create index pages
  - [x] basic table generation
  - [x] multiline text on page
  - [x] multipage
  - [x] font and other styling
- [x] pagination
- [x] measure text location
- [x] measure page size
- [x] add hyperlink annotations
- [x] outline items
- [x] Metadata writer
  - [x] polish this up once options s> imports
- [x] Check tramlines in title
-wasm filesystem for file handling in mupdf functions (mupdf.FS.writeFile('/filename.pdf',pdfBytes), out = doc.saveToBuffer, and FS.unlink to clean up)
- [x] cleanup files at the end (maybe also periodically)
- [x] try to save fewer files
- [x] Perform File Checks

Extended functionality
- [x] Allow printable: insert blank pages before any pdf which would otherwise begin on an even page.
- [ ] Reloadable state (see below)
- [ ] option to just make the index not the whole bundle (pdf? docx?)
- [ ] Add Optional lines of Court Information at top (in the [CourtName])
- [ ] filesize check and split into multiple volumes
- [ ] make files smaller/compress pdfs
- [ ] custom confidential label/colour
- [ ] OCR if not already done
- [ ] option to change colour of page numbers?
- [ ] Add coversheet option

Code Sanity
- [x] jsdoc comments
- [x] lazy loading libs
- [x] Structure the code into modules
- [ ] assert for assumptions
- [ ] add ifexists checks before function calls
- [ ] Error handling: `try` wrapping
- [x] use ternary operator `?` to assign values depending on conditions rather than if blocks, and use nice config blocks like in the toc generate function
- [x] check async/blocking flow. Why am I only sometimes using await? because it's hacky.
- [ ] document.isPDF() checks before editing each pdf
- [x] error catching

- [ ] save and reload state:
  - [ ] split pdf by bookmark?
  - [ ] remove pagenumbers (see $tools/redactpdf for python implementation of redacting based on colour)
  - [x] save tocEntries object in document metadata (info Key: Bundle Index)
  - [x] save tocEntries  in a tagged annotation (invisible free text annotation on p1 with BundleIndex data)
  - [x] retreive metadata object
  - [x] tag pagenumbers (now tagged by \u200B 0-width-space as first char and use of very specific black colour rgb(0.072, 0.021, 0.073))
  - [x] ingest tocEntries object embedded in pdf, and populate frontend on that basis (this is so cool)

Far future: make it downloadable
- [ ] webpack or vite? Or change to browser code?
- [ ] file system / fetch
UI Fun
- possibly mock up an index live preview

## 6 April 2024

Created project. Beginning to learn Javascrpt.

Do not properly understand differences between Node and browser. Still, I'll work with Node runtime for local testing.

 I've stored test PDFs and a hardcoded csv index locally.

### Implementations

Implemented functions:

- IngestCSV
- mergepdfs (pdflib)
- countpdfpages
- create toc entries
- perform file checks (create dirs if not exist, check all expected files present)

### Libraries

Decided that I'm going to need three libraries.

pdflib: Good for merging.
A generation library for generating the index.
Finally, MuPDF WASM for some more advanced manipulations.

### mupdf wasm

Does not generate, but
- Create index:
  - (use another lib to generate)
  - extract text with position information (StructuredText object)
- merge index and main content
- Paginate
  - add pagination annotations to each page
  - 'bake' annotations (equivalent to overlay)
- hyperlink
  - create annotations with each of the position elements from the create index step
- add outline item
  - seems to have outline inserting functionality

## 12 April 2025

Beginning to work with mpdf.
https://mupdf.readthedocs.io/en/latest/mupdf-wasm.html

Goal today: pagination. There are three logical ways to approach this:

 1. **Overlay**: Create a pdf with N pages. Add a page number to each footer, with a blank background. Overlay that pdf onto the target pdf. This is the method used by buntool python.

 2. **Annotations**: Add an annotation to the footer of every page. Then, 'bake' that annotation on, fixing it onto the page. This is supported by mupdf. It feels like a viable solution, but it would also have the problem of baking (removing interactive content of) all other annotations, so is better avoided.

 3. **Just scribe text**: This is similar to 2 above, but skips the annotation stage. Not sure whether possible under mupdf.

Of these,
 1 - is not necessary
 2 - works with mupdf. And it doesn't remove hyperlinks, though it does risk modifying input pdfs.
 3 - works with pdf lib, though not mupdf

Implemented
 - addPageNumberingToPdf

Tomorrow - generate index somehow.

## 13 April 2025

Implemented:
- TOC generation
- mergeTwoPdfs
- measure text for hyperlinking
- add hyperlinks

Great progress with jsPDF and the autotable plugin. It's slightly opinionated yet smooth.

Opted to draw with js objects rather than html, to avoid circular development (I'll leave the html for the frontend, not the other way around). Focusing on one language at a time is enough right now.

The Autotable function in particular is well set up for measuring and reporting what it did. Here's an example that will be useful for hyperlinking:

```js
// Configure autoTable
autoTable(doc, {
  head: headers,
  body: body,
  startY: 20,
  didDrawCell: (data) => {
    // Check if this is the first cell in the row
    if (data.section === "body" && data.column.index === 0) {
      const rowInfo = {
        rowNumber: data.row.index + 1, // Row number (1-based index)
        x: data.cell.x, // X-coordinate of the row
        y: data.cell.y, // Y-coordinate of the row
        width: data.table.width, // Width of the row (entire table width)
        height: data.row.height, // Height of the row
      };
      rowCoordinates.push(rowInfo);

      // Log the row information
      console.log(`Row ${rowInfo.rowNumber}: x=${rowInfo.x}, y=${rowInfo.y}, width=${rowInfo.width}, height=${rowInfo.height}`);
    }
  },
});
```

It worked really nicely - just with an mm to pts conversion to format for mupdf.

## 14 April 2025

Thinking about how to move from local Node enviornment to browser-based environment.

Challenges:

- use of fs and path in Node is not supported.
- More generally, the system of file saving and re-loading is inefficient and server-minded not client-minded.
- will need to make sure that memory is handled carefully, or I'll over-stress client side resource
- how do uploads work when it's not uploading to anywhere? Put another way, what's the clientside equivalent of a POST request?

Useful concepts (learning ntoes from conversing with copilot):

- Blobs (Binary large object) = raw data in browser. Copilot says to use URL.createObjectURL() to fashion a download URL from a blob. Great!
- Browser local storage is a key-value store. This could be useul for allowing a user to store config options, defaults, and history but is capped at 5MB.
- ArrayBuffer and Uint8Array - two other memory object typws.
- To replace the current approach of saving file states,
  - Don't write to disk. Pass aroud the memory object.
  - Pipeline processing where functions return Blobs, ingest Blobs as input. Save on load time as well.
  - memory managemnet:
    - If I create a new object each time, it'll multiply the memory usage.
    - instead, I could just reuse variables: load the pdfData once, and then assign the result of each function to pdfata. That'd probably use approx. double the input memory (plus any used by intermediate operations) while function is in progress, but it will wane to the actual bundle size after the function completes.
  - Consider streaming APIs for pdf-lib or mupdf:
    - intuitively, PDF seems ill suited to streaming.
  - Garbage collector in JS:
    - auto memory management
    - Sweeps away data that is no longer 'reachable'.
    - It'll therefore be really important to stop 'reachability' once data is finished with. For example, once the first merge option is complete I won't need the input files any more, so I'll need to remove any variables that reference them at the time they are finished with.
    - global variables cause objects to continue to be reachable. So, avoid them. This is anything without 'let', 'const' or 'var'. Also, use of 'var' outside a function is said to be global, but I need to check this (maybe just avoid var and stick to scoped const and let).
    - once objects are finished with, reassign them to `null` or `{}`.
    - if big objecs are in an object of `map`, that blocks garbage collection because the reference in the map remains. If this becomes an issue, the concept of a `weakMap` might help, but at present it doesn't feel like a tool I need.

So, to do list:

- [ ] hand around blobs instead of saving files
- [ ] go through codebase and be mindful of memory management, setting to null when data finished with.  This could be useful within functions to clean out memory early, if the function still has some stuff left to do; but generally it's handled by scoping.
- [ ] go through codebase and make sure const, let, and vars are appropriately used for scoping.

Example of downloading:
```js
const blob = new Blob([processedData], { type: "application/pdf" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "output.pdf";
link.click();
URL.revokeObjectURL(url); // Clean up
```


## 18-19 April 2025

goals:

- [x] Split js into three parts: main, functions, config
- [x] Change file handling into passing around a blob in memory
- [x] create Uint8array blob
- [ ] work out file loading of individual pdfs
- [x] pass blob around functions
- [ ] spec out an interface between frontend and main logic

Had difficulty with mupdf handling in memory. But it works with this system:

```js
  // Assume inputPdf is a Uint8Array containing PDF data
  const buffer = Buffer.from(pdfBytes); // Convert Uint8Array to Buffer
  let doc = mupdf.Document.openDocument(buffer, "application/pdf");

  // Do stuff here

  const outputPdf = doc.saveToBuffer("incremental").asUint8Array()
  return outputPdf;
  }
```
### Spec for interface

Interface will need to:

- have listeners and handlers for frontend functions
- offer a load-pdf and loadcsv function to get from the map, which will be used for replacing the existing fs reads
- sanitise filenames
- sanitise user input text
- savefile to user via url
- map (original filenames, sanitised filename, file object)


OK, lots to do:

- [x] Basic form
- [x] change around imports
- [x] the use of buffer = Buffer.from(pdf...) is possibly limited to Node
- [x] basic editable table
- [x] load table info into data element and handle in logic (not csv)
- [x] parse title
- [x] parse date
- [x] parse page count
~~- [ ] sanitise filename~~
- [ ] check not duplicate filenames
- [ ]

### data flow

Add PDF to form
date: extract
title: extract and prettify
Add to table
sort table by hand or auto
gather table data into structure that replaces csv
Pass data to logic

File list to pass includes:
  file name
  title
  date
  pagecount

## 26-27 April

Working on porting from node to browser. Catching up with stuff from last week too.

The frontend work from last week was useful, but I think started from the wrong place. I need to have a fully interactive frontend to test with, because without that I can't learn concepts one by one.

Side quest of making existing frontend compatible with node backend did not work at all: it requires me to understand concepts at a deeper level than I currently do. There was also some template code from the first iteration which interacts badly and which I don't fully get (or at least can't robustly separate the python-specific flow from the js flow).

So I'm in ./learning-form-data-flow/ working up an mvp from scratch, which is a much better learning experience and gives me control to build up based on what I've noticed, decided and learned since v1.

First, need to grapple with cdn imports and remove node-specific dependencies.

Mental consolidation about different variable types:

 - objects are key-value pairs, where all keys are strings or symbols. Using curly braces obj = {key: value, key1:value1} accessed by obj.key1 or obj['key1'].
 - Arrays are ordered lists like arr = [key, key1, key2] accessed the normal way like arr[0]
 - maps are keyvalue pairs where keys can be anything. map = new Map() set with map.set('key',value), Accessed with map.get('key')

Tasks:

- [x] remove fs calls
- [x] re-implement csv as index object
- [x] re-implement file save as download
- [x] buntoolmain should explicitly ingest config and index object

Next, to resolve problems:
- [x] Use of buffers is nodejs specific. Need to redo that.
- [x] "Make sure your build system (if any) and browser support ES module imports from URLs."
- [x] test various cdn delivery

With that done, the mvp is working in browser!

```
***PROTOTYPE IS WORKING***
```

It's now possible to begin bugtesting. There are some obvious ones:

- [x] need to hard refresh between runs (currently something is preventing reruns, presumbably because vars are cleared)
- [x] NaN in page numbering / page numbering starts at 1.
- [x] Strange buffer error when using many files: [This was due to mupdf re-using buffers under the hood, causing an interminttent crash. ]
- [x] need to clear index on submit

Moving on to add some frontend functions:
- [x] Parse date from filename or metadata
- [x] parse title from filename
- [x] strip double chrs
- [x] prettify title

## 28 April 2025

Next todo:

Implement all existing options
- [x] Ensure config globally available
- [x] confidential marking
- [x] footer font
- [x] page num alignment (L C R)
- [x] page num style (xofy)
- [x] footer prefix
- [x] index font
- [x] date style
- [x] bookmark style
- [ ] section breaks

Continuing progress:

- [x] use better fonts and embed them, to allow for wider charsets.

Test string:
```
Tęšt Štring: Lörem Ípsum – 你好，世界! Привет, мир! Café Müller: αβγδε ζήτα, مرحبا، שלום! 🚀🔥😊💡"
```

### Advice for fonts:

#### Font suggestions
Sans‑serif (modern, high legibility)
• Roboto    — Google’s system font, excellent x‑height
• Open Sans  — very neutral, great on screens
• Noto Sans  — extensive Unicode coverage

Serif (contemporary)
• Merriweather — slightly condensed, highly readable at small sizes
• Noto Serif  — companion to Noto Sans, broad script support
• Tinos    — metrics‑compatible with Times, under Apache 2.0

Serif (traditional “book” style)
• Libre Baskerville — optimized for body text, classic feel
• EB Garamond   — faithful revival of Claude Garamond’s roman
• Lora     — calligraphic details, good for long reads

Monospace
• Fira Code   — includes programming ligatures, MIT‑licensed
• Source Code Pro — Adobe’s open source code font, solid / clear
• Liberation Mono — metrically matches Courier New, SIL Open Font



#### PDFLIB

```js
Download a TTF that supports your scripts (e.g. Google’s Noto Sans).
Bundle it as an ArrayBuffer or fetch it at runtime:
export async function addPageNumberingToPdf(pdfBytes) {
  const pdfDoc = await pdflib.PDFDocument.load(pdfBytes);

  // fetch/embed your own font
  const fontBytes = await fetch('/fonts/NotoSans-Regular.ttf').then(r=>r.arrayBuffer());
  const unicodeFont = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();
  for (const [i, page] of pages.entries()) {
    const text = `Page ${i+1} of ${pages.length}`;
    page.drawText(text, {
      x: 50, y: 20,
      size: 12,
      font: unicodeFont,      // use your embedded TTF
      color: pdfLib.rgb(0,0,0)
    });
  }
  return pdfDoc.save();
}
```

#### JSPDF

```js
Convert NotoSans-Regular.ttf to a base64 string or serve it.
Register it in jsPDF before you call .text():

import jsPDF from 'https://cdn.jsdelivr.net/npm/jspdf@3.0.1/+esm';

// at init time
const doc = new jsPDF();
const notoTTF = await fetch('/fonts/NotoSans-Regular.ttf')
  .then(r=>r.arrayBuffer());
const base64 = btoa(
  new Uint8Array(notoTTF).reduce((s,b)=> s+String.fromCharCode(b), '')
);
doc.addFileToVFS('NotoSans.ttf', base64);
doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');

// later, when drawing:
doc.setFont('NotoSans');
doc.setFontSize(12);
doc.text('你好, мир, مرحبا! 🚀', 20, 30);
```

Style some components:
- [x] size and style of cl no, project, title
- [x] toc elements
- [x] font sizes for footer
- [x] font sizes in table

## 29 April 2025

Next steps:
- [x] proof of concept for metadata embeddig
- [x] proof of concept for page numbering tagging
- [x] start with site design

## Planning website

Sitemap: I think I need the following pages:

- Home
- Make a Bundle
- How to
- Pricing
- About
- Legal terms

11ty or Hugo seem to be the best static site generators. Eleventy was appealing but I was slightly turned off by the way it seemed to heavily advertise netlify for hosting.  So, probablyhugo it is then.

For the sake of not losing them, the best 11t themes were:
  Shane Robinson's 11ty
  https://11ta.netlify.app/

  Home | Skeleventy
  https://skeleventy.netlify.app/

  11ty Fylgja Blog
  https://11ty-fylgja.netlify.app/

For Hugo, it's [HugoPlate](https://themes.gohugo.io/themes/hugoplate/) by a mile. Unfortunately that and a bunch of other templates had breaking dependency issues which I can't be faffed learning my way around. Instead:

https://github.com/chaoming/hugo-saasify-theme

customisation section of readme says to look at:

- [ ] Colors in tailwind.config.js
- [ ] Fonts in tailwind.config.js
- [ ] customise components like buttons, cards etc in assets/css/main.css
- [ ] content structure

More than that, I need to:

- [ ] Set up navbar items: modify [menu] section of Hugo.toml
- [ ] logo in header: theme parameters around line 38 of hugo.toml "logo" and "header logo"; replace logo file in static/imates/
- [ ] footer: hugo.toml at # footer sections. There are 'column 1 menu' and 'configuration' parts; and template at /layouts/partials/footer/
- [ ] frontpage content
- [ ] About content
- [ ] licence content (and pricing)
- [ ] donate
- [ ] guide (3 pages)
- [ ] footer
- [x] (c) notice
- [x] GH and similar links
- [ ] GH readme

Colour palette:

```css
          50: #eef1fc',
          100: #dde3f9',
          200: #bbc7f3',
          300: #99abec',
          400: #778fe6',
          500: #5573df',
          600: #425ad6',
          700: #3548ab',
          800: #283680',
          900: #1b2456',

        secondary: {
          050: #faf5ff',
          100: #f3e8ff',
          200: #e9d5ff',
          300: #d8b4fe',
          400: #c084fc',
          500: #a855f7',
          600: #9333ea',
          700: #7e22ce',
          800: #6b21a8',
          900: #581c87'

050: #e6fbfa',
100: #c7f7f5',
200: #99eeeb',
300: #6be6e0',
400: #3cded6',
500: #1ed6cc',
600: #14bcb3',
700: #12928b',
800: #0f6d67',
900: #0c4844',

050: #fff0f5',
100: #ffe0eb',
200: #ffc1d8',
300: #ffa3c4',
400: #ff84b0',
500: #ff669c',
600: #ff5c9b',
700: #e63d7a',
800: #c52c61',
900: #a31c48',

050: #f5f0f9',
100: #ebe0f3',
200: #d6c1e7',
300: #c3a3db',
400: #a984cf',
500: #8f65c3',
600: #7547b7',
700: #5f37a2',
800: #4e2882',
900: #420560',

050: #fdf6ee',
100: #faecd8',
200: #f6d9b1',
300: #f1c68a',
400: #eba963',
500: #e58d3c',
600: #bc641d',
700: #9c5218',
800: #7d4214',
900: #5e3110',

```


### Testimonials

Stephen Vivian <mail@viviansc.co.za>
Senior barrister
"Just a quick note to thank you for your helpful Buntool, which I have been using to quickly create bundles in a matter involving a significant number of documents. It has truly saved me hours of my life."

Geoff Sharp <geoff.sharp@cliftonchambers.co.nz>
International commercial mediator
"fantastically useful tool in my area. Congratulations."

Paul Warry
paulw@grove-chambers.co.uk
Barrister
A quick note of thanks for taking the time and effort in putting together
BunTool and making it available as a resource.

Karen Medhurst <kemedhurst3@live.co.uk>
Litigant in person
 I am currently a litigant in person in a civil case - your product has been brilliant because reading the court rules on preparing paginated bundles is like reading something written in 'double dutch'.

J M <jb_mistry@hotmail.com>
Litigant in Person
I am supremely grateful to you...You saved me soooo much hassle & even focused my legal argument as I was working thru bundle creation now I have a winning case !

A London law firm
We have been testing your bundle tool which we have found very helpful... We use Bundledocs currently but found that your tool is much easier to use.


### Make images

Homepage:
- [x] simple to use (messy Pdfs -> organised bundle)
- [x] private and confidential: no tracking icon
- [x] free for everyone:
- [x] great for court: picture of court stuff

## 3 May 2025

Today's task: make a nice sortable table for frontend.

Tabular js looks good: https://tabulator.info/examples/6.3

Useful concepts:


- moveable rows (drag and drop)
- sorters by column, or functions like 'trigger sort' button?
- Editable data (type in / edit fields)
- interaction history (undo button)
- Themeing
- multi-selectable rows (select rows to drag together

- Sections UX might be solved:
  - use [movable rows with row groups](https://tabulator.info/examples/6.3#movable-groups)

Overall flow:
  - upload documents together.
  - button to add new section -> type section name -> define new groupValues entry
  - multiselect and drag into group
  - sort chronologically


   - add row implementation kind of works but it's not grouped.
   - Nested tables (for sections - could be clunky)
   - GroupBy field (great UX but wants to have a section column)
   - moveable rows with row groups
