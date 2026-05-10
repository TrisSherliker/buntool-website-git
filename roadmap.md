# Development roadmap

## High priority features

Features with an obvious cost-benefit updside

- [x] Handle scanned files with rotation tags
- [x] Tutorial function
- [x] Coversheet option
- [x] Page numbering styles
  - ~~margin size~~ (Centering is good enough and the simplicity tradeoff is not worth it)
  - [x] font colour (red, blue)
  - [x] page numbering size
  - [x] consider: auto-detect content overlap?
- [ ] Log error messages
- [x] Times and Arial free alternatives
- [x] User help for common error messages
- [x] Split logic into modules by dependency 

## Requested features requiring more thought

Good ideas which are complicated to implement

- [ ] Coversheet creator for bundles
- [ ] Templating system for different tribunals
  - [ ] choose default or specific court
  - [ ] claim no, coversheet
  - [ ] specific rules
  - [ ] include claim number check for different tribunals
- [ ] Section-based page numbering for compatibility with Family court non-financial bundles
- [ ] sort files within sections in frontend (qol but requires custom sort behaviour)
- [ ] Witness statement coversheet maker

## Long term at best

Features that may be impossble or cumbersome to develop without compromising on privacy or freedom

- [ ] OCR Documents (tesseract.js if not getTextContent())
- [ ] MS Word file handling
- [ ] Image file handling