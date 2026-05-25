/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net) with significant frontend code additions by Claude Code
 * A tool for the creation  of legal bundles.
 * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 *
 * frontend.js — entry point. Wires together the frontend/ submodules.
 */

import Config from './buntoolConfig.js';
import { init as initAutosave, markDirty, saveNow, listSnapshots, loadSnapshot } from './buntoolAutosave.js';

import { state } from './frontend/state.js';
import { getAllSectionTbodys, getAllFileRows } from './frontend/helpers.js';
import { sortRowsBy, sortSection } from './frontend/sort.js';
import { getAutosaveState, applySnapshot } from './frontend/autosave.js';
import { setup as setupFileRows } from './frontend/fileRows.js';
import { setup as setupSections } from './frontend/sections.js';
import { setup as setupCoversheet } from './frontend/coversheet.js';
import { setup as setupFileProcessing } from './frontend/fileProcessing.js';
import { setup as setupBundleGeneration, runPreviewIndex } from './frontend/bundleGeneration.js';
import { setupModals } from './frontend/modals.js';

const form = document.getElementById('upload-form');

// ─── Config & state setup ────────────────────────────────────────────────────

state.config = new Config();
window.config = state.config;

// ─── DOMContentLoaded: lazy imports, autosave, event wiring ─────────────────

