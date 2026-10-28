'use strict';

function importPicker() { $('#fileImport').click(); }
function menusDef() {
  const dl = [
    { label: 'Microsoft Word (.docx)', run: () => exportAs('docx') }, { label: 'PDF Document (.pdf)', run: () => exportAs('pdf') },
    { label: 'Markdown (.md)', run: () => exportAs('md') }, { label: 'Web Page (.html)', run: () => exportAs('html') }, { label: 'Plain Text (.txt)', run: () => exportAs('txt') }
  ];
  const tableInsert = () => [{ label: 'Table…', run: () => tableDialog() }].concat([[2, 2], [3, 3], [4, 4], [5, 3]].map(([r, c]) => ({ label: `${r} × ${c}`, run: () => insertTable(r, c) })));
  return {
    File: [
      { label: 'New document', shortcut: 'Alt+N', run: () => newDoc() }, { label: 'Open…', shortcut: 'Ctrl+O', run: () => showHome() },
      { label: 'Make a copy', run: async () => { await save(); const id = await newDoc({ title: 'Copy of ' + (state.title || 'Untitled document'), html: page.innerHTML, ps: { ...state.ps } }); } },
      { label: 'Import (.docx, .md, .html, .txt)…', run: importPicker }, '-',
      { label: 'Rename', run: () => { $('#docTitle').focus(); $('#docTitle').select(); } },
      { label: 'Download', submenu: dl }, '-',
      { label: 'Page setup…', run: pageSetupDialog }, { label: 'Print', shortcut: 'Ctrl+P', run: printDoc }, '-',
      { label: 'Delete this document', run: async () => { if (!confirm('Delete this document permanently?')) return; await DB.del(state.id); const rest = (await DB.all()).sort((a, b) => b.modified - a.modified); dirty = false; if (rest.length) await loadDoc(rest[0].id); else await newDoc(); } }
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', run: A.undo }, { label: 'Redo', shortcut: 'Ctrl+Y', run: A.redo }, '-',
      { label: 'Cut', shortcut: 'Ctrl+X', run: () => { restoreSelIfNeeded(); document.execCommand('cut'); } },
      { label: 'Copy', shortcut: 'Ctrl+C', run: () => { restoreSelIfNeeded(); document.execCommand('copy'); } },
      { label: 'Paste', shortcut: 'Ctrl+V', run: async () => { restoreSelIfNeeded(); try { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t); markDirty(); } catch { toast('Use Ctrl+V to paste'); } } }, '-',
      { label: 'Select all', shortcut: 'Ctrl+A', run: () => { page.focus(); document.execCommand('selectAll'); } }, '-',
      { label: 'Find and replace', shortcut: 'Ctrl+H', run: () => openFind(true) }
    ],
    View: [
      { label: 'Show outline', checked: !$('#outline').classList.contains('hidden'), run: A.toggleOutline },
      { label: 'Show page-break guides', checked: lsGet('ld_guides', '1') === '1', run: () => { lsSet('ld_guides', lsGet('ld_guides', '1') === '1' ? '0' : '1'); applyPageSetup(); } },
      { label: 'Dark theme', checked: document.body.classList.contains('dark'), run: toggleTheme },
      { label: 'Zoom', submenu: [0.5, 0.75, 1, 1.25, 1.5, 2].map(z => ({ label: Math.round(z * 100) + '%', checked: state.zoom === z, run: () => setZoom(z) })) },
      { label: 'Full screen', run: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }
    ],
    Insert: [
      { label: 'Image…', run: () => $('#fileImg').click() }, { label: 'Table', submenu: tableInsert }, '-',
      { label: 'Link', shortcut: 'Ctrl+K', run: () => openLinkDialog() }, { label: 'Horizontal line', run: insertHR }, { label: 'Page break', shortcut: 'Ctrl+Enter', run: insertPageBreak }, '-',
      { label: 'Checklist', run: toggleChecklist }, { label: 'Block quote', run: () => { cmd('formatBlock', '<blockquote>'); } },
      { label: 'Code block', run: () => { cmd('formatBlock', '<pre>'); } }, '-',
      { label: 'Special characters…', run: specialChars }, { label: 'Date', run: insertDate }
    ],
    Format: [
      { label: 'Text', submenu: [
        { label: 'Bold', shortcut: 'Ctrl+B', run: A.bold }, { label: 'Italic', shortcut: 'Ctrl+I', run: A.italic }, { label: 'Underline', shortcut: 'Ctrl+U', run: A.underline },
        { label: 'Strikethrough', shortcut: 'Alt+Shift+5', run: A.strike }, { label: 'Superscript', shortcut: 'Ctrl+.', run: A.sup }, { label: 'Subscript', shortcut: 'Ctrl+,', run: A.sub }, { label: 'Inline code', run: toggleInlineCode }] },
      { label: 'Paragraph styles', submenu: Object.entries(STYLE_NAMES).map(([k, v]) => ({ label: v, run: () => setBlockStyle(k) })) },
      { label: 'Align & indent', submenu: [
        { label: 'Left', shortcut: 'Ctrl+Shift+L', run: A.alignLeft }, { label: 'Center', shortcut: 'Ctrl+Shift+E', run: A.alignCenter }, { label: 'Right', shortcut: 'Ctrl+Shift+R', run: A.alignRight },
        { label: 'Justified', shortcut: 'Ctrl+Shift+J', run: A.alignJustify }, '-', { label: 'Increase indent', run: A.indent }, { label: 'Decrease indent', run: A.outdent }] },
      { label: 'Line & paragraph spacing', submenu: lineSpacingItems },
      { label: 'Bullets & numbering', submenu: [{ label: 'Bulleted list', run: A.bullets }, { label: 'Numbered list', run: A.numbers }, { label: 'Checklist', run: toggleChecklist }] },
      { label: 'Capitalization', submenu: [{ label: 'lowercase', run: () => caseTransform('lower') }, { label: 'UPPERCASE', run: () => caseTransform('upper') }, { label: 'Title Case', run: () => caseTransform('title') }] },
      { label: 'Table', submenu: tableMenu }, '-',
      { label: 'Clear formatting', shortcut: 'Ctrl+\\', run: clearFormatting }
    ],
    Tools: [
      { label: 'Word count', shortcut: 'Ctrl+Shift+C', run: wordCountDialog }, { label: 'Find and replace', shortcut: 'Ctrl+H', run: () => openFind(true) },
      { label: 'Spelling check', checked: page.spellcheck, run: () => { page.spellcheck = !page.spellcheck; page.blur(); page.focus(); } }, '-',
      { label: 'Keyboard shortcuts', run: shortcutsDialog }
    ]
  };
}
const mb = $('#menubar');
['File', 'Edit', 'View', 'Insert', 'Format', 'Tools'].forEach(name => {
  const b = el('button', { textContent: name, type: 'button' }); mb.append(b);
  b.addEventListener('mousedown', e => e.preventDefault());
  const open = () => { const was = b.classList.contains('open'); closePopups(); if (was) return; b.classList.add('open'); const r = b.getBoundingClientRect(); showMenu(menusDef()[name], r.left, r.bottom + 2); b.classList.add('open'); };
  b.addEventListener('click', open);
  b.addEventListener('mouseenter', () => { if ($$('#menubar button.open').length && !b.classList.contains('open')) { closePopups(); b.classList.add('open'); const r = b.getBoundingClientRect(); showMenu(menusDef()[name], r.left, r.bottom + 2); b.classList.add('open'); } });
});
$('#dlBtn').addEventListener('click', e => menuBelow(e.currentTarget, menusDef().File[6].submenu));
$('#logo').addEventListener('click', () => showHome());
