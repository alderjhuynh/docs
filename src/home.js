'use strict';

Object.assign(ICONS, {
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  gridv: 'M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z',
  listv: 'M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z',
  folder: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z'
});
const DOC_ICON = `<svg class="ty" viewBox="0 0 24 24"><path fill="#4285f4" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#a1c2fa" d="M14 2l6 6h-6z"/><path fill="#fff" d="M7 12h10v1.5H7zm0 3h10v1.5H7zm0 3h6v1.5H7z"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24"><path fill="#ea4335" d="M11 3h2v8h-2z"/><path fill="#4285f4" d="M13 11h8v2h-8z"/><path fill="#34a853" d="M11 13h2v8h-2z"/><path fill="#fbbc04" d="M3 11h8v2H3z"/></svg>`;
$('#homeLogo').innerHTML = DOC_ICON.replace('class="ty" ', '');
$('#openFileBtn').innerHTML = svg(ICONS.folder);
$('#homeSearch .ico').innerHTML = svg(ICONS.search);

const TEMPLATES = [
  { name: 'Blank document', blank: true },
  { name: 'Meeting notes', sub: 'Agenda & actions', title: 'Meeting notes', html:
    '<p class="title">Meeting notes</p><p class="subtitle">Date · Attendees</p><h1>Agenda</h1><ul><li>Topic one</li><li>Topic two</li></ul><h1>Discussion</h1><p><br></p><h1>Action items</h1><ul class="checklist"><li>Owner – task</li><li>Owner – task</li></ul>' },
  { name: 'To-do list', sub: 'Checklist', title: 'To-do list', html:
    '<p class="title">To-do list</p><p><br></p><h2>Today</h2><ul class="checklist"><li>First task</li><li>Second task</li><li>Third task</li></ul><h2>This week</h2><ul class="checklist"><li>Task</li><li>Task</li></ul>' },
  { name: 'Project proposal', sub: 'Outline', title: 'Project proposal', html:
    '<p class="title">Project proposal</p><p class="subtitle">Prepared by · Date</p><h1>Summary</h1><p>One paragraph describing the project and why it matters.</p><h1>Goals</h1><ol><li>Goal one</li><li>Goal two</li></ol><h1>Timeline</h1><p>Key milestones and dates.</p><h1>Budget</h1><p>Estimated costs.</p>' },
  { name: 'Letter', sub: 'Formal', title: 'Letter', html:
    '<p>Your name<br>Your address</p><p><br></p><p>Date</p><p><br></p><p>Recipient name<br>Recipient address</p><p><br></p><p>Dear Recipient,</p><p><br></p><p>Write the body of your letter here.</p><p><br></p><p>Sincerely,</p><p>Your name</p>' }
];

const home = $('#home');
const homeUI = { view: lsGet('ld_view', 'grid') === 'list' ? 'list' : 'grid', sort: lsGet('ld_sort', 'modified'), q: '' };
const SORTS = { modified: 'Last modified', created: 'Date created', title: 'Title' };
const homeOpen = () => !home.hidden;
const untitled = d => d.title || 'Untitled document';
function fmtDate(ts) {
  const d = new Date(ts), n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], d.getFullYear() === n.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
const plainText = html => { const t = document.createElement('template'); t.innerHTML = html || ''; return (t.content.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); };

const thumbObserver = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return; thumbObserver.unobserve(en.target);
  const t = el('div', { className: 'tpage' }); t.innerHTML = sanitizeHTML(en.target._html || '<p><br></p>', { keepStyles: true });
  $$('img', t).forEach(i => i.loading = 'lazy'); en.target.append(t);
}), { root: $('#homeScroll'), rootMargin: '200px' });
function thumb(html) { const pv = el('div', { className: 'pv' }); pv._html = html; thumbObserver.observe(pv); return pv; }

