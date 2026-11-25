'use strict';

const cloudUI = (() => {
  const TOKEN_KEY = 'ld_cloud_token';
  const STATE_ORDER = ['local newer', 'local only', 'cloud newer', 'cloud only', 'deleted in cloud', 'same'];
  let panel = null;
  const ui = {};
  let rows = null;
  let lastChecked = 0;
  let busy = false;
  let loginBusy = false;
  let loadError = '';
  let logLines = [];

  function isMobile() {
    try { return window.matchMedia('(max-width: 720px)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
    catch { return false; }
  }

  function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    kids.flat().forEach(k => { if (k == null) return; e.append(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }

  const icon = name => svg(ICONS[name] || ICONS.cloud);

  function appendLog(...a) {
    const msg = a.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
    logLines.push(msg);
    if (logLines.length > 200) logLines.shift();
    renderLog();
  }

  function renderLog() {
    if (!panel) return;
    const out = panel.querySelector('#cloudLog');
    if (!out) return;
    out.textContent = logLines.join('\n');
    out.scrollTop = out.scrollHeight;
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' hr ago';
    return new Date(ts).toLocaleDateString();
  }

  function metaText(r) {
    switch (r.state) {
      case 'local only': return 'Only on this device' + (r.local ? ' · ' + r.local : '');
      case 'local newer': return 'This device is newer' + (r.local ? ' · ' + r.local : '');
      case 'cloud only': return 'Only in the cloud' + (r.cloud ? ' · ' + r.cloud : '');
      case 'cloud newer': return 'Cloud copy is newer' + (r.cloud ? ' · ' + r.cloud : '');
      case 'deleted in cloud': return 'Removed from the cloud';
      default: return 'Up to date' + (r.local || r.cloud ? ' · ' + (r.local || r.cloud) : '');
    }
  }

  function setStateIcon(name, spin = false) {
    ui.stateIcon.innerHTML = icon(name);
    ui.stateIcon.classList.toggle('spin', spin);
  }

  function renderState(tone, title, sub) {
    ui.stateCard.className = 'cloud-state is-' + tone;
    setStateIcon(tone === 'ok' ? 'cloudDone' : tone === 'error' ? 'cloudOff' : tone === 'loading' ? 'refresh' : 'cloud', tone === 'loading');
    ui.stateTitle.textContent = title;
    ui.stateSub.textContent = sub;
  }

  function pendingRows() {
    return (rows || []).filter(r => r.state !== 'same');
  }

  function renderSummary() {
    const total = rows.length, pending = pendingRows();
    const upload = rows.filter(r => r.state === 'local only' || r.state === 'local newer').length;
    const download = rows.filter(r => r.state === 'cloud only' || r.state === 'cloud newer').length;
    const removed = rows.filter(r => r.state === 'deleted in cloud').length;
    const bits = [];
    if (upload) bits.push(upload + ' to upload');
    if (download) bits.push(download + ' to download');
    if (removed) bits.push(removed + ' removed');

    if (!total) renderState('ok', 'No documents yet', 'Create a document to start syncing.');
    else if (!pending.length) renderState('ok', total + (total === 1 ? ' document synced' : ' documents synced'), 'Everything is up to date.');
    else renderState('warn', pending.length + (pending.length === 1 ? ' document needs attention' : ' documents need attention'), bits.join(' · '));
  }

  function updateRowButtons() {
    if (!ui.list) return;
    ui.list.querySelectorAll('button').forEach(b => { b.disabled = busy; });
  }

  function setBusy(v) {
    busy = v;
    if (ui.syncBtn) {
      ui.syncBtn.disabled = v;
      ui.syncBtn.textContent = v ? 'Syncing…' : 'Sync now';
    }
    if (ui.refreshBtn) ui.refreshBtn.disabled = v;
    if (ui.uploadAll) ui.uploadAll.disabled = v;
    if (ui.downloadAll) ui.downloadAll.disabled = v;
    if (ui.signout) ui.signout.disabled = v;
    updateRowButtons();
  }

  function setLoginBusy(v) {
    loginBusy = v;
    if (ui.loginBtn) { ui.loginBtn.disabled = v; ui.loginBtn.textContent = v ? 'Signing in…' : 'Sign in'; }
    if (ui.token) ui.token.disabled = v;
  }

  function showError(msg) {
    ui.error.textContent = msg || '';
    ui.error.hidden = !msg;
  }

  function setReveal(on) {
    ui.token.type = on ? 'text' : 'password';
    ui.reveal.textContent = on ? 'Hide' : 'Show';
    ui.reveal.title = on ? 'Hide access token' : 'Show access token';
    ui.reveal.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function rowEl(r) {
    const row = el('div', { className: 'cloud-doc' });
    row.dataset.state = r.state;

    const docIcon = el('span', { className: 'cloud-docicon' });
    docIcon.innerHTML = icon(r.state === 'same' ? 'cloudDone' : r.state === 'deleted in cloud' ? 'cloudOff' : 'cloud');

    const main = el('div', { className: 'cloud-docmain' },
      el('div', { className: 'cloud-docname', textContent: r.title }),
      el('div', { className: 'cloud-docmeta', textContent: metaText(r) })
    );

    const acts = el('div', { className: 'cloud-docacts' });
    if (r.state === 'local only' || r.state === 'local newer') {
      const b = el('button', { type: 'button', className: 'cloud-docbtn', textContent: 'Upload', title: 'Upload this document to the cloud' });
      b.onclick = () => rowAction(r, 'upload');
      acts.append(b);
    } else if (r.state === 'cloud only' || r.state === 'cloud newer') {
      const b = el('button', { type: 'button', className: 'cloud-docbtn', textContent: 'Download', title: 'Download this document from the cloud' });
      b.onclick = () => rowAction(r, 'download');
      acts.append(b);
    } else if (r.state === 'deleted in cloud') {
      const b = el('button', { type: 'button', className: 'cloud-docbtn danger', textContent: 'Remove local', title: 'Remove the local copy of this document' });
      b.onclick = () => rowAction(r, 'forget');
      acts.append(b);
    } else {
      const ok = el('span', { className: 'cloud-check', title: 'Up to date' });
      ok.innerHTML = icon('check');
      acts.append(ok);
    }

    if (r.hasCloud) {
      const rm = el('button', { type: 'button', className: 'cloud-dociconbtn', title: 'Remove from cloud' });
      rm.innerHTML = icon('trash');
      rm.onclick = () => rowAction(r, 'remove-cloud');
      acts.append(rm);
    }

    row.append(docIcon, main, acts);
    return row;
  }

  function renderList() {
    if (!ui.list) return;
    ui.list.innerHTML = '';
    if (!rows) {
      ui.listHead.hidden = true;
      ui.empty.hidden = true;
      return;
    }
    const sorted = rows.slice().sort((a, b) => {
      const d = STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
      return d || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
    sorted.forEach(r => ui.list.append(rowEl(r)));
    ui.count.textContent = String(sorted.length);
    ui.listHead.hidden = sorted.length === 0;
    ui.empty.hidden = sorted.length !== 0;
    if (!sorted.length) {
      ui.emptyTitle.textContent = 'No documents yet';
      ui.emptyText.textContent = 'Create a document and it will show up here.';
    }
    updateRowButtons();
  }

  function render() {
    if (!panel) return;
    const signed = cloud.signedIn();
    ui.signin.hidden = signed;
    ui.account.hidden = !signed;
    ui.sub.textContent = signed ? (busy ? 'Syncing…' : 'Connected') : 'Not connected';
    if (!signed) {
      showError('');
      rows = null;
      loadError = '';
      renderList();
      return;
    }

    if (loadError) renderState('error', 'Could not reach the cloud', loadError);
    else if (!rows && busy) renderState('loading', 'Checking for changes…', 'This only takes a moment.');
    else if (!rows) renderState('warn', 'Ready to check', 'Refresh to see what needs syncing.');
    else renderSummary();

    renderList();
    ui.note.textContent = lastChecked ? 'Checked ' + timeAgo(lastChecked) : '';
  }

  async function refresh({ quiet = false } = {}) {
    if (!cloud.signedIn()) { rows = null; render(); return; }
    const alreadyBusy = busy;
    if (!alreadyBusy) setBusy(true);
    loadError = '';
    render();
    try {
      rows = await cloud.status();
      lastChecked = Date.now();
    } catch (e) {
      loadError = e.message || 'Could not check the cloud.';
      if (!quiet) toast(loadError, 5000);
    } finally {
      if (!alreadyBusy) setBusy(false);
      render();
    }
  }

  function outcomeText(out) {
    const up = out.pushed !== undefined ? out.pushed : 0;
    const down = out.pulled !== undefined ? out.pulled : 0;
    const del = out.deleted !== undefined ? out.deleted : 0;
    const failed = (out.failed && out.failed.length) || 0;
    if (failed) return 'Finished with errors. See Activity for details.';
    const bits = [];
    if (up) bits.push(up + ' uploaded');
    if (down) bits.push(down + ' downloaded');
    if (del) bits.push(del + ' removed locally');
    return bits.length ? bits.join(' · ') : 'Everything is up to date';
  }

  async function rowAction(r, kind) {
    if (busy) return;
    if (kind === 'remove-cloud') {
      if (!confirm('Remove "' + r.title + '" from cloud storage?\n\nThe local copy will stay on this device.')) return;
      setBusy(true);
      try { await cloud.remove(r.id); toast('Removed from cloud'); }
      catch (e) { toast(e.message || 'Could not remove from the cloud.', 5000); }
      finally { setBusy(false); await refresh({ quiet: true }); }
      return;
    }
    if (kind === 'forget') {
      if (typeof removeDoc === 'function') { await removeDoc({ id: r.id, title: r.title }); await refresh({ quiet: true }); return; }
      if (!confirm('Remove the local copy of "' + r.title + '"?')) return;
      setBusy(true);
      try { await DB.del(r.id); }
      catch (e) { toast(e.message || 'Could not remove the local copy.', 5000); }
      finally { setBusy(false); await refresh({ quiet: true }); }
      return;
    }

    setBusy(true);
    try {
      if (kind === 'upload') {
        const out = await cloud.push(r.id);
        toast(out.pushed ? 'Uploaded to cloud' : (out.skipped[0] || 'Nothing to upload'));
      } else {
        const out = await cloud.pull(r.id);
        toast(out.pulled ? 'Downloaded from cloud' : (out.skipped[0] || 'Nothing to download'));
      }
    } catch (e) {
      toast(e.message || 'Cloud action failed.', 5000);
    } finally {
      setBusy(false);
      await refresh({ quiet: true });
    }
  }

  async function doSync() {
    if (busy) return;
    setBusy(true);
    loadError = '';
    render();
    try {
      const out = await cloud.sync('all');
      toast(outcomeText({ pushed: out.pushed.pushed, pulled: out.pulled.pulled, deleted: out.pulled.deleted, failed: [...out.pushed.failed, ...out.pulled.failed] }), 3500);
    } catch (e) {
      toast(e.message || 'Sync failed.', 5000);
    } finally {
      setBusy(false);
      await refresh({ quiet: true });
    }
  }

  async function runAll(label, fn) {
    if (busy) return;
    setBusy(true);
    loadError = '';
    render();
    try {
      const out = await fn();
      toast((label ? label + ': ' : '') + outcomeText(out), 3500);
    } catch (e) {
      toast(e.message || 'Cloud action failed.', 5000);
    } finally {
      setBusy(false);
      await refresh({ quiet: true });
    }
  }

  async function doLogin() {
    if (loginBusy) return;
    const t = ui.token.value.trim();
    if (!t) { showError('Enter your access token.'); ui.token.focus(); return; }
    showError('');
    setLoginBusy(true);
    try {
      await cloud.login(t, { remember: true });
      ui.token.value = '';
      setReveal(false);
      rows = null;
      lastChecked = 0;
      loadError = '';
      render();
      await refresh();
      toast('Connected to cloud storage');
    } catch (e) {
      showError(e.message || 'Could not sign in.');
    } finally {
      setLoginBusy(false);
    }
  }

  function doSignOut() {
    cloud.logout();
    rows = null;
    lastChecked = 0;
    loadError = '';
    setReveal(false);
    ui.token.value = '';
    render();
    toast('Signed out');
  }

  function buildPanel() {
    const p = el('div', { id: 'cloudPanel', className: 'cloud-panel', hidden: true });
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Cloud storage');

    const mark = el('span', { className: 'cloud-mark' });
    mark.innerHTML = icon('cloud');
    ui.sub = el('div', { className: 'cloud-sub', textContent: 'Not connected' });
    ui.closeBtn = el('button', { type: 'button', className: 'cloud-iconbtn cloud-close', title: 'Close' });
    ui.closeBtn.innerHTML = icon('close');
    const head = el('div', { className: 'cloud-head' },
      mark,
      el('div', { className: 'cloud-headtext' },
        el('div', { className: 'cloud-title', textContent: 'Cloud storage' }),
        ui.sub
      ),
      ui.closeBtn
    );

    ui.token = el('input', { type: 'password', id: 'cloudToken', placeholder: 'Paste your access token', autocomplete: 'off' });
    ui.token.spellcheck = false;
    ui.reveal = el('button', { type: 'button', className: 'cloud-reveal', textContent: 'Show', title: 'Show access token' });
    ui.loginBtn = el('button', { type: 'button', className: 'cloud-primary cloud-block', id: 'cloudLoginBtn', textContent: 'Sign in' });
    ui.error = el('div', { className: 'cloud-error', hidden: true, role: 'alert' });
    const signin = el('div', { className: 'cloud-signin' },
      el('p', { className: 'cloud-copy', textContent: 'Sign in to keep your documents in sync across devices. They stay available offline and update when you reconnect.' }),
      el('label', { className: 'cloud-field' },
        el('span', { className: 'cloud-label', textContent: 'Access token' }),
        el('span', { className: 'cloud-tokenwrap' }, ui.token, ui.reveal)
      ),
      ui.loginBtn,
      ui.error
    );

    ui.stateIcon = el('span', { className: 'cloud-stateicon' });
    ui.stateTitle = el('div', { className: 'cloud-statetitle' });
    ui.stateSub = el('div', { className: 'cloud-statesub', role: 'status' });
    ui.refreshBtn = el('button', { type: 'button', className: 'cloud-iconbtn', title: 'Check for changes' });
    ui.refreshBtn.innerHTML = icon('refresh');
    ui.stateCard = el('div', { className: 'cloud-state is-warn' },
      ui.stateIcon,
      el('div', { className: 'cloud-statemain' }, ui.stateTitle, ui.stateSub),
      ui.refreshBtn
    );

    ui.syncBtn = el('button', { type: 'button', className: 'cloud-primary', id: 'cloudSyncBtn', textContent: 'Sync now' });
    const actions = el('div', { className: 'cloud-actions' }, ui.syncBtn);

    ui.count = el('span', { className: 'cloud-count' });
    ui.listHead = el('div', { className: 'cloud-listhead' },
      el('span', { textContent: 'Documents' }),
      ui.count
    );
    ui.list = el('div', { className: 'cloud-list', id: 'cloudList', role: 'list' });
    ui.emptyTitle = el('div', { className: 'big' });
    ui.emptyText = el('div');
    ui.empty = el('div', { className: 'cloud-empty', hidden: true },
      (() => { const s = el('span', { className: 'cloud-emptyicon' }); s.innerHTML = icon('cloud'); return s; })(),
      ui.emptyTitle,
      ui.emptyText
    );

    ui.log = el('pre', { className: 'cloud-log', id: 'cloudLog' });
    const activity = el('details', { className: 'cloud-activity' },
      el('summary', { textContent: 'Activity' }),
      ui.log
    );

    ui.uploadAll = el('button', { type: 'button', className: 'cloud-link', textContent: 'Upload all', title: 'Upload every document that is newer on this device' });
    ui.downloadAll = el('button', { type: 'button', className: 'cloud-link', textContent: 'Download all', title: 'Download every document that is newer in the cloud' });
    ui.signout = el('button', { type: 'button', className: 'cloud-link danger', id: 'cloudSignout', textContent: 'Sign out' });
    ui.note = el('span', { className: 'cloud-note' });
    const foot = el('div', { className: 'cloud-foot' },
      el('div', { className: 'cloud-footlinks' }, ui.uploadAll, ui.downloadAll, ui.signout),
      ui.note
    );

    const account = el('div', { className: 'cloud-account', hidden: true },
      ui.stateCard,
      actions,
      ui.listHead,
      ui.list,
      ui.empty,
      activity,
      foot
    );

    const body = el('div', { className: 'cloud-body' }, signin, account);
    p.append(head, body);
    document.body.append(p);

    ui.closeBtn.onclick = hide;
    ui.loginBtn.onclick = doLogin;
    ui.token.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });
    ui.reveal.onclick = () => setReveal(ui.token.type === 'password');
    ui.refreshBtn.onclick = () => refresh();
    ui.syncBtn.onclick = doSync;
    ui.uploadAll.onclick = () => runAll('Upload all', () => cloud.push('all'));
    ui.downloadAll.onclick = () => runAll('Download all', () => cloud.pull('all'));
    ui.signout.onclick = doSignOut;
    p.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } });

    const tokenInput = ui.token;
    try { const saved = localStorage.getItem(TOKEN_KEY); if (saved) tokenInput.value = saved; } catch { }

    return p;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = buildPanel();
    return panel;
  }

  function reflectButtons() {
    const open = !!(panel && !panel.hidden);
    document.querySelectorAll('[data-cloud-open]').forEach(b => {
      b.classList.toggle('on', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function show() {
    const p = ensurePanel();
    p.hidden = false;
    reflectButtons();
    try { const saved = localStorage.getItem(TOKEN_KEY); if (saved && !ui.token.value) ui.token.value = saved; } catch { }
    render();
    if (cloud.signedIn()) refresh({ quiet: true });
    else setTimeout(() => { if (!p.hidden) ui.token.focus(); }, 40);
  }

  function hide() {
    const p = ensurePanel();
    p.hidden = true;
    reflectButtons();
  }

  function toggle() {
    const p = ensurePanel();
    if (p.hidden) show(); else hide();
  }

  function makeButton(id) {
    const b = el('button', { type: 'button', className: 'tb round', id, title: 'Cloud storage' });
    b.dataset.cloudOpen = '';
    b.setAttribute('aria-label', 'Cloud storage');
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = icon('cloud');
    b.onclick = toggle;
    return b;
  }

  function installButtons() {
    const homeRight = document.querySelector('.home-right');
    if (homeRight && !homeRight.querySelector('[data-cloud-open]')) homeRight.prepend(makeButton('cloudOpenBtn'));
    const titleRight = document.querySelector('.titleright');
    if (titleRight && !titleRight.querySelector('[data-cloud-open]')) titleRight.prepend(makeButton('cloudOpenBtn2'));
  }

  window.cloudUI = { toggle, show, hide, refresh, isMobile };
  if (typeof cloud !== 'undefined') { cloud.openUI = toggle; cloud.ui = toggle; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButtons);
  else installButtons();

  return { toggle, ensurePanel };
})();

try { if (typeof cloud !== 'undefined') cloud.ui = cloudUI.toggle; } catch (_) { }
