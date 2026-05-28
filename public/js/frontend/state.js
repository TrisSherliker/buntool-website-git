/**
 * Shared mutable state for the BunTool frontend.
 * All frontend submodules import this object and mutate it directly.
 */
export const state = {
  // lazy-loaded heavy modules (set during DOMContentLoaded)
  processTheBundle:      null,
  countPdfPages:         null,
  validateAndCountPages: null,
  validateCoverPage:     null,
  chrono:                null,

  // file data
  filesMap:          new Map(),   // filename → File
  frontendInputData: {},          // filename → { title, date, pageCount }
  coversheetFile:    null,

  // section state
  isSectioned:    false,
  nextSectionNum: 1,

  // drag state
  draggedRow:     null,
  draggedSection: null,
  reorderMode:    'drag',         // 'drag' | 'arrows'

  // config (assigned after DOMContentLoaded)
  config: null,

  // bundle generation flow state
  bundleConfirmed:       false,
  largeBundleConfirmed:  false,
  pendingConfirmAction:  null,
  _cancelReject:         null,

  // processing overlay UI state
  _trackInitialized:    false,
  _overlayOriginalHTML: null,
};
