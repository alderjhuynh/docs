'use strict';

const STYLE_NAMES = { p: 'Normal text', title: 'Title', subtitle: 'Subtitle', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6' };
function currentStyle() {
  const b = closest('p,h1,h2,h3,h4,h5,h6,pre,blockquote');
  if (!b) return 'p'; const t = b.tagName.toLowerCase();
  if (t === 'p' && b.classList.contains('title')) return 'title';
  if (t === 'p' && b.classList.contains('subtitle')) return 'subtitle';
  return STYLE_NAMES[t] ? t : 'p';
}
function updateToolbar() {
  const q = c => { try { return document.queryCommandState(c); } catch { return false; } };
  const set = (id, on) => $('#' + id).classList.toggle('on', !!on);
  set('b-bold', q('bold')); set('b-italic', q('italic')); set('b-underline', q('underline'));
  set('b-left', q('justifyLeft') && !q('justifyCenter')); set('b-center', q('justifyCenter')); set('b-right', q('justifyRight')); set('b-justify', q('justifyFull'));
  const li = closest('li'), ul = li && li.parentElement;
  set('b-check', ul && ul.classList.contains('checklist'));
  set('b-ul', ul && ul.tagName === 'UL' && !ul.classList.contains('checklist'));
  set('b-ol', ul && ul.tagName === 'OL');
  const s = getSelection(); let n = s.anchorNode; if (n && n.nodeType === 3) n = n.parentElement;
  if (n && page.contains(n)) {
    const cs = getComputedStyle(n);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); $('#fontBtn').textContent = fam;
    if (document.activeElement !== $('#sizeInput')) $('#sizeInput').value = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
    $('#styleBtn').textContent = STYLE_NAMES[currentStyle()];
  }
}

const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96];
let pendingSize = null;
function fixSizeMarkers() {
  if (pendingSize == null) return;
  $$('font[size="7"], [style*="xxx-large"]', page).forEach(e => { e.removeAttribute('size'); e.style.fontSize = pendingSize + 'pt'; });
}
function setFontSize(pt) {
  pt = Math.max(1, Math.min(400, parseFloat(pt) || 11));
  restoreSelIfNeeded();
  pendingSize = pt; cmd('fontSize', '7'); fixSizeMarkers();
  $$('span[style*="font-size"] span[style*="font-size"]', page).forEach(s => { if (s.parentElement.children.length === 1 && s.parentElement.textContent === s.textContent) s.parentElement.style.fontSize = ''; });
  $('#sizeInput').value = pt; markDirty();
}
function stepSize(dir) {
  const cur = parseFloat($('#sizeInput').value) || 11;
  let next;
  if (dir > 0) next = SIZES.find(x => x > cur) || cur + 8; else next = [...SIZES].reverse().find(x => x < cur) || Math.max(1, cur - 1);
  setFontSize(next);
}
function setFont(name) { restoreSelIfNeeded(); cmd('fontName', name); }
function setBlockStyle(name) {
  restoreSelIfNeeded();
  if (name === 'title' || name === 'subtitle' || name === 'p') cmd('formatBlock', '<p>'); else cmd('formatBlock', '<' + name + '>');
  selectedBlocks().forEach(b => {
    b.classList.remove('title', 'subtitle'); if (!b.className) b.removeAttribute('class');
    if (name === 'title' || name === 'subtitle') b.classList.add(name);
  });
  updateToolbar(); refreshOutline();
}
function setColor(kind, color) {
  restoreSelIfNeeded();
  const cmdName = kind === 'text' ? 'foreColor' : 'hiliteColor';
  if (kind === 'cell') { cellsInSelection().forEach(c => c.style.backgroundColor = color === 'transparent' ? '' : color); markDirty(); return; }
  cmd(cmdName, color);
  if (kind === 'text') $('#colorBar').style.background = color; else $('#hlBar').style.background = color === 'transparent' ? '#fff' : color;
}
function applyLineSpacing(v) { selectedBlocks().forEach(b => b.style.lineHeight = v ? String(v) : ''); markDirty(); }
function toggleChecklist() {
  restoreSelIfNeeded();
  let li = closest('li'), ul = li && li.parentElement;
  if (ul && ul.tagName === 'UL' && ul.classList.contains('checklist')) { cmd('insertUnorderedList'); return; }
  if (ul && ul.tagName === 'UL') ul.classList.add('checklist');
  else { cmd('insertUnorderedList'); li = closest('li'); ul = li && li.parentElement; if (ul) { if (ul.tagName === 'OL') { cmd('insertUnorderedList'); ul = closest('li').parentElement; } ul.classList.add('checklist'); } }
  markDirty(); updateToolbar();
}
function toggleInlineCode() {
  restoreSelIfNeeded();
  const s = getSelection(); if (!s.rangeCount || s.isCollapsed) { toast('Select some text first'); return; }
  const code = closest('code');
  if (code) { const t = document.createTextNode(code.textContent); code.replaceWith(t); markDirty(); return; }
  document.execCommand('insertHTML', false, '<code>' + esc(s.toString()) + '</code>'); markDirty();
}
function caseTransform(kind) {
  restoreSelIfNeeded();
  const s = getSelection(); if (s.isCollapsed) { toast('Select some text first'); return; }
  const t = s.toString();
  const r = kind === 'upper' ? t.toUpperCase() : kind === 'lower' ? t.toLowerCase() : t.toLowerCase().replace(/(^|[\s(\["'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  document.execCommand('insertText', false, r); markDirty();
}
function clearFormatting() {
  restoreSelIfNeeded();
  cmd('removeFormat'); cmd('unlink');
  selectedBlocks().forEach(b => { b.removeAttribute('style'); });
  $$('span,font', page).forEach(sp => { if (!sp.getAttribute('style') && sp.tagName === 'SPAN') { while (sp.firstChild) sp.before(sp.firstChild); sp.remove(); } });
  markDirty();
}
