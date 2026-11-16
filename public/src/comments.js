'use strict';

Object.assign(ICONS, {
  tick: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  undoArrow: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z'
});

let cmtOpen = false, cmtMode = 'open', cmtActive = null, cmtDraft = null, cmtEdit = null, cmtSig = '';
const cmtReply = {};

const AVATAR_COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#c2185b', '#5f6368'];
const authorName = () => lsGet('ld_author', '').trim() || 'You';
const avatarColor = n => { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
const tabComments = () => state.comments.filter(c => c.tab === state.tab);
const commentById = id => state.comments.find(c => c.id === id);
const anchorsOf = cid => $$('span.cmt[data-cid="' + CSS.escape(cid) + '"]', page);
const orphanIds = () => { const live = new Set($$('span.cmt', page).map(s => s.dataset.cid)); return tabComments().filter(c => !live.has(c.id)).map(c => c.id); };


const STRUCTURAL = new Set(['UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR']);
const BLOCKISH = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'PRE', 'BLOCKQUOTE', 'HR', 'DIV']);

function wrapRange(range, cid) {
  const sc = range.startContainer, so = range.startOffset, ec = range.endContainer, eo = range.endOffset;
  const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
  const pieces = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n; (n = walker.nextNode());) {
    if (!range.intersectsNode(n)) continue;
    if (n.nodeType === 3) {
      if (range.comparePoint(n, n.nodeValue.length) < 0 || range.comparePoint(n, 0) > 0) continue;
      const s = n === sc ? so : 0, e = n === ec ? eo : n.nodeValue.length;
      if (e <= s) continue;
      const p = n.parentNode;
      if (!/\S/.test(n.nodeValue.slice(s, e)) && (STRUCTURAL.has(p.tagName) || BLOCKISH.has(n.previousSibling && n.previousSibling.tagName) || BLOCKISH.has(n.nextSibling && n.nextSibling.tagName))) continue;
      pieces.push({ node: n, s, e });
    } else if (n.tagName === 'IMG') {
      const p = n.parentNode, i = Array.prototype.indexOf.call(p.childNodes, n);
      if (range.comparePoint(p, i) === 0 && range.comparePoint(p, i + 1) === 0) pieces.push({ img: n });
    }
  }
  pieces.forEach(pc => {
    let target = pc.img;
    if (!target) {
      target = pc.node;
      if (pc.e < target.nodeValue.length) target.splitText(pc.e);
      if (pc.s > 0) target = target.splitText(pc.s);
    }
    const sp = document.createElement('span'); sp.className = 'cmt'; sp.dataset.cid = cid;
    target.parentNode.insertBefore(sp, target); sp.appendChild(target);
  });
  return pieces.length;
}
function dropAnchors(cid, tidy) {
  const parents = new Set();
  anchorsOf(cid).forEach(s => { const p = unwrapSpan(s); if (p) parents.add(p); });
  if (tidy) parents.forEach(p => p.normalize());
}
const saveSel = () => { const s = getSelection(); return s.rangeCount && page.contains(s.anchorNode) ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null; };
const restoreSel2 = sv => { if (sv && sv[0].isConnected && sv[2].isConnected) getSelection().setBaseAndExtent(...sv); };

function syncAnchors() {
  const mine = new Map(tabComments().map(c => [c.id, c])); let sv = null;
  $$('span.cmt', page).forEach(s => {
    const c = mine.get(s.dataset.cid), draft = cmtDraft && cmtDraft.id === s.dataset.cid;
    if (!s.firstChild || (!c && !draft)) { if (!sv) sv = saveSel(); unwrapSpan(s); return; }
    if (c && s.classList.contains('resolved') !== !!c.resolved) s.classList.toggle('resolved', !!c.resolved);
  });
  restoreSel2(sv);
}

function paintActive() {
  if (!CSS.highlights) return;
  const rs = cmtActive ? anchorsOf(cmtActive).map(s => { const r = document.createRange(); r.selectNodeContents(s); return r; }) : [];
  if (rs.length) CSS.highlights.set('cmt-active', new Highlight(...rs)); else CSS.highlights.delete('cmt-active');
}

