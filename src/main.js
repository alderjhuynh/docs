'use strict';

(async function boot() {
  document.execCommand('defaultParagraphSeparator', false, 'p');
  if (lsGet('ld_dark', '0') === '1') document.body.classList.add('dark');
  $('#themeBtn').innerHTML = svg(document.body.classList.contains('dark') ? ICONS.sun : ICONS.moon);
  if (lsGet('ld_outline', '0') === '1') { $('#outline').classList.remove('hidden'); $('#b-outline').classList.add('on'); }
  setZoom(parseFloat(lsGet('ld_zoom', '1')) || 1);
  try { await DB.open(); } catch (e) { toast('IndexedDB unavailable – documents will not be saved', 8000); return; }
  const want = location.hash.slice(1);
  if (want && await loadDoc(want)) { page.focus(); return; }
  await showHome();
})();
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== state.id) loadDoc(id); });
