/**
 * BunTool
 * Copyrght (c) 2025-2026 Tris Sheriker (tris@sherliker.net) with significant frontend code additions by Claude Code
 * A tool for the creation  of legal bundles.
 * Licensed under the Mozilla Public License Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://mozilla.org/MPL/2.0/.
 * 
 * frontend.js
 * frontend logic module
 */

let processTheBundle;
let countPdfPages;
let validateAndCountPages;
let validateCoverPage;
let coversheetFile = null;
let bundleConfirmed = false;
let largeBundleConfirmed = false;
let pendingConfirmAction = null;
let _cancelReject = null;

const BUNDLE_LOG_URL = 'https://trissherliker--cf20f90c1a4811f1b20642dde27851f2.web.val.run';

async function logBundleEvent(payload) {
  if (!['buntool.co.uk', 'www.buntool.co.uk'].includes(window.location.hostname)) return;
  try {
    await fetch(BUNDLE_LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch { /* non-critical */ }
}
let chrono;
let draggedRow = null;
let reorderMode = 'drag'; // 'drag' | 'arrows'

import Config from './buntoolConfig.js';
import { init as initAutosave, markDirty, saveNow, listSnapshots, loadSnapshot } from './buntoolAutosave.js';

const fileInput = document.getElementById('file-input');
const fileTableBody = document.getElementById('file-table-body');

function pulseStep2() {
  const step2 = document.getElementById('file-drop-zone');
  if (!step2) return;
  step2.scrollIntoView({ behavior: 'smooth', block: 'center' });
  step2.classList.add('pulse-ring');
  setTimeout(() => step2.classList.remove('pulse-ring'), 1500);
}
const form = document.getElementById('upload-form');
const addSectionBreakBtn = document.getElementById('add-section-break-btn');
const clearAllRowsBtn = document.getElementById('clear-all-rows-btn');
const indexData = [];

// Globals for inputs, files and config:
const filesMap = new Map(); // filename -> File
const frontendInputData = {}; // filename -> { title, date, pages }
const config = new Config();

function uniqueFilename(name) {
  if (!filesMap.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (filesMap.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}
window.config = config; // Expose config as global


/***********************************
 *         Autosave helpers        *
 ***********************************/

async function getAutosaveState() {
  if (filesMap.size === 0) return null;

  const files = [];
  for (const [filename, file] of filesMap) {
    files.push({ filename, bytes: await file.arrayBuffer() });
  }

  const tableOrder = [];
  fileTableBody.querySelectorAll('tr').forEach(row => {
    if (row.dataset.sectionBreak === 'true') {
      tableOrder.push({ type: 'section', title: row.querySelector('.section-break-title')?.value || '' });
    } else if (row.dataset.filename) {
      tableOrder.push({ type: 'file', filename: row.dataset.filename });
    }
  });

  const config = {
    claimNumber:      document.getElementById('config-claimNumber')?.value      || '',
    bundleTitle:      document.getElementById('config-bundleTitle')?.value       || '',
    projectName:      document.getElementById('config-projectName')?.value       || '',
    confidential:     document.getElementById('config-confidential')?.checked    ?? false,
    footerFont:          document.getElementById('config-footerFont')?.value           || '',
    alignment:           document.getElementById('config-alignment')?.value            || '',
    numberingStyle:      document.getElementById('config-numberingStyle')?.value       || '',
    footerPrefix:        document.getElementById('config-footerPrefix')?.value         || '',
    pageNumberColour:    document.getElementById('config-pageNumberColour')?.value     || 'black',
    fontFace:         document.getElementById('config-fontFace')?.value          || '',
    dateStyle:        document.getElementById('config-dateStyle')?.value         || '',
    outlineItemStyle: document.getElementById('config-outlineItemStyle')?.value  || '',
    printableBundle:  document.getElementById('config-printableBundle')?.checked ?? false,
    headingFontSize:  document.getElementById('config-headingFontSize')?.value   || '',
    indexFontSize:    document.getElementById('config-indexFontSize')?.value     || '',
    footerFontSize:   document.getElementById('config-footerFontSize')?.value    || '',
    showTableBorders: document.getElementById('config-showTableBorders')?.checked ?? false,
  };

  let coversheet = null;
  if (coversheetFile) {
    coversheet = { filename: coversheetFile.name, bytes: await coversheetFile.arrayBuffer() };
  }

  return { files, inputData: { ...frontendInputData }, tableOrder, config, coversheet };
}

async function applySnapshot(snapshot) {
  // Clear current state
  filesMap.clear();
  Object.keys(frontendInputData).forEach(k => delete frontendInputData[k]);
  fileTableBody.innerHTML = '';
  coversheetFile = null;
  setCoversheetSelected(null);

  // Restore files into filesMap
  for (const { filename, bytes } of snapshot.files) {
    filesMap.set(filename, new File([bytes], filename, { type: 'application/pdf' }));
  }

  // Restore inputData
  Object.assign(frontendInputData, snapshot.inputData);

  // Rebuild table rows in saved order
  for (const item of snapshot.tableOrder) {
    if (item.type === 'section') {
      const row = document.createElement('tr');
      row.draggable = reorderMode === 'drag';
      row.classList.add('section-break-row', 'bg-blue-50', 'border-t-2', 'border-blue-300', 'hover:bg-blue-100', 'transition');
      row.dataset.sectionBreak = 'true';
      row.innerHTML = `
        <td class="drag-handle px-2 py-3 cursor-move">
          <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
          </svg>
        </td>
        <td colspan="4" class="px-6 py-3">
          <input type="text" class="section-break-title w-full px-3 py-1 border border-blue-300 rounded bg-white text-blue-700 font-semibold text-align-left focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="" placeholder="Type section name e.g. 'Part 1: Evidence'"/>
        </td>
        <td class="px-6 py-3 flex gap-2">
          <button type="button" class="move-up-btn text-gray-500 hover:text-gray-700 transition" title="Move up">▲</button>
          <button type="button" class="move-down-btn text-gray-500 hover:text-gray-700 transition" title="Move down">▼</button>
          <button type="button" class="delete-section-break-btn text-red-600 hover:text-red-800 transition" title="Delete section break">❌</button>
        </td>`;
      row.querySelector('.section-break-title').value = item.title;
      row.addEventListener('dragstart', handleDragStart);
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('drop', handleDrop);
      row.addEventListener('dragend', handleDragEnd);
      fileTableBody.appendChild(row);
    } else {
      const data = frontendInputData[item.filename];
      if (!data) continue;
      const row = document.createElement('tr');
      row.draggable = reorderMode === 'drag';
      row.dataset.filename = item.filename;
      row.classList.add('hover:bg-gray-50', 'transition');
      row.innerHTML = `
        <td class="drag-handle px-2 py-3 cursor-move">
          <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
          </svg>
        </td>
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
      row.querySelector('.filename-cell').textContent = item.filename;
      row.querySelector('.title-input').value = data.title || '';
      row.querySelector('.date-input').value  = data.date  || '';
      row.querySelector('.pages-cell').textContent = data.pageCount ?? '';
      row.querySelectorAll('[data-filename]').forEach(el => el.dataset.filename = item.filename);
      row.addEventListener('dragstart', handleDragStart);
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('drop', handleDrop);
      row.addEventListener('dragend', handleDragEnd);
      fileTableBody.appendChild(row);
    }
  }

  // Restore config fields
  const c = snapshot.config;
  // _set: if val is undefined (field didn't exist at save time), leave the element at its HTML default
  const _set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val ?? ''; };
  const _chk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };
  _set('config-claimNumber',      c.claimNumber);
  _set('config-bundleTitle',      c.bundleTitle);
  _set('config-projectName',      c.projectName);
  _chk('config-confidential',     c.confidential);
  _set('config-footerFont',         c.footerFont);
  _set('config-alignment',          c.alignment);
  _set('config-numberingStyle',     c.numberingStyle);
  _set('config-footerPrefix',       c.footerPrefix);
  _set('config-pageNumberColour',   c.pageNumberColour);
  _set('config-fontFace',         c.fontFace);
  _set('config-dateStyle',        c.dateStyle);
  _set('config-outlineItemStyle', c.outlineItemStyle);
  _chk('config-printableBundle',  c.printableBundle);
  _set('config-headingFontSize',  c.headingFontSize);
  _set('config-indexFontSize',    c.indexFontSize);
  _set('config-footerFontSize',   c.footerFontSize);
  _chk('config-showTableBorders', c.showTableBorders);

  // Restore coversheet
  if (snapshot.coversheet) {
    coversheetFile = new File([snapshot.coversheet.bytes], snapshot.coversheet.filename, { type: 'application/pdf' });
    setCoversheetSelected(snapshot.coversheet.filename);
  }

  // Hide the step-2 hint since files are now loaded
  const hint = document.getElementById('file-input-hint');
  if (hint) hint.style.display = 'none';
}


/***********************************
 *  Event Listeners and Handlers   *
 ***********************************/

window.addEventListener('DOMContentLoaded', () => {
  import('./buntoolPages.js').then(m => { countPdfPages = m.countPdfPages; validateAndCountPages = m.validateAndCountPages; });
  import('./buntoolMain.js').then(m => processTheBundle = m.default ?? m.processTheBundle);
  import('https://esm.sh/chrono-node@2.9.0').then(m => chrono = m);

  // Autosave init
  initAutosave(getAutosaveState);

  // Config field changes dirty the autosave (file inputs excluded)
  form.addEventListener('change', (e) => {
    if (e.target.type === 'file') return;
    markDirty();
  });

  // Restore-from-autosave button
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
        const trunc = (str, n) => str && str.length > n ? str.slice(0, n) + '…' : str;
        const title = trunc(s.bundleTitle, 20);
        const proj  = trunc(s.projectName, 20);
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
      // Show welcome modal; actual save happens when the user dismisses it
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
    const rows = Array.from(fileTableBody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      const aSection = a.dataset.sectionBreak === 'true';
      const bSection = b.dataset.sectionBreak === 'true';
      if (aSection && bSection) return 0;
      if (aSection) return 1;
      if (bSection) return -1;
      let aVal, bVal;
      if (col === 'pages') {
        aVal = parseInt(a.querySelector('.pages-cell')?.textContent || '0', 10);
        bVal = parseInt(b.querySelector('.pages-cell')?.textContent || '0', 10);
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (col === 'filename') { aVal = a.dataset.filename || ''; bVal = b.dataset.filename || ''; }
      else if (col === 'title') { aVal = a.querySelector('.title-input')?.value || ''; bVal = b.querySelector('.title-input')?.value || ''; }
      else if (col === 'date') { aVal = a.querySelector('.date-input')?.value || ''; bVal = b.querySelector('.date-input')?.value || ''; }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    rows.forEach(row => fileTableBody.appendChild(row));
  });

  document.getElementById('reorder-toggle-btn')?.addEventListener('change', (e) => {
    reorderMode = e.target.checked ? 'drag' : 'arrows';
    const table = document.getElementById('file-table');
    if (reorderMode === 'arrows') {
      table.classList.add('arrow-mode');
      fileTableBody.querySelectorAll('tr').forEach(r => r.draggable = false);
    } else {
      table.classList.remove('arrow-mode');
      fileTableBody.querySelectorAll('tr').forEach(r => r.draggable = true);
    }
  });
});

window.addEventListener('beforeunload', (e) => {
  if (filesMap.size > 0) {
    e.preventDefault();
  }
});

// Drag and Drop Handlers
function handleDragStart(e) {
  draggedRow = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
  this.style.opacity = '0.4';
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  if (draggedRow !== this) {
    const allRows = Array.from(fileTableBody.querySelectorAll('tr'));
    const draggedIndex = allRows.indexOf(draggedRow);
    const targetIndex = allRows.indexOf(this);

    if (draggedIndex < targetIndex) {
      this.parentNode.insertBefore(draggedRow, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedRow, this);
    }
  }
  return false;
}

function handleDragEnd() {
  this.style.opacity = '1';
}

async function processFiles(files) {

  // Check total filesize (including existing files)
  let totalSize = 0;

  // Add existing files' sizes
  for (const existingFile of filesMap.values()) {
    totalSize += existingFile.size;
  }

  // Add new files' sizes
  for (const file of files) {
    totalSize += file.size;
  }

  const totalSizeMB = totalSize / (1024 * 1024);

  // Block if over 500MB
  if (totalSizeMB > 500) {
    showErrorModal({
      title: 'Total file size too large',
      message: `You have chosen ${totalSizeMB.toFixed(1)}MB worth of documents which would create a very large bundle. This is too big to be handled reliably, and exceeds the permitted file size. Please split the documents into multiple volumes (often labelled 'A', 'B' etc) and create separate bundles.`,
    });
    return;
  }

  // Hide the step 2 hint once files have been added
  if (files.length > 0) {
    const hint = document.getElementById('file-input-hint');
    if (hint) hint.style.display = 'none';
  }

  // Process each new file
  for (const file of files){
    // Materialise bytes into memory immediately so filesMap holds an in-memory copy,
    // not a live OS file reference that can expire (ChromeOS sandbox, network drives, permission changes)
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const key = uniqueFilename(file.name);
    const prettyTitle = prettifyTitle(file.name);
    const dateParseObj = await parseDateFromFilename(prettyTitle); // returns .date (as date obj), .name (stripped of date)
    const displayTitle = stripDoubleChars(dateParseObj.name);
    if (!countPdfPages){
      ({countPdfPages, validateAndCountPages} = await import('./buntoolPages.js'));
    }
    const validation = await validateAndCountPages(fileBytes);
    if (validation.error) {
      showErrorModal({
        title: 'Not a valid PDF file',
        message: `"${file.name}" does not appear to be a valid PDF file. Please check the file and try again.`,
      });
      continue;
    }
    const pageCount = validation.pageCount;

    const materializedFile = new File([fileBytes], file.name, { type: 'application/pdf' });
    filesMap.set(key, materializedFile);
    frontendInputData[key] = { title: displayTitle, date: dateParseObj.date, pageCount: pageCount };

    const row = document.createElement('tr');
    row.draggable = reorderMode === 'drag';
    row.dataset.filename = key;
    row.classList.add('hover:bg-gray-50', 'transition');
    row.innerHTML = `
      <td class="drag-handle px-2 py-3 cursor-move">
        <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
        </svg>
      </td>
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
        <button type="button" class="download-pdf-btn text-blue-600 hover:text-blue-800 transition" data-filename="" title="Download this PDF">
          💾
        </button>
        <button type="button" class="delete-row-btn text-red-600 hover:text-red-800 transition" data-filename="" title="Delete row">
          ❌
        </button>
      </td>
    `;
    row.querySelector('.filename-cell').textContent = key;
    row.querySelector('.title-input').value = displayTitle;
    row.querySelector('.date-input').value = dateParseObj.date || '';
    row.querySelector('.pages-cell').textContent = pageCount ?? '';
    row.querySelectorAll('[data-filename]').forEach(el => el.dataset.filename = key);

    // Add drag event listeners
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);

    fileTableBody.appendChild(row);
    markDirty({ immediate: true });
  };

  // After adding all files, warn if the total upload is very large
  let totalPagesNow = 0;
  let totalSizeMbNow = 0;
  for (const [fn, f] of filesMap) {
    totalSizeMbNow += f.size / (1024 * 1024);
    totalPagesNow += frontendInputData[fn]?.pageCount ?? 0;
  }
  if (totalPagesNow > 1000 || totalSizeMbNow > 100) {
    const parts = [];
    if (totalPagesNow > 1000) parts.push(`${totalPagesNow} pages`);
    if (totalSizeMbNow > 100) parts.push(`${totalSizeMbNow.toFixed(1)} MB`);
    showUploadWarningModal({
      title: '⚠️ Very large bundle',
      message: `Your documents total ${parts.join(' and ')}. It's very rare for single court bundles to exceed 1000 pages or 100 MB. You may want to consider splitting the documents into separate volumes (e.g. "Bundle A" and "Bundle B"). If you proceed, BunTool may take longer than usual to process.`,
    });
  }
}

fileInput.addEventListener('change', async (e) => {
  try {
    await processFiles(Array.from(e.target.files));
  } catch (error) {
    showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error });
  }
  // Reset file input so same file can be selected again if needed
  fileInput.value = '';
});

const coversheetInput    = document.getElementById('coversheet-input');
const coversheetFilename = document.getElementById('coversheet-filename');
const coversheetClearBtn = document.getElementById('coversheet-clear-btn');
const coversheetBtnText  = document.getElementById('coversheet-btn-text');

function setCoversheetSelected(name) {
  coversheetFile = name ? coversheetFile : null;
  if (coversheetFilename) { coversheetFilename.textContent = name || ''; coversheetFilename.classList.toggle('hidden', !name); }
  coversheetClearBtn?.classList.toggle('hidden', !name);
  if (coversheetBtnText) coversheetBtnText.textContent = name ? 'Change coversheet…' : 'Add coversheet';
}

coversheetInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  coversheetInput.value = '';
  if (!file) return;

  if (!validateCoverPage) {
    ({ validateCoverPage } = await import('./buntoolPages.js'));
  }
  try {
    const processedBytes = await validateCoverPage(file);
    coversheetFile = new File([processedBytes], file.name, { type: 'application/pdf' });
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
  coversheetFile = null;
  setCoversheetSelected(null);
  markDirty();
});