function commentRange() {
  const s = getSelection();
  const r = s.rangeCount && page.contains(s.anchorNode) ? s.getRangeAt(0) : lastRange;
  return r && page.contains(r.commonAncestorContainer) ? r : null;
}
function commentStart() {
  commentsCancelDraft();
  const r = commentRange(), cid = uid(); let made = 0, quote = '';
  if (r && !r.collapsed) {
    quote = r.toString().replace(/\s+/g, ' ').trim().slice(0, 240);
    made = wrapRange(r, cid);
    if (made && !quote) quote = 'Image';
  } else if (selImg && selImg.isConnected) {
    const sp = document.createElement('span'); sp.className = 'cmt'; sp.dataset.cid = cid;
    selImg.parentNode.insertBefore(sp, selImg); sp.appendChild(selImg); made = 1; quote = 'Image';
  }
  if (!made) { toast('Select some text or an image to comment on'); return; }
  getSelection().removeAllRanges(); lastRange = null; fab.hidden = true;
  cmtDraft = { id: cid, quote, text: '' }; cmtActive = cid; cmtMode = 'open'; cmtOpen = true;
  renderComments();
}
function commentsCancelDraft() {
  if (!cmtDraft) return;
  dropAnchors(cmtDraft.id, true); cmtDraft = null; cmtActive = null;
  renderComments();
}
function commentSubmit(text) {
  state.comments.push({ id: cmtDraft.id, tab: state.tab, author: authorName(), created: Date.now(), text, resolved: false, quote: cmtDraft.quote, replies: [] });
  cmtActive = cmtDraft.id; cmtDraft = null; commentsChanged();
}
function commentsChanged() { syncAnchors(); markDirty(); renderTabs(); renderComments(); }
function setResolved(c, v) {
  c.resolved = v; if (v && cmtActive === c.id) cmtActive = null;
  commentsChanged(); toast(v ? 'Comment resolved' : 'Comment reopened');
}
function deleteComment(c) {
  if (c.replies.length && !confirm('Delete this comment and its replies?')) return;
  dropAnchors(c.id, true); state.comments = state.comments.filter(x => x !== c);
  if (cmtActive === c.id) cmtActive = null; delete cmtReply[c.id]; commentsChanged();
}
function deleteReply(c, r) { c.replies = c.replies.filter(x => x !== r); commentsChanged(); }
function activateComment(cid, scroll) {
  if (cmtActive === cid) return;
  cmtActive = cid; cmtEdit = null; renderComments();
  const s = scroll && anchorsOf(cid)[0]; if (!s) return;
  const r = s.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  if (r.top < c.top + 20 || r.bottom > c.bottom - 20) s.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function setCmtOpen(on) { cmtOpen = on; renderComments(); positionImgBox(); }
function authorDialog() {
  const i = el('input', { type: 'text', value: lsGet('ld_author', ''), placeholder: 'You', maxLength: 40 });
  dialog('Comment author', el('div', {}, el('label', { textContent: 'Name shown on the comments you write' }), i),
    [{ label: 'Cancel' }, { label: 'Save', primary: true, run: () => { lsSet('ld_author', i.value.trim()); toast('Saved'); } }], i);
}

function commentsLoaded() {
  cmtDraft = null; cmtActive = null; cmtEdit = null; cmtMode = 'open';
  Object.keys(cmtReply).forEach(k => delete cmtReply[k]);
  syncAnchors();
  cmtOpen = state.comments.some(c => !c.resolved);
  renderComments(); positionImgBox();
}
function commentsTabChanged() { cmtActive = null; cmtEdit = null; syncAnchors(); renderComments(); }
const commentsRefresh = () => renderComments();

const iconBtn = (title, path, cls = '') => el('button', { type: 'button', className: 'cib ' + cls, title, innerHTML: svg(path) });
const avatar = name => { const a = el('span', { className: 'cav', textContent: (name.trim().charAt(0) || '?').toUpperCase() }); a.style.background = avatarColor(name); return a; };

function composer({ placeholder, value = '', submit, onSubmit, onCancel, onInput, focus }) {
  const ta = el('textarea', { className: 'cta', rows: 1, placeholder, value, maxLength: 5000 });
  const ok = el('button', { type: 'button', className: 'cbtn primary', textContent: submit });
  const no = el('button', { type: 'button', className: 'cbtn', textContent: 'Cancel' });
  const box = el('div', { className: 'ccomposer' + (value ? ' has' : '') }, ta, el('div', { className: 'cbtns' }, no, ok));
  const go = () => { const t = ta.value.trim(); if (t) onSubmit(t); };
  ta._fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ok.disabled = !value.trim();
  ta.addEventListener('input', () => { ok.disabled = !ta.value.trim(); box.classList.toggle('has', !!ta.value); ta._fit(); onInput && onInput(ta.value); layoutComments(); });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); go(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  });
  ok.onclick = e => { e.stopPropagation(); go(); };
  no.onclick = e => { e.stopPropagation(); onCancel(); };
  if (focus) ta.dataset.focus = '1';
  return box;
}