function renderTemplates() {
  const row = $('#tplRow'); row.innerHTML = '';
  TEMPLATES.forEach(t => {
    const pv = t.blank ? el('div', { className: 'pv' }) : thumb(t.html);
    if (t.blank) pv.innerHTML = PLUS_ICON;
    const b = el('button', { type: 'button', className: 'tpl' + (t.blank ? ' blank' : ''), title: t.name }, pv, el('span', { className: 'nm', textContent: t.name }), t.sub ? el('span', { className: 'sub', textContent: t.sub }) : '');
    b.onclick = () => newDoc(t.blank ? {} : { title: t.title, html: t.html });
    row.append(b);
  });
}

async function renderHome() {
  const docs = await DB.all();
  docs.forEach(d => d._text = plainText(d.html));
  const q = homeUI.q.trim().toLowerCase();
  let list = q ? docs.filter(d => untitled(d).toLowerCase().includes(q) || d._text.includes(q)) : docs.slice();
  const s = homeUI.sort;
  list.sort(s === 'title' ? (a, b) => untitled(a).localeCompare(untitled(b), undefined, { sensitivity: 'base' }) : (a, b) => (b[s] || b.modified) - (a[s] || a.modified));

  $('#recentTitle').textContent = q ? 'Search results' : 'Recent documents';
  $('#sortBtn').textContent = SORTS[s];
  $('#viewBtn').innerHTML = svg(homeUI.view === 'grid' ? ICONS.listv : ICONS.gridv);
  $('#viewBtn').title = homeUI.view === 'grid' ? 'List view' : 'Grid view';
  $('#homeSearchClear').hidden = !homeUI.q;
  $('#homeStart').hidden = !!q;

  const grid = $('#docGrid'); grid.innerHTML = ''; grid.className = homeUI.view === 'list' ? 'list' : '';
  if (homeUI.view === 'list' && list.length) grid.append(el('div', { className: 'dhead' }, el('span', { textContent: 'Name' }), el('span', { textContent: 'Last modified' }), el('span', { textContent: 'Created' }), el('span')));
  list.forEach(d => {
    const more = el('button', { type: 'button', className: 'more', title: 'More actions', textContent: '⋮' });
    const card = el('div', { className: 'dcard' + (d.id === state.id ? ' current' : ''), tabIndex: 0, role: 'button', title: untitled(d) },
      thumb(d.html),
      el('div', { className: 'meta' }, (() => { const t = document.createElement('div'); t.innerHTML = DOC_ICON; return t.firstChild; })(),
        el('div', { className: 'nm', textContent: untitled(d) }),
        el('div', { className: 'dt m', textContent: (homeUI.view === 'list' ? '' : 'Modified ') + fmtDate(d.modified) }),
        el('div', { className: 'dt c', textContent: fmtDate(d.created || d.modified) }), more));
    const menu = (x, y) => { more.classList.add('open'); showMenu(docActions(d), x, y); };
    card.onclick = e => { if (e.target === more) return; loadDoc(d.id).then(ok => ok && page.focus()); };
    card.onkeydown = e => { if (e.target !== card) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = more.getBoundingClientRect(); menu(r.left, r.bottom); } };
    more.onclick = e => { e.stopPropagation(); if (more.classList.contains('open')) { closePopups(); more.classList.remove('open'); return; } const r = more.getBoundingClientRect(); menu(r.right - 200, r.bottom + 2); };
    more.addEventListener('mousedown', e => e.stopPropagation());
    card.oncontextmenu = e => { e.preventDefault(); menu(e.clientX, e.clientY); };
    grid.append(card);
  });

  const empty = $('#homeEmpty'); empty.hidden = list.length > 0;
  if (!list.length) {
    empty.innerHTML = `<svg viewBox="0 0 24 24"><path fill="${q ? '#9aa0a6' : '#a1c2fa'}" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="${q ? '#bdc1c6' : '#4285f4'}" d="M14 2l6 6h-6z"/><path fill="#fff" d="M7 12h10v1.5H7zm0 3h10v1.5H7zm0 3h6v1.5H7z"/></svg>`;
    empty.append(el('div', { className: 'big', textContent: q ? 'No matching documents' : 'No documents yet' }),
      el('div', { textContent: q ? 'Try a different search.' : 'Pick a template above to start writing. Documents are saved in this browser.' }));
  }
}
const docActions = d => [
  { label: 'Open', run: () => loadDoc(d.id).then(ok => ok && page.focus()) }, '-',
  { label: 'Rename', run: () => renameDialog(d) },
  { label: 'Make a copy', run: async () => { const now = Date.now(); await DB.put({ id: uid(), title: 'Copy of ' + untitled(d), html: d.html, ps: d.ps, created: now, modified: now }); toast('Copy created'); renderHome(); } }, '-',
  { label: 'Remove', run: () => removeDoc(d) }
];
function renameDialog(d) {
  const inp = el('input', { type: 'text', value: d.title || '', placeholder: 'Untitled document' });
  dialog('Rename', el('div', {}, inp), [{ label: 'Cancel' }, { label: 'OK', primary: true, run: async () => {
    const title = inp.value.trim(); const cur = d.id === state.id;
    if (cur) { state.title = title; $('#docTitle').value = title; await save(); }
    else await DB.put({ ...(await DB.get(d.id)), title, modified: Date.now() });
    renderHome();
  } }], inp);
}
async function removeDoc(d) {
  if (!confirm('Delete "' + untitled(d) + '" permanently?')) return;
  await DB.del(d.id);
  if (d.id === state.id) { clearTimeout(saveTimer); dirty = false; state.id = null; page.innerHTML = '<p><br></p>'; $('#docTitle').value = ''; lsSet('ld_current', ''); history.replaceState(null, '', location.pathname + location.search); $('#homeClose').hidden = true; }
  toast('Document removed'); renderHome();
}
async function showHome() {
  if (dirty) await save();
  closePopups(); $('#linkPop').hidden = true; $('#findbar').hidden = true;
  homeUI.q = ''; $('#homeSearchIn').value = '';
  $('#homeClose').hidden = !state.id; $('#homeTheme').innerHTML = svg(document.body.classList.contains('dark') ? ICONS.sun : ICONS.moon);
  home.hidden = false; renderTemplates(); await renderHome(); $('#homeScroll').scrollTop = 0; document.title = 'Docs – LocalDocs';
}
function hideHome() { if (home.hidden) return; home.hidden = true; document.title = (state.title || 'Untitled document') + ' – LocalDocs'; }
const docsDialog = showHome;