// Drop zone for dragging files from the OS onto the add-documents panel
const dropZone = document.getElementById('file-drop-zone');
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('ring-2', 'ring-pink-400');
});
dropZone.addEventListener('dragleave', (e) => {
  // Only remove highlight when leaving the drop zone entirely (not a child element)
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('ring-2', 'ring-pink-400');
  }
});
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('ring-2', 'ring-pink-400');
  try {
    await processFiles(Array.from(e.dataTransfer.files));
  } catch (error) {
    showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error });
  }
});

fileTableBody.addEventListener('input', (e) => {
  const target = e.target;
  if (target.classList.contains('title-input')) {
    const filename = target.getAttribute('data-filename');
    frontendInputData[filename].title = target.value;
    markDirty();
  }
  if (target.classList.contains('date-input')) {
    const filename = target.getAttribute('data-filename');
    frontendInputData[filename].date = target.value;
    markDirty();
  }
});

// Handle download, delete, and move button clicks
fileTableBody.addEventListener('click', (e) => {
  // Handle move up button
  if (e.target.classList.contains('move-up-btn')) {
    const row = e.target.closest('tr');
    const prev = row.previousElementSibling;
    if (prev) {
      row.parentNode.insertBefore(row, prev);
    }
  }

  // Handle move down button
  if (e.target.classList.contains('move-down-btn')) {
    const row = e.target.closest('tr');
    const next = row.nextElementSibling;
    if (next) {
      row.parentNode.insertBefore(next, row);
    }
  }

  // Handle download button for extracted PDFs
  if (e.target.classList.contains('download-pdf-btn')) {
    const filename = e.target.getAttribute('data-filename');
    const file = filesMap.get(filename);

    if (file) {
      // Create download link
      const blob = new Blob([file], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);

      console.log(`Downloaded: ${filename}`);
    } else {
      console.error(`File not found in filesMap: ${filename}`);
    }
  }

  if (e.target.classList.contains('delete-row-btn')) {
    const filename = e.target.getAttribute('data-filename');
    filesMap.delete(filename);
    delete frontendInputData[filename];
    e.target.closest('tr').remove();
    markDirty();
  }

  // Handle section break deletion
  if (e.target.classList.contains('delete-section-break-btn')) {
    e.target.closest('tr').remove();
    markDirty();
  }
});