function messageEl(c, m, root) {
  const editing = cmtEdit && cmtEdit.cid === c.id && cmtEdit.rid === (root ? null : m.id);
  const acts = el('div', { className: 'cacts' });
  if (root) {
    const rs = iconBtn(c.resolved ? 'Reopen' : 'Resolve', c.resolved ? ICONS.undoArrow : ICONS.tick);
    rs.onclick = e => { e.stopPropagation(); setResolved(c, !c.resolved); };
    acts.append(rs);
  }
  const more = iconBtn('More options', ICONS.more);
  more.addEventListener('mousedown', e => e.stopPropagation());
  more.onclick = e => {
    e.stopPropagation(); const r = more.getBoundingClientRect(); closePopups();
    showMenu([
      { label: 'Edit', run: () => { cmtActive = c.id; cmtEdit = { cid: c.id, rid: root ? null : m.id }; renderComments(); } },
      { label: 'Delete', run: () => root ? deleteComment(c) : deleteReply(c, m) }
    ], r.right - 150, r.bottom + 2);
  };
  acts.append(more);
  const body = editing
    ? composer({ placeholder: 'Edit', value: m.text, submit: 'Save', focus: true, onCancel: () => { cmtEdit = null; renderComments(); },
        onSubmit: t => { m.text = t; cmtEdit = null; commentsChanged(); } })
    : el('div', { className: 'ctext', textContent: m.text });
  return el('div', { className: 'cmsg' },
    el('div', { className: 'chead' }, avatar(m.author), el('div', { className: 'cwho' }, el('b', { textContent: m.author }), el('span', { className: 'ctime', textContent: fmtDate(m.created) })), acts),
    body);
}

function threadCard(c, orphan) {
  const full = cmtMode === 'resolved' || cmtActive === c.id;
  const card = el('div', { className: 'ccard' + (cmtActive === c.id ? ' active' : '') + (orphan ? ' orphan' : '') });
  card.dataset.id = c.id;
  if (orphan || cmtMode === 'resolved') card.append(el('div', { className: 'cquote' }, orphan ? el('i', { textContent: 'Original text was deleted · ' }) : '', '“' + c.quote + '”'));
  card.append(messageEl(c, c, true));
  if (full) c.replies.forEach(r => card.append(messageEl(c, r, false)));
  else if (c.replies.length) card.append(el('div', { className: 'cmore', textContent: c.replies.length + (c.replies.length === 1 ? ' reply' : ' replies') }));
  if (cmtActive === c.id && !c.resolved) {
    card.append(composer({ placeholder: 'Reply', value: cmtReply[c.id] || '', submit: 'Reply',
      onInput: v => { cmtReply[c.id] = v; },
      onCancel: () => { delete cmtReply[c.id]; renderComments(); },
      onSubmit: t => { c.replies.push({ id: uid(), author: authorName(), created: Date.now(), text: t }); delete cmtReply[c.id]; commentsChanged(); } }));
  }
  card.addEventListener('click', () => activateComment(c.id, true));
  return card;
}
function draftCard() {
  const card = el('div', { className: 'ccard active draft' });
  card.dataset.id = cmtDraft.id;
  card.append(el('div', { className: 'chead' }, avatar(authorName()), el('div', { className: 'cwho' }, el('b', { textContent: authorName() }))),
    composer({ placeholder: 'Comment', value: cmtDraft.text, submit: 'Comment', focus: true, onInput: v => { cmtDraft.text = v; }, onCancel: commentsCancelDraft, onSubmit: commentSubmit }));
  return card;
}

function renderComments() {
  const open = state.comments.filter(c => !c.resolved).length;
  $('#cmtBadge').textContent = open; $('#cmtBadge').hidden = !open;
  $('#cmtBtn').classList.toggle('on', cmtOpen);
  $('#cmtBarWrap').hidden = $('#cmtRail').hidden = !cmtOpen;
  canvas.classList.toggle('cmts-open', cmtOpen);
  if (!cmtOpen) { paintActive(); return; }

  const rail = $('#cmtRail'); rail.innerHTML = ''; rail.classList.toggle('list', cmtMode === 'resolved');
  const mine = tabComments(), orphans = new Set(orphanIds());
  $$('#cmtSeg button').forEach(b => {
    const resolved = b.dataset.v === 'resolved';
    b.classList.toggle('on', b.dataset.v === cmtMode);
    b.textContent = (resolved ? 'Resolved' : 'Open') + ' ' + mine.filter(c => !!c.resolved === resolved).length;
  });
  const shown = mine.filter(c => (cmtMode === 'resolved') === !!c.resolved);
  if (cmtMode === 'open' && cmtDraft) rail.append(draftCard());
  shown.forEach(c => rail.append(threadCard(c, orphans.has(c.id) && !c.resolved)));
  if (!shown.length && !cmtDraft) rail.append(el('div', { className: 'cempty', textContent: cmtMode === 'resolved' ? 'No resolved comments on this tab.' : 'No comments on this tab. Select text and press Ctrl+Alt+M to add one.' }));
  cmtSig = orphanIds().join();
  $$('textarea', rail).forEach(t => t._fit());
  layoutComments(); paintActive();
  const f = rail.querySelector('textarea[data-focus]'); if (f) { f.focus({ preventScroll: true }); f.setSelectionRange(f.value.length, f.value.length); }
}

