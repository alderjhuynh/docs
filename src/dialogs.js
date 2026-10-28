'use strict';

function dialog(title, body, buttons, focusEl) {
  const dlg = $('#dlg'); $('#dlgTitle').textContent = title;
  const b = $('#dlgBody'); b.innerHTML = ''; b.append(body);
  const bt = $('#dlgBtns'); bt.innerHTML = '';
  buttons.forEach(x => {
    const btn = el('button', { type: 'button', textContent: x.label, className: x.primary ? 'primary' : '' });
    btn.onclick = () => { dlg.close(); x.run && x.run(); }; bt.append(btn);
  });
  const prim = buttons.find(x => x.primary);
  $('#dlgForm').onsubmit = e => { e.preventDefault(); if (prim) { dlg.close(); prim.run && prim.run(); } };
  dlg.showModal(); (focusEl || b.querySelector('input,select,button'))?.focus();
  if (focusEl && focusEl.select) focusEl.select();
}
function wordCountDialog() {
  const text = page.innerText || '', words = (text.match(/\S+/g) || []).length;
  const sel = getSelection().toString(), sw = (sel.match(/\S+/g) || []).length;
  const row = (a, b, c) => el('tr', {}, el('td', { textContent: a }), el('td', { textContent: b }), c !== undefined ? el('td', { textContent: c }) : '');
  const t = el('table', { className: 'stats' });
  t.append(row('Pages (approx.)', Math.max(1, Math.ceil(words / 500))), row('Words', words), row('Characters', text.replace(/\n/g, '').length), row('Characters excluding spaces', text.replace(/\s/g, '').length));
  if (sel) t.append(row('Words in selection', sw));
  dialog('Word count', t, [{ label: 'OK', primary: true }]);
}
function shortcutsDialog() {
  const k = [['Bold / Italic / Underline', 'Ctrl+B / I / U'], ['Link', 'Ctrl+K'], ['Find / Replace', 'Ctrl+F / Ctrl+H'], ['Save now', 'Ctrl+S'], ['Print / PDF', 'Ctrl+P'],
    ['Align L / C / R / Justify', 'Ctrl+Shift+L/E/R/J'], ['Numbered / bulleted list', 'Ctrl+Shift+7 / 8'], ['Heading 1–3 / Normal', 'Ctrl+Alt+1–3 / 0'],
    ['Indent / outdent', 'Tab / Shift+Tab, Ctrl+] / ['], ['Clear formatting', 'Ctrl+\\'], ['Font size ± ', 'Ctrl+Shift+. / ,'], ['Markdown while typing', '# , ## , - , 1. , [] , > + space']];
  const g = el('div', { className: 'kbd' }); k.forEach(([a, b]) => g.append(el('span', { textContent: a }), el('b', { textContent: b })));
  dialog('Keyboard shortcuts', g, [{ label: 'Close', primary: true }]);
}
