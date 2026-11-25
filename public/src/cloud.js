'use strict';

const cloud = (() => {
  const TOKEN_KEY = 'ld_cloud_token';
  let token = lsGet(TOKEN_KEY, '');
  const listeners = new Set();

  const log = (...a) => {
    console.log('%c[cloud]', 'color:#1a73e8;font-weight:bold', ...a);
    try { if (window.__cloudLog) window.__cloudLog(...a); } catch (_) { }
  };
  const emit = () => { for (const fn of listeners) { try { fn(); } catch (_) { } } };
  const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  async function api(path, { method = 'GET', headers, body } = {}) {
    if (!token) throw new Error('Sign in to cloud storage first.');
    let res;
    try {
      res = await fetch('/api' + path, { method, headers: { ...headers, Authorization: 'Bearer ' + token }, body });
    } catch (_) {
      throw new Error('Could not reach the cloud. Check your connection and try again.');
    }
    if (res.status === 401) throw new Error('That access token was rejected. Check it and try again.');
    return res;
  }

  async function manifest() {
    const res = await api('/docs');
    if (!res.ok) throw new Error('Could not load cloud documents (' + res.status + ').');
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.docs)) throw new Error('The cloud returned an unexpected response.');
    return data.docs;
  }

  async function ready() {
    for (let i = 0; i < 100 && !DB.db; i++) await new Promise(r => setTimeout(r, 50));
    if (!DB.db) throw new Error('Local storage is not ready yet.');
  }
  const localDocs = async () => { await ready(); if (dirty) await save(); return DB.all(); };

  function compare(locals, remotes) {
    const L = new Map(locals.map(d => [d.id, d])), R = new Map(remotes.map(d => [d.id, d]));
    const rows = [];
    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id), r = R.get(id);
      let st;
      if (l && !r) st = 'local only';
      else if (!l && r) st = r.deleted ? 'gone' : 'cloud only';
      else if (r.deleted) st = r.modified > l.modified ? 'deleted in cloud' : 'local newer';
      else st = l.modified === r.modified ? 'same' : l.modified > r.modified ? 'local newer' : 'cloud newer';
      if (st === 'gone') continue;
      rows.push({
        id,
        title: l?.title || r?.title || 'Untitled document',
        local: l ? new Date(l.modified).toLocaleString() : '',
        cloud: r && !r.deleted ? new Date(r.modified).toLocaleString() : '',
        localModified: l?.modified || 0,
        cloudModified: r?.modified || 0,
        hasLocal: !!l,
        hasCloud: !!(r && !r.deleted),
        state: st,
      });
    }
    return rows;
  }

  function candidates(rows, target) {
    if (target === 'current') target = state.id;
    if (target === 'all') return rows;
    if (!target) throw new Error('No document is open.');
    const row = rows.find(r => r.id === target);
    if (!row) throw new Error('That document was not found locally or in the cloud.');
    return [row];
  }

  async function status() {
    const rows = compare(await localDocs(), await manifest());
    console.table(rows);
    return rows;
  }

  const PUSHABLE = new Set(['local only', 'local newer']);
  const PULLABLE = new Set(['cloud only', 'cloud newer']);

  async function push(target = 'all', { force = false } = {}) {
    const locals = await localDocs();
    const rows = compare(locals, await manifest());
    const list = candidates(rows, target);
    const explicit = target !== 'all';
    const L = new Map(locals.map(d => [d.id, d]));
    const out = { pushed: 0, skipped: [], failed: [] };

    for (const r of list) {
      const d = L.get(r.id);
      if (!d) {
        if (explicit) out.skipped.push(r.title + ' (not on this device)');
        continue;
      }
      if (!force && !PUSHABLE.has(r.state)) {
        if (explicit) out.skipped.push(r.title + ' (already up to date)');
        continue;
      }
      if (!force && r.state === 'same') continue;
      const res = await api('/docs/' + encodeURIComponent(d.id), {
        method: 'PUT',
        headers: {
          'X-Doc-Modified': d.modified,
          'X-Doc-Created': d.created || d.modified,
          'X-Doc-Title': encodeURIComponent(d.title || ''),
          ...(force ? { 'X-Doc-Force': '1' } : {}),
        },
        body: JSON.stringify(d),
      });
      if (res.ok) { out.pushed++; log('Uploaded', untitled(d)); }
      else if (res.status === 409) out.skipped.push(untitled(d) + ' (cloud copy is newer)');
      else out.failed.push(untitled(d) + ' (' + res.status + ')');
    }
    log('push done', out);
    emit();
    return out;
  }

  async function pull(target = 'all', { force = false, prune = false } = {}) {
    const locals = await localDocs();
    const rows = compare(locals, await manifest());
    const list = candidates(rows, target);
    const explicit = target !== 'all';
    const out = { pulled: 0, deleted: 0, skipped: [], failed: [] };

    for (const r of list) {
      if (!r.hasCloud) {
        if (explicit && r.state !== 'deleted in cloud') out.skipped.push(r.title + ' (not in the cloud)');
        continue;
      }
      if (!force && !PULLABLE.has(r.state)) {
        if (explicit) out.skipped.push(r.title + ' (already up to date)');
        continue;
      }
      const res = await api('/docs/' + encodeURIComponent(r.id));
      if (!res.ok) { out.failed.push(r.title + ' (' + res.status + ')'); continue; }
      const d = await res.json().catch(() => null);
      if (!d || d.id !== r.id) { out.failed.push(r.title + ' (bad record)'); continue; }
      await DB.put(d); out.pulled++; log('Downloaded', untitled(d));
      if (state.id === d.id) await loadDoc(d.id);
    }

    if (prune) {
      const prunable = target === 'all' ? rows : list;
      for (const r of prunable.filter(r => r.state === 'deleted in cloud')) {
        await DB.del(r.id); out.deleted++; log('Removed local copy of', r.title);
        if (state.id === r.id) location.hash = '';
      }
    }

    if (typeof homeOpen === 'function' && homeOpen()) renderHome();
    log('pull done', out);
    emit();
    return out;
  }

  async function sync(target = 'all') {
    const pushed = await push(target);
    const pulled = await pull(target);
    return { pushed, pulled };
  }

  async function remove(id) {
    if (!id) throw new Error('Choose a document to remove.');
    const res = await api('/docs/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not remove from the cloud (' + res.status + ').');
    log('Removed from cloud', id);
    emit();
    return true;
  }

  async function login(t, { remember = true } = {}) {
    if (!t || typeof t !== 'string' || !t.trim()) throw new Error('Enter your access token.');
    const prev = token;
    token = t.trim();
    try { await manifest(); } catch (e) { token = prev; throw e; }
    if (remember) lsSet(TOKEN_KEY, token);
    log('Signed in');
    emit();
    return true;
  }

  function logout() {
    token = '';
    try { localStorage.removeItem(TOKEN_KEY); } catch { }
    log('Signed out');
    emit();
  }

  const getToken = () => token;
  const signedIn = () => !!token;

  if (token) {
    (async () => {
      try {
        await ready();
        const rows = compare(await DB.all(), await manifest()), n = s => rows.filter(r => r.state === s).length;
        const diff = rows.length - n('same');
        if (diff) log(`${n('cloud newer') + n('cloud only')} to download, ${n('local newer') + n('local only')} to upload, ${n('deleted in cloud')} deleted in cloud`);
        else log('In sync');
      } catch (e) { }
    })();
  }

  return { login, logout, status, push, pull, sync, remove, getToken, signedIn, ready, onChange };
})();
