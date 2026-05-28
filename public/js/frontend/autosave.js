import { state } from './state.js';
import { makeFileRow, ensureEmptyPlaceholder } from './fileRows.js';
import { createSectionTbody, createSection0000HeaderRow } from './sections.js';
import { setCoversheetSelected } from './coversheet.js';
import { getDefaultSection0000 } from './helpers.js';

export async function getAutosaveState() {
  if (state.filesMap.size === 0) return null;

  const files = [];
  for (const [filename, file] of state.filesMap) {
    files.push({ filename, bytes: await file.arrayBuffer() });
  }

  const tableOrder = [];
  document.querySelectorAll('.section-tbody').forEach(tbody => {
    const sectionID = tbody.dataset.sectionId;
    const headerRow = tbody.querySelector('.section-header-row');
    const labelEl   = headerRow?.querySelector('.section-label-input');
    const label     = labelEl?.value.trim() || labelEl?.placeholder || '';
    const name      = headerRow?.querySelector('.section-name-input')?.value.trim() ?? '';
    const filenames = Array.from(tbody.querySelectorAll('tr.file-row')).map(r => r.dataset.filename).filter(Boolean);
    tableOrder.push({ type: 'section', sectionID, label, name, filenames });
  });

  const config = {
    claimNumber:         document.getElementById('config-claimNumber')?.value         || '',
    bundleTitle:         document.getElementById('config-bundleTitle')?.value          || '',
    projectName:         document.getElementById('config-projectName')?.value          || '',
    confidential:        document.getElementById('config-confidential')?.checked       ?? false,
    footerFont:          document.getElementById('config-footerFont')?.value           || '',
    alignment:           document.getElementById('config-alignment')?.value            || '',
    numberingStyle:      document.getElementById('config-numberingStyle')?.value       || '',
    footerPrefix:        document.getElementById('config-footerPrefix')?.value         || '',
    pageNumberColour:    document.getElementById('config-pageNumberColour')?.value     || 'black',
    fontFace:            document.getElementById('config-fontFace')?.value             || '',
    dateStyle:           document.getElementById('config-dateStyle')?.value            || '',
    outlineItemStyle:    document.getElementById('config-outlineItemStyle')?.value     || '',
    printableBundle:     document.getElementById('config-printableBundle')?.checked    ?? false,
    headingFontSize:     document.getElementById('config-headingFontSize')?.value      || '',
    indexFontSize:       document.getElementById('config-indexFontSize')?.value        || '',
    footerFontSize:      document.getElementById('config-footerFontSize')?.value       || '',
    showTableBorders:    document.getElementById('config-showTableBorders')?.checked   ?? false,
    sectionPrefix:       document.getElementById('config-sectionPrefix')?.value        || '',
    pageNumberPerSection: document.getElementById('config-pageNumberPerSection')?.checked ?? false,
  };

  let coversheet = null;
  if (state.coversheetFile) {
    coversheet = { filename: state.coversheetFile.name, bytes: await state.coversheetFile.arrayBuffer() };
  }

  return { files, inputData: { ...state.frontendInputData }, tableOrder, config, coversheet, isSectioned: state.isSectioned };
}

export async function applySnapshot(snapshot) {
  state.filesMap.clear();
  Object.keys(state.frontendInputData).forEach(k => delete state.frontendInputData[k]);
  document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').forEach(el => el.remove());
  const section0000 = getDefaultSection0000();
  if (section0000) section0000.innerHTML = '';
  state.coversheetFile    = null;
  setCoversheetSelected(null);
  state.isSectioned       = false;
  state.nextSectionNum    = 1;
  document.getElementById('file-table')?.classList.remove('sectioned');

  for (const { filename, bytes } of snapshot.files) {
    state.filesMap.set(filename, new File([bytes], filename, { type: 'application/pdf' }));
  }

  Object.assign(state.frontendInputData, snapshot.inputData);

  const snapshotSectioned = snapshot.isSectioned ??
    snapshot.tableOrder.some(item =>
      item.type === 'section' &&
      (item.sectionID !== '0000' || item.label || item.name)
    );
  if (snapshotSectioned) {
    state.isSectioned = true;
    document.getElementById('file-table')?.classList.add('sectioned');
  }

  const table = document.querySelector('#file-table table');
  let saved0000Label = '', saved0000Name = '';
  for (const item of snapshot.tableOrder) {
    if (item.type !== 'section') continue;
    let tbody;
    if (item.sectionID === '0000') {
      tbody = getDefaultSection0000();
      saved0000Label = item.label || '';
      saved0000Name  = item.name  || '';
    } else {
      tbody = createSectionTbody(item.sectionID, item.label || '', item.name || '');
      table?.appendChild(tbody);
      const num = parseInt(item.sectionID, 10);
      if (!isNaN(num) && num >= state.nextSectionNum) state.nextSectionNum = num + 1;
    }
    for (const filename of (item.filenames || [])) {
      const data = state.frontendInputData[filename];
      if (!data) continue;
      const row = makeFileRow(filename, data);
      tbody.appendChild(row);
    }
    if (state.isSectioned) ensureEmptyPlaceholder(tbody);
  }

  if (state.isSectioned) {
    const s0 = getDefaultSection0000();
    createSection0000HeaderRow(s0, saved0000Label || 'A', saved0000Name);
  }

  // Legacy snapshot support: flat tableOrder array
  if (snapshot.tableOrder.length && snapshot.tableOrder[0].type === 'file') {
    for (const item of snapshot.tableOrder) {
      if (item.type !== 'file') continue;
      const data  = state.frontendInputData[item.filename];
      if (!data) continue;
      const tbody = getDefaultSection0000();
      tbody.appendChild(makeFileRow(item.filename, data));
    }
  }

  // Restore config fields
  const c    = snapshot.config;
  const _set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val ?? ''; };
  const _chk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };
  _set('config-claimNumber',        c.claimNumber);
  _set('config-bundleTitle',        c.bundleTitle);
  _set('config-projectName',        c.projectName);
  _chk('config-confidential',       c.confidential);
  _set('config-footerFont',         c.footerFont);
  _set('config-alignment',          c.alignment);
  _set('config-numberingStyle',     c.numberingStyle);
  _set('config-footerPrefix',       c.footerPrefix);
  _set('config-pageNumberColour',   c.pageNumberColour);
  _set('config-fontFace',           c.fontFace);
  _set('config-dateStyle',          c.dateStyle);
  _set('config-outlineItemStyle',   c.outlineItemStyle);
  _chk('config-printableBundle',    c.printableBundle);
  _set('config-headingFontSize',    c.headingFontSize);
  _set('config-indexFontSize',      c.indexFontSize);
  _set('config-footerFontSize',     c.footerFontSize);
  _chk('config-showTableBorders',   c.showTableBorders);
  _set('config-sectionPrefix',      c.sectionPrefix);
  _chk('config-pageNumberPerSection', c.pageNumberPerSection);

  if (snapshot.coversheet) {
    state.coversheetFile = new File([snapshot.coversheet.bytes], snapshot.coversheet.filename, { type: 'application/pdf' });
    setCoversheetSelected(snapshot.coversheet.filename);
  }
}
