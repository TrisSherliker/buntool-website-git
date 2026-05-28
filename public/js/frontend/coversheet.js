import { state } from './state.js';
import { markDirty } from '../buntoolAutosave.js';
import { showErrorModal } from './modals.js';

const coversheetInput    = document.getElementById('coversheet-input');
const coversheetFilename = document.getElementById('coversheet-filename');
const coversheetClearBtn = document.getElementById('coversheet-clear-btn');
const coversheetBtnText  = document.getElementById('coversheet-btn-text');

export function setCoversheetSelected(name) {
  state.coversheetFile = name ? state.coversheetFile : null;
  if (coversheetFilename) {
    coversheetFilename.textContent = name || '';
    coversheetFilename.classList.toggle('hidden', !name);
  }
  coversheetClearBtn?.classList.toggle('hidden', !name);
  if (coversheetBtnText) coversheetBtnText.textContent = name ? 'Change coversheet…' : 'Add coversheet';
}

export function setup() {
  coversheetInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    coversheetInput.value = '';
    if (!file) return;

    if (!state.validateCoverPage) {
      ({ validateCoverPage: state.validateCoverPage } = await import('../buntoolPages.js'));
    }
    try {
      const processedBytes = await state.validateCoverPage(file);
      state.coversheetFile = new File([processedBytes], file.name, { type: 'application/pdf' });
      setCoversheetSelected(file.name);
      markDirty({ immediate: true });
    } catch (error) {
      showErrorModal({
        title: 'Invalid coversheet',
        message: 'The selected file could not be read as a PDF. Please choose a valid PDF file.',
        error,
      });
    }
  });

  coversheetClearBtn?.addEventListener('click', () => {
    state.coversheetFile = null;
    setCoversheetSelected(null);
    markDirty();
  });
}