// Handle "Clear All Rows" button
clearAllRowsBtn?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all documents and section breaks?')) {
    filesMap.clear();
    Object.keys(frontendInputData).forEach(key => delete frontendInputData[key]);
    fileTableBody.innerHTML = '';
  }
});

// Handle "Add Section Break" button
addSectionBreakBtn?.addEventListener('click', () => {
  const sectionBreakRow = document.createElement('tr');
  sectionBreakRow.draggable = reorderMode === 'drag';
  sectionBreakRow.classList.add('section-break-row', 'bg-blue-50', 'border-t-2', 'border-blue-300', 'hover:bg-blue-100', 'transition');
  sectionBreakRow.dataset.sectionBreak = 'true';
  sectionBreakRow.innerHTML = `
    <td class="drag-handle px-2 py-3 cursor-move">
      <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
      </svg>
    </td>
    <td colspan="4" class="px-6 py-3">
      <input type="text" class="section-break-title w-full px-3 py-1 border border-blue-300 rounded bg-white text-blue-700 font-semibold text-align-left focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="" placeholder="Type section name e.g. 'Part 1: Evidence'"/>
    </td>
    <td class="px-6 py-3 flex gap-2">
      <button type="button" class="move-up-btn text-gray-500 hover:text-gray-700 transition" title="Move up">▲</button>
      <button type="button" class="move-down-btn text-gray-500 hover:text-gray-700 transition" title="Move down">▼</button>
      <button type="button" class="delete-section-break-btn text-red-600 hover:text-red-800 transition" title="Delete section break">
        ❌
      </button>
    </td>
  `;

  // Add drag event listeners
  sectionBreakRow.addEventListener('dragstart', handleDragStart);
  sectionBreakRow.addEventListener('dragover', handleDragOver);
  sectionBreakRow.addEventListener('drop', handleDrop);
  sectionBreakRow.addEventListener('dragend', handleDragEnd);

  // Add to end of table
  fileTableBody.appendChild(sectionBreakRow);
  markDirty();
});