function layoutComments() {
  if (!cmtOpen || cmtMode !== 'open') return;
  const rail = $('#cmtRail'), cr = canvas.getBoundingClientRect(), GAP = 8, items = [];
  $$('.ccard:not(.orphan)', rail).forEach(card => {
    const sp = anchorsOf(card.dataset.id)[0]; if (!sp) return;
    items.push({ card, y: sp.getBoundingClientRect().top - cr.top + canvas.scrollTop - 6, h: card.offsetHeight });
  });
  items.sort((a, b) => a.y - b.y);
  const ai = items.findIndex(i => i.card.dataset.id === cmtActive);
  if (ai >= 0) {
    items[ai].top = items[ai].y;
    for (let j = ai - 1; j >= 0; j--) items[j].top = Math.min(items[j].y, items[j + 1].top - items[j].h - GAP);
    for (let j = ai + 1; j < items.length; j++) items[j].top = Math.max(items[j].y, items[j - 1].top + items[j - 1].h + GAP);
  } else items.forEach(it => { it.top = it.y; });
  let bottom = 0;
  items.forEach(it => { it.top = Math.max(it.top, bottom ? bottom + GAP : 0); bottom = it.top + it.h; it.card.style.top = it.top + 'px'; });
  $$('.ccard.orphan', rail).forEach(card => { const top = bottom ? bottom + 16 : 0; card.style.top = top + 'px'; bottom = top + card.offsetHeight; });
  rail.style.height = bottom + 'px';
}

const fab = $('#cmtFab');
function updateFab() {
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed || !page.contains(s.anchorNode) || !s.toString().trim() || document.activeElement !== page) { fab.hidden = true; return; }
  const r = s.getRangeAt(0).getBoundingClientRect(), pr = page.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  fab.hidden = false;
  fab.style.top = Math.max(cr.top + 4, Math.min(r.top - 2, cr.bottom - 40)) + 'px';
  fab.style.left = (pr.right - 40) + 'px';
}
fab.innerHTML = svg(ICONS.commentAdd);
fab.addEventListener('mousedown', e => e.preventDefault());
fab.addEventListener('click', commentStart);

page.addEventListener('blur', () => setTimeout(updateFab, 0));
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (!s.rangeCount || !page.contains(s.anchorNode)) { fab.hidden = true; return; }
  updateFab();
  if (!s.isCollapsed || cmtDraft || !cmtOpen) return;
  const n = s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode;
  const sp = n && n.closest && n.closest('span.cmt'), c = sp && commentById(sp.dataset.cid);
  const id = c && !c.resolved ? c.id : null;
  if (id !== cmtActive) { cmtActive = id; cmtEdit = null; renderComments(); }
});
page.addEventListener('click', e => {
  const sp = e.target.closest && e.target.closest('span.cmt'), c = sp && commentById(sp.dataset.cid);
  if (!c || c.resolved || cmtOpen) return;
  cmtOpen = true; cmtActive = c.id; renderComments(); positionImgBox();
});
canvas.addEventListener('scroll', updateFab);
window.addEventListener('resize', () => { updateFab(); layoutComments(); });

let touchT;
new MutationObserver(() => {
  clearTimeout(touchT);
  touchT = setTimeout(() => { syncAnchors(); if (cmtOpen && orphanIds().join() !== cmtSig) renderComments(); else layoutComments(); }, 120);
}).observe(page, { childList: true, subtree: true, characterData: true });
new ResizeObserver(() => layoutComments()).observe(page);

$('#cmtBtn').innerHTML = svg(ICONS.comment); $('#cmtBtn').append($('#cmtBadge'));
$('#cmtBtn').onclick = () => setCmtOpen(!cmtOpen);
$('#cmtClose').innerHTML = svg('M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
$('#cmtClose').onclick = () => setCmtOpen(false);
$$('#cmtSeg button').forEach(b => b.onclick = () => { cmtMode = b.dataset.v; cmtActive = null; cmtEdit = null; renderComments(); });
