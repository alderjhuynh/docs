'use strict';

const cloud = (() => {
  const TOKEN_KEY = 'ld_cloud_token';
  let token = lsGet(TOKEN_KEY, '');
  const log = (...a) => { console.log('%c[cloud]', 'color:#1a73e8;font-weight:bold', ...a); try { if (window.__cloudLog) window.__cloudLog(...a); } catch (_) { } };

  async function api(path, { method = 'GET', headers, body } = {}) {
    if (!token) throw new Error("No token. Run cloud.login('<your ADMIN_TOKEN>')");
    const res = await fetch('/api' + path, { method, headers: { ...headers, Authorization: 'Bearer ' + token }, body });
    if (res.status === 401) throw new Error("Token rejected. Run cloud.login('<your ADMIN_TOKEN>')");
    return res;
  }
  async function manifest() {
    const res = await api('/docs');
    if (!res.ok) throw new Error('manifest failed: ' + res.status);
    return (await res.json()).docs;
  }

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
      rows.push({ id, title: (l?.title || r?.title || 'Untitled document'), local: l ? new Date(l.modified).toLocaleString() : '', cloud: r && !r.deleted ? new Date(r.modified).toLocaleString() : '', state: st });
    }
    return rows;
  }
  const localDocs = async () => { if (dirty) await save(); return DB.all(); };

  function pick(rows, target, wanted) {
    if (target === 'current') target = state.id;
    if (target === 'all') return rows.filter(r => wanted.includes(r.state));
    const r = rows.find(r => r.id === target);
    if (!r) throw new Error('No doc with id ' + target);
    return [r];
  }

  async function status() {
    const rows = compare(await localDocs(), await manifest());
    console.table(rows);
    return rows;
  }

  async function push(target = 'all', { force = false } = {}) {
    const locals = await localDocs(), rows = compare(locals, await manifest());
    const todo = pick(rows, target, ['local only', 'local newer']).filter(r => r.state !== 'cloud only' && r.state !== 'deleted in cloud' || force);
    const L = new Map(locals.map(d => [d.id, d])), out = { pushed: 0, skipped: [], failed: [] };
    for (const r of todo) {
      const d = L.get(r.id); if (!d) { out.skipped.push(r.id + ' (not local)'); continue; }
      if (!force && r.state === 'same') continue;
      const res = await api('/docs/' + encodeURIComponent(d.id), {
        method: 'PUT',
        headers: { 'X-Doc-Modified': d.modified, 'X-Doc-Created': d.created || d.modified, 'X-Doc-Title': encodeURIComponent(d.title || ''), ...(force ? { 'X-Doc-Force': '1' } : {}) },
        body: JSON.stringify(d)
      });
      if (res.ok) { out.pushed++; log('pushed', untitled(d)); }
      else if (res.status === 409) out.skipped.push(untitled(d) + ' (cloud is newer; use { force: true })');
      else out.failed.push(untitled(d) + ' (' + res.status + ')');
    }
    log('push done', out); return out;
  }

  async function pull(target = 'all', { force = false, prune = false } = {}) {
    const locals = await localDocs(), rows = compare(locals, await manifest());
    const todo = pick(rows, target, force ? ['cloud only', 'cloud newer', 'local newer'] : ['cloud only', 'cloud newer']);
    const out = { pulled: 0, deleted: 0, skipped: [], failed: [] };
    for (const r of todo) {
      if (r.state === 'deleted in cloud' || r.state === 'local newer' && !force || r.state === 'local only') { out.skipped.push(r.title + ' (' + r.state + ')'); continue; }
      const res = await api('/docs/' + encodeURIComponent(r.id));
      if (!res.ok) { out.failed.push(r.title + ' (' + res.status + ')'); continue; }
      const d = await res.json();
      if (!d || d.id !== r.id) { out.failed.push(r.title + ' (bad record)'); continue; }
      await DB.put(d); out.pulled++; log('pulled', untitled(d));
      if (state.id === d.id) await loadDoc(d.id);
    }
    if (prune) {
      for (const r of rows.filter(r => r.state === 'deleted in cloud')) { await DB.del(r.id); out.deleted++; log('removed locally (deleted in cloud)', r.title); if (state.id === r.id) location.hash = ''; }
    }
    if (typeof homeOpen === 'function' && homeOpen()) renderHome();
    log('pull done', out); return out;
  }

  async function remove(id) {
    if (!id) throw new Error('cloud.remove(id)');
    const res = await api('/docs/' + encodeURIComponent(id), { method: 'DELETE' });
    log(res.ok ? 'removed from cloud' : 'failed ' + res.status, id); return res.ok;
  }

  async function login(t, { remember = true } = {}) {
    if (!t || typeof t !== 'string') throw new Error("cloud.login('<your ADMIN_TOKEN>')");
    const prev = token; token = t.trim();
    try { await manifest(); } catch (e) { token = prev; throw e; }
    if (remember) lsSet(TOKEN_KEY, token);
    log('signed in'); return true;
  }
  function logout() { token = ''; try { localStorage.removeItem(TOKEN_KEY); } catch { } log('token forgotten'); }

  if (token) {
    (async () => {
      for (let i = 0; i < 100 && !DB.db; i++) await new Promise(r => setTimeout(r, 100));
      if (!DB.db) return;
      try {
        const rows = compare(await DB.all(), await manifest()), n = s => rows.filter(r => r.state === s).length;
        const diff = rows.length - n('same');
        if (diff) log(`${n('cloud newer') + n('cloud only')} to pull, ${n('local newer') + n('local only')} to push, ${n('deleted in cloud')} deleted in cloud. Run cloud.status()`);
        else log('in sync');
      } catch (e) { }
    })();
  }

  return { login, logout, status, push, pull, remove, getToken: () => token };
})();
