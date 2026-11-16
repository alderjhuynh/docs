'use strict';

let hits = [], hitIdx = -1;
const findBar = $('#findbar');
function openFind(withReplace) {
  findBar.hidden = false; const s = getSelection(); const f = $('#findIn');
  if (s.rangeCount && !s.isCollapsed && page.contains(s.anchorNode) && s.toString().length < 80 && !s.toString().includes('\n')) f.value = s.toString();
  f.focus(); f.select(); runFind();
}
function closeFind() { findBar.hidden = true; hits = []; if (CSS.highlights) { CSS.highlights.delete('find-all'); CSS.highlights.delete('find-cur'); } page.focus(); }
function runFind(keepIdx) {
  const q = $('#findIn').value, cs = $('#findCase').checked; hits = [];
  if (q) {
    const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    const needle = cs ? q : q.toLowerCase();
    for (let n; (n = w.nextNode());) {
      const t = cs ? n.nodeValue : n.nodeValue.toLowerCase(); let i = 0;
      while ((i = t.indexOf(needle, i)) !== -1) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); hits.push(r); i += Math.max(1, q.length); }
    }
  }
  hitIdx = hits.length ? (keepIdx != null ? Math.min(keepIdx, hits.length - 1) : 0) : -1; paintFind();
}
function paintFind(scroll = true) {
  $('#findCount').textContent = hits.length ? `${hitIdx + 1} of ${hits.length}` : ($('#findIn').value ? 'No results' : '0 of 0');
  if (!CSS.highlights) return;
  CSS.highlights.set('find-all', new Highlight(...hits));
  if (hitIdx >= 0) { CSS.highlights.set('find-cur', new Highlight(hits[hitIdx])); if (scroll) { const r = hits[hitIdx].getBoundingClientRect(); const c = canvas.getBoundingClientRect(); if (r.top < c.top + 40 || r.bottom > c.bottom - 40) canvas.scrollTop += r.top - c.top - c.height / 3; } }
  else CSS.highlights.delete('find-cur');
}
function findStep(d) { if (!hits.length) return; hitIdx = (hitIdx + d + hits.length) % hits.length; paintFind(); }
function replaceCurrent() {
  if (hitIdx < 0) return; const r = hits[hitIdx], idx = hitIdx;
  page.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, $('#replIn').value); markDirty();
  runFind(idx); $('#findIn').focus() && 0;
}
function replaceAll() {
  if (!hits.length) return; const n = hits.length, rep = $('#replIn').value; page.focus();
  for (let i = hits.length - 1; i >= 0; i--) { const s = getSelection(); s.removeAllRanges(); s.addRange(hits[i]); document.execCommand('insertText', false, rep); }
  markDirty(); runFind(); toast(n + ' replaced');
}
$('#findIn').addEventListener('input', () => runFind());
$('#findCase').addEventListener('change', () => runFind());
$('#findIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } });
$('#findNext').onclick = () => findStep(1); $('#findPrev').onclick = () => findStep(-1); $('#findClose').onclick = closeFind;
$('#replOne').onclick = replaceCurrent; $('#replAll').onclick = replaceAll;
findBar.addEventListener('keydown', e => { if (e.key === 'Escape') closeFind(); });
