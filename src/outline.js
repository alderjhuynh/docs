'use strict';

let outlineT;
function refreshOutline() {
  clearTimeout(outlineT); outlineT = setTimeout(() => {
    if ($('#outline').classList.contains('hidden')) return;
    const list = $('#outlineList'); list.innerHTML = '';
    const hs = $$('p.title,p.subtitle,h1,h2,h3,h4,h5,h6', page).filter(h => h.textContent.trim());
    if (!hs.length) { list.append(el('p', { className: 'muted', textContent: 'Headings you add to the document will appear here.' })); return; }
    hs.forEach(h => {
      const lvl = h.tagName === 'P' ? (h.classList.contains('title') ? 1 : 2) : +h.tagName[1];
      const a = el('a', { className: 'l' + Math.min(lvl, 6), textContent: h.textContent.trim(), title: h.textContent.trim() });
      a.onclick = () => { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
      list.append(a);
    });
  }, 250);
}
let countT;
function updateCounts() {
  clearTimeout(countT); countT = setTimeout(() => {
    const w = (page.innerText.match(/\S+/g) || []).length; $('#wordbadge').textContent = w + (w === 1 ? ' word' : ' words');
  }, 200);
}
$('#wordbadge').onclick = wordCountDialog;
