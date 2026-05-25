import { state } from './state.js';
import { DRAG_ICON_SVG } from './constants.js';
import { markDirty } from '../buntoolAutosave.js';
import { IndexData } from '../buntoolIndexData.js';
import { handleDragStart, handleFileDragOver, handleFileDrop, handleDragEnd } from './dragdrop.js';
import { getAllSectionTbodys } from './helpers.js';

// ─── Empty-section placeholders ──────────────────────────────────────────────

export function ensureEmptyPlaceholder(tbody) {
  if (!tbody) return;
  if (tbody.querySelector('tr.file-row')) return;
  if (tbody.querySelector('.empty-section-placeholder')) return;
  const tr = document.createElement('tr');
  tr.className = 'empty-section-placeholder';
  tr.innerHTML = `<td colspan="6" class="px-4 py-4 text-center text-sm text-gray-400 italic select-none">[empty — drag documents here]</td>`;
  tr.addEventListener('dragover', (e) => { if (state.draggedRow) { e.preventDefault(); e.stopPropagation(); } });
  tr.addEventListener('drop', (e) => {
    if (!state.draggedRow) return;
    e.preventDefault(); e.stopPropagation();
    removeEmptyPlaceholder(tbody);
    tbody.appendChild(state.draggedRow);
    state.draggedRow = null;
    markDirty();
  });
  tbody.appendChild(tr);
}

export function removeEmptyPlaceholder(tbody) {
  tbody?.querySelector('.empty-section-placeholder')?.remove();
}

// ─── Build a file-row <tr> ────────────────────────────────────────────────────

export function makeFileRow(filename, data) {
  const row = document.createElement('tr');
  row.draggable = state.reorderMode === 'drag';
  row.dataset.filename = filename;
  row.classList.add('file-row', 'hover:bg-gray-50', 'transition');
  row.innerHTML = `
    <td class="drag-handle px-2 py-3 cursor-move">${DRAG_ICON_SVG}</td>
    <td class="px-4 py-3 text-sm text-gray-500 filename-cell"></td>
    <td class="px-4 py-3 title-cell">
      <textarea class="title-input w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-filename="" rows="1"></textarea>
    </td>
    <td class="px-4 py-3 date-cell">
      <input type="date" class="date-input w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-filename="" />
    </td>
    <td class="px-4 py-3 text-sm text-gray-700 text-center pages-cell"></td>
    <td class="px-4 py-3 flex gap-2 actions-cell">
      <button type="button" class="move-up-btn text-gray-500 hover:text-gray-700 transition" title="Move up">▲</button>
      <button type="button" class="move-down-btn text-gray-500 hover:text-gray-700 transition" title="Move down">▼</button>
      <button type="button" class="download-pdf-btn text-blue-600 hover:text-blue-800 transition" data-filename="" title="Download this PDF">💾</button>
      <button type="button" class="delete-row-btn text-red-600 hover:text-red-800 transition" data-filename="" title="Delete row">❌</button>
    </td>`;
  row.querySelector('.filename-cell').textContent = filename;
  row.querySelector('.title-input').value  = data.title    || '';
  row.querySelector('.date-input').value   = data.date     || '';
  row.querySelector('.pages-cell').textContent = data.pageCount ?? '';
  row.querySelectorAll('[data-filename]').forEach(el => el.dataset.filename = filename);
  row.addEventListener('dragstart', handleDragStart);
  row.addEventListener('dragover',  handleFileDragOver);
  row.addEventListener('drop',      handleFileDrop);
  row.addEventListener('dragend',   handleDragEnd);
  return row;
}

// ─── Build IndexData from current DOM ────────────────────────────────────────

export function buildIndexData() {
  const sections = [];
  getAllSectionTbodys().forEach(tbody => {
    const sectionID  = tbody.dataset.sectionId;
    const headerRow  = tbody.querySelector('.section-header-row');
    const labelEl    = headerRow?.querySelector('.section-label-input');
    const sectionLabel = labelEl?.value.trim() || labelEl?.placeholder || '';
    const sectionName  = headerRow?.querySelector('.section-name-input')?.value.trim() ?? '';
    const files = [];
    tbody.querySelectorAll('tr.file-row').forEach(row => {
      const fn = row.dataset.filename;
      if (fn && state.frontendInputData[fn]) {
        files.push({
          filename:  fn,
          title:     state.frontendInputData[fn].title,
          date:      state.frontendInputData[fn].date || '',
          pageCount: state.frontendInputData[fn].pageCount,
        });
      }
    });
    sections.push({ sectionID, sectionLabel, sectionName, files });
  });
  // In sectioned mode, redesignate 0000 → 0001 so downstream sectionID === '0000' guards
  // treat it as a real section (not the null placeholder).
  if (state.isSectioned) {
    sections.forEach((s, i) => { s.sectionID = String(i + 1).padStart(4, '0'); });
  }
  return new IndexData(sections);
}

