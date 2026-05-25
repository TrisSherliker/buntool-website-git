import { state } from './state.js';
import { BUNDLE_STEPS } from './constants.js';

export function triggerDownload(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

export function buildTrack() {
  const track = document.getElementById('processing-track');
  if (!track) return;
  track.innerHTML = BUNDLE_STEPS.map((step, i) => {
    const isLast = i === BUNDLE_STEPS.length - 1;
    return `<div class="flex gap-3 items-stretch">
      <div class="flex flex-col items-center w-5 flex-shrink-0">
        <div id="station-dot-${i}" class="w-4 h-4 rounded-full border-2 border-gray-300 bg-white flex-shrink-0"></div>
        ${!isLast ? `<div id="station-line-${i}" class="w-px flex-1 bg-gray-200 mt-1"></div>` : ''}
      </div>
      <div class="${!isLast ? 'pb-3' : ''}">
        <span id="station-label-${i}" class="text-xs text-gray-400">${step}</span>
      </div>
    </div>`;
  }).join('');
  track.classList.remove('hidden');
  state._trackInitialized = true;
}

export function updateTrack(activeIndex) {
  BUNDLE_STEPS.forEach((_, i) => {
    const dot   = document.getElementById(`station-dot-${i}`);
    const line  = document.getElementById(`station-line-${i}`);
    const label = document.getElementById(`station-label-${i}`);
    if (!dot) return;
    if (i < activeIndex) {
      dot.className = 'w-4 h-4 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center';
      dot.innerHTML = '<svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
      if (line)  line.className  = 'w-px flex-1 bg-green-400 mt-1';
      if (label) label.className = 'text-xs text-green-600 font-medium';
    } else if (i === activeIndex) {
      dot.className = 'w-4 h-4 rounded-full bg-green-500 flex-shrink-0 animate-pulse';
      dot.innerHTML = '';
      if (line)  line.className  = 'w-px flex-1 bg-gray-200 mt-1';
      if (label) label.className = 'text-xs text-gray-800 font-semibold';
    } else {
      dot.className = 'w-4 h-4 rounded-full border-2 border-gray-300 bg-white flex-shrink-0';
      dot.innerHTML = '';
      if (line)  line.className  = 'w-px flex-1 bg-gray-200 mt-1';
      if (label) label.className = 'text-xs text-gray-400';
    }
  });
}

export function showProcessingOverlay(msg) {
  const overlay = document.getElementById('processing-overlay');
  if (!overlay) return;

  const inner = overlay.querySelector(':scope > div');
  if (inner && !state._overlayOriginalHTML) state._overlayOriginalHTML = inner.innerHTML;

  const el = document.getElementById('processing-overlay-msg');
  if (el) el.textContent = msg || 'Processing…';
  overlay.classList.remove('hidden');

  const stepIndex = BUNDLE_STEPS.indexOf(msg);
  if (msg === 'Building bundle…' || msg === 'Building index preview…') {
    buildTrack();
    updateTrack(-1);
  } else if (stepIndex !== -1) {
    if (!state._trackInitialized) buildTrack();
    document.getElementById('processing-track')?.classList.remove('hidden');
    updateTrack(stepIndex);
  } else if (!state._trackInitialized) {
    document.getElementById('processing-track')?.classList.add('hidden');
  }
}

export function hideProcessingOverlay() {
  const overlay = document.getElementById('processing-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  const inner = overlay.querySelector(':scope > div');
  if (inner && state._overlayOriginalHTML) inner.innerHTML = state._overlayOriginalHTML;
  state._trackInitialized = false;
}

export function showBundleReadyState(pdfBytes, filename) {
  state._cancelReject = null;
  document.getElementById('processing-cancel-btn')?.classList.add('hidden');
  updateTrack(BUNDLE_STEPS.length);

  setTimeout(() => {
    const overlay = document.getElementById('processing-overlay');
    if (!overlay) return;

    const spinnerRow = overlay.querySelector('.flex.items-center.gap-3.mb-4');
    if (spinnerRow) {
      spinnerRow.outerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div class="w-6 h-6 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-gray-800 flex-1">Bundle ready!</p>
          <button id="overlay-close-x" class="text-gray-400 hover:text-gray-600 transition" aria-label="Close">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>`;
    }

    const track = document.getElementById('processing-track');
    if (track) {
      const btns = document.createElement('div');
      btns.className = 'flex flex-col gap-2 mt-4';
      btns.innerHTML = `
        <button id="overlay-save-btn" class="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Save bundle
        </button>
        <button id="overlay-edit-btn" class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition">
          Close and edit
        </button>`;
      track.after(btns);
      let _lastEl = btns;

      if (typeof window.hasDefaultConfig === 'function' && !window.hasDefaultConfig()) {
        const defaultsPrompt = document.createElement('div');
        defaultsPrompt.className = 'mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 flex items-center justify-between gap-2';
        defaultsPrompt.innerHTML = `
          <span>Save these settings as your default for future bundles?</span>
          <div class="flex gap-2 flex-shrink-0">
            <button id="save-defaults-yes" class="font-semibold hover:underline">Save</button>
            <button id="save-defaults-no" class="text-blue-400 hover:underline">No thanks</button>
          </div>`;
        btns.after(defaultsPrompt);
        _lastEl = defaultsPrompt;

        document.getElementById('save-defaults-yes')?.addEventListener('click', () => {
          window.saveDefaultConfig?.();
          defaultsPrompt.innerHTML = '<span class="text-green-700 font-medium">✓ Settings saved as default.</span>';
          setTimeout(() => defaultsPrompt.remove(), 2000);
        });
        document.getElementById('save-defaults-no')?.addEventListener('click', () => defaultsPrompt.remove());
      }

      const kofi = document.createElement('div');
      kofi.className = 'mt-3 pt-2 border-t border-gray-700 text-center';
      kofi.innerHTML = `<a href="https://ko-fi.com/buntool" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs text-white bg-pink-500 hover:bg-pink-600 rounded px-3 py-1.5 transition-colors">☕ Helpful? Donate to support!</a>`;
      _lastEl.after(kofi);
    }

    document.getElementById('overlay-save-btn')?.addEventListener('click', () => {
      triggerDownload(pdfBytes, filename);
      hideProcessingOverlay();
    });
    document.getElementById('overlay-close-x')?.addEventListener('click', () => hideProcessingOverlay());
    document.getElementById('overlay-edit-btn')?.addEventListener('click', () => hideProcessingOverlay());
  }, 800);
}
