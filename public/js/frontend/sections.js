import { state } from './state.js';
import { DRAG_ICON_SVG } from './constants.js';
import { markDirty } from '../buntoolAutosave.js';
import { attachSectionDragHandlers } from './dragdrop.js';
import { sortSectionPopover } from './sort.js';
import { ensureEmptyPlaceholder, removeEmptyPlaceholder } from './fileRows.js';
import { getDefaultSection0000 } from './helpers.js';

export function nextSectionLabel() {
  const total = document.querySelectorAll('.section-tbody').length;
  const idx   = state.isSectioned ? total : 0;
  return String.fromCharCode(65 + (idx % 26));
}

/** Build the inner HTML for a section-0000 header row. */
function section0000HeaderHTML(label = 'A', name = '') {
  return `
    <td class="drag-handle px-2 py-2 cursor-move">${DRAG_ICON_SVG}</td>
    <td class="px-2 py-2">
      <input type="text" class="section-label-input" value="${label}" placeholder="A" title="Section label (e.g. A, B, 1)" />
    </td>
    <td colspan="3" class="px-2 py-2">
      <input type="text" class="section-name-input" value="${name}" placeholder="Type section name" />
    </td>
    <td class="px-2 py-2 whitespace-nowrap">
      <label class="inline-flex items-center px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded cursor-pointer transition mr-1" title="Add files to this section">
        + Files
        <input type="file" class="section-add-files-input sr-only" multiple accept="application/pdf" data-section-id="0000" />
      </label>
      <button type="button" class="section-sort-btn text-xs text-gray-500 hover:text-gray-700 transition mr-1" data-section-id="0000" title="Sort files in this section">⇅</button>
      <button type="button" class="section-delete-btn text-xs text-red-500 hover:text-red-700 transition" data-section-id="0000" title="Delete this section">✕</button>
    </td>`;
}

/** Create and attach the editable header row to section 0000. */
export function createSection0000HeaderRow(section0000, label = 'A', name = '') {
  if (!section0000 || section0000.querySelector('.section-header-row')) return;
  const headerTr = document.createElement('tr');
  headerTr.className = 'section-header-row';
  headerTr.dataset.sectionId = '0000';
  headerTr.innerHTML = section0000HeaderHTML(label, name);

  headerTr.querySelector('.section-add-files-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length) {
      const { processFiles } = await import('./fileProcessing.js');
      await processFiles(files, section0000);
    }
  });
  headerTr.querySelector('.section-sort-btn')?.addEventListener('click', () => sortSectionPopover(section0000));
  headerTr.querySelector('.section-delete-btn')?.addEventListener('click', () => deleteSection(section0000));

  const handle = headerTr.querySelector('.drag-handle');
  handle?.addEventListener('mousedown', () => {
    if (state.reorderMode === 'drag') section0000.draggable = true;
  });
  document.addEventListener('mouseup', () => { section0000.draggable = false; }, { capture: true });
  section0000.draggable = false;
  attachSectionDragHandlers(section0000);
  section0000.insertBefore(headerTr, section0000.firstChild);
}

export function createSectionTbody(sectionID, label, name) {
  const tbody = document.createElement('tbody');
  tbody.className = 'section-tbody bg-white divide-y divide-gray-200';
  tbody.id = `tbody-section-${sectionID}`;
  tbody.dataset.sectionId = sectionID;
  tbody.draggable = false;

  tbody.innerHTML = `
    <tr class="section-header-row" data-section-id="${sectionID}">
      <td class="drag-handle px-2 py-2 cursor-move">${DRAG_ICON_SVG}</td>
      <td class="px-2 py-2">
        <input type="text" class="section-label-input" value="${label}" placeholder="${nextSectionLabel()}" title="Section label (e.g. A, B, 1)" />
      </td>
      <td colspan="3" class="px-2 py-2">
        <input type="text" class="section-name-input" value="${name}" placeholder="Type section name" />
      </td>
      <td class="px-2 py-2 whitespace-nowrap">
        <label class="inline-flex items-center px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded cursor-pointer transition mr-1" title="Add files to this section">
          + Files
          <input type="file" class="section-add-files-input sr-only" multiple accept="application/pdf" data-section-id="${sectionID}" />
        </label>
        <button type="button" class="section-sort-btn text-xs text-gray-500 hover:text-gray-700 transition mr-1" data-section-id="${sectionID}" title="Sort files in this section">⇅</button>
        <button type="button" class="section-delete-btn text-xs text-red-500 hover:text-red-700 transition" data-section-id="${sectionID}" title="Delete this section">✕</button>
      </td>
    </tr>`;

  attachSectionDragHandlers(tbody);

  tbody.querySelector('.section-add-files-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length) {
      const { processFiles } = await import('./fileProcessing.js');
      await processFiles(files, tbody);
    }
  });

  tbody.querySelector('.section-name-input')?.addEventListener('input', (e) => {
    if (e.target.value.trim()) e.target.style.outline = '';
  });

  tbody.querySelector('.section-sort-btn')?.addEventListener('click', () => sortSectionPopover(tbody));
  tbody.querySelector('.section-delete-btn')?.addEventListener('click', () => deleteSection(tbody));

  const headerDragHandle = tbody.querySelector('.section-header-row .drag-handle');
  headerDragHandle?.addEventListener('mousedown', () => {
    if (state.reorderMode === 'drag') tbody.draggable = true;
  });
  document.addEventListener('mouseup', () => { tbody.draggable = false; }, { capture: true });

  markDirty();
  return tbody;
}