window.addEventListener('DOMContentLoaded', () => {
  import('./buntoolPages.js').then(m => {
    state.countPdfPages         = m.countPdfPages;
    state.validateAndCountPages = m.validateAndCountPages;
    state.validateCoverPage     = m.validateCoverPage;
  });
  import('./buntoolMain.js').then(m => {
    state.processTheBundle = m.default ?? m.processTheBundle;
  });
  import('https://esm.sh/chrono-node@2.9.0').then(m => { state.chrono = m; });

  // Autosave
  initAutosave(getAutosaveState);

  form?.addEventListener('change', (e) => {
    if (e.target.type === 'file') return;
    markDirty();
  });

  // Autosave restore modal
  document.getElementById('autosave-restore-btn')?.addEventListener('click', async () => {
    const snapshots = await listSnapshots();
    const modal     = document.getElementById('autosave-modal');
    const list      = document.getElementById('autosave-snapshot-list');
    if (!list || !modal) return;

    if (!snapshots.length) {
      list.innerHTML = '<p class="text-xs text-gray-500 text-center py-2">No autosaves found.</p>';
    } else {
      list.innerHTML = snapshots.map(s => {
        const when  = new Date(s.timestamp);
        const label = when.toLocaleDateString([], { day: 'numeric', month: 'short' })
                    + ' at ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const size  = s.sizeBytes < 1024 ** 2
          ? `${(s.sizeBytes / 1024).toFixed(0)} KB`
          : `${(s.sizeBytes / 1024 ** 2).toFixed(1)} MB`;
        const trunc   = (str, n) => str && str.length > n ? str.slice(0, n) + '…' : str;
        const title   = trunc(s.bundleTitle, 20);
        const proj    = trunc(s.projectName, 20);
        const nameStr = [title, proj].filter(Boolean).join(' / ');
        return `<button type="button"
          class="autosave-restore-item w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-xs"
          data-ts="${s.timestamp}">
          <span class="font-medium text-gray-800">${label}</span>${nameStr ? `<span class="text-gray-600 ml-2">${nameStr}</span>` : ''}
          <span class="text-gray-500 ml-2">${s.fileCount} doc${s.fileCount !== 1 ? 's' : ''} · ${size}</span>
        </button>`;
      }).join('');
      list.querySelectorAll('.autosave-restore-item').forEach(btn => {
        btn.addEventListener('click', async () => {
          modal.classList.add('hidden');
          const snapshot = await loadSnapshot(Number(btn.dataset.ts));
          if (snapshot) await applySnapshot(snapshot);
        });
      });
    }
    modal.classList.remove('hidden');
  });

  document.getElementById('autosave-modal-close')?.addEventListener('click', () => {
    document.getElementById('autosave-modal')?.classList.add('hidden');
  });

  document.getElementById('autosave-save-now-btn')?.addEventListener('click', async () => {
    if (!localStorage.getItem('buntool_autosave_welcomed')) {
      document.getElementById('autosave-welcome-modal')?.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('autosave-save-now-btn');
    const _setSaveLabel = (b, text) => { if (b) { const svg = b.querySelector('svg'); b.textContent = text; if (svg) b.prepend(svg); } };
    _setSaveLabel(btn, 'Saving…'); if (btn) btn.disabled = true;
    await saveNow();
    if (btn) btn.disabled = false; _setSaveLabel(btn, 'Save progress');
  });

  document.getElementById('autosave-welcome-ok')?.addEventListener('click', async () => {
    localStorage.setItem('buntool_autosave_welcomed', '1');
    document.getElementById('autosave-welcome-modal')?.classList.add('hidden');
    const btn = document.getElementById('autosave-save-now-btn');
    const _setSaveLabel = (b, text) => { if (b) { const svg = b.querySelector('svg'); b.textContent = text; if (svg) b.prepend(svg); } };
    _setSaveLabel(btn, 'Saving…'); if (btn) btn.disabled = true;
    await saveNow();
    if (btn) btn.disabled = false; _setSaveLabel(btn, 'Save progress');
  });

  // Column header sort
  let sortCol = null;
  let sortDir = 'asc';
  document.querySelector('#file-table thead')?.addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort-col]');
    if (!th) return;
    const col = th.dataset.sortCol;
    sortDir = (sortCol === col && sortDir === 'asc') ? 'desc' : 'asc';
    sortCol = col;
    document.querySelectorAll('#file-table thead [data-sort-col]').forEach(h => {
      h.querySelector('.sort-indicator').textContent = '';
    });
    th.querySelector('.sort-indicator').textContent = sortDir === 'asc' ? '▲' : '▼';

    if (e.shiftKey && state.isSectioned) {
      const hasSections = document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').length > 0;
      if (hasSections) {
        new Promise(resolve => {
          window._globalSortResolve = resolve;
          document.getElementById('global-sort-modal')?.classList.remove('hidden');
        }).then(confirmed => {
          if (!confirmed) return;
          const allRows     = getAllFileRows();
          sortRowsBy(allRows, col, sortDir);
          const section0000 = document.getElementById('tbody-section-0000');
          const headerRow   = section0000?.querySelector('.section-header-row');
          allRows.forEach(row => section0000.appendChild(row));
          document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').forEach(t => t.remove());
          state.isSectioned    = false;
          state.nextSectionNum = 1;
          document.getElementById('file-table')?.classList.remove('sectioned');
          if (headerRow) headerRow.remove();
        });
        return;
      }
      const allRows = getAllFileRows();
      sortRowsBy(allRows, col, sortDir);
      const section0000 = document.getElementById('tbody-section-0000');
      allRows.forEach(row => section0000.appendChild(row));
    } else {
      getAllSectionTbodys().forEach(tbody => sortSection(tbody, col, sortDir));
    }
  });

  document.getElementById('reorder-toggle-btn')?.addEventListener('change', (e) => {
    state.reorderMode = e.target.checked ? 'drag' : 'arrows';
    const table = document.getElementById('file-table');
    if (state.reorderMode === 'arrows') {
      table.classList.add('arrow-mode');
      getAllFileRows().forEach(r => r.draggable = false);
      document.querySelectorAll('.section-tbody').forEach(t => t.draggable = false);
    } else {
      table.classList.remove('arrow-mode');
      getAllFileRows().forEach(r => r.draggable = true);
      document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').forEach(t => t.draggable = true);
    }
  });

  // Wire up submodules
  setupFileRows();
  setupSections();
  setupCoversheet();
  setupFileProcessing();
  setupBundleGeneration(form, runPreviewIndex);
  setupModals(form, runPreviewIndex);
});

window.addEventListener('beforeunload', (e) => {
  if (state.filesMap.size > 0) e.preventDefault();
});
