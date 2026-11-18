'use strict';

const cloudUI = (() => {
  const TOKEN_KEY = 'ld_cloud_token';
  let panel = null;
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

  function buildPanel() {
    const p = el('div', { id: 'cloudPanel', className: 'cloud-panel' });
    p.innerHTML = '';
    const head = el('div', { className: 'cloud-head' },
      el('span', { className: 'cloud-title', textContent: 'Cloud storage' }),
      el('button', { type: 'button', className: 'tb sm cloud-close', textContent: '✕', title: 'Close' })
    );
    head.querySelector('.cloud-close').onclick = () => { p.hidden = true; };

    const tokenRow = el('div', { className: 'cloud-row' },
      el('label', { textContent: 'Token' }),
      el('input', { type: 'password', id: 'cloudToken', placeholder: 'ADMIN_TOKEN', autocomplete: 'off' }),
      el('button', { type: 'button', className: 'pill small', id: 'cloudLoginBtn', textContent: 'Login' })
    );

    const status = el('div', { className: 'cloud-status', id: 'cloudStatus', textContent: 'Not signed in' });

    const btns = el('div', { className: 'cloud-btns' },
      el('button', { type: 'button', className: 'pill small', textContent: 'Status', 'data-cmd': 'status' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Push', 'data-cmd': 'push' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Push (force)', 'data-cmd': 'push-force' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Pull', 'data-cmd': 'pull' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Pull (force)', 'data-cmd': 'pull-force' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Pull + prune', 'data-cmd': 'pull-prune' }),
      el('button', { type: 'button', className: 'pill small', textContent: 'Logout', 'data-cmd': 'logout' })
    );

    const targetRow = el('div', { className: 'cloud-row' },
      el('label', { textContent: 'Target id' }),
      el('input', { type: 'text', id: 'cloudTarget', placeholder: 'all / current / doc id', value: 'all' })
    );

    const removeRow = el('div', { className: 'cloud-row' },
      el('label', { textContent: 'Remove id' }),
      el('input', { type: 'text', id: 'cloudRemoveId', placeholder: 'doc id' }),
      el('button', { type: 'button', className: 'pill small', id: 'cloudRemoveBtn', textContent: 'Remove' })
    );

    const log = el('pre', { id: 'cloudLog', className: 'cloud-log' });

    p.append(head, tokenRow, status, btns, targetRow, removeRow, log);
    document.body.append(p);

    const tokenInput = p.querySelector('#cloudToken');
    try { const saved = localStorage.getItem(TOKEN_KEY); if (saved) tokenInput.value = saved; } catch {}

    p.querySelector('#cloudLoginBtn').onclick = async () => {
      const t = tokenInput.value.trim();
      if (!t) { appendLog('enter a token first'); return; }
      try {
        await cloud.login(t, { remember: true });
        updateStatus();
        appendLog('signed in');
      } catch (e) { appendLog('login failed:', e.message); }
    };

    p.querySelectorAll('[data-cmd]').forEach(b => {
      b.onclick = async () => {
        const cmd = b.dataset.cmd;
        const target = p.querySelector('#cloudTarget').value.trim() || 'all';
        try {
          if (cmd === 'status') { const rows = await cloud.status(); appendLog('status:', rows.length, 'rows'); }
          else if (cmd === 'push') { appendLog(await cloud.push(target)); }
          else if (cmd === 'push-force') { appendLog(await cloud.push(target, { force: true })); }
          else if (cmd === 'pull') { appendLog(await cloud.pull(target)); }
          else if (cmd === 'pull-force') { appendLog(await cloud.pull(target, { force: true })); }
          else if (cmd === 'pull-prune') { appendLog(await cloud.pull(target, { prune: true })); }
          else if (cmd === 'logout') { cloud.logout(); tokenInput.value = ''; updateStatus(); appendLog('logged out'); }
        } catch (e) { appendLog(cmd, 'failed:', e.message); }
      };
    });

    p.querySelector('#cloudRemoveBtn').onclick = async () => {
      const id = p.querySelector('#cloudRemoveId').value.trim();
      if (!id) { appendLog('enter an id'); return; }
      if (!confirm('Remove "' + id + '" from cloud?')) return;
      try { const ok = await cloud.remove(id); appendLog('remove', id, ok ? 'ok' : 'failed'); }
      catch (e) { appendLog('remove failed:', e.message); }
    };

    function updateStatus() {
      const s = p.querySelector('#cloudStatus');
      const t = (typeof cloud.getToken === 'function') ? cloud.getToken() : '';
      s.textContent = t ? 'Signed in' : 'Not signed in';
    }
    updateStatus();
    return p;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = buildPanel();
    return panel;
  }

  function toggle() {
    const p = ensurePanel();
    p.hidden = !p.hidden;
    if (!p.hidden) {
      const ti = p.querySelector('#cloudToken');
      try { const saved = localStorage.getItem(TOKEN_KEY); if (saved && !ti.value) ti.value = saved; } catch {}
    }
  }

  const origLog = console.log;
  window.__cloudLog = (...a) => appendLog(...a);

  function installButton() {
    const homeRight = document.querySelector('#homeRight') || document.querySelector('.home-right');
    if (homeRight && !document.querySelector('#cloudOpenBtn')) {
      const b = el('button', { type: 'button', className: 'tb round', id: 'cloudOpenBtn', title: 'Cloud storage' });
      b.textContent = '☁';
      b.onclick = toggle;
      homeRight.prepend(b);
    }
    const titleRight = document.querySelector('.titleright');
    if (titleRight && !document.querySelector('#cloudOpenBtn2')) {
      const b = el('button', { type: 'button', className: 'tb round', id: 'cloudOpenBtn2', title: 'Cloud storage' });
      b.textContent = '☁';
      b.onclick = toggle;
      titleRight.prepend(b);
    }
  }

  window.cloudUI = { toggle, isMobile };
  if (typeof cloud !== 'undefined') cloud.openUI = toggle;

  document.addEventListener('DOMContentLoaded', () => {
    installButton();
  });

  if (document.readyState !== 'loading') setTimeout(installButton, 0);

  return { toggle, ensurePanel };
})();

try { if (typeof cloud !== 'undefined') cloud.ui = cloudUI.toggle; } catch (_) {}