// Handle "Upload Bundle" input
const bundleInput = document.getElementById('bundle-input');

// Ordered steps emitted by processTheBundle via onProgress
const BUNDLE_STEPS = [
  'Validating configuration…',
  'Creating table of contents…',
  'Generating index pages…',
  'Merging documents…',
  'Merging index with documents…',
  'Adding page numbering…',
  'Adding hyperlinks…',
  'Adding bookmarks…',
  'Preparing file for save…',
];
let _trackInitialized = false;

function _buildTrack() {
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
  _trackInitialized = true;
}

function _updateTrack(activeIndex) {
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

let _overlayOriginalHTML = null;

function showProcessingOverlay(msg) {
  const overlay = document.getElementById('processing-overlay');
  if (!overlay) return;

  // Capture original inner HTML on first call so we can restore it on hide
  const inner = overlay.querySelector(':scope > div');
  if (inner && !_overlayOriginalHTML) _overlayOriginalHTML = inner.innerHTML;

  const el = document.getElementById('processing-overlay-msg');
  if (el) el.textContent = msg || 'Processing…';
  overlay.classList.remove('hidden');

  const stepIndex = BUNDLE_STEPS.indexOf(msg);
  if (msg === 'Building bundle…' || msg === 'Building index preview…') {
    _buildTrack();
    _updateTrack(-1);
  } else if (stepIndex !== -1) {
    if (!_trackInitialized) _buildTrack();
    document.getElementById('processing-track')?.classList.remove('hidden');
    _updateTrack(stepIndex);
  } else {
    // Import path — no track needed
    document.getElementById('processing-track')?.classList.add('hidden');
  }
}

function hideProcessingOverlay() {
  const overlay = document.getElementById('processing-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  // Restore original spinner/track structure for next use
  const inner = overlay.querySelector(':scope > div');
  if (inner && _overlayOriginalHTML) inner.innerHTML = _overlayOriginalHTML;
  _trackInitialized = false;
}

function _triggerDownload(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function showBundleReadyState(pdfBytes, filename) {
  _cancelReject = null;
  document.getElementById('processing-cancel-btn')?.classList.add('hidden');
  // Tick all remaining stations before showing success
  _updateTrack(BUNDLE_STEPS.length);

  setTimeout(() => {
    const overlay = document.getElementById('processing-overlay');
    if (!overlay) return;

    // Swap spinner row for success header
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

    // Insert action buttons after the track
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

      // Offer to save defaults if none saved yet
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
      _triggerDownload(pdfBytes, filename);
      hideProcessingOverlay();
    });
    document.getElementById('overlay-close-x')?.addEventListener('click', () => hideProcessingOverlay());
    document.getElementById('overlay-edit-btn')?.addEventListener('click', () => hideProcessingOverlay());
  }, 800);
}

bundleInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log('Processing bundle upload...');

  showProcessingOverlay('Reading bundle…');

  try {
    // Read bundle PDF
    const arrayBuffer = await file.arrayBuffer();
    const bundleBytes = new Uint8Array(arrayBuffer);

    // Import unpacking functions from buntoolRestore.js
    const { extractBundleMetadata, splitBundlePdf, parseConfigFromMetadata } =
      await import('./buntoolRestore.js');

    // Extract metadata
    console.log('Extracting metadata from bundle...');
    const metadata = extractBundleMetadata(bundleBytes);
    if (!metadata || metadata.length === 0) {
      hideProcessingOverlay();
      showErrorModal({
        title: 'Not a BunTool bundle',
        message: 'BunTool couldn\'t find its data in this PDF. Please check that you have selected a bundle created with the latest version of BunTool, not any other PDF.',
      });
      bundleInput.value = '';
      return;
    }

    // Parse config from PDF metadata
    console.log('Parsing configuration from bundle...');
    const extractedConfig = parseConfigFromMetadata(bundleBytes);

    // Populate form fields with extracted config
    document.getElementById('config-claimNumber').value = extractedConfig.heading.claimNumber || '';
    document.getElementById('config-bundleTitle').value = extractedConfig.heading.bundleTitle || '';
    document.getElementById('config-projectName').value = extractedConfig.heading.projectName || '';
    document.getElementById('config-confidential').checked = extractedConfig.heading.confidential || false;

    // Populate advanced config fields
    const pn = extractedConfig.pageNumbering || extractedConfig.page || {};
    document.getElementById('config-fontFace').value = extractedConfig.index?.fontFace || 'serif';
    document.getElementById('config-dateStyle').value = extractedConfig.index?.dateStyle || 'DD Mon. YYYY';
    document.getElementById('config-outlineItemStyle').value = extractedConfig.index?.outlineItemStyle || 'plain';
    document.getElementById('config-footerFont').value = pn.footerFont || 'serif';
    document.getElementById('config-footerFontSize').value = pn.footerFontSize || 'medium';
    document.getElementById('config-alignment').value = pn.alignment || 'right';
    document.getElementById('config-numberingStyle').value = pn.numberingStyle || 'PageX';
    document.getElementById('config-footerPrefix').value = pn.footerPrefix ?? '';
    document.getElementById('config-pageNumberColour').value = pn.pageNumberColour || 'black';
    document.getElementById('config-printableBundle').checked =
      extractedConfig.pageOptions?.printableBundle === true;

    // Split bundle into individual PDFs
    console.log('Splitting bundle into individual documents...');
    showProcessingOverlay('Extracting documents…');
    const hasCoversheet = extractedConfig.pageOptions?.coversheet === true;
    const extractedFiles = await splitBundlePdf(bundleBytes, metadata, hasCoversheet);

    // Clear existing table
    fileTableBody.innerHTML = '';
    filesMap.clear();
    Object.keys(frontendInputData).forEach(key => delete frontendInputData[key]);

    // Process each extracted document and section break in order
    for (const entry of metadata) {
      if (entry.section) {
        // This is a section break - recreate it
        const sectionBreakRow = document.createElement('tr');
        sectionBreakRow.draggable = reorderMode === 'drag';
        sectionBreakRow.classList.add('section-break-row', 'bg-blue-50', 'border-t-2', 'border-blue-300', 'hover:bg-blue-100', 'transition');
        sectionBreakRow.dataset.sectionBreak = 'true';
        sectionBreakRow.innerHTML = `
          <td class="drag-handle px-2 py-3 cursor-move">
            <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
            </svg>
          </td>
          <td colspan="4" class="px-6 py-3 text-center">
            <input type="text" class="section-break-title w-full px-3 py-1 border border-blue-300 rounded bg-white text-blue-700 font-semibold text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="" placeholder="Section name..."/>
          </td>
          <td class="px-6 py-3 flex gap-2">
            <button type="button" class="move-up-btn text-gray-500 hover:text-gray-700 transition" title="Move up">▲</button>
            <button type="button" class="move-down-btn text-gray-500 hover:text-gray-700 transition" title="Move down">▼</button>
            <button type="button" class="delete-section-break-btn text-red-600 hover:text-red-800 transition" title="Delete section break">
              ❌
            </button>
          </td>
        `;
        sectionBreakRow.querySelector('.section-break-title').value = entry.title || '— SECTION BREAK —';

        // Add drag event listeners
        sectionBreakRow.addEventListener('dragstart', handleDragStart);
        sectionBreakRow.addEventListener('dragover', handleDragOver);
        sectionBreakRow.addEventListener('drop', handleDrop);
        sectionBreakRow.addEventListener('dragend', handleDragEnd);

        fileTableBody.appendChild(sectionBreakRow);
      } else {
        // This is a document entry
        const filename = entry.filename;
        const pdfBytes = extractedFiles.get(filename);

        if (!pdfBytes) {
          console.warn(`Could not find extracted PDF for: ${filename}`);
          continue;
        }

        // Create File object from extracted bytes
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const extractedFile = new File([blob], filename, { type: 'application/pdf' });

        const key = uniqueFilename(filename);

        // Add to filesMap
        filesMap.set(key, extractedFile);

        // Count pages
        if (!countPdfPages) {
          ({ countPdfPages } = await import('./buntoolPages.js'));
        }
        const pageCount = await countPdfPages(extractedFile);

        // Store in frontendInputData
        frontendInputData[key] = {
          title: entry.title,
          date: entry.date || '',
          pageCount: pageCount
        };

        // Create table row
        const row = document.createElement('tr');
        row.draggable = reorderMode === 'drag';
        row.dataset.filename = key;
        row.classList.add('hover:bg-gray-50', 'transition');
        row.innerHTML = `
          <td class="drag-handle px-2 py-3 cursor-move">
            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zM10 17a1 1 0 01-.707-.293l-3-3a1 1 0 011.414-1.414L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3A1 1 0 0110 17z"/>
            </svg>
          </td>
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
            <button type="button" class="download-pdf-btn text-blue-600 hover:text-blue-800 transition" data-filename="" title="Download this PDF">
              💾
            </button>
            <button type="button" class="delete-row-btn text-red-600 hover:text-red-800 transition" data-filename="" title="Delete row">
              ❌
            </button>
          </td>
        `;
        row.querySelector('.filename-cell').textContent = key;
        row.querySelector('.title-input').value = entry.title || '';
        row.querySelector('.date-input').value = entry.date || '';
        row.querySelector('.pages-cell').textContent = pageCount ?? '';
        row.querySelectorAll('[data-filename]').forEach(el => el.dataset.filename = key);

        // Add drag event listeners
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('drop', handleDrop);
        row.addEventListener('dragend', handleDragEnd);

        fileTableBody.appendChild(row);
      }
    }

    const coversheetBytes = extractedFiles.get('coversheet.pdf');
    if (coversheetBytes) {
      const blob = new Blob([coversheetBytes], { type: 'application/pdf' });
      coversheetFile = new File([blob], 'coversheet.pdf', { type: 'application/pdf' });
      setCoversheetSelected('coversheet.pdf');
    }

    const sectionCount = metadata.filter(e => e.section).length;
    console.log(`✓ Bundle unpacked: ${extractedFiles.size} documents extracted, ${sectionCount} section breaks restored`);
    hideProcessingOverlay();

  } catch (error) {
    hideProcessingOverlay();
    console.error('Failed to process bundle:', error);
    showErrorModal({
      title: 'Failed to open bundle',
      message: 'Something went wrong while opening the bundle. If this keeps happening, please send a bug report with the details below.',
      error,
    });
  }

  // Reset input
  bundleInput.value = '';
});