// ─── File-table delegated event handlers ─────────────────────────────────────

export function setup() {
  document.getElementById('file-table')?.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('title-input')) {
      const filename = target.getAttribute('data-filename');
      if (state.frontendInputData[filename]) { state.frontendInputData[filename].title = target.value; markDirty(); }
    }
    if (target.classList.contains('date-input')) {
      const filename = target.getAttribute('data-filename');
      if (state.frontendInputData[filename]) { state.frontendInputData[filename].date = target.value; markDirty(); }
    }
  });

  document.getElementById('file-table')?.addEventListener('click', (e) => {
    // Move up
    if (e.target.classList.contains('move-up-btn')) {
      const row = e.target.closest('tr');
      if (!row) return;
      if (row.classList.contains('section-header-row')) {
        const tbody = row.closest('tbody');
        const prev  = tbody?.previousElementSibling;
        if (prev && prev.id !== 'tbody-section-0000' && prev.classList.contains('section-tbody')) {
          tbody.parentNode.insertBefore(tbody, prev);
          markDirty();
        }
        return;
      }
      const prev = row.previousElementSibling;
      if (prev && !prev.classList.contains('section-header-row') && !prev.classList.contains('empty-section-placeholder')) {
        row.parentNode.insertBefore(row, prev);
      } else {
        const tbody     = row.closest('tbody');
        const prevTbody = tbody?.previousElementSibling;
        if (prevTbody?.classList.contains('section-tbody')) {
          removeEmptyPlaceholder(prevTbody);
          prevTbody.appendChild(row);
          ensureEmptyPlaceholder(tbody);
        }
      }
      markDirty();
      return;
    }

    // Move down
    if (e.target.classList.contains('move-down-btn')) {
      const row = e.target.closest('tr');
      if (!row) return;
      if (row.classList.contains('section-header-row')) {
        const tbody = row.closest('tbody');
        const next  = tbody?.nextElementSibling;
        if (next?.classList.contains('section-tbody')) {
          tbody.parentNode.insertBefore(next, tbody);
          markDirty();
        }
        return;
      }
      const next = row.nextElementSibling;
      if (next && !next.classList.contains('empty-section-placeholder')) {
        row.parentNode.insertBefore(next, row);
      } else {
        const tbody     = row.closest('tbody');
        const nextTbody = tbody?.nextElementSibling;
        if (nextTbody?.classList.contains('section-tbody')) {
          removeEmptyPlaceholder(nextTbody);
          const afterHeader = nextTbody.querySelector('.section-header-row')?.nextSibling || nextTbody.firstChild;
          nextTbody.insertBefore(row, afterHeader);
          ensureEmptyPlaceholder(tbody);
        }
      }
      markDirty();
      return;
    }

    // Download
    if (e.target.classList.contains('download-pdf-btn') || e.target.closest('.download-pdf-btn')) {
      const btn      = e.target.closest('.download-pdf-btn');
      const filename = btn?.getAttribute('data-filename');
      const file     = filename ? state.filesMap.get(filename) : null;
      if (file) {
        const blob = new Blob([file], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
      }
      return;
    }

    // Delete file row
    if (e.target.classList.contains('delete-row-btn')) {
      const filename = e.target.getAttribute('data-filename');
      state.filesMap.delete(filename);
      delete state.frontendInputData[filename];
      const row   = e.target.closest('tr');
      const tbody = row?.closest('tbody');
      row.remove();
      if (tbody) ensureEmptyPlaceholder(tbody);
      markDirty();
    }
  });

  // Clear all rows
  document.getElementById('clear-all-rows-btn')?.addEventListener('click', () => {
    new Promise(resolve => {
      window._clearAllResolve = resolve;
      document.getElementById('clear-all-modal')?.classList.remove('hidden');
    }).then(confirmed => {
      if (!confirmed) return;
      state.filesMap.clear();
      Object.keys(state.frontendInputData).forEach(key => delete state.frontendInputData[key]);
      document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').forEach(el => el.remove());
      const section0000 = document.getElementById('tbody-section-0000');
      if (section0000) section0000.innerHTML = '';
      state.isSectioned    = false;
      state.nextSectionNum = 1;
      document.getElementById('file-table')?.classList.remove('sectioned');
    });
  });
}
