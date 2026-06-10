# Development roadmap

## Privacy improvements

In the spirit of cutting off as many third parties as possible,

- [ ] Move from Val.Town logging to an owned enpoint and trim file errors {S4-5}
- [ ] Host dependencies directly with cdns as fallback {S3}
- [ ] Clean up console messages of user data for better privacy on shared machines {F8}
- Caching: 
  - [ ] Fix caching to hash-validate at server and in _headers {S2} 
  - [ ] Tune long-cache for slow assets like fonts {F4}

## BugFixes {with tags}

- [ ] Sanitise imported strings via sections.js {S1}
- [ ] Dates
  - [ ] US Date format {B1} {B9}
  - [ ] Review date parsing logic and chrono-node fallback {B3}
- [ ] Extend per-section numbering to new metaWorker architecture {B2}
- [ ] Error handling of encrypted PDFs is tricky {B5}
- [ ] timeout extension to 240s and match in modal {B4}

## High priority features

Features with an obvious cost-benefit updside
- [ ] Clean up and commit bash scripts/release.sh
- [ ] Testing suite at deploy time {F1}
- [ ] UX improvements 
  - [ ] for modals {F5}{F6}
  - [ ] skip beforeunload where unnecessary {F8}
  - [ ] 
- [ ] Templating system for Family court
  - [ ] User flow needs an extra heirarchy in the /app/ route
  - [ ] choose default or specific court
  - [ ] claim no, coversheet
  - [ ] specific rules
  - [ ] include claim number check for different tribunals
- [x] Memory cleanliness. Face up to the mupdf memory copies.
- [x] Handle scanned files with rotation tags
- [x] Tutorial function
- [x] Coversheet option
- [x] Page numbering styles
  - ~~margin size~~ (Centering is good enough and the simplicity tradeoff is not worth it)
  - [x] font colour (red, blue)
  - [x] page numbering size
  - [x] consider: auto-detect content overlap?
- [x] Log error messages
- [x] Times and Arial free alternatives
- [x] User help for common error messages
- [x] Split logic into modules by dependency 

## Requested features requiring more thought

Good ideas which are complicated to implement

- [ ] Coversheet creator for bundles
- [ ] if docs are password protected, detect that at validation time and prompt for password. 
- [ ] Save local filesystem view of old bundles, restore
- [x] Section-based page numbering for compatibility with Family court non-financial bundles
  - [x] this needed quite a big architectural change
  - [x] and therefore
  - [x] deserves more footprint here
- [x] sort files within sections in frontend (qol but requires custom sort behaviour)

## Long term at best

Features that may be impossble or cumbersome to develop without compromising on privacy or freedom

- [ ] Witness statement coversheet maker
- [ ] OCR Documents (tesseract.js if not getTextContent())
- [ ] MS Word file handling
- [ ] Image file handling and conversion
