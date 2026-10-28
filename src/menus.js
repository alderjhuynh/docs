'use strict';

function closePopups() { popup.innerHTML = ''; $$('#menubar button.open').forEach(b => b.classList.remove('open')); }
function buildMenu(items, parent) {
  const m = el('div', { className: 'menu' });
  m.addEventListener('mousedown', e => e.preventDefault());
  items.forEach(it => {
    if (it === '-') { m.append(el('div', { className: 'msep' })); return; }
    const row = el('div', { className: 'mi' + (it.submenu ? ' sub' : '') + (it.disabled ? ' dis' : '') },
      el('span', { className: 'ck', textContent: it.checked ? '✓' : '' }),
      el('span', { className: 'lab', textContent: it.label }), it.shortcut ? el('span', { className: 'sc', textContent: it.shortcut }) : '');
    if (it.style) row.querySelector('.lab').setAttribute('style', it.style);
    let sub = null;
    row.addEventListener('mouseenter', () => {
      $$(':scope > .menu', parent || popup).forEach(x => { if (x !== m && x.dataset.owner !== undefined) { } });
      popup.querySelectorAll('.menu[data-depth]').forEach(x => { if (+x.dataset.depth > +(m.dataset.depth || 0)) x.remove(); });
      if (it.submenu) {
        sub = buildMenu(typeof it.submenu === 'function' ? it.submenu() : it.submenu, popup); sub.dataset.depth = (+(m.dataset.depth || 0) + 1);
        popup.append(sub); const r = row.getBoundingClientRect();
        let left = r.right - 4; if (left + sub.offsetWidth > innerWidth) left = r.left - sub.offsetWidth + 4;
        sub.style.left = left + 'px'; sub.style.top = Math.min(r.top - 6, innerHeight - sub.offsetHeight - 8) + 'px';
      }
    });
    if (!it.submenu) row.addEventListener('click', e => { closePopups(); it.run && it.run(e); });
    m.append(row);
  });
  return m;
}
function showMenu(items, x, y, depth = 0) {
  closePopups(); const m = buildMenu(items); m.dataset.depth = depth; popup.append(m);
  m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 6)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 6)) + 'px'; return m;
}
function menuBelow(btn, items) { const r = btn.getBoundingClientRect(); return showMenu(items, r.left, r.bottom + 2); }
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu,.palette') && !e.target.closest('#menubar') && !e.target.closest('.tb.dd')) closePopups(); if (!e.target.closest('#linkPop') && !e.target.closest('#page a')) $('#linkPop').hidden = true; });

const PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130']
];
function colorPopup(kind, ev, anchor) {
  closePopups();
  const m = el('div', { className: 'menu palette' }); m.addEventListener('mousedown', e => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
  const reset = el('div', { className: 'ph' }, el('span', { textContent: kind === 'text' ? 'Text colour' : kind === 'cell' ? 'Cell background' : 'Highlight colour' }), el('button', { textContent: 'Reset', type: 'button' }));
  reset.querySelector('button').onclick = () => { closePopups(); setColor(kind, kind === 'text' ? '#000000' : 'transparent'); };
  m.append(reset);
  PALETTE.forEach(r => { const row = el('div', { className: 'row' }); r.forEach(c => { const s = el('div', { className: 'sw', title: c }); s.style.background = c; s.onclick = () => { closePopups(); setColor(kind, c); }; row.append(s); }); m.append(row); });
  const custom = el('input', { type: 'color', value: '#1a73e8', style: 'width:100%;height:28px;margin-top:8px;border:0;padding:0;background:none' });
  custom.onchange = () => { closePopups(); setColor(kind, custom.value); }; m.append(el('div', { className: 'ph', textContent: 'Custom' }), custom);
  popup.append(m);
  const r = anchor ? anchor.getBoundingClientRect() : { left: ev.clientX, bottom: ev.clientY };
  m.style.left = Math.min(r.left, innerWidth - 270) + 'px'; m.style.top = (r.bottom + 2) + 'px';
}
