'use strict';

$('#fileImg').addEventListener('change', e => { insertImageFile(e.target.files[0]); e.target.value = ''; });
$('#fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { toast('Importing…'); const r = await importFile(f); await newDoc({ title: r.title, html: r.html }); toast('Imported ' + f.name); } catch (err) { console.error(err); toast('Import failed: ' + err.message, 6000); }
});
page.addEventListener('paste', e => {
  const cd = e.clipboardData; if (!cd) return;
  const img = Array.from(cd.files || []).find(f => f.type.startsWith('image/'));
  if (img && !cd.getData('text/html')) { e.preventDefault(); insertImageFile(img); return; }
  const html = cd.getData('text/html');
  if (html) { e.preventDefault(); document.execCommand('insertHTML', false, sanitizeHTML(html)); markDirty(); }
});
page.addEventListener('drop', e => {
  const f = Array.from(e.dataTransfer.files || []).find(f => f.type.startsWith('image/'));
  if (f) { e.preventDefault(); insertImageFile(f); }
});
page.addEventListener('click', e => {
  const li = e.target.closest && e.target.closest('li');
  if (li && li.parentElement.classList.contains('checklist') && li === e.target) {
    const x = (e.clientX - li.getBoundingClientRect().left) / state.zoom;
    if (x < 26) { e.preventDefault(); li.getAttribute('data-checked') === 'true' ? li.removeAttribute('data-checked') : li.setAttribute('data-checked', 'true'); markDirty(); }
  }
});
function mdShortcut() {
  const b = closest('p'); if (!b || b.classList.length || b.closest('li,td,th')) return;
  const t = b.textContent.replace(/ /g, ' ');
  let m, action;
  if ((m = t.match(/^(#{1,6}) $/))) action = () => cmd('formatBlock', '<h' + m[1].length + '>');
  else if (/^[-*] $/.test(t)) action = () => cmd('insertUnorderedList');
  else if (/^1[.)] $/.test(t)) action = () => cmd('insertOrderedList');
  else if (/^\[\] $/.test(t) || /^\[ \] $/.test(t)) action = toggleChecklist;
  else if (/^> $/.test(t)) action = () => cmd('formatBlock', '<blockquote>');
  else return;
  const r = document.createRange(); r.selectNodeContents(b); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.execCommand('delete'); action(); refreshOutline();
}
page.addEventListener('input', e => {
  ensureBlock(); fixSizeMarkers(); fixNesting();
  if (e.inputType === 'insertParagraph') { const li = closest('li'); if (li) li.removeAttribute('data-checked'); }
  if (e.inputType === 'insertText' && e.data === ' ') mdShortcut();
  markDirty(); refreshOutline(); updateCounts(); positionImgBox();
});
page.addEventListener('blur', () => { pendingSize = null; });
page.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key;
  if (k === 'Tab') {
    const cell = curCell();
    if (closest('li')) { e.preventDefault(); cmd(e.shiftKey ? 'outdent' : 'indent'); return; }
    if (cell) {
      e.preventDefault(); const cells = $$('td,th', cell.closest('table')); const i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i >= cells.length) { tableOp('rowBelow'); const nc = $$('td,th', cell.closest('table')); placeCaret(nc[i]); } else if (i >= 0) placeCaret(cells[i]); return;
    }
    e.preventDefault(); cmd(e.shiftKey ? 'outdent' : 'indent'); return;
  }
  if (mod && k === 'Enter') { e.preventDefault(); insertPageBreak(); return; }
  if (mod && !e.shiftKey && !e.altKey) {
    if (k === 'k') { e.preventDefault(); openLinkDialog(); return; }
    if (k === 's') { e.preventDefault(); save().then(() => toast('Saved')); return; }
    if (k === '\\') { e.preventDefault(); clearFormatting(); return; }
    if (k === ']') { e.preventDefault(); cmd('indent'); return; }
    if (k === '[') { e.preventDefault(); cmd('outdent'); return; }
    if (k === '.') { e.preventDefault(); A.sup(); return; }
    if (k === ',') { e.preventDefault(); A.sub(); return; }
  }
  if (mod && e.shiftKey && !e.altKey) {
    const map = { l: A.alignLeft, e: A.alignCenter, r: A.alignRight, j: A.alignJustify, c: wordCountDialog, '7': A.numbers, '&': A.numbers, '8': A.bullets, '*': A.bullets, '9': toggleChecklist, '(': toggleChecklist, '>': A.sizeUp, '.': A.sizeUp, '<': A.sizeDown, ',': A.sizeDown, x: A.strike };
    const f = map[k.toLowerCase()]; if (f) { e.preventDefault(); f(); return; }
  }
  if (mod && e.altKey) {
    const m = { '0': 'p', '1': 'h1', '2': 'h2', '3': 'h3', '4': 'h4', '5': 'h5', '6': 'h6' }[e.code.replace('Digit', '')]; if (m) { e.preventDefault(); setBlockStyle(m); }
  }
});
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && !e.altKey && ['f', 'h'].includes(e.key.toLowerCase())) { e.preventDefault(); openFind(e.key.toLowerCase() === 'h'); if (e.key.toLowerCase() === 'h') $('#replIn').focus(); }
  else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); printDoc(); }
  else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); showHome(); }
  else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save().then(() => toast('Saved')); }
  else if (e.key === 'Escape') { if ($('#dlg').open) return; if (!$('#popup').firstChild && homeOpen() && state.id) { hideHome(); return; } closePopups(); $('#linkPop').hidden = true; }
  else if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newDoc(); }
});
canvas.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(Math.min(2, Math.max(.5, +(state.zoom + (e.deltaY < 0 ? .1 : -.1)).toFixed(2)))); }, { passive: false });

$('#docTitle').addEventListener('input', e => { state.title = e.target.value; document.title = (state.title || 'Untitled document') + ' – LocalDocs'; markDirty(); });
$('#docTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); page.focus(); } });
$('#themeBtn').onclick = toggleTheme;
window.addEventListener('resize', positionImgBox);
