'use strict';

Object.assign(ICONS, {
  doc: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'
});
const TAB_EMOJI = ['📄', '📝', '📌', '📎', '📚', '📅', '💡', '✅', '⭐', '🔥', '🎯', '🧠', '💬', '📊', '🗂️', '🔧', '🏠', '💰', '❤️', '🚀', '🔒', '🧪', '🎨', '🌱'];

function newTab(p = {}) {
  return { id: uid(), title: p.title == null ? '' : p.title, icon: p.icon || '', html: p.html || '<p><br></p>', collapsed: false, children: p.children || [] };
}
function docTabs(d) {
  if (Array.isArray(d.tabs) && d.tabs.length) return d.tabs;
  return [newTab({ title: 'Tab 1', html: d.html })];
}
function tabsFlat(list = state.tabs, depth = 0, out = []) {
  list.forEach(n => { out.push({ node: n, depth }); tabsFlat(n.children, depth + 1, out); });
  return out;
}
function tabFind(id, list = state.tabs, parent = null) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { node: list[i], list, index: i, parent };
    const r = tabFind(id, list[i].children, list[i]); if (r) return r;
  }
  return null;
}
const tabNode = id => { const r = tabFind(id); return r && r.node; };
const tabLabel = n => n.title.trim() || 'Untitled tab';
const docAllHTML = d => tabsFlat(docTabs(d)).map(x => x.node.title + ' ' + x.node.html).join(' ');

function setPageHTML(html) {
  page.innerHTML = html || '<p><br></p>';
  if (!page.firstChild) page.innerHTML = '<p><br></p>';
}
let tabsFrozen = false;
function tabsFlush() { if (tabsFrozen) return; const n = tabNode(state.tab); if (n) n.html = page.innerHTML; }

function unwrapSpan(s) { const p = s.parentNode; if (!p) return null; while (s.firstChild) p.insertBefore(s.firstChild, s); p.removeChild(s); return p; }
function stripComments(html) {
  if (!html || !html.includes('data-cid')) return html;
  const t = document.createElement('template'); t.innerHTML = html;
  t.content.querySelectorAll('span[data-cid]').forEach(unwrapSpan);
  return t.innerHTML;
}
function tabsForCopy(tabs) {
  const copy = structuredClone(tabs);
  tabsFlat(copy).forEach(x => { x.node.html = stripComments(x.node.html); });
  return copy;
}

function tabsLoad(d) {
  state.tabs = docTabs(d);
  state.comments = Array.isArray(d.comments) ? d.comments : [];
  const want = lsGet('ld_tab_' + d.id, '');
  state.tab = tabNode(want) ? want : state.tabs[0].id;
  for (let r = tabFind(state.tab); r && r.parent; r = tabFind(r.parent.id)) r.parent.collapsed = false;
  setPageHTML(tabNode(state.tab).html);
  lastRange = null;
  renderTabs();
  commentsLoaded();
}

function switchTab(id, opts = {}) {
  if (!tabNode(id)) return;
  if (id === state.tab) { if (opts.focus !== false) page.focus(); return; }
  commentsCancelDraft();
  tabsFlush();
  state.tab = id; lsSet('ld_tab_' + state.id, id);
  deselectImg(); lastRange = null; pendingSize = null;
  setPageHTML(tabNode(id).html);
  canvas.scrollTop = 0;
  renderTabs(opts.focusRow ? id : null); refreshOutline(); updateCounts(); updateToolbar(); positionImgBox();
  commentsTabChanged();
  if (!findBar.hidden) runFind();
  if (opts.focus !== false) page.focus();
}

function addTab(parentId) {
  commentsCancelDraft(); tabsFlush();
  const n = newTab({ title: 'Tab ' + (tabsFlat().length + 1) });
  if (parentId) { const p = tabNode(parentId); p.children.push(n); p.collapsed = false; } else state.tabs.push(n);
  markDirty();
  if ($('#outline').classList.contains('hidden')) setSidebar(true, false);
  switchTab(n.id, { focus: false });
  startRename(n.id);
}
function deleteTab(id) {
  const r = tabFind(id); if (!r) return;
  if (tabsFlat().length <= 1) { toast('A document needs at least one tab'); return; }
  const doomed = tabsFlat([r.node]).map(x => x.node.id), subs = doomed.length - 1;
  if (!confirm('Delete tab "' + tabLabel(r.node) + '"' + (subs ? ' and its ' + subs + (subs === 1 ? ' subtab' : ' subtabs') : '') + ' permanently?')) return;
  commentsCancelDraft(); tabsFlush();
  r.list.splice(r.index, 1);
  state.comments = state.comments.filter(c => !doomed.includes(c.tab));
  markDirty();
  if (doomed.includes(state.tab)) switchTab((r.list[r.index] || r.list[r.index - 1] || r.parent || state.tabs[0]).id, { focus: false });
  else { renderTabs(); commentsRefresh(); }
}
function duplicateTab(id) {
  tabsFlush(); const r = tabFind(id); if (!r) return;
  const clone = n => ({ ...n, id: uid(), html: stripComments(n.html), children: n.children.map(clone) });
  const c = clone(r.node); c.title = 'Copy of ' + tabLabel(r.node);
  r.list.splice(r.index + 1, 0, c); markDirty(); renderTabs(c.id);
}

