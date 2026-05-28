import { state } from './state.js';

export function isFileMissingError(error) {
  if (!error) return false;
  if (error.name === 'NotFoundError') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('file or directory could not be found')
    || msg.includes('file not found')
    || msg.includes('cannot find the file')
    || msg.includes('no such file');
}

export function isMemoryError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('realloc')
    || msg.includes('malloc')
    || msg.includes('out of memory')
    || msg.includes('allocation failed')
    || msg.includes('memory exhausted');
}

export function showUploadWarningModal({ title, message } = {}) {
  const modal   = document.getElementById('upload-warning-modal');
  const titleEl = document.getElementById('upload-warning-modal-title');
  const msgEl   = document.getElementById('upload-warning-modal-msg');
  if (titleEl) titleEl.textContent = title   || '⚠️ Large upload';
  if (msgEl)   msgEl.textContent   = message || '';
  modal?.classList.remove('hidden');
}

export function showErrorModal({ title, message, error } = {}) {
  const modal          = document.getElementById('error-modal');
  const titleEl        = document.getElementById('error-modal-title');
  const msgEl          = document.getElementById('error-modal-msg');
  const hintEl         = document.getElementById('error-modal-hint');
  const detailsWrapper = document.getElementById('error-modal-details-wrapper');
  const detailsEl      = document.getElementById('error-modal-details');
  const copyBtn        = document.getElementById('error-modal-copy-btn');

  if (titleEl) titleEl.textContent = title   || 'Something went wrong';
  if (msgEl)   msgEl.textContent   = message || '';

  if (isFileMissingError(error)) {
    hintEl?.classList.remove('hidden');
  } else {
    hintEl?.classList.add('hidden');
  }

  if (error) {
    const buildSpan = document.querySelector('footer span.text-xs.text-gray-400');
    const build     = buildSpan ? buildSpan.textContent.trim() : 'unknown';
    const details   = [
      `Build: ${build}`,
      `Time: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Error: ${error.message || error}`,
      error.stack ? `Stack:\n${error.stack}` : '',
    ].filter(Boolean).join('\n');
    if (detailsEl) detailsEl.value = details;
    detailsWrapper?.classList.remove('hidden');
    copyBtn?.classList.remove('hidden');
  } else {
    detailsWrapper?.classList.add('hidden');
    copyBtn?.classList.add('hidden');
  }

  modal?.classList.remove('hidden');
}

const bundleInfoFields = [
  { id: 'config-bundleTitle', label: 'bundle title' },
  { id: 'config-claimNumber', label: 'claim number' },
  { id: 'config-projectName', label: 'case name' },
];

/** Returns true if the modal was shown (i.e. there ARE missing fields). */
export function showMissingInfoModal(actionType) {
  const missing = bundleInfoFields
    .filter(f => !document.getElementById(f.id)?.value.trim())
    .map(f => f.label);
  if (missing.length === 0) return false;
  const formatted = missing.length === 1
    ? missing[0]
    : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  const msgEl = document.getElementById('bundle-confirm-msg');
  if (msgEl) msgEl.textContent = `Are you sure you want to leave out the ${formatted}?`;
  state.pendingConfirmAction = actionType;
  document.getElementById('bundle-confirm-modal')?.classList.remove('hidden');
  return true;
}

/** Wire up static modal close/action buttons. Called once from frontend.js init. */
export function setupModals(form, runPreviewIndex) {
  document.getElementById('bundle-confirm-sure')?.addEventListener('click', () => {
    document.getElementById('bundle-confirm-modal')?.classList.add('hidden');
    if (state.pendingConfirmAction === 'bundle') {
      state.bundleConfirmed = true;
      form.requestSubmit();
    } else if (state.pendingConfirmAction === 'preview') {
      runPreviewIndex();
    }
    state.pendingConfirmAction = null;
  });

  document.getElementById('bundle-confirm-addinfo')?.addEventListener('click', () => {
    document.getElementById('bundle-confirm-modal')?.classList.add('hidden');
    const first = bundleInfoFields.find(f => !document.getElementById(f.id)?.value.trim());
    if (first) {
      const el = document.getElementById(first.id);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  document.getElementById('large-bundle-proceed')?.addEventListener('click', () => {
    document.getElementById('large-bundle-modal')?.classList.add('hidden');
    state.largeBundleConfirmed = true;
    form.requestSubmit();
  });

  document.getElementById('large-bundle-goback')?.addEventListener('click', () => {
    document.getElementById('large-bundle-modal')?.classList.add('hidden');
  });
}
