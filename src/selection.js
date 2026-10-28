'use strict';

let lastRange = null;
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && page.contains(s.anchorNode)) { lastRange = s.getRangeAt(0).cloneRange(); updateToolbar(); }
});
function restoreSel() {
  page.focus();
  if (lastRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(lastRange); }
}
function inPage() { const s = getSelection(); return s.rangeCount && page.contains(s.anchorNode); }
const BLOCKY = 'ul,ol,p,h1,h2,h3,h4,h5,h6,table,blockquote,pre,hr';
function fixNesting() {
  const bad = $$('p', page).filter(p => p.querySelector(':scope > ' + BLOCKY.split(',').join(', :scope > ')));
  if (!bad.length) return;
  const s = getSelection(); const sv = s.rangeCount ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
  bad.reverse().forEach(p => { if (!p.isConnected) return; while (p.firstChild) p.before(p.firstChild); p.remove(); });
  if (sv && sv[0] && sv[0].isConnected && sv[2].isConnected) s.setBaseAndExtent(...sv);
  if (!page.firstChild) page.innerHTML = '<p><br></p>';
}
function cmd(name, val = null) { if (!inPage()) restoreSel(); document.execCommand('styleWithCSS', false, true); const r = document.execCommand(name, false, val); fixNesting(); markDirty(); return r; }
function closest(sel) {
  const s = getSelection(); if (!s.rangeCount) return null;
  let n = s.anchorNode; if (n && n.nodeType === 3) n = n.parentElement;
  const f = n && n.closest(sel); return f && page.contains(f) ? f : null;
}
const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,pre,blockquote';
function selectedBlocks() {
  const s = getSelection(); if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  const list = $$(BLOCK_SEL, page).filter(b => r.intersectsNode(b) && !b.querySelector(':scope > ' + BLOCK_SEL.split(',').join(', :scope > ')));
  if (!list.length) { const b = closest(BLOCK_SEL); return b ? [b] : []; }
  return list;
}
function ensureBlock() {
  if (page.childNodes.length === 0) page.innerHTML = '<p><br></p>';
}
function restoreSelIfNeeded() { if (document.activeElement !== page) restoreSel(); }
function placeCaret(node) { const r = document.createRange(); r.selectNodeContents(node); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