function moveTab(id, targetId, pos) {
  if (id === targetId) return;
  const src = tabFind(id); if (!src || !tabFind(targetId)) return;
  if (tabFind(targetId, src.node.children)) return;
  src.list.splice(src.index, 1);
  const dst = tabFind(targetId);
  if (pos === 'into') { dst.node.children.push(src.node); dst.node.collapsed = false; }
  else dst.list.splice(dst.index + (pos === 'after' ? 1 : 0), 0, src.node);
  markDirty(); renderTabs(id);
}
const firstGlyph = v => {
  v = (v || '').trim(); if (!v) return '';
  try { return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)][0].segment; } catch { return Array.from(v)[0]; }
};
function iconDialog(id) {
  const n = tabNode(id); if (!n) return;
  const set = v => { n.icon = v; markDirty(); renderTabs(id); };
  const g = el('div', { className: 'chars emoji' });
  TAB_EMOJI.forEach(c => g.append(el('button', { type: 'button', textContent: c, onclick: () => { $('#dlg').close(); set(c); } })));
  const inp = el('input', { type: 'text', placeholder: 'Type or paste any emoji', maxLength: 16 });
  dialog('Tab icon', el('div', {}, g, el('label', { textContent: 'Custom' }), inp), [
    { label: 'Default icon', run: () => set('') }, { label: 'Cancel' },
    { label: 'Apply', primary: true, run: () => { const v = firstGlyph(inp.value); if (v) set(v); } }
  ], inp);
}

function tabMenu(id) {
  const r = tabFind(id); if (!r) return [];
  const sibs = r.list, i = r.index;
  return [
    { label: 'Rename', run: () => startRename(id) },
    { label: 'Add subtab', run: () => addTab(id) },
    { label: 'Duplicate tab', run: () => duplicateTab(id) },
    { label: 'Change icon…', run: () => iconDialog(id) }, '-',
    { label: 'Move up', disabled: i === 0, run: () => moveTab(id, sibs[i - 1].id, 'before') },
    { label: 'Move down', disabled: i === sibs.length - 1, run: () => moveTab(id, sibs[i + 1].id, 'after') },
    { label: 'Make subtab of tab above', disabled: i === 0, run: () => moveTab(id, sibs[i - 1].id, 'into') },
    { label: 'Move out one level', disabled: !r.parent, run: () => moveTab(id, r.parent.id, 'after') }, '-',
    { label: 'Delete tab', disabled: tabsFlat().length <= 1, run: () => deleteTab(id) }
  ];
}

const rowOf = id => $$('#tabList .trow').find(r => r.dataset.id === id);
let dragTab = null;

