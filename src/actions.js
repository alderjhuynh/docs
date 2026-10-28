'use strict';

const A = {
  undo: () => cmd('undo'), redo: () => cmd('redo'), print: () => printDoc(),
  bold: () => cmd('bold'), italic: () => cmd('italic'), underline: () => cmd('underline'),
  strike: () => cmd('strikeThrough'), sup: () => cmd('superscript'), sub: () => cmd('subscript'),
  alignLeft: () => cmd('justifyLeft'), alignCenter: () => cmd('justifyCenter'), alignRight: () => cmd('justifyRight'), alignJustify: () => cmd('justifyFull'),
  bullets: () => { restoreSelIfNeeded(); const li = closest('li'); if (li && li.parentElement.classList.contains('checklist')) { li.parentElement.classList.remove('checklist'); markDirty(); updateToolbar(); return; } cmd('insertUnorderedList'); },
  numbers: () => cmd('insertOrderedList'), checklist: toggleChecklist,
  indent: () => cmd('indent'), outdent: () => cmd('outdent'), clearFormat: clearFormatting,
  link: () => openLinkDialog(), image: () => $('#fileImg').click(),
  sizeUp: () => stepSize(1), sizeDown: () => stepSize(-1),
  toggleOutline: () => { const o = $('#outline'); o.classList.toggle('hidden'); lsSet('ld_outline', o.classList.contains('hidden') ? '0' : '1'); $('#b-outline').classList.toggle('on', !o.classList.contains('hidden')); refreshOutline(); positionImgBox(); }
};
$('#toolbar').addEventListener('mousedown', e => { if (e.target.id !== 'sizeInput') e.preventDefault(); });
$$('#toolbar [data-act]').forEach(b => b.addEventListener('click', e => {
  const a = b.dataset.act;
  if (a === 'textColor') return colorPopup('text', e, b);
  if (a === 'highlight') return colorPopup('hl', e, b);
  if (a === 'lineSpacing') return menuBelow(b, lineSpacingItems());
  A[a] && A[a]();
}));
const lineSpacingItems = () => [['Single', 1], ['1.15', 1.15], ['1.5', 1.5], ['Double', 2]].map(([l, v]) => ({ label: l, run: () => applyLineSpacing(v) })).concat(['-', { label: 'Default', run: () => applyLineSpacing(null) }]);

const FONTS = ['Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'sans-serif', 'serif', 'monospace'];
$('#fontBtn').onclick = e => menuBelow(e.currentTarget, FONTS.map(f => ({ label: f, style: `font-family:'${f}'`, run: () => setFont(f) })));
$('#styleBtn').onclick = e => menuBelow(e.currentTarget, Object.entries(STYLE_NAMES).map(([k, v]) => ({
  label: v, checked: currentStyle() === k, run: () => setBlockStyle(k),
  style: ({ title: 'font-size:22px', subtitle: 'font-size:15px;color:#777', h1: 'font-size:20px', h2: 'font-size:17px', h3: 'font-size:15px', h4: 'font-size:13px', h5: 'font-size:12px', h6: 'font-size:12px;font-style:italic' })[k] || ''
})));
$('#zoomBtn').onclick = e => menuBelow(e.currentTarget, [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map(z => ({ label: Math.round(z * 100) + '%', checked: state.zoom === z, run: () => setZoom(z) })));
const sizeIn = $('#sizeInput');
sizeIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setFontSize(sizeIn.value); restoreSel(); } else if (e.key === 'Escape') { restoreSel(); } });
sizeIn.addEventListener('focus', () => sizeIn.select());
