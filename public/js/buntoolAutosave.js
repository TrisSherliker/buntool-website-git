/**
 * BunTool
 * Copyright (c) 2025-2026 Tris Sherliker (tris@sherliker.net)
 * Licensed under the Mozilla Public License Version 2.0.
 *
 * buntoolAutosave.js
 * Periodic autosave of app state (source files + form data) to IndexedDB.
 *
 * Triggers:
 *   - File upload: save after UPLOAD_SETTLE_MS (lets page-counting finish)
 *   - Inactivity: save after INACTIVITY_MS of no further changes, but only
 *     if the state has changed since the last save
 *
 * Cap: always keep at least 1 snapshot; evict oldest when total exceeds MAX_BYTES or
 *      count exceeds MAX_COUNT.
 * Batching: autosave fires after DIRTY_THRESHOLD markDirty calls OR INACTIVITY_MS,
 *      whichever comes first.
 */

const DB_NAME           = 'buntool-autosave';
const DB_VERSION        = 1;
const MAX_BYTES         = 500 * 1024 * 1024; // 500 MB
const MAX_COUNT         = 20;                // max stored snapshots
const INACTIVITY_MS     = 5 * 60 * 1000;    // 5 minutes
const UPLOAD_SETTLE_MS  = 3_000;            // wait for page-counting on upload
const DIRTY_THRESHOLD   = 5;               // save after this many non-immediate markDirty calls

let _getState   = null;
let _dirty      = false;
let _dirtyCount = 0;
let _timer      = null;
let _db         = null;


// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function _openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ({ target: { result: db } }) => {
      // Full snapshot data (includes ArrayBuffers for PDF bytes)
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'timestamp' });
      }
      // Lightweight metadata for listing without loading file bytes
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'timestamp' });
      }
    };
    req.onsuccess = ({ target: { result: db } }) => { _db = db; resolve(db); };
    req.onerror   = ({ target: { error } })       => reject(error);
  });
}

function _req(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

function _txDone(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
    tx.onabort    = () => rej(tx.error);
  });
}


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise with an async callback that returns the current app state to
 * snapshot, or null if there is nothing worth saving.
 * Call this once at app startup.
 *
 * @param {() => Promise<Object|null>} getState
 */
export function init(getState) {
  _getState = getState;
}

/**
 * Mark state as changed and schedule an autosave.
 *
 * @param {{ immediate?: boolean }} opts
 *   immediate=true  — triggered by a file upload; save after UPLOAD_SETTLE_MS
 *   immediate=false — triggered by an edit; save after INACTIVITY_MS
 */
export function markDirty({ immediate = false } = {}) {
  _dirty = true;
  if (immediate) {
    // File upload — settle briefly then save regardless of count
    clearTimeout(_timer);
    _timer = setTimeout(_performSave, UPLOAD_SETTLE_MS);
    return;
  }
  _dirtyCount++;
  if (_dirtyCount >= DIRTY_THRESHOLD) {
    // Threshold reached — save immediately (no further delay)
    clearTimeout(_timer);
    _dirtyCount = 0;
    _performSave();
    return;
  }
  // Reset inactivity window; save after INACTIVITY_MS of quiet
  clearTimeout(_timer);
  _timer = setTimeout(() => { _dirtyCount = 0; _performSave(); }, INACTIVITY_MS);
}

/**
 * List saved snapshots, newest first. Returns lightweight metadata only
 * (no file bytes) so callers can show a list without loading large data.
 *
 * @returns {Promise<Array<{ timestamp: number, sizeBytes: number, fileCount: number }>>}
 */
/**
 * Save immediately, bypassing the dirty flag and any pending timer.
 */
export async function saveNow() {
  clearTimeout(_timer);
  _dirty = true;
  await _performSave();
}

export async function listSnapshots() {
  const db  = await _openDb();
  const all = await _req(db.transaction('meta', 'readonly').objectStore('meta').getAll());
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Load the full snapshot for a given timestamp, including file bytes.
 *
 * @param {number} timestamp
 * @returns {Promise<Object|undefined>}
 */
export async function loadSnapshot(timestamp) {
  const db = await _openDb();
  return _req(db.transaction('snapshots', 'readonly').objectStore('snapshots').get(timestamp));
}

/**
 * Delete a single snapshot by timestamp.
 */
export async function deleteSnapshot(timestamp) {
  const db = await _openDb();
  const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
  tx.objectStore('snapshots').delete(timestamp);
  tx.objectStore('meta').delete(timestamp);
  return _txDone(tx);
}

/**
 * Delete all snapshots.
 */
export async function clearAll() {
  const db = await _openDb();
  const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
  tx.objectStore('snapshots').clear();
  tx.objectStore('meta').clear();
  return _txDone(tx);
}


// ── Internal ──────────────────────────────────────────────────────────────────

async function _performSave() {
  if (!_dirty || !_getState) return;

  let state;
  try {
    state = await _getState();
  } catch (err) {
    console.warn('[autosave] getState() threw:', err);
    return;
  }
  if (!state?.files?.length) return;

  const timestamp   = Date.now();
  const sizeBytes   = _calcSize(state);
  const fileCount   = state.files.length;
  const bundleTitle = state.config?.bundleTitle || state.config?.heading?.bundleTitle || '';
  const projectName = state.config?.projectName || state.config?.heading?.projectName || '';

  try {
    const db = await _openDb();
    const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
    tx.objectStore('snapshots').put({ timestamp, ...state });
    tx.objectStore('meta').put({ timestamp, sizeBytes, fileCount, bundleTitle, projectName });
    await _txDone(tx);

    await _enforceCap();

    _dirty = false;
    console.log(`[autosave] Saved ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${fileCount} doc(s) · ${_fmtBytes(sizeBytes)}`);
  } catch (err) {
    console.warn('[autosave] Save failed:', err);
  }
}

async function _enforceCap() {
  const db  = await _openDb();
  const all = await _req(db.transaction('meta', 'readonly').objectStore('meta').getAll());
  all.sort((a, b) => a.timestamp - b.timestamp); // oldest first

  let total      = all.reduce((s, m) => s + m.sizeBytes, 0);
  const toDelete = [];

  while (
    (total > MAX_BYTES || all.length - toDelete.length > MAX_COUNT) &&
    all.length - toDelete.length > 1
  ) {
    const oldest = all[toDelete.length];
    total -= oldest.sizeBytes;
    toDelete.push(oldest.timestamp);
  }

  if (!toDelete.length) return;

  const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
  for (const ts of toDelete) {
    tx.objectStore('snapshots').delete(ts);
    tx.objectStore('meta').delete(ts);
  }
  await _txDone(tx);
  console.log(`[autosave] Evicted ${toDelete.length} old snapshot(s) to stay under cap`);
}

function _calcSize(state) {
  let n = 10_000; // ~10 KB overhead for JSON-serialisable fields
  for (const f of state.files)    n += f.bytes.byteLength;
  if (state.coversheet)           n += state.coversheet.bytes.byteLength;
  return n;
}

function _fmtBytes(n) {
  if (n < 1024)       return `${n} B`;
  if (n < 1024 ** 2)  return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
