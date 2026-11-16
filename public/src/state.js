'use strict';

const state = {
  id: null, title: '', zoom: 1, created: 0,
  ps: { size: 'Letter', orient: 'portrait', mt: 1, mb: 1, ml: 1, mr: 1 },
  tabs: [],
  tab: null,
  comments: []
};
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('localdocs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => rej(r.error);
    });
  },
  tx(mode, fn) { return new Promise((res, rej) => { const t = this.db.transaction('docs', mode); const q = fn(t.objectStore('docs')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); },
  get: function (id) { return this.tx('readonly', s => s.get(id)); },
  put: function (d) { return this.tx('readwrite', s => s.put(d)); },
  del: function (id) { return this.tx('readwrite', s => s.delete(id)); },
  all: function () { return this.tx('readonly', s => s.getAll()); }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeName = () => ((state.title || 'Untitled document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled document');

let saveTimer, dirty = false;
function markDirty() { dirty = true; $('#saveState').textContent = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
async function save() {
  if (!state.id || !DB.db) return; clearTimeout(saveTimer);
  deselectImg(); tabsFlush();
  try {
    await DB.put({ id: state.id, title: state.title, tabs: state.tabs, comments: state.comments, modified: Date.now(), created: state.created, ps: state.ps });
    dirty = false; $('#saveState').textContent = 'Saved locally';
  } catch (e) { $('#saveState').textContent = 'Save failed'; console.error(e); }
}
window.addEventListener('beforeunload', () => { if (dirty) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) save(); });

async function loadDoc(id) {
  if (dirty) await save();
  const d = await DB.get(id); if (!d) return false;
  state.id = d.id; state.title = d.title || ''; state.created = d.created || d.modified;
  state.ps = Object.assign({ size: 'Letter', orient: 'portrait', mt: 1, mb: 1, ml: 1, mr: 1 }, d.ps || {});
  tabsLoad(d);
  $('#docTitle').value = state.title; document.title = (state.title || 'Untitled document') + ' - Docs';
  lsSet('ld_current', id); history.replaceState(null, '', '#' + id);
  applyPageSetup(); refreshOutline(); updateCounts(); updateToolbar();
  $('#saveState').textContent = 'Saved locally'; dirty = false; page.scrollTop = 0; canvas.scrollTop = 0;
  hideHome();
  return true;
}
async function newDoc(opts = {}) {
  if (dirty) await save();
  const id = uid(), now = Date.now();
  await DB.put({ id, title: opts.title || '', tabs: opts.tabs || [newTab({ title: 'Tab 1', html: opts.html })], comments: [], modified: now, created: now, ps: opts.ps || undefined });
  await loadDoc(id); page.focus(); return id;
}
