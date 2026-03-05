# Finding javascript libraries

ignore coversheet option for now. Ignore roman preface numbering too.
create index pages (first pass without file numbers)
create real index pages
check real length = expected length; else redo frontmatter with difference
merge frontmatter with main content
add pagination to merged pdf
add hyperlinks to index
add outline items
/ https://github.com/Hopding/pdf-lib/discussions/998
/ https://www.npmjs.com/package/@lillallol/outline-pdf
/ https://github.com/Hopding/pdf-lib/issues/281
bookmark the index


## MuPDF WASM

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
- 



## Overview

| Function                | PDFKit          | pdfmake         | jsPDF | pdfme | PDF-LIB |
|-------------------------|-----------------|-----------------|-------|-------|---------|
| Frontend browser        | OK              | OK              |       |       | OK        |
| Generate PDF for index  | OK              | OK              |       |       | OK      |
| Table formatting        | ?               | OK              |       |       | ?    |
| Combine:                | X               | X               |       |       | OK       |
| -Existing PDFS          | X               | X               |       |       | ?        |
| -Import pages           | X               | X               |       |       | OK      |
| Page Numbering:         | X               | X               |       |       | OK       |
| '-zip-overlay (stamp)   | X               | X               |       |       | X      |
| '-As text annotations   | OK              | OK              |       |       | OK        |
| Add outline items       | OK              | OK              |       |       |  X       |
| Hyperlinking:           | OK              | OK              |       |       |  x      |
| '-Hyperlink annotations | OK              | OK              |       |       |  x      |
| '-measure text          | X               | OK              |       |       |  OK       |
| Set metadata            | OK              | OK              |       |       |  OK      |
| Active?                 | OK              | OK              |       | OK    |  OK      |
| Overall                 | Generation only | Generation only |       |       |  Some editing, no hyperlinking     |

Outcomes: 
- Generate index: pdf make
- Combine pdfs: pdf -lib
- Pagination: pdf-lib
- Hyperlinking:
- Outline items: 


## Muhammara
NON BROWSER
  generate and modify
  does rect, overlay, combine
  claims to have extensibility to do annotations(!)
  https://github.com/julianhille/MuhammaraJS?tab=readme-ov-file#modify-an-existing-pdf 


## PDFKit 

Homepage: https://pdfkit.org/
https://github.com/foliojs/pdfkit
MIT Licensed

## pdfmake

https://pdfmake.github.io/docs/0.1/
https://github.com/bpampuch/pdfmake
MIt Licensed

## jsPDF

https://raw.githack.com/MrRio/jsPDF/master/docs/index.html 
https://github.com/parallax/jsPDF?tab=readme-ov-file
MIT Licensed

## PDF-LIB

https://github.com/Hopding/pdf-lib



## Notes

https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p