export function addSection() {
  document.getElementById('file-table-empty')?.classList.add('hidden');
  document.getElementById('file-table-content')?.classList.remove('hidden');

  if (!state.isSectioned) {
    state.isSectioned = true;
    document.getElementById('file-table')?.classList.add('sectioned');
    const section0000 = getDefaultSection0000();
    createSection0000HeaderRow(section0000, 'A', '');
    ensureEmptyPlaceholder(section0000 ?? getDefaultSection0000());
    document.getElementById('file-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    markDirty();
    return;
  }

  const sectionID = String(state.nextSectionNum++).padStart(4, '0');
  const table     = document.querySelector('#file-table table');
  const tbody     = createSectionTbody(sectionID, '', '');
  table?.appendChild(tbody);
  ensureEmptyPlaceholder(tbody);
  markDirty();
}

// ─── Delete section ───────────────────────────────────────────────────────────

function buildSectionPickerList(excludeTbody) {
  const list = document.getElementById('delete-section-picker-list');
  if (!list) return;
  list.innerHTML = '';
  document.querySelectorAll('.section-tbody').forEach(t => {
    if (t === excludeTbody) return;
    const labelEl = t.querySelector('.section-label-input');
    const label   = labelEl?.value.trim() || labelEl?.placeholder || '';
    const name    = t.querySelector('.section-name-input')?.value.trim() || '';
    const display = (label && name) ? `${label} — ${name}` : (name || label || '(unnamed)');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-sm';
    btn.textContent = display;
    btn.addEventListener('click', () => {
      document.getElementById('delete-section-modal')?.classList.add('hidden');
      document.getElementById('delete-section-step1')?.classList.remove('hidden');
      document.getElementById('delete-section-step2')?.classList.add('hidden');
      window._deleteSectionResolve?.({ action: 'move', targetTbody: t });
    });
    list.appendChild(btn);
  });
}

function showDeleteSectionModal(tbody) {
  buildSectionPickerList(tbody);
  const fileCount = tbody.querySelectorAll('tr.file-row').length;
  const msg = document.getElementById('delete-section-msg');
  if (msg) msg.textContent = `This section contains ${fileCount} file${fileCount === 1 ? '' : 's'}. What would you like to do with them?`;
  document.getElementById('delete-section-step1')?.classList.remove('hidden');
  document.getElementById('delete-section-step2')?.classList.add('hidden');
  return new Promise(resolve => {
    window._deleteSectionResolve = resolve;
    document.getElementById('delete-section-modal')?.classList.remove('hidden');
  });
}

export async function deleteSection(tbody) {
  const fileRows = Array.from(tbody.querySelectorAll('tr.file-row'));
  if (fileRows.length > 0) {
    const result = await showDeleteSectionModal(tbody);
    if (result.action === 'cancel') return;
    if (result.action === 'move') {
      const target = result.targetTbody;
      removeEmptyPlaceholder(target);
      fileRows.forEach(row => target.appendChild(row));
    } else {
      fileRows.forEach(row => {
        const fn = row.dataset.filename;
        if (fn) { state.filesMap.delete(fn); delete state.frontendInputData[fn]; }
      });
    }
  }

  if (tbody.id === 'tbody-section-0000') {
    tbody.querySelector('.section-header-row')?.remove();
    removeEmptyPlaceholder(tbody);
  } else {
    tbody.remove();
  }

  const hasAnySection = document.querySelector('.section-tbody .section-header-row') !== null;
  if (!hasAnySection) {
    state.isSectioned = false;
    document.getElementById('file-table')?.classList.remove('sectioned');
  }
  markDirty();
}

// ─── Section picker (for main add-files button while sectioned) ───────────────

export function showSectionPicker(files) {
  const popover = document.getElementById('section-picker-popover');
  const list    = document.getElementById('section-picker-list');
  if (!popover || !list) return;
  list.innerHTML = '';

  document.querySelectorAll('.section-tbody').forEach(tbody => {
    const labelEl = tbody.querySelector('.section-label-input');
    const label   = labelEl?.value.trim() || labelEl?.placeholder || '';
    const name    = tbody.querySelector('.section-name-input')?.value.trim() || '';
    const display = (label && name) ? `${label} — ${name}` : (name || label || '(unnamed)');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-sm font-medium text-blue-700';
    btn.textContent = display;
    btn.addEventListener('click', async () => {
      popover.classList.add('hidden');
      const { processFiles } = await import('./fileProcessing.js');
      try { await processFiles(files, tbody); }
      catch (err) {
        const { showErrorModal } = await import('./modals.js');
        showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error: err });
      }
    });
    list.appendChild(btn);
  });

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'w-full text-left px-3 py-2 rounded-lg border border-dashed border-blue-300 hover:bg-blue-50 text-blue-600 text-sm transition';
  newBtn.textContent = '+ Create new section';
  newBtn.addEventListener('click', async () => {
    popover.classList.add('hidden');
    addSection();
    const newTbody = document.querySelector('.section-tbody:last-of-type');
    const { processFiles } = await import('./fileProcessing.js');
    try { if (newTbody) await processFiles(files, newTbody); }
    catch (err) {
      const { showErrorModal } = await import('./modals.js');
      showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error: err });
    }
  });
  list.appendChild(newBtn);
  popover.classList.remove('hidden');
}

export function setup() {
  document.querySelectorAll('.add-section-btn').forEach(btn => btn.addEventListener('click', addSection));
  document.getElementById('section-picker-cancel')?.addEventListener('click', () => {
    document.getElementById('section-picker-popover')?.classList.add('hidden');
  });
}
