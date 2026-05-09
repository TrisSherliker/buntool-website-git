# Development roadmap

## High priority features

Features with an obvious cost-benefit updside

- [x] Handle scanned files with rotation tags
- [x] Tutorial function
- [x] Coversheet option
- [ ] Page numbering styles
  - [ ] margin size
  - [ ] font colour (red)
  - [ ] page numbering size
  - [ ] consider: auto-detect content overlap?
- [w] Log error messages
- [ ] User help for common error messages
- [x] Split logic into modules by dependency 

## Requested features requiring more thought

Good ideas which are complicated to implement

- [ ] Templating system for different tribunals
  - [ ] choose default or specific court
  - [ ] claim no, coversheet
  - [ ] specific rules
  - [ ] include claim number check for different tribunals
- [ ] Section-based page numbering for compatibility with Family court non-financial bundles
- [ ] sort files within sections in frontend (qol but requires custom sort behaviour)
- [ ] Witness statement coversheet maker

## Long term at best

Features that may be impossble or cumbersome to develop

- [ ] OCR Documents (tesseract.js if not getTextContent())
- [ ] MS Word file handling
- [ ] Image file handling