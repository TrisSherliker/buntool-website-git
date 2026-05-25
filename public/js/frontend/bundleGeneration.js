import { state } from './state.js';
import { BUNDLE_LOG_URL } from './constants.js';
import { stripUnsuitableChars, uniqueFilename } from './utils.js';
import { buildIndexData, makeFileRow } from './fileRows.js';
import { ensureEmptyPlaceholder, removeEmptyPlaceholder } from './fileRows.js';
import { showProcessingOverlay, hideProcessingOverlay, showBundleReadyState } from './bundleUI.js';
import { showErrorModal, showMissingInfoModal, isMemoryError } from './modals.js';
import { createSectionTbody, createSection0000HeaderRow } from './sections.js';
import { setCoversheetSelected } from './coversheet.js';
import { markDirty } from '../buntoolAutosave.js';
import { getDefaultSection0000, getAllFileRows, pulseStep2 } from './helpers.js';

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

function gatherConfigOptions() {
  return {
    heading: {
      claimNumber:  stripUnsuitableChars(document.getElementById('config-claimNumber').value),
      bundleTitle:  stripUnsuitableChars(document.getElementById('config-bundleTitle').value),
      projectName:  stripUnsuitableChars(document.getElementById('config-projectName').value),
      confidential: document.getElementById('config-confidential').checked,
      fontSize:     document.getElementById('config-headingFontSize').value,
    },
    pageNumbering: {
      footerFont:          document.getElementById('config-footerFont').value,
      footerFontSize:      document.getElementById('config-footerFontSize').value,
      alignment:           document.getElementById('config-alignment').value,
      numberingStyle:      document.getElementById('config-numberingStyle').value,
      footerPrefix:        stripUnsuitableChars(document.getElementById('config-footerPrefix').value),
      pageNumberColour:    document.getElementById('config-pageNumberColour').value,
      pageNumberPerSection: document.getElementById('config-pageNumberPerSection').checked,
    },
    index: {
      fontFace:         document.getElementById('config-fontFace').value,
      dateStyle:        document.getElementById('config-dateStyle').value,
      outlineItemStyle: document.getElementById('config-outlineItemStyle').value,
      fontSize:         document.getElementById('config-indexFontSize').value,
      showTableBorders: document.getElementById('config-showTableBorders').checked,
      sectionPrefix:    document.getElementById('config-sectionPrefix').value,
    },
    pageOptions: {
      printableBundle: document.getElementById('config-printableBundle').checked,
      coversheet:      state.coversheetFile !== null,
    },
  };
}

