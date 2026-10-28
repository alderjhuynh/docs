'use strict';

function openLinkDialog(existing) {
  restoreSelIfNeeded();
  const a = existing || closest('a');
  const s = getSelection(); const sel = s.rangeCount ? s.toString() : '';
  const t = el('input', { type: 'text', value: a ? a.textContent : sel, placeholder: 'Text' });
  const u = el('input', { type: 'text', value: a ? a.getAttribute('href') : '', placeholder: 'https://…  or  #  or  mailto:' });
  const range = lastRange && lastRange.cloneRange();
  dialog('Insert link', el('div', {}, el('label', { textContent: 'Text' }), t, el('label', { textContent: 'Link' }), u), [
    a && { label: 'Remove link', run: () => { unlinkEl(a); } },
    { label: 'Cancel' },
    { label: 'Apply', primary: true, run: () => {
      let url = u.value.trim(); if (!url) return;
      if (!/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(url)) url = 'https://' + url;
      if (/^javascript:/i.test(url)) return;
      if (a) { a.setAttribute('href', url); if (t.value && t.value !== a.textContent) a.textContent = t.value; markDirty(); return; }
      page.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
      const label = t.value || url;
      if (getSelection().isCollapsed || label !== sel) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(label)}</a>`);
      else document.execCommand('createLink', false, url);
      markDirty();
    } }
  ].filter(Boolean), u);
}
function unlinkEl(a) { while (a.firstChild) a.before(a.firstChild); a.remove(); markDirty(); }
function showLinkPop(a) {
  const pop = $('#linkPop'); pop.innerHTML = '';
  const href = a.getAttribute('href');
  const open = el('a', { href, target: '_blank', rel: 'noopener', textContent: href, title: href });
  const edit = el('button', { textContent: 'Edit' }), rm = el('button', { textContent: 'Remove' });
  edit.onclick = () => { pop.hidden = true; openLinkDialog(a); }; rm.onclick = () => { pop.hidden = true; unlinkEl(a); };
  [edit, rm].forEach(b => b.onmousedown = e => e.preventDefault());
  pop.append(open, edit, rm); pop.hidden = false;
  const r = a.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - 340, r.left)) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
}
page.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); return; }
  if (a) showLinkPop(a); else $('#linkPop').hidden = true;
});