// Debug: Add click listener to all submit buttons
document.querySelectorAll('button[type="submit"]').forEach((btn, i) => {
  console.log(`Submit button ${i}:`, btn, 'Inside form:', btn.closest('form'));
  btn.addEventListener('click', (e) => {
    console.log('Submit button clicked!', e.target);
  });
});

const bundleInfoFields = [
  { id: 'config-bundleTitle', label: 'bundle title' },
  { id: 'config-claimNumber', label: 'claim number' },
  { id: 'config-projectName', label: 'case name' },
];

function isFileMissingError(error) {
  if (!error) return false;
  if (error.name === 'NotFoundError') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('file or directory could not be found')
    || msg.includes('file not found')
    || msg.includes('cannot find the file')
    || msg.includes('no such file');
}

function isMemoryError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('realloc')
    || msg.includes('malloc')
    || msg.includes('out of memory')
    || msg.includes('allocation failed')
    || msg.includes('memory exhausted');
}

function showUploadWarningModal({ title, message } = {}) {
  const modal = document.getElementById('upload-warning-modal');
  const titleEl = document.getElementById('upload-warning-modal-title');
  const msgEl = document.getElementById('upload-warning-modal-msg');
  if (titleEl) titleEl.textContent = title || '⚠️ Large upload';
  if (msgEl) msgEl.textContent = message || '';
  modal?.classList.remove('hidden');
}