export async function handleFormSubmit(e, form) {
  e.preventDefault();
  console.log('Form submit triggered!');

  if (getAllFileRows().length === 0) { pulseStep2(); return; }

  if (!state.bundleConfirmed) {
    if (showMissingInfoModal('bundle')) return;
  }
  state.bundleConfirmed = false;

  if (!state.largeBundleConfirmed) {
    const totalPages  = Object.values(state.frontendInputData).reduce((sum, d) => sum + (d.pageCount || 0), 0);
    const totalSizeMB = Array.from(state.filesMap.values()).reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
    if (totalPages > 1000 || totalSizeMB > 75) {
      document.getElementById('large-bundle-modal')?.classList.remove('hidden');
      return;
    }
  }
  state.largeBundleConfirmed = false;

  const bundleUuid   = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  const bundleTsStart = Date.now();

  if (!state.processTheBundle) {
    ({ processTheBundle: state.processTheBundle } = await import('../buntoolMain.js'));
  }

  const configOptions = gatherConfigOptions();
  state.config.updateOptions(configOptions);
  console.log('Config pushed:', JSON.stringify(state.config));

  // Validate section names — include section 0000 when it is in sectioned mode (has a header row)
  {
    const unnamedSections = Array.from(document.querySelectorAll('.section-tbody'))
      .filter(t => t.querySelector('.section-header-row') && !t.querySelector('.section-name-input')?.value.trim());
    if (unnamedSections.length > 0) {
      unnamedSections.forEach(t => {
        const inp = t.querySelector('.section-name-input');
        if (inp) { inp.style.outline = '2px solid #ef4444'; inp.focus(); }
      });
      showErrorModal({ title: 'Section name required', message: 'Please give each section a name before creating the bundle.' });
      return;
    }
    document.querySelectorAll('.section-name-input').forEach(inp => inp.style.outline = '');
  }

  const bundleIndexData = buildIndexData();
  if (bundleIndexData.totalFileCount === 0) {
    showErrorModal({ title: 'No documents added', message: 'Please add at least one document before creating a bundle.' });
    return;
  }
  try { bundleIndexData.validateIndexStructure(); }
  catch (err) { showErrorModal({ title: 'Index data error', message: err.message }); return; }

  const inputSizeMb = Array.from(state.filesMap.values()).reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
  await logBundleEvent({ event: 'start', uuid: bundleUuid, file_count: state.filesMap.size, total_size_mb: Math.round(inputSizeMb * 10) / 10 });

  const _abandonHandler = (ev) => {
    navigator.sendBeacon(BUNDLE_LOG_URL, JSON.stringify({
      event: 'abandoned',
      uuid: bundleUuid,
      duration_ms: Date.now() - bundleTsStart,
      error_type: ev.persisted ? 'navigated_away' : 'tab_closed',
    }));
  };
  window.addEventListener('pagehide', _abandonHandler);

  const BUNDLE_TIMEOUT_MS = 240_000;
  let cancelled = false;
  showProcessingOverlay('Building bundle…');
  document.getElementById('processing-cancel-btn')?.classList.remove('hidden');

  try {
    const pdfBytes = await Promise.race([
      state.processTheBundle(state.filesMap, bundleIndexData, state.config, (label) => { if (!cancelled) showProcessingOverlay(label); }, state.coversheetFile),
      new Promise((_, reject) => setTimeout(() => reject(new Error('__timeout__')), BUNDLE_TIMEOUT_MS)),
      new Promise((_, reject) => { state._cancelReject = reject; }),
    ]);

    if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
      throw new Error('Bundle processing returned invalid or empty PDF data');
    }

    const sanitize = (str) => str.replace(/[<>:"/\\|?*.]/g, '-');
    const truncate  = (str, maxLen) => str.length > maxLen ? str.slice(0, maxLen) : str;
    const today     = new Date().toISOString().slice(0, 10);
    const parts     = [
      configOptions.heading.bundleTitle?.trim(),
      configOptions.heading.claimNumber?.trim(),
      configOptions.heading.projectName?.trim(),
      today,
    ].filter(p => p);
    let bundleFilename = sanitize(parts.join('-')) + '.pdf';
    if (bundleFilename.length > 251) bundleFilename = truncate(sanitize(parts.join('-')), 247) + '.pdf';

    logBundleEvent({ event: 'complete', uuid: bundleUuid, duration_ms: Date.now() - bundleTsStart, page_count: bundleIndexData.totalPageCount });
    showBundleReadyState(pdfBytes, bundleFilename);
    return;
  } catch (error) {
    state._cancelReject = null;
    document.getElementById('processing-cancel-btn')?.classList.add('hidden');
    const inputPageCount = bundleIndexData.totalPageCount;
    if (error.message === '__cancelled__') {
      cancelled = true;
      logBundleEvent({ event: 'error', uuid: bundleUuid, duration_ms: Date.now() - bundleTsStart, error_type: 'cancelled', error_message: 'Aborted by user action', page_count: inputPageCount || undefined, total_size_mb: Math.round(inputSizeMb * 10) / 10 });
      hideProcessingOverlay();
      return;
    }
    console.error('[FRONTEND ERROR] Bundle generation failed:', error);
    const errorType = error.message === '__timeout__' ? 'timeout' : isMemoryError(error) ? 'oom' : 'other';
    logBundleEvent({ event: 'error', uuid: bundleUuid, duration_ms: Date.now() - bundleTsStart, error_type: errorType, error_message: error.message === '__timeout__' ? undefined : error.message, error_stack: error.stack ? error.stack.slice(0, 800) : undefined, page_count: inputPageCount || undefined, total_size_mb: Math.round(inputSizeMb * 10) / 10 });
    if (error.message === '__timeout__') {
      showErrorModal({ title: 'Bundle generation timed out', message: 'Your bundle took too long to generate (more than 120 seconds). The browser may be running low on memory, or you may have a very large bundle. Try closing other tabs, or split your documents into smaller batches.' });
    } else if (errorType === 'oom') {
      showErrorModal({ title: 'Not enough memory', message: 'Your browser ran out of memory processing this bundle. This isn\'t an error in BunTool, but to do with the memory avaiable in your computer. It usually happens when a bundle is very large, or you have many tabs or apps open. Try splitting your documents into smaller batches, or close other tabs / apps to free up memory.' });
    } else {
      showErrorModal({ title: 'Bundle generation failed', message: 'Something went wrong while creating your bundle. If this keeps happening, please send a bug report with the details below.', error });
    }
    hideProcessingOverlay();
  } finally {
    window.removeEventListener('pagehide', _abandonHandler);
  }
}

export async function runPreviewIndex() {
  if (getAllFileRows().length === 0) { pulseStep2(); return; }

  if (!state.processTheBundle) {
    ({ processTheBundle: state.processTheBundle } = await import('../buntoolMain.js'));
  }

  const configOptions = { ...gatherConfigOptions(), index: { ...gatherConfigOptions().index, justTheIndex: true } };
  state.config.updateOptions(configOptions);

  const previewIndexData = buildIndexData();
  if (previewIndexData.totalFileCount === 0) {
    showErrorModal({ title: 'No documents added', message: 'Please add at least one document before generating an index preview.' });
    return;
  }

  const BUNDLE_TIMEOUT_MS = 240_000;
  showProcessingOverlay('Building index preview…');
  try {
    const pdfBytes = await Promise.race([
      state.processTheBundle(state.filesMap, previewIndexData, state.config, (label) => showProcessingOverlay(label), state.coversheetFile),
      new Promise((_, reject) => setTimeout(() => reject(new Error('__timeout__')), BUNDLE_TIMEOUT_MS)),
    ]);
    if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length === 0) {
      throw new Error('Preview returned invalid or empty PDF data');
    }
    const blob  = new Blob([pdfBytes], { type: 'application/pdf' });
    const url   = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a     = document.createElement('a');
    a.href = url;
    a.download = `index-preview-${today}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  } catch (error) {
    console.error('[FRONTEND ERROR] Index preview failed:', error);
    if (error.message === '__timeout__') {
      showErrorModal({ title: 'Index preview timed out', message: 'The index preview took too long to generate. The browser may be running low on memory. Try closing other tabs.' });
    } else {
      showErrorModal({ title: 'Index preview failed', message: 'Something went wrong while generating the index preview. If this keeps happening, please send a bug report with the details below.', error });
    }
  } finally {
    hideProcessingOverlay();
    state.config.updateOptions({ index: { justTheIndex: false } });
  }
}

export async function handleBundleRestore(file) {
  if (!file) return;
  console.log('Processing bundle upload...');
  showProcessingOverlay('Reading bundle…');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bundleBytes = new Uint8Array(arrayBuffer);

    const { extractBundleMetadata, splitBundlePdf, parseConfigFromMetadata, normaliseBundleMetadata } =
      await import('../buntoolRestore.js');

    console.log('Extracting metadata from bundle...');
    const metadata = extractBundleMetadata(bundleBytes);
    const bundleInput = document.getElementById('bundle-input');
    if (!metadata || metadata.length === 0) {
      hideProcessingOverlay();
      showErrorModal({ title: 'Not a BunTool bundle', message: 'BunTool couldn\'t find its data in this PDF. Please check that you have selected a bundle created with the latest version of BunTool, not any other PDF.' });
      if (bundleInput) bundleInput.value = '';
      return;
    }

    console.log('Parsing configuration from bundle...');
    const extractedConfig = parseConfigFromMetadata(bundleBytes);

    document.getElementById('config-claimNumber').value  = extractedConfig.heading.claimNumber || '';
    document.getElementById('config-bundleTitle').value  = extractedConfig.heading.bundleTitle  || '';
    document.getElementById('config-projectName').value  = extractedConfig.heading.projectName  || '';
    document.getElementById('config-confidential').checked = extractedConfig.heading.confidential || false;

    const pn = extractedConfig.pageNumbering || extractedConfig.page || {};
    document.getElementById('config-fontFace').value            = extractedConfig.index?.fontFace        || 'serif';
    document.getElementById('config-dateStyle').value           = extractedConfig.index?.dateStyle        || 'DD Mon. YYYY';
    document.getElementById('config-outlineItemStyle').value    = extractedConfig.index?.outlineItemStyle || 'plain';
    document.getElementById('config-footerFont').value          = pn.footerFont     || 'serif';
    document.getElementById('config-footerFontSize').value      = pn.footerFontSize || 'medium';
    document.getElementById('config-alignment').value           = pn.alignment      || 'right';
    document.getElementById('config-numberingStyle').value      = pn.numberingStyle || 'PageX';
    document.getElementById('config-footerPrefix').value        = pn.footerPrefix   ?? '';
    document.getElementById('config-pageNumberColour').value    = pn.pageNumberColour || 'black';
    document.getElementById('config-printableBundle').checked   = extractedConfig.pageOptions?.printableBundle === true;
    if (extractedConfig.index?.sectionPrefix !== undefined)
      document.getElementById('config-sectionPrefix').value = extractedConfig.index.sectionPrefix;
    document.getElementById('config-pageNumberPerSection').checked = extractedConfig.pageNumbering?.pageNumberPerSection === true;

    console.log('Splitting bundle into individual documents...');
    showProcessingOverlay('Extracting documents…');
    const hasCoversheet    = extractedConfig.pageOptions?.coversheet === true;
    const extractedFiles   = await splitBundlePdf(bundleBytes, metadata, hasCoversheet);

    // Clear existing state
    document.querySelectorAll('.section-tbody:not(#tbody-section-0000)').forEach(el => el.remove());
    const restoreSection0000 = getDefaultSection0000();
    if (restoreSection0000) restoreSection0000.innerHTML = '';
    state.filesMap.clear();
    Object.keys(state.frontendInputData).forEach(key => delete state.frontendInputData[key]);
    state.isSectioned    = false;
    state.nextSectionNum = 1;
    document.getElementById('file-table')?.classList.remove('sectioned');

    if (!state.countPdfPages) {
      ({ countPdfPages: state.countPdfPages } = await import('../buntoolPages.js'));
    }

    const table    = document.querySelector('#file-table table');
    const sections = normaliseBundleMetadata(metadata);

    let restoreLabel0000 = '', restoreName0000 = '';
    for (let si = 0; si < sections.length; si++) {
      const section = sections[si];
      let tbody;
      // The first section always maps to the DOM's default section-0000 element,
      // regardless of its stored sectionID (old bundles store '0000'; new sectioned
      // bundles store '0001' because 0000 is redesignated at build time).
      if (si === 0) {
        tbody = getDefaultSection0000();
        restoreLabel0000 = section.sectionLabel || '';
        restoreName0000  = section.sectionName  || '';
      } else {
        tbody = createSectionTbody(section.sectionID, section.sectionLabel || '', section.sectionName || '');
        table?.appendChild(tbody);
        if (!state.isSectioned) {
          state.isSectioned = true;
          document.getElementById('file-table')?.classList.add('sectioned');
        }
        const num = parseInt(section.sectionID, 10);
        if (!isNaN(num) && num >= state.nextSectionNum) state.nextSectionNum = num + 1;
      }
      for (const entry of (section.files || [])) {
        const pdfBytes = extractedFiles.get(entry.filename);
        if (!pdfBytes) { console.warn(`Missing PDF for: ${entry.filename}`); continue; }
        const key = uniqueFilename(entry.filename, state.filesMap);
        state.filesMap.set(key, new File([pdfBytes], entry.filename, { type: 'application/pdf' }));
        const pageCount = await state.countPdfPages(state.filesMap.get(key));
        state.frontendInputData[key] = { title: entry.title, date: entry.date || '', pageCount };
        tbody.appendChild(makeFileRow(key, state.frontendInputData[key]));
      }
      if (state.isSectioned) ensureEmptyPlaceholder(tbody);
    }

    if (state.isSectioned) {
      createSection0000HeaderRow(getDefaultSection0000(), restoreLabel0000, restoreName0000);
    }

    const coversheetBytes = extractedFiles.get('coversheet.pdf');
    if (coversheetBytes) {
      const blob = new Blob([coversheetBytes], { type: 'application/pdf' });
      state.coversheetFile = new File([blob], 'coversheet.pdf', { type: 'application/pdf' });
      setCoversheetSelected('coversheet.pdf');
    }

    console.log(`✓ Bundle unpacked: ${extractedFiles.size} documents extracted`);
    hideProcessingOverlay();
  } catch (error) {
    hideProcessingOverlay();
    console.error('Failed to process bundle:', error);
    showErrorModal({ title: 'Failed to open bundle', message: 'Something went wrong while opening the bundle. If this keeps happening, please send a bug report with the details below.', error });
  }

  const bundleInput = document.getElementById('bundle-input');
  if (bundleInput) bundleInput.value = '';
}

export function setup(form, runPreviewIndexFn) {
  form.addEventListener('submit', (e) => handleFormSubmit(e, form));

  document.getElementById('processing-overlay')?.addEventListener('click', (e) => {
    if (e.target.closest('#processing-cancel-btn')) {
      state._cancelReject?.(new Error('__cancelled__'));
    }
  });

  for (const id of ['preview-index-btn', 'preview-index-btn-advanced']) {
    document.getElementById(id)?.addEventListener('click', () => {
      if (getAllFileRows().length === 0) { pulseStep2(); return; }
      if (showMissingInfoModal('preview')) return;
      runPreviewIndex();
    });
  }

  const bundleInput = document.getElementById('bundle-input');
  bundleInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleBundleRestore(file);
  });

  // Debug submit buttons (kept from original)
  document.querySelectorAll('button[type="submit"]').forEach((btn, i) => {
    console.log(`Submit button ${i}:`, btn, 'Inside form:', btn.closest('form'));
    btn.addEventListener('click', (e) => { console.log('Submit button clicked!', e.target); });
  });
}
