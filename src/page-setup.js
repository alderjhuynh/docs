'use strict';

function applyPageSetup() {
  const ps = state.ps, d = PAGE_SIZES[ps.size] || PAGE_SIZES.Letter;
  const w = (ps.orient === 'landscape' ? d[1] : d[0]) * 96, h = (ps.orient === 'landscape' ? d[0] : d[1]) * 96;
  const st = page.style;
  st.width = w + 'px'; st.minHeight = h + 'px';
  st.setProperty('--mt', ps.mt * 96 + 'px'); st.setProperty('--mb', ps.mb * 96 + 'px'); st.setProperty('--ml', ps.ml * 96 + 'px'); st.setProperty('--mr', ps.mr * 96 + 'px');
  st.setProperty('--ch', (h - (ps.mt + ps.mb) * 96) + 'px');
  let tag = $('#pagestyle'); if (!tag) { tag = el('style', { id: 'pagestyle' }); document.head.append(tag); }
  tag.textContent = `@page{size:${ps.orient === 'landscape' ? d[1] : d[0]}in ${ps.orient === 'landscape' ? d[0] : d[1]}in;margin:${ps.mt}in ${ps.mr}in ${ps.mb}in ${ps.ml}in}`;
  page.classList.toggle('guides', lsGet('ld_guides', '1') === '1');
  positionImgBox();
}
function setZoom(z) {
  state.zoom = z; $('#pageWrap').style.zoom = z; $('#zoomBtn').textContent = Math.round(z * 100) + '%'; lsSet('ld_zoom', z); positionImgBox();
}
function pageSetupDialog() {
  const ps = state.ps;
  const sel = (opts, v) => { const s = el('select'); opts.forEach(o => s.append(el('option', { value: o, textContent: o, selected: o === v }))); return s; };
  const size = sel(Object.keys(PAGE_SIZES), ps.size), or = sel(['portrait', 'landscape'], ps.orient);
  const num = v => el('input', { type: 'number', step: '0.1', min: '0', max: '4', value: v });
  const mt = num(ps.mt), mb = num(ps.mb), ml = num(ps.ml), mr = num(ps.mr);
  const f = (l, i) => el('div', {}, el('label', { textContent: l }), i);
  dialog('Page setup', el('div', {}, el('div', { className: 'grid2' }, f('Paper size', size), f('Orientation', or)),
    el('label', { textContent: 'Margins (inches)' }), el('div', { className: 'grid2' }, f('Top', mt), f('Bottom', mb), f('Left', ml), f('Right', mr))), [
    { label: 'Cancel' }, { label: 'OK', primary: true, run: () => {
      state.ps = { size: size.value, orient: or.value, mt: +mt.value || 0, mb: +mb.value || 0, ml: +ml.value || 0, mr: +mr.value || 0 };
      applyPageSetup(); markDirty();
    } }]);
}
