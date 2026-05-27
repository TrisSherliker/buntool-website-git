import { state } from './state.js';
import { markDirty } from '../buntoolAutosave.js';
import { parseDateFromFilename, prettifyTitle, stripDoubleChars, uniqueFilename } from './utils.js';
import { makeFileRow, removeEmptyPlaceholder } from './fileRows.js';
import { showSectionPicker } from './sections.js';
import { showErrorModal, showUploadWarningModal } from './modals.js';
import { getDefaultSection0000 } from './helpers.js';

export async function processFiles(files, targetTbody) {
  if (!targetTbody) targetTbody = getDefaultSection0000();

  let totalSize = 0;
  for (const existingFile of state.filesMap.values()) totalSize += existingFile.size;
  for (const file of files) totalSize += file.size;

  const totalSizeMB = totalSize / (1024 * 1024);
  if (totalSizeMB > 450) {
    showErrorModal({
      title: 'Total file size too large',
      message: `You have chosen ${totalSizeMB.toFixed(1)}MB worth of documents which would create a very large bundle. This is too big to be handled reliably, and exceeds the permitted file size. Please split the documents into multiple volumes (often labelled 'A', 'B' etc) and create separate bundles.`,
    });
    return;
  }

  const validationProgress = document.getElementById('validation-progress');
  const validationBar      = document.getElementById('validation-progress-bar');
  const validationLabel    = document.getElementById('validation-progress-label');
  const totalNewFiles = files.length;
  if (validationProgress && totalNewFiles > 0) {
    validationProgress.classList.remove('hidden');
    validationBar.style.width = '0%';
    validationLabel.textContent = `0 / ${totalNewFiles}`;
  }

  let validatedCount = 0;
  for (const file of files) {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const key = uniqueFilename(file.name, state.filesMap);
    const prettyTitle = prettifyTitle(file.name);
    const dateParseObj = await parseDateFromFilename(prettyTitle, state.chrono);
    const displayTitle = stripDoubleChars(dateParseObj.name);
    if (!state.validateAndCountPages) {
      ({ validateAndCountPages: state.validateAndCountPages } = await import('../buntoolPages.js'));
    }
    const validation = await state.validateAndCountPages(fileBytes);
    if (validation.error) {
      showErrorModal({
        title: 'Not a valid PDF file',
        message: `"${file.name}" does not appear to be a valid PDF file. Please check the file and try again. Reasons may include:

        - The file is password-protected (if so, you can save as unprotected PDF or "print" to a new pdf and try again)

        - The file is not actually a PDF (e.g. a Word document - needs converting)

        - The file is corrupted or incomplete (if so, try to get a better copy)

        - The file is digitally signed by software that adds non-standard elements (if so, try "printing" to a new PDF file, to flatten it) `,
      });
      continue;
    }
    const pageCount = validation.pageCount;

    const materializedFile = new File([fileBytes], file.name, { type: 'application/pdf' });
    state.filesMap.set(key, materializedFile);
    state.frontendInputData[key] = { title: displayTitle, date: dateParseObj.date, pageCount };

    const row = makeFileRow(key, { title: displayTitle, date: dateParseObj.date, pageCount });
    removeEmptyPlaceholder(targetTbody);
    targetTbody.appendChild(row);
    markDirty({ immediate: true });

    validatedCount++;
    if (validationBar) {
      validationBar.style.width = `${(validatedCount / totalNewFiles) * 100}%`;
      validationLabel.textContent = `${validatedCount} / ${totalNewFiles}`;
    }
  }

  if (validationProgress) validationProgress.classList.add('hidden');

  let totalPagesNow = 0;
  let totalSizeMbNow = 0;
  for (const [fn, f] of state.filesMap) {
    totalSizeMbNow += f.size / (1024 * 1024);
    totalPagesNow  += state.frontendInputData[fn]?.pageCount ?? 0;
  }
  if (totalPagesNow > 1000 || totalSizeMbNow > 100) {
    const parts = [];
    if (totalPagesNow  > 1000) parts.push(`${totalPagesNow} pages`);
    if (totalSizeMbNow > 100)  parts.push(`${totalSizeMbNow.toFixed(1)} MB`);
    showUploadWarningModal({
      title: '⚠️ Very large bundle',
      message: `Your documents total ${parts.join(' and ')}. It's very rare for single court bundles to exceed 1000 pages or 100 MB. You may want to consider splitting the documents into separate volumes (e.g. "Bundle A" and "Bundle B"). If you proceed, BunTool may take longer than usual to process.`,
    });
  }
}

export function setup() {
  const fileInput = document.getElementById('file-input');

  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    fileInput.value = '';
    if (!files.length) return;
    if (state.isSectioned) {
      showSectionPicker(files);
    } else {
      try {
        await processFiles(files);
      } catch (error) {
        showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error });
      }
    }
  });

  const dropZone = document.getElementById('file-drop-zone');
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('ring-2', 'ring-pink-400');
  });
  dropZone?.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('ring-2', 'ring-pink-400');
    }
  });
  dropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('ring-2', 'ring-pink-400');
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    if (state.isSectioned) {
      showSectionPicker(files);
    } else {
      try {
        await processFiles(files);
      } catch (error) {
        showErrorModal({ title: 'Error adding files', message: 'An unexpected error occurred while adding files.', error });
      }
    }
  });
}