$('#homeSearchIn').addEventListener('input', e => { homeUI.q = e.target.value; renderHome(); });
$('#homeSearchIn').addEventListener('keydown', e => { if (e.key === 'Escape' && homeUI.q) { e.stopPropagation(); e.target.value = ''; homeUI.q = ''; renderHome(); } });
$('#homeSearchClear').onclick = () => { $('#homeSearchIn').value = ''; homeUI.q = ''; renderHome(); $('#homeSearchIn').focus(); };
$('#sortBtn').addEventListener('mousedown', e => e.stopPropagation());
$('#sortBtn').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); showMenu(Object.entries(SORTS).map(([k, v]) => ({ label: v, checked: homeUI.sort === k, run: () => { homeUI.sort = k; lsSet('ld_sort', k); renderHome(); } })), r.left, r.bottom + 2); };
$('#viewBtn').onclick = () => { homeUI.view = homeUI.view === 'grid' ? 'list' : 'grid'; lsSet('ld_view', homeUI.view); renderHome(); };
$('#openFileBtn').onclick = importPicker;
$('#homeClose').onclick = hideHome;
$('#homeTheme').onclick = toggleTheme;
$('#homeScroll').addEventListener('scroll', e => $('#homeTop').classList.toggle('scrolled', e.target.scrollTop > 0));
home.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
home.addEventListener('drop', async e => {
  const f = e.dataTransfer.files[0]; if (!f) return; e.preventDefault();
  try { toast('Importing…'); const r = await importFile(f); await newDoc({ title: r.title, html: r.html }); toast('Imported ' + f.name); } catch (err) { console.error(err); toast('Import failed: ' + err.message, 6000); }
});

function toggleTheme() { const d = document.body.classList.toggle('dark'); lsSet('ld_dark', d ? '1' : '0'); $('#themeBtn').innerHTML = $('#homeTheme').innerHTML = svg(d ? ICONS.sun : ICONS.moon); }
