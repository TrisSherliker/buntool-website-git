import { markDirty } from '../buntoolAutosave.js';

export function sortRowsBy(rows, col, dir) {
  rows.sort((a, b) => {
    let aVal, bVal;
    if (col === 'filename') {
      aVal = a.dataset.filename || '';
      bVal = b.dataset.filename || '';
    } else if (col === 'title') {
      aVal = a.querySelector('.title-input')?.value || '';
      bVal = b.querySelector('.title-input')?.value || '';
    } else if (col === 'date') {
      aVal = a.querySelector('.date-input')?.value || '';
      bVal = b.querySelector('.date-input')?.value || '';
    } else if (col === 'pages') {
      return dir === 'asc'
        ? (parseInt(a.querySelector('.pages-cell')?.textContent || '0') - parseInt(b.querySelector('.pages-cell')?.textContent || '0'))
        : (parseInt(b.querySelector('.pages-cell')?.textContent || '0') - parseInt(a.querySelector('.pages-cell')?.textContent || '0'));
    }
    const cmp = (aVal || '').localeCompare(bVal || '', undefined, { sensitivity: 'base', numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function sortSection(tbody, col, dir) {
  const fileRows = Array.from(tbody.querySelectorAll('tr.file-row'));
  sortRowsBy(fileRows, col, dir);
  fileRows.forEach(row => tbody.appendChild(row));
  markDirty();
}

export function sortSectionPopover(tbody) {
  const existing = document.getElementById('section-sort-popover');
  existing?.remove();
  const btn = tbody.querySelector('.section-sort-btn');
  if (!btn) return;
  const pop = document.createElement('div');
  pop.id = 'section-sort-popover';
  pop.className = 'absolute z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs flex flex-col gap-1';
  pop.style.minWidth = '140px';
  const opts = [
    ['Filename ▲', 'filename', 'asc'], ['Filename ▼', 'filename', 'desc'],
    ['Title ▲',    'title',    'asc'], ['Title ▼',    'title',    'desc'],
    ['Date ▲',     'date',     'asc'], ['Date ▼',     'date',     'desc'],
    ['Pages ▲',    'pages',    'asc'], ['Pages ▼',    'pages',    'desc'],
  ];
  opts.forEach(([label, col, dir]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'text-left px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-700 transition';
    b.textContent = label;
    b.addEventListener('click', () => { sortSection(tbody, col, dir); pop.remove(); });
    pop.appendChild(b);
  });
  document.body.appendChild(pop);
  const rect = btn.getBoundingClientRect();
  pop.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (rect.left  + window.scrollX)     + 'px';
  const dismiss = (e) => {
    if (!pop.contains(e.target) && e.target !== btn) {
      pop.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);
}