function showErrorModal({ title, message, error } = {}) {
  const modal = document.getElementById('error-modal');
  const titleEl = document.getElementById('error-modal-title');
  const msgEl = document.getElementById('error-modal-msg');
  const hintEl = document.getElementById('error-modal-hint');
  const detailsWrapper = document.getElementById('error-modal-details-wrapper');
  const detailsEl = document.getElementById('error-modal-details');
  const copyBtn = document.getElementById('error-modal-copy-btn');

  if (titleEl) titleEl.textContent = title || 'Something went wrong';
  if (msgEl) msgEl.textContent = message || '';

  if (isFileMissingError(error)) {
    hintEl?.classList.remove('hidden');
  } else {
    hintEl?.classList.add('hidden');
  }

  if (error) {
    const buildSpan = document.querySelector('footer span.text-xs.text-gray-400');
    const build = buildSpan ? buildSpan.textContent.trim() : 'unknown';
    const details = [
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

function showMissingInfoModal(actionType) {
  const missing = bundleInfoFields.filter(f => !document.getElementById(f.id).value.trim()).map(f => f.label);
  if (missing.length === 0) return false;
  const formatted = missing.length === 1
    ? missing[0]
    : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  document.getElementById('bundle-confirm-msg').textContent =
    `Are you sure you want to leave out the ${formatted}?`;
  pendingConfirmAction = actionType;
  document.getElementById('bundle-confirm-modal').classList.remove('hidden');
  return true;
}

document.getElementById('bundle-confirm-sure')?.addEventListener('click', () => {
  document.getElementById('bundle-confirm-modal').classList.add('hidden');
  if (pendingConfirmAction === 'bundle') {
    bundleConfirmed = true;
    form.requestSubmit();
  } else if (pendingConfirmAction === 'preview') {
    runPreviewIndex();
  }
  pendingConfirmAction = null;
});

document.getElementById('bundle-confirm-addinfo')?.addEventListener('click', () => {
  document.getElementById('bundle-confirm-modal').classList.add('hidden');
  const first = bundleInfoFields.find(f => !document.getElementById(f.id).value.trim());
  if (first) {
    const el = document.getElementById(first.id);
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

document.getElementById('processing-overlay')?.addEventListener('click', (e) => {
  if (e.target.closest('#processing-cancel-btn')) {
    _cancelReject?.(new Error('__cancelled__'));
  }
});

document.getElementById('large-bundle-proceed')?.addEventListener('click', () => {
  document.getElementById('large-bundle-modal')?.classList.add('hidden');
  largeBundleConfirmed = true;
  form.requestSubmit();
});

document.getElementById('large-bundle-goback')?.addEventListener('click', () => {
  document.getElementById('large-bundle-modal')?.classList.add('hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Form submit triggered!');

  if (fileTableBody.querySelectorAll('tr').length === 0) {
    pulseStep2();
    return;
  }

  if (!bundleConfirmed) {
    if (showMissingInfoModal('bundle')) return;
  }
  bundleConfirmed = false;

  if (!largeBundleConfirmed) {
    const totalPages = Object.values(frontendInputData).reduce((sum, d) => sum + (d.pageCount || 0), 0);
    const totalSizeMB = Array.from(filesMap.values()).reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
    if (totalPages > 1000 || totalSizeMB > 75) {
      document.getElementById('large-bundle-modal')?.classList.remove('hidden');
      return;
    }
  }
  largeBundleConfirmed = false;

  const bundleUuid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  const bundleTsStart = Date.now();
  //dynamic (lazy) load the main module
  if (!processTheBundle) {
    ({ processTheBundle } = await import('./buntoolMain.js'));
  };

  // Gather config options from the form
  const configOptions = {
    heading: {
      claimNumber: stripUnsuitableChars(document.getElementById('config-claimNumber').value),
      bundleTitle: stripUnsuitableChars(document.getElementById('config-bundleTitle').value),
      projectName: stripUnsuitableChars(document.getElementById('config-projectName').value),
      confidential: document.getElementById('config-confidential').checked,
      fontSize: document.getElementById('config-headingFontSize').value,
    },
    pageNumbering: {
      footerFont: document.getElementById('config-footerFont').value,
      footerFontSize: document.getElementById('config-footerFontSize').value,
      alignment: document.getElementById('config-alignment').value,
      numberingStyle: document.getElementById('config-numberingStyle').value,
      footerPrefix: stripUnsuitableChars(document.getElementById('config-footerPrefix').value),
      pageNumberColour: document.getElementById('config-pageNumberColour').value,
    },
    index: {
      fontFace: document.getElementById('config-fontFace').value,
      dateStyle: document.getElementById('config-dateStyle').value,
      outlineItemStyle: document.getElementById('config-outlineItemStyle').value,
      fontSize: document.getElementById('config-indexFontSize').value,
      showTableBorders: document.getElementById('config-showTableBorders').checked,
    },
    pageOptions: {
      printableBundle: document.getElementById('config-printableBundle').checked,
      coversheet: coversheetFile !== null,
    }
  };

  config.updateOptions(configOptions);
  console.log('Config pushed:',JSON.stringify(config));

  // Build indexData array in table order (including section breaks)
  indexData.length = 0; // Clear any previous indexData for repeat uses in same ssn
  const rows = fileTableBody.querySelectorAll('tr');
  rows.forEach(row => {
    // Check if this is a section break
    if (row.dataset.sectionBreak === 'true') {
      const sectionTitleInput = row.querySelector('.section-break-title');
      const sectionTitle = sectionTitleInput ? sectionTitleInput.value : '—';
      indexData.push({
        sectionMarker: 1,  // Indicates section break
        title: sectionTitle
      });
    } else {
      // Regular document row - get filename from second column (first is drag handle)
      const filenameTd = row.querySelectorAll('td')[1];
      if (filenameTd) {
        const filename = filenameTd.textContent.trim();
        if (frontendInputData[filename]) {
          indexData.push({
            filename,
            title: frontendInputData[filename].title,
            date: frontendInputData[filename].date,
            pageCount: frontendInputData[filename].pageCount,
            sectionMarker: 0
          });
        }
      }
    }
  });

  if (indexData.length === 0) {
    showErrorModal({ title: 'No documents added', message: 'Please add at least one document before creating a bundle.' });
    return;
  }

  const inputSizeMb = Array.from(filesMap.values()).reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
  await logBundleEvent({ event: 'start', uuid: bundleUuid, file_count: filesMap.size, total_size_mb: Math.round(inputSizeMb * 10) / 10 });

  const _abandonHandler = (e) => {
    navigator.sendBeacon(BUNDLE_LOG_URL, JSON.stringify({
      event: 'abandoned',
      uuid: bundleUuid,
      duration_ms: Date.now() - bundleTsStart,
      error_type: e.persisted ? 'navigated_away' : 'tab_closed',
    }));
  };
  window.addEventListener('pagehide', _abandonHandler);

  const BUNDLE_TIMEOUT_MS = 240_000;
  let cancelled = false;
  showProcessingOverlay('Building bundle…');
  document.getElementById('processing-cancel-btn')?.classList.remove('hidden');
  try {
    const pdfBytes = await Promise.race([
      processTheBundle(filesMap, indexData, config, (label) => { if (!cancelled) showProcessingOverlay(label); }, coversheetFile),
      new Promise((_, reject) => setTimeout(() => reject(new Error('__timeout__')), BUNDLE_TIMEOUT_MS)),
      new Promise((_, reject) => { _cancelReject = reject; }),
    ]);

    // Validate that we got valid PDF bytes
    if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
      throw new Error('Bundle processing returned invalid or empty PDF data');
    }

    // Generate filename: title-claimno-case-date.pdf
    const sanitize = (str) => str.replace(/[<>:"/\\|?*.]/g, '-');
    const truncate = (str, maxLen) => str.length > maxLen ? str.slice(0, maxLen) : str;
    const today = new Date().toISOString().slice(0, 10);
    const parts = [
      configOptions.heading.bundleTitle?.trim(),
      configOptions.heading.claimNumber?.trim(),
      configOptions.heading.projectName?.trim(),
      today
    ].filter(p => p);
    let bundleFilename = sanitize(parts.join('-')) + '.pdf';
    if (bundleFilename.length > 251) {
      bundleFilename = truncate(sanitize(parts.join('-')), 247) + '.pdf';
    }

    logBundleEvent({
      event: 'complete',
      uuid: bundleUuid,
      duration_ms: Date.now() - bundleTsStart,
      page_count: indexData.filter(e => !e.sectionMarker).reduce((sum, e) => sum + (e.pageCount || 0), 0),
    });

    showBundleReadyState(pdfBytes, bundleFilename);
    return; // keep overlay open — hideProcessingOverlay handled by the modal buttons
  } catch (error) {
    _cancelReject = null;
    document.getElementById('processing-cancel-btn')?.classList.add('hidden');
    const inputPageCount = indexData.filter(e => !e.sectionMarker).reduce((sum, e) => sum + (e.pageCount || 0), 0);
    if (error.message === '__cancelled__') {
      cancelled = true;
      logBundleEvent({
        event: 'error',
        uuid: bundleUuid,
        duration_ms: Date.now() - bundleTsStart,
        error_type: 'cancelled',
        error_message: 'Aborted by user action',
        page_count: inputPageCount || undefined,
        total_size_mb: Math.round(inputSizeMb * 10) / 10,
      });
      hideProcessingOverlay();
      return;
    }
    console.error('[FRONTEND ERROR] Bundle generation failed:', error);
    const errorType = error.message === '__timeout__' ? 'timeout' : isMemoryError(error) ? 'oom' : 'other';
    logBundleEvent({
      event: 'error',
      uuid: bundleUuid,
      duration_ms: Date.now() - bundleTsStart,
      error_type: errorType,
      error_message: error.message === '__timeout__' ? undefined : error.message,
      error_stack: error.stack ? error.stack.slice(0, 800) : undefined,
      page_count: inputPageCount || undefined,
      total_size_mb: Math.round(inputSizeMb * 10) / 10,
    });
    if (error.message === '__timeout__') {
      showErrorModal({
        title: 'Bundle generation timed out',
        message: 'Your bundle took too long to generate (more than 120 seconds). The browser may be running low on memory, or you may have a very large bundle. Try closing other tabs, or split your documents into smaller batches.',
      });
    } else if (errorType === 'oom') {
      showErrorModal({
        title: 'Not enough memory',
        message: 'Your browser ran out of memory processing this bundle. This isn\'t an error in BunTool, but to do with the memory avaiable in your computer. It usually happens when a bundle is very large, or you have many tabs or apps open. Try splitting your documents into smaller batches, or close other tabs / apps to free up memory.',
      });
    } else {
      showErrorModal({
        title: 'Bundle generation failed',
        message: 'Something went wrong while creating your bundle. If this keeps happening, please send a bug report with the details below.',
        error,
      });
    }
    hideProcessingOverlay();
  } finally {
    window.removeEventListener('pagehide', _abandonHandler);
  }

});

async function runPreviewIndex() {
  if (fileTableBody.querySelectorAll('tr').length === 0) {
    pulseStep2();
    return;
  }

  if (!processTheBundle) {
    ({ processTheBundle } = await import('./buntoolMain.js'));
  }

  const configOptions = {
    heading: {
      claimNumber: stripUnsuitableChars(document.getElementById('config-claimNumber').value),
      bundleTitle: stripUnsuitableChars(document.getElementById('config-bundleTitle').value),
      projectName: stripUnsuitableChars(document.getElementById('config-projectName').value),
      confidential: document.getElementById('config-confidential').checked,
      fontSize: document.getElementById('config-headingFontSize').value,
    },
    pageNumbering: {
      footerFont: document.getElementById('config-footerFont').value,
      footerFontSize: document.getElementById('config-footerFontSize').value,
      alignment: document.getElementById('config-alignment').value,
      numberingStyle: document.getElementById('config-numberingStyle').value,
      footerPrefix: stripUnsuitableChars(document.getElementById('config-footerPrefix').value),
      pageNumberColour: document.getElementById('config-pageNumberColour').value,
    },
    index: {
      fontFace: document.getElementById('config-fontFace').value,
      dateStyle: document.getElementById('config-dateStyle').value,
      outlineItemStyle: document.getElementById('config-outlineItemStyle').value,
      fontSize: document.getElementById('config-indexFontSize').value,
      showTableBorders: document.getElementById('config-showTableBorders').checked,
      justTheIndex: true,
    },
    pageOptions: {
      printableBundle: document.getElementById('config-printableBundle').checked,
      coversheet: coversheetFile !== null,
    }
  };

  config.updateOptions(configOptions);

  indexData.length = 0;
  const rows = fileTableBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (row.dataset.sectionBreak === 'true') {
      const sectionTitleInput = row.querySelector('.section-break-title');
      indexData.push({ sectionMarker: 1, title: sectionTitleInput ? sectionTitleInput.value : '—' });
    } else {
      const filenameTd = row.querySelectorAll('td')[1];
      if (filenameTd) {
        const filename = filenameTd.textContent.trim();
        if (frontendInputData[filename]) {
          indexData.push({
            filename,
            title: frontendInputData[filename].title,
            date: frontendInputData[filename].date,
            pageCount: frontendInputData[filename].pageCount,
            sectionMarker: 0
          });
        }
      }
    }
  });

  if (indexData.length === 0) {
    showErrorModal({ title: 'No documents added', message: 'Please add at least one document before generating an index preview.' });
    return;
  }

  const BUNDLE_TIMEOUT_MS = 240_000;
  showProcessingOverlay('Building index preview…');
  try {
    const pdfBytes = await Promise.race([
      processTheBundle(filesMap, indexData, config, (label) => showProcessingOverlay(label), coversheetFile),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('__timeout__')), BUNDLE_TIMEOUT_MS)
      ),
    ]);
    if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
      throw new Error('Preview returned invalid or empty PDF data');
    }
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `index-preview-${today}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  } catch (error) {
    console.error('[FRONTEND ERROR] Index preview failed:', error);
    if (error.message === '__timeout__') {
      showErrorModal({
        title: 'Index preview timed out',
        message: 'The index preview took too long to generate. The browser may be running low on memory. Try closing other tabs.',
      });
    } else {
      showErrorModal({
        title: 'Index preview failed',
        message: 'Something went wrong while generating the index preview. If this keeps happening, please send a bug report with the details below.',
        error,
      });
    }
  } finally {
    hideProcessingOverlay();
    config.updateOptions({ index: { justTheIndex: false } });
  }
}

for (const id of ['preview-index-btn', 'preview-index-btn-advanced']) {
  document.getElementById(id)?.addEventListener('click', () => {
    if (fileTableBody.querySelectorAll('tr').length === 0) { pulseStep2(); return; }
    if (showMissingInfoModal('preview')) return;
    runPreviewIndex();
  });
}


/***********************************
 *       Frontend Functions        *
***********************************/


async function parseDateFromFilename(filename) {
  let matchedDate = null;
  let filenameWithoutDate = filename;

  // Check for filenames that start with YYYY-MM-DD or DD-MM-YYYY
  const yearFirstDateRegex = /(?<!\d)[\[\(]{0,1}(1\d{3}|20\d{2})[-._]?(0[1-9]|1[0-2])[-._]?(0[1-9]|[12][0-9]|3[01])[\]\)]{0,1}(?!\d)/;
  const yearLastDateRegex = /(?<!\d)[\[\(]{0,1}(0[1-9]|[12][0-9]|3[01])[-._]?(0[1-9]|1[0-2])[-._]?(1\d{3}|20\d{2})[\]\)]{0,1}(?!\d)/;

  const yearFirstMatch = filename.match(yearFirstDateRegex);
  if (yearFirstMatch) {
    const [fullMatch, year, month, day] = yearFirstMatch;
    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    matchedDate = parsedDate.toISOString().split('T')[0];
    filenameWithoutDate = filenameWithoutDate.replace(fullMatch, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    return { date: matchedDate, name: filenameWithoutDate };
  }

  const yearLastMatch = filename.match(yearLastDateRegex);
  if (yearLastMatch) {
    const [fullMatch, day, month, year] = yearLastMatch;
    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    matchedDate = parsedDate.toISOString().split('T')[0];
    filenameWithoutDate = filenameWithoutDate.replace(fullMatch, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    return { date: matchedDate, name: filenameWithoutDate };
  }

  // Fall back to chrono-node for natural language processing
  let chronoParsedResult = [];
  if (typeof chrono !== 'undefined') {
    console.log('filename being parsed:', filename);
    chronoParsedResult = chrono.parse(filename);
  }
  if (chronoParsedResult.length > 0) {
    const parsedDate = chronoParsedResult[0].start.date();
    matchedDate = parsedDate.toISOString().split('T')[0];
    const matchedInputText = chronoParsedResult[0].text;
    console.log('matchedInputText:', matchedInputText);
    console.log('matchedDate:', matchedDate);
    filenameWithoutDate = filenameWithoutDate.replace(matchedInputText, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    console.log('filenameWithoutDate:', filenameWithoutDate);
    return { date: matchedDate, name: filenameWithoutDate };
  }

  return { date: null, name: filenameWithoutDate };
}

function prettifyTitle(title) {
  // trim off file extension: 
  title = title.replace(/\.[a-zA-Z0-9]{1,4}$/, '');
  // Replace multiple underscores with a single space
  title = title.replace(/_+/g, ' ');
  // Remove any character that is not a word character, space, or punctuation:
  title = title.replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}]/gu, ''); // Unicode-aware regex: L is letter, N is number, P is punctuation, S is symbol, Z is separator
  // if any double spaces, underscores or hyphens which might result from the above:
  title = stripDoubleChars(title);
  return title.trim();
}


function stripDoubleChars(str) {
  // Replace multiple spaces, underscores, stops or hyphens with a single space
  str = str.replace(/[_\s\-.,\\/]+/g, ' ');
  return str.trim();
}

function stripUnsuitableChars(input) {
  return input
    // 1) strip out all emoji / pictographic codepoints
    .replace(/\p{Extended_Pictographic}/gu, '')
    // 2) strip out control characters and anything not in these Unicode categories:
    //    L = Letter, N = Number, P = Punctuation, S = Symbol, Z = Separator
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}]/gu, '')
    // 3) collapse multiple spaces/tabs/newlines to a single space
    .replace(/\s+/g, ' ')
    .trim();
}