function renderTabs(focusId) {
  const box = $('#tabList'); box.innerHTML = '';
  const draw = (list, depth) => list.forEach(n => {
    const kids = n.children.length, open = state.comments.filter(c => c.tab === n.id && !c.resolved).length;
    const chev = el('button', { type: 'button', className: 'tchev' + (kids ? (n.collapsed ? '' : ' open') : ' none'), tabIndex: -1, title: n.collapsed ? 'Expand' : 'Collapse', textContent: '▸' });
    const icon = el('span', { className: 'ti' });
    if (n.icon) icon.textContent = n.icon; else icon.innerHTML = svg(ICONS.doc);
    const more = el('button', { type: 'button', className: 'tmore', tabIndex: -1, title: 'Tab actions', innerHTML: svg(ICONS.more) });
    const row = el('div', { className: 'trow' + (n.id === state.tab ? ' on' : ''), tabIndex: 0, role: 'treeitem', draggable: true, title: tabLabel(n) },
      chev, icon, el('span', { className: 'tt' + (n.title.trim() ? '' : ' untitled'), textContent: tabLabel(n) }),
      open ? el('span', { className: 'tcnt', title: open + ' open comment' + (open === 1 ? '' : 's'), textContent: open }) : '', more);
    row.dataset.id = n.id; row.style.paddingLeft = (4 + depth * 14) + 'px';
    row.setAttribute('aria-level', depth + 1); row.setAttribute('aria-selected', n.id === state.tab);
    if (kids) row.setAttribute('aria-expanded', !n.collapsed);

    const menuAt = (x, y) => { closePopups(); showMenu(tabMenu(n.id), x, y); };
    row.addEventListener('click', e => { if (e.target.closest('.tchev,.tmore,.tt-edit')) return; switchTab(n.id, { focusRow: true, focus: e.detail > 0 }); });
    row.addEventListener('dblclick', e => { if (!e.target.closest('.tchev,.tmore,.tt-edit')) startRename(n.id); });
    row.addEventListener('contextmenu', e => { e.preventDefault(); menuAt(e.clientX, e.clientY); });
    chev.addEventListener('click', e => { e.stopPropagation(); if (kids) { n.collapsed = !n.collapsed; renderTabs(n.id); } });
    more.addEventListener('mousedown', e => e.stopPropagation());
    more.addEventListener('click', e => { e.stopPropagation(); const r = more.getBoundingClientRect(); menuAt(r.left, r.bottom + 2); });
    row.addEventListener('keydown', e => rowKey(e, n, row));

    row.addEventListener('dragstart', e => { dragTab = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.id); row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { dragTab = null; $$('#tabList .trow').forEach(r => r.classList.remove('dragging', 'drop-before', 'drop-after', 'drop-into')); });
    row.addEventListener('dragover', e => {
      const z = dropZone(e, row, n.id); if (!z) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      row.classList.toggle('drop-before', z === 'before'); row.classList.toggle('drop-after', z === 'after'); row.classList.toggle('drop-into', z === 'into');
    });
    row.addEventListener('dragleave', e => { if (!row.contains(e.relatedTarget)) row.classList.remove('drop-before', 'drop-after', 'drop-into'); });
    row.addEventListener('drop', e => { const z = dropZone(e, row, n.id); if (!z) return; e.preventDefault(); const id = dragTab; dragTab = null; moveTab(id, n.id, z); });

    box.append(row);
    if (kids && !n.collapsed) draw(n.children, depth + 1);
  });
  draw(state.tabs, 0);
  if (focusId) { const r = rowOf(focusId); if (r) r.focus(); }
}
function dropZone(e, row, targetId) {
  if (!dragTab || dragTab === targetId) return null;
  const src = tabFind(dragTab); if (!src || tabFind(targetId, src.node.children)) return null;
  const r = row.getBoundingClientRect(), f = (e.clientY - r.top) / r.height;
  return f < .28 ? 'before' : f > .72 ? 'after' : 'into';
}
function rowKey(e, n, row) {
  if (e.target !== row) return;
  const rows = $$('#tabList .trow'), i = rows.indexOf(row);
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(n.id, { focusRow: true, focus: false }); }
  else if (e.key === 'F2') { e.preventDefault(); startRename(n.id); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); rows[i + 1] && rows[i + 1].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); rows[i - 1] && rows[i - 1].focus(); }
  else if (e.key === 'ArrowRight' && n.children.length) { e.preventDefault(); if (n.collapsed) { n.collapsed = false; renderTabs(n.id); } else rows[i + 1].focus(); }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (n.children.length && !n.collapsed) { n.collapsed = true; renderTabs(n.id); }
    else { const p = tabFind(n.id).parent; if (p) rowOf(p.id).focus(); }
  }
  else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = row.getBoundingClientRect(); closePopups(); showMenu(tabMenu(n.id), r.left + 24, r.bottom); }
}
function startRename(id) {
  const row = rowOf(id), n = tabNode(id); if (!row || !n) return;
  const lab = $('.tt', row); if (!lab) return;
  const inp = el('input', { className: 'tt-edit', type: 'text', value: n.title, placeholder: 'Untitled tab', maxLength: 100, spellcheck: false });
  row.draggable = false; lab.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    if (ok && inp.value.trim() !== n.title) { n.title = inp.value.trim(); markDirty(); }
    renderTabs(id);
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
  ['mousedown', 'click', 'dblclick'].forEach(t => inp.addEventListener(t, e => e.stopPropagation()));
}

$('#tabAdd').innerHTML = svg(ICONS.add);
$('#tabAdd').onclick = () => addTab();
