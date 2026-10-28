'use strict';

function printDoc() {
  deselectImg(); const old = document.title; document.title = safeName();
  const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore); setTimeout(() => window.print(), 50);
}
async function exportAs(kind) {
  await save(); deselectImg(); const name = safeName();
  try {
    if (kind === 'pdf') { toast('In the print dialog choose “Save as PDF” as the destination', 5000); setTimeout(printDoc, 700); return; }
    if (kind === 'docx') { toast('Building .docx…'); download(await toDocxBlob(normalizedClone(page), state.title || 'Untitled document', state.ps), name + '.docx'); toast('Downloaded ' + name + '.docx'); }
    else if (kind === 'md') { download(new Blob([toMarkdown(normalizedClone(page))], { type: 'text/markdown' }), name + '.md'); toast('Downloaded ' + name + '.md'); }
    else if (kind === 'html') { const p = state.ps, d = PAGE_SIZES[p.size]; download(new Blob([toStandaloneHTML(normalizedClone(page), state.title || 'Untitled document', { ...p, w: p.orient === 'landscape' ? d[1] : d[0] })], { type: 'text/html' }), name + '.html'); toast('Downloaded ' + name + '.html'); }
    else if (kind === 'txt') { download(new Blob([page.innerText], { type: 'text/plain' }), name + '.txt'); toast('Downloaded ' + name + '.txt'); }
  } catch (e) { console.error(e); toast('Export failed: ' + e.message, 6000); }
}
