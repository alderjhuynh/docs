'use strict';

function printDoc() {
  deselectImg(); const old = document.title; document.title = safeName();
  const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore); setTimeout(() => window.print(), 50);
}

const imagesReady = root => Promise.all($$('img', root).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));

async function collectTabs() {
  tabsFlush();
  const flat = tabsFlat();
  if (flat.length < 2) return [{ node: flat[0].node, clone: normalizedClone(page), text: page.innerText }];
  const keep = state.tab, out = [];
  tabsFrozen = true; canvas.style.visibility = 'hidden';
  try {
    for (const { node } of flat) {
      setPageHTML(node.html); await imagesReady(page);
      out.push({ node, clone: normalizedClone(page), text: page.innerText });
    }
  } finally { setPageHTML(tabNode(keep).html); canvas.style.visibility = ''; tabsFrozen = false; }
  return out;
}
function composeRoot(items) {
  if (items.length < 2) return items[0].clone;
  const root = document.createElement('div');
  items.forEach(({ node, clone }, i) => {
    if (i) root.append(Object.assign(document.createElement('hr'), { className: 'pagebreak' }));
    root.append(Object.assign(document.createElement('p'), { className: 'title', textContent: tabLabel(node) }), ...Array.from(clone.childNodes));
  });
  return root;
}

async function exportAs(kind) {
  await save(); deselectImg(); const name = safeName();
  try {
    if (kind === 'pdf') { toast('In the print dialog choose “Save as PDF” as the destination', 5000); setTimeout(printDoc, 700); return; }
    if (kind === 'docx') toast('Building .docx…');
    const items = await collectTabs(), root = composeRoot(items), title = state.title || 'Untitled document';
    if (kind === 'docx') { download(await toDocxBlob(root, title, state.ps), name + '.docx'); toast('Downloaded ' + name + '.docx'); }
    else if (kind === 'md') { download(new Blob([toMarkdown(root)], { type: 'text/markdown' }), name + '.md'); toast('Downloaded ' + name + '.md'); }
    else if (kind === 'html') { const p = state.ps, d = PAGE_SIZES[p.size]; download(new Blob([toStandaloneHTML(root, title, { ...p, w: p.orient === 'landscape' ? d[1] : d[0] })], { type: 'text/html' }), name + '.html'); toast('Downloaded ' + name + '.html'); }
    else if (kind === 'txt') {
      const text = items.length < 2 ? items[0].text : items.map(i => tabLabel(i.node) + '\n\n' + i.text).join('\n\n\n');
      download(new Blob([text], { type: 'text/plain' }), name + '.txt'); toast('Downloaded ' + name + '.txt');
    }
  } catch (e) { console.error(e); toast('Export failed: ' + e.message, 6000); }
}
