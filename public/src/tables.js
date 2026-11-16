'use strict';

function insertTable(rows, cols) {
  restoreSelIfNeeded();
  let h = '<table data-new="1"><tbody>' + Array.from({ length: rows }, () => '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>').join('') + '</tbody></table><p><br></p>';
  document.execCommand('insertHTML', false, h); fixNesting();
  const t = page.querySelector('table[data-new]'); if (t) { t.removeAttribute('data-new'); placeCaret(t.rows[0].cells[0]); }
  markDirty();
}
const curCell = () => closest('td,th');
function cellsInSelection() {
  const s = getSelection(); if (!s.rangeCount) return []; const r = s.getRangeAt(0);
  const hits = $$('td,th', page).filter(c => r.intersectsNode(c)); if (hits.length) return hits;
  const c = curCell(); return c ? [c] : [];
}
function tableOp(op) {
  const c = curCell(); if (!c) { toast('Click inside a table first'); return; }
  const row = c.parentElement, table = c.closest('table'), idx = c.cellIndex;
  const blank = (tag = 'td') => { const e = document.createElement(tag); e.innerHTML = '<br>'; return e; };
  const newRow = () => { const r = document.createElement('tr'); Array.from(row.cells).forEach(x => { const n = blank(x.tagName.toLowerCase()); if (x.style.backgroundColor) n.style.backgroundColor = ''; r.append(n); }); return r; };
  if (op === 'rowAbove') row.before(newRow());
  else if (op === 'rowBelow') row.after(newRow());
  else if (op === 'colLeft' || op === 'colRight') Array.from(table.rows).forEach(r => { const ref = r.cells[idx] || r.cells[r.cells.length - 1]; const n = blank(ref.tagName.toLowerCase()); op === 'colLeft' ? ref.before(n) : ref.after(n); });
  else if (op === 'delRow') { if (table.rows.length === 1) table.remove(); else row.remove(); }
  else if (op === 'delCol') { if (row.cells.length === 1) table.remove(); else Array.from(table.rows).forEach(r => r.cells[idx] && r.cells[idx].remove()); }
  else if (op === 'delTable') table.remove();
  else if (op === 'header') { Array.from(table.rows[0].cells).forEach(x => { const t = x.tagName === 'TD' ? 'th' : 'td'; const n = document.createElement(t); n.innerHTML = x.innerHTML; if (x.style.cssText) n.style.cssText = x.style.cssText; x.replaceWith(n); }); }
  else if (op === 'merge') {
    const cells = cellsInSelection().filter(x => x.parentElement === row); if (cells.length < 2) { toast('Select cells in one row to merge'); return; }
    const first = cells[0]; cells.slice(1).forEach(x => { if (x.textContent.trim()) first.append(document.createElement('br'), ...Array.from(x.childNodes)); x.remove(); }); first.colSpan = cells.length;
  }
  if (!page.firstChild) page.innerHTML = '<p><br></p>';
  markDirty();
}
function tableMenu() {
  return [
    { label: 'Insert row above', run: () => tableOp('rowAbove') }, { label: 'Insert row below', run: () => tableOp('rowBelow') },
    { label: 'Insert column left', run: () => tableOp('colLeft') }, { label: 'Insert column right', run: () => tableOp('colRight') }, '-',
    { label: 'Delete row', run: () => tableOp('delRow') }, { label: 'Delete column', run: () => tableOp('delCol') }, { label: 'Delete table', run: () => tableOp('delTable') }, '-',
    { label: 'Toggle header row', run: () => tableOp('header') }, { label: 'Merge cells in row (select across)', run: () => tableOp('merge') },
    { label: 'Cell background colour…', run: e => colorPopup('cell', e) }
  ];
}
page.addEventListener('contextmenu', e => {
  if (e.target.closest('td,th')) { e.preventDefault(); showMenu(tableMenu(), e.clientX, e.clientY); }
});
function tableDialog() {
  const r = el('input', { type: 'number', min: 1, max: 50, value: 3 }), c = el('input', { type: 'number', min: 1, max: 20, value: 3 });
  const range = lastRange && lastRange.cloneRange();
  dialog('Insert table', el('div', { className: 'grid2' }, el('div', {}, el('label', { textContent: 'Rows' }), r), el('div', {}, el('label', { textContent: 'Columns' }), c)),
    [{ label: 'Cancel' }, { label: 'Insert', primary: true, run: () => { page.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } insertTable(Math.max(1, +r.value || 1), Math.max(1, +c.value || 1)); } }], r);
}
