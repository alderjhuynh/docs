'use strict';

const PAGE_SIZES = { Letter: [8.5, 11], A4: [8.2677, 11.6929], Legal: [8.5, 14] };

const OK_TAGS = new Set('P H1 H2 H3 H4 H5 H6 SPAN B STRONG I EM U S STRIKE DEL SUB SUP CODE PRE BLOCKQUOTE UL OL LI A BR HR IMG TABLE THEAD TBODY TFOOT TR TD TH'.split(' '));
const DROP_TAGS = new Set('SCRIPT STYLE IFRAME OBJECT EMBED LINK META TITLE HEAD NOSCRIPT SVG CANVAS VIDEO AUDIO FORM BUTTON SELECT TEXTAREA'.split(' '));
const BLOCKS = new Set('P H1 H2 H3 H4 H5 H6 PRE BLOCKQUOTE UL OL LI TABLE TR TD TH DIV HR'.split(' '));
const KEEP_STYLE = ['font-family', 'font-size', 'color', 'background-color', 'font-weight', 'font-style', 'text-align', 'line-height', 'margin-left'];

function sanitizeHTML(html, opts = {}) {
  const keepStyles = opts.keepStyles !== false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = document.createElement('div');

  function cleanStyle(el, src) {
    if (!keepStyles) return;
    const s = src.style; if (!s) return;
    for (const p of KEEP_STYLE) {
      let v = s.getPropertyValue(p);
      if (!v) continue;
      if (p === 'font-weight' && (v === 'normal' || v === '400')) continue;
      if (p === 'font-style' && v === 'normal') continue;
      if (p === 'background-color' && /^(transparent|rgba\(0,\s*0,\s*0,\s*0\)|white|#fff(fff)?|rgb\(255,\s*255,\s*255\))$/i.test(v)) continue;
      if (p === 'color' && /^(black|#000(000)?|rgb\(0,\s*0,\s*0\))$/i.test(v)) continue;
      if (p === 'margin-left' && !/^\d/.test(v)) continue;
      if (p === 'margin-left' && parseFloat(v) === 0) continue;
      if (p === 'font-family') v = v.replace(/"/g, "'");
      if (p === 'text-align' && (v === 'start' || v === 'left')) continue;
      el.style.setProperty(p, v);
    }
    const td = s.getPropertyValue('text-decoration') || s.getPropertyValue('text-decoration-line');
    if (td && /underline/.test(td)) el.style.textDecoration = 'underline';
    if (td && /line-through/.test(td)) el.style.textDecoration = (el.style.textDecoration + ' line-through').trim();
  }

  function walk(srcParent, dstParent) {
    for (const n of Array.from(srcParent.childNodes)) {
      if (n.nodeType === 3) {
        dstParent.appendChild(document.createTextNode(n.textContent));
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (DROP_TAGS.has(tag)) continue;

      if ((tag === 'B' || tag === 'STRONG') && /normal|400/.test(n.style.fontWeight || '')) { walk(n, dstParent); continue; }

      if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN' || tag === 'BODY' || tag === 'HTML' || tag === 'CENTER') {
        const hasBlock = Array.from(n.children).some(c => BLOCKS.has(c.tagName.toUpperCase()));
        if (hasBlock || tag !== 'DIV') { walk(n, dstParent); continue; }
        const p = document.createElement('p'); cleanStyle(p, n); walk(n, p); dstParent.appendChild(p); continue;
      }
      if (!OK_TAGS.has(tag)) { walk(n, dstParent); continue; }

      const el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const h = n.getAttribute('href') || '';
        if (/^\s*(javascript|data|vbscript):/i.test(h)) { walk(n, dstParent); continue; }
        el.setAttribute('href', h);
      } else if (tag === 'IMG') {
        const s = n.getAttribute('src') || '';
        if (!/^(data:image\/|https?:|blob:)/i.test(s)) continue;
        el.setAttribute('src', s);
        const w = n.getAttribute('width') || n.style.width, ht = n.getAttribute('height') || n.style.height;
        if (w && parseFloat(w) > 0) el.style.width = parseFloat(w) + 'px';
        if (ht && parseFloat(ht) > 0 && w) el.style.height = parseFloat(ht) + 'px';
        dstParent.appendChild(el); continue;
      } else if (tag === 'TD' || tag === 'TH') {
        const cs = parseInt(n.getAttribute('colspan')); if (cs > 1) el.setAttribute('colspan', cs);
        const bg = n.style.backgroundColor || n.getAttribute('bgcolor');
        if (bg && !/^(transparent|white|#fff(fff)?)$/i.test(bg)) el.style.backgroundColor = bg;
      } else if (tag === 'OL') {
        const st = parseInt(n.getAttribute('start')); if (st > 1) el.setAttribute('start', st);
      } else if (tag === 'UL' && n.classList.contains('checklist')) {
        el.className = 'checklist';
      } else if (tag === 'LI' && n.getAttribute('data-checked') === 'true') {
        el.setAttribute('data-checked', 'true');
      } else if (tag === 'HR' && n.classList.contains('pagebreak')) {
        el.className = 'pagebreak';
      } else if (tag === 'P' && (n.classList.contains('title') || n.classList.contains('subtitle'))) {
        el.className = n.className;
      }
      if (tag !== 'TD' && tag !== 'TH' || true) cleanStyle(el, n);
      if (tag === 'TD' && el.style.backgroundColor === '' && n.style.backgroundColor) el.style.backgroundColor = n.style.backgroundColor;

      const va = n.style && n.style.verticalAlign;
      let target = el;
      if (tag === 'SPAN' && (va === 'super' || va === 'sub')) {
        const w = document.createElement(va === 'super' ? 'sup' : 'sub'); w.appendChild(el); target = w;
      }
      if (tag === 'BR' || tag === 'HR') { dstParent.appendChild(el); continue; }
      walk(n, el);
      dstParent.appendChild(target);
    }
  }
  walk(doc.body, out);

  out.querySelectorAll('li > input[type=checkbox]').forEach(() => {});
  for (const span of Array.from(out.querySelectorAll('span'))) {
    if (!span.getAttribute('style')) { while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span); span.remove(); }
  }
  (function strip(node) {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === 3) {
        const prev = c.previousSibling, next = c.nextSibling;
        const blockish = e => !e || (e.nodeType === 1 && BLOCKS.has(e.tagName));
        if (/^\s*$/.test(c.textContent) && (blockish(prev) || blockish(next))) c.remove();
        else c.textContent = c.textContent.replace(/[ \t\r\n]+/g, ' ');
      } else if (c.nodeType === 1 && c.tagName !== 'PRE') strip(c);
    }
  })(out);
  wrapLooseInline(out);
  out.querySelectorAll('td,th,li,p,h1,h2,h3,h4,h5,h6').forEach(x => { if (!x.firstChild) x.innerHTML = '<br>'; });
  return out.innerHTML;
}

function wrapLooseInline(root) {
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const hasContent = run.some(n => n.nodeType === 1 || /\S/.test(n.textContent));
    if (hasContent) { const p = document.createElement('p'); run[0].before(p); run.forEach(n => p.appendChild(n)); }
    else run.forEach(n => n.remove());
    run = [];
  };
  for (const n of Array.from(root.childNodes)) {
    if (n.nodeType === 1 && BLOCKS.has(n.tagName)) flush(); else run.push(n);
  }
  flush();
}

function normalizedClone(pageEl) {
  const c = pageEl.cloneNode(true);
  const orig = pageEl.querySelectorAll('td,th,table,img'), copy = c.querySelectorAll('td,th,table,img');
  orig.forEach((o, i) => { if (o.tagName === 'IMG') { copy[i].dataset.nw = o.naturalWidth; copy[i].dataset.nh = o.naturalHeight; copy[i].dataset.rw = o.getBoundingClientRect().width / (parseFloat(getComputedStyle(pageEl.parentElement).zoom) || 1); } else copy[i].dataset.w = o.offsetWidth; });
  c.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
  c.querySelectorAll('ul > ul, ul > ol, ol > ul, ol > ol').forEach(l => {
    const prev = l.previousElementSibling;
    if (prev && prev.tagName === 'LI') prev.appendChild(l);
    else { const li = document.createElement('li'); l.before(li); li.appendChild(l); }
  });
  c.querySelectorAll('p').forEach(p => { if (p.querySelector(':scope > ul, :scope > ol, :scope > table, :scope > p')) { while (p.firstChild) p.before(p.firstChild); p.remove(); } });
  return c;
}

async function importFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = (file.name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  let html = '';
  if (ext === 'docx') {
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
      convertImage: mammoth.images.imgElement(img => img.read('base64').then(b => ({ src: 'data:' + img.contentType + ';base64,' + b })))
    });
    html = sanitizeHTML(res.value, { keepStyles: true });
  } else if (ext === 'md' || ext === 'markdown') {
    const raw = marked.parse(await file.text(), { gfm: true, breaks: false });
    const tmp = document.createElement('div'); tmp.innerHTML = sanitizeHTML(raw);
    tmp.querySelectorAll('li').forEach(li => {
      const first = li.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]');
      if (first) { if (first.checked) li.setAttribute('data-checked', 'true'); first.remove(); li.parentElement.classList.add('checklist'); }
    });
    html = tmp.innerHTML;
  } else if (ext === 'html' || ext === 'htm') {
    html = sanitizeHTML(await file.text());
  } else {
    const t = await file.text();
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = t.replace(/\r\n?/g, '\n').split('\n').map(l => '<p>' + (esc(l) || '<br>') + '</p>').join('');
  }
  return { title: name, html: html || '<p><br></p>' };
}

function toMarkdown(pageEl) {
  const clone = pageEl.cloneNode(true);
  clone.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  clone.querySelectorAll('table').forEach(t => {
    const first = t.rows[0]; if (!first) return;
    Array.from(first.cells).forEach(c => { if (c.tagName === 'TD') { const th = document.createElement('th'); th.innerHTML = c.innerHTML; th.setAttribute('colspan', c.colSpan); c.replaceWith(th); } });
    t.querySelectorAll('td,th').forEach(c => { c.innerHTML = c.innerHTML.replace(/<\/p>\s*<p[^>]*>/gi, ' ').replace(/<\/?p[^>]*>/gi, '').replace(/<br\s*\/?>/gi, ' ').trim(); });
  });
  clone.querySelectorAll('span[style]').forEach(sp => {
    const st = sp.style; const wrap = tag => { const w = document.createElement(tag); while (sp.firstChild) w.appendChild(sp.firstChild); sp.appendChild(w); };
    if (st.fontWeight === 'bold' || parseInt(st.fontWeight) >= 600) wrap('strong');
    if (st.fontStyle === 'italic') wrap('em');
    if (/underline/.test(st.textDecoration + st.textDecorationLine)) wrap('u');
    if (/line-through/.test(st.textDecoration + st.textDecorationLine)) wrap('s');
  });
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', hr: '---' });
  td.use(turndownPluginGfm.gfm);
  td.keep(['u', 'sub', 'sup']);
  td.addRule('titleP', { filter: n => n.nodeName === 'P' && n.classList.contains('title'), replacement: c => '\n\n# ' + c.trim() + '\n\n' });
  td.addRule('subtitleP', { filter: n => n.nodeName === 'P' && n.classList.contains('subtitle'), replacement: c => '\n\n*' + c.trim() + '*\n\n' });
  td.addRule('pagebreak', { filter: n => n.nodeName === 'HR' && n.classList.contains('pagebreak'), replacement: () => '\n\n---\n\n' });
  td.addRule('highlight', { filter: n => n.nodeName === 'SPAN' && n.style && n.style.backgroundColor && n.style.backgroundColor !== 'transparent', replacement: c => '<mark>' + c + '</mark>' });
  td.addRule('checkItem', {
    filter: n => n.nodeName === 'LI' && n.parentNode && n.parentNode.classList && n.parentNode.classList.contains('checklist'),
    replacement: (content, node) => {
      content = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n    ');
      return '- [' + (node.getAttribute('data-checked') === 'true' ? 'x' : ' ') + '] ' + content + (node.nextSibling ? '\n' : '');
    }
  });
  return td.turndown(clone).replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function toStandaloneHTML(pageEl, title, ps) {
  const clone = pageEl.cloneNode(true);
  clone.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  clone.removeAttribute('contenteditable'); clone.removeAttribute('id'); clone.removeAttribute('style');
  const css = document.querySelector('link[href="style.css"]') ? '' : '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{background:#f9fbfd;margin:0;padding:24px}
.doc{background:#fff;color:#000;max-width:${ps.w}in;margin:0 auto;padding:${ps.mt}in ${ps.mr}in ${ps.mb}in ${ps.ml}in;box-shadow:0 0 0 1px #c7c7c7;font:11pt/1.15 Arial,sans-serif;overflow-wrap:anywhere}
.doc p{margin:0}.doc p.title{font-size:26pt;margin:0 0 3pt}.doc p.subtitle{font-size:15pt;color:#666;margin:0 0 16pt}
.doc h1{font-size:20pt;margin:20pt 0 6pt;font-weight:400}.doc h2{font-size:16pt;margin:18pt 0 6pt;font-weight:400}.doc h3{font-size:14pt;margin:16pt 0 4pt;font-weight:400;color:#434343}
.doc h4{font-size:12pt;font-weight:400;color:#666}.doc h5{font-size:11pt;font-weight:400;color:#666}.doc h6{font-size:11pt;font-weight:400;color:#666;font-style:italic}
.doc ul,.doc ol{margin:0;padding-left:36px}.doc a{color:#1155cc}.doc blockquote{margin:0 0 0 24px;padding-left:14px;border-left:3px solid #c0c0c0;color:#444}
.doc pre{background:#f3f3f3;padding:8px 12px;border-radius:4px;font:10pt "Courier New",monospace;white-space:pre-wrap}.doc code{font-family:"Courier New",monospace;background:#f1f3f4;padding:0 3px}
.doc table{border-collapse:collapse;width:100%;table-layout:fixed}.doc td,.doc th{border:1px solid #000;padding:4px 6px;vertical-align:top}
.doc img{max-width:100%}.doc hr{border:0;border-top:1px solid #000}.doc hr.pagebreak{border-top:1px dashed #999}
.doc ul.checklist{list-style:none;padding-left:0}.doc ul.checklist>li::before{content:"\\2610\\00a0"}.doc ul.checklist>li[data-checked=true]::before{content:"\\2611\\00a0"}
.doc ul.checklist>li[data-checked=true]{text-decoration:line-through;color:#80868b}
@media print{body{background:#fff;padding:0}.doc{box-shadow:none;max-width:none;padding:0}@page{margin:${ps.mt}in ${ps.mr}in ${ps.mb}in ${ps.ml}in}}
</style></head><body><div class="doc">${clone.innerHTML}</div></body></html>`;
}

async function toDocxBlob(pageEl, title, ps) {
  const D = docx;
  const TW = 1440;
  const dims = PAGE_SIZES[ps.size] || PAGE_SIZES.Letter;
  const pageW = Math.round(dims[0] * TW), pageH = Math.round(dims[1] * TW);
  const contentW = Math.round((ps.orient === 'landscape' ? dims[1] : dims[0]) * TW - (ps.ml + ps.mr) * TW);
  const numConfigs = [];
  let olCount = 0;

  const bulletChars = ['•', '◦', '▪'];
  const bulletLevels = Array.from({ length: 9 }, (_, i) => ({
    level: i, format: D.LevelFormat.BULLET, text: bulletChars[i % 3], alignment: D.AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } }
  }));
  numConfigs.push({ reference: 'bullets', levels: bulletLevels });

  const fmts = [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN];
  function newOrdered(start) {
    const ref = 'ol' + (++olCount);
    numConfigs.push({
      reference: ref, levels: Array.from({ length: 9 }, (_, i) => ({
        level: i, format: fmts[i % 3], text: `%${i + 1}.`, alignment: D.AlignmentType.LEFT, start: i === 0 ? start : 1,
        style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } }
      }))
    });
    return ref;
  }

  const px2tw = px => Math.round(px * 15);
  const clean = s => s.replace(/ /g, ' ').replace(/[\r\n]+\s*/g, ' ');
  const hex = c => {
    if (!c) return null;
    const m = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
    if (m) { if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase(); }
    const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) return (h[1].length === 3 ? h[1].split('').map(x => x + x).join('') : h[1]).toUpperCase();
    const probe = document.createElement('span'); probe.style.color = c; document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color; probe.remove();
    return rgb === c ? null : hex(rgb);
  };

  function styleFrom(el, st) {
    const s = { ...st }; const e = el.style || {};
    const tag = el.tagName;
    if (tag === 'B' || tag === 'STRONG') s.bold = true;
    if (tag === 'I' || tag === 'EM') s.italics = true;
    if (tag === 'U') s.underline = { type: D.UnderlineType.SINGLE };
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
    if (tag === 'SUB') s.subScript = true;
    if (tag === 'SUP') s.superScript = true;
    if (tag === 'CODE') { s.font = 'Courier New'; s.shading = { type: D.ShadingType.CLEAR, fill: 'F1F3F4', color: 'auto' }; }
    if (e.fontWeight && (e.fontWeight === 'bold' || parseInt(e.fontWeight) >= 600)) s.bold = true;
    if (e.fontStyle === 'italic') s.italics = true;
    const td = (e.textDecoration || '') + ' ' + (e.textDecorationLine || '');
    if (/underline/.test(td)) s.underline = { type: D.UnderlineType.SINGLE };
    if (/line-through/.test(td)) s.strike = true;
    if (e.color) { const h = hex(e.color); if (h) s.color = h; }
    if (e.backgroundColor) { const h = hex(e.backgroundColor); if (h) s.shading = { type: D.ShadingType.CLEAR, fill: h, color: 'auto' }; }
    if (e.fontFamily) s.font = e.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (e.fontSize) {
      const m = e.fontSize.match(/([\d.]+)(px|pt)/); if (m) s.size = Math.round((m[2] === 'px' ? parseFloat(m[1]) * .75 : parseFloat(m[1])) * 2);
    }
    return s;
  }

  async function imageRun(img) {
    try {
      let src = img.getAttribute('src') || '', bytes, type;
      const nw = +img.dataset.nw || img.naturalWidth || 0, nh = +img.dataset.nh || img.naturalHeight || 0;
      let w = parseFloat(img.style.width) || nw || +img.dataset.rw || 300;
      let h = parseFloat(img.style.height) || (nw ? w * nh / nw : 200);
      const maxW = contentW / 15; if (w > maxW) { h = h * maxW / w; w = maxW; }
      let m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i);
      if (m) {
        type = m[1].toLowerCase().replace('jpeg', 'jpg');
        const bin = atob(m[2]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        const im = new Image(); im.crossOrigin = 'anonymous';
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = src; });
        const c = document.createElement('canvas'); c.width = im.naturalWidth || w; c.height = im.naturalHeight || h;
        c.getContext('2d').drawImage(im, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        bytes = new Uint8Array(await blob.arrayBuffer()); type = 'png';
      }
      return new D.ImageRun({ type, data: bytes, transformation: { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) } });
    } catch (e) { console.warn('image skipped', e); return new D.TextRun({ text: '[image: ' + (img.alt || 'unavailable') + ']', italics: true }); }
  }

  async function inline(node, st, out) {
    for (const n of Array.from(node.childNodes)) {
      if (n.nodeType === 3) {
        const t = clean(n.textContent); if (t) out.push(new D.TextRun({ text: t, ...st })); continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === 'BR') { if (n.nextSibling) out.push(new D.TextRun({ break: 1, ...st })); continue; }
      if (tag === 'IMG') { out.push(await imageRun(n)); continue; }
      if (tag === 'A' && n.getAttribute('href')) {
        const kids = []; await inline(n, { ...styleFrom(n, st), color: st.color || '1155CC', underline: { type: D.UnderlineType.SINGLE } }, kids);
        out.push(new D.ExternalHyperlink({ link: n.getAttribute('href'), children: kids })); continue;
      }
      if (/^(UL|OL|TABLE|P|H[1-6]|DIV|BLOCKQUOTE|PRE|HR)$/.test(tag)) continue;
      await inline(n, styleFrom(n, st), out);
    }
  }

  function paraProps(el, extra = {}) {
    const p = { ...extra }; const s = el.style || {};
    if (s.textAlign) p.alignment = ({ left: D.AlignmentType.LEFT, center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED })[s.textAlign];
    const lh = parseFloat(s.lineHeight); if (lh && !/px|pt/.test(s.lineHeight)) p.spacing = { ...(p.spacing || {}), line: Math.round(240 * lh), lineRule: D.LineRuleType.AUTO };
    const ml = parseFloat(s.marginLeft); if (ml > 0) p.indent = { ...(p.indent || {}), left: px2tw(ml) + ((p.indent && p.indent.left) || 0) };
    return p;
  }

  async function paragraphFrom(el, props, st) {
    const kids = []; await inline(el, st, kids);
    return new D.Paragraph({ ...paraProps(el, props), children: kids });
  }

  async function blocks(container, ctx, out) {
    let loose = null;
    const flush = async () => { if (loose) { const kids = []; for (const n of loose) await inlineNode(n, ctx.st, kids); if (kids.length) out.push(new D.Paragraph({ ...ctx.pp, children: kids })); loose = null; } };
    const inlineNode = async (n, st, kids) => { const w = document.createElement('div'); w.appendChild(n.cloneNode(true)); await inline(w, st, kids); };

    for (const n of Array.from(container.childNodes)) {
      if (n.nodeType === 3) { if (/\S/.test(n.textContent)) (loose = loose || []).push(n); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (!/^(P|H[1-6]|UL|OL|TABLE|HR|BLOCKQUOTE|PRE|DIV)$/.test(tag)) { (loose = loose || []).push(n); continue; }
      await flush();
      const base = ctx.pp || {};
      if (tag === 'P') {
        const props = { ...base };
        if (n.classList.contains('title')) props.style = 'Title';
        else if (n.classList.contains('subtitle')) props.style = 'Subtitle';
        out.push(await paragraphFrom(n, props, ctx.st));
      } else if (/^H[1-6]$/.test(tag)) {
        out.push(await paragraphFrom(n, { ...base, heading: D.HeadingLevel['HEADING_' + tag[1]] }, ctx.st));
      } else if (tag === 'DIV') {
        await blocks(n, ctx, out);
      } else if (tag === 'HR') {
        if (n.classList.contains('pagebreak')) out.push(new D.Paragraph({ children: [new D.PageBreak()] }));
        else out.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, children: [] }));
      } else if (tag === 'BLOCKQUOTE') {
        const pp = { ...base, indent: { left: 720 }, border: { left: { style: D.BorderStyle.SINGLE, size: 18, color: 'C0C0C0', space: 8 } } };
        const hasBlocks = Array.from(n.children).some(c => /^(P|H[1-6]|UL|OL|DIV|TABLE)$/.test(c.tagName));
        if (hasBlocks) await blocks(n, { ...ctx, pp, st: { ...ctx.st, color: '444444' } }, out);
        else out.push(await paragraphFrom(n, pp, { ...ctx.st, color: '444444' }));
      } else if (tag === 'PRE') {
        const lines = n.textContent.replace(/\n$/, '').split('\n');
        lines.forEach(l => out.push(new D.Paragraph({
          shading: { type: D.ShadingType.CLEAR, fill: 'F3F3F3', color: 'auto' },
          children: [new D.TextRun({ text: l.replace(/ /g, ' '), font: 'Courier New', size: 20 })]
        })));
      } else if (tag === 'UL' || tag === 'OL') {
        await list(n, ctx, out, 0);
      } else if (tag === 'TABLE') {
        out.push(await table(n, ctx)); out.push(new D.Paragraph({ children: [] }));
      }
    }
    await flush();
  }

  async function list(listEl, ctx, out, level) {
    const isOl = listEl.tagName === 'OL', isCheck = listEl.classList.contains('checklist');
    const ref = isOl ? newOrdered(parseInt(listEl.getAttribute('start')) || 1) : 'bullets';
    for (const li of Array.from(listEl.children)) {
      if (li.tagName !== 'LI') continue;
      let kids = [], first = true;
      const emit = () => {
        const props = paraProps(li, {});
        if (isCheck) {
          props.indent = { left: 720 * (level + 1), hanging: 360 };
          if (first) kids.unshift(new D.TextRun({ text: (li.getAttribute('data-checked') === 'true' ? '\u2611' : '\u2610') + '\t', font: 'Segoe UI Symbol' }));
        } else if (first) props.numbering = { reference: ref, level: Math.min(level, 8) };
        else props.indent = { left: 720 * (level + 1) };
        out.push(new D.Paragraph({ ...props, children: kids })); kids = []; first = false;
      };
      for (const c of Array.from(li.childNodes)) {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) { if (kids.length || first) emit(); await list(c, ctx, out, level + 1); }
        else if (c.nodeType === 1 && /^(P|DIV|H[1-6])$/.test(c.tagName)) { await inline(c, ctx.st, kids); emit(); }
        else { const w = document.createElement('div'); w.appendChild(c.cloneNode(true)); await inline(w, ctx.st, kids); }
      }
      if (kids.length || first) emit();
    }
  }

  async function table(t, ctx) {
    const rows = Array.from(t.rows);
    const first = rows[0]; const total = +t.dataset.w || t.offsetWidth || 1;
    let widths = Array.from(first ? first.cells : []).flatMap(c => Array(c.colSpan || 1).fill((+c.dataset.w || c.offsetWidth || total / first.cells.length) / (c.colSpan || 1)));
    const sum = widths.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map(w => Math.max(200, Math.round(w / sum * contentW)));
    const line = { style: D.BorderStyle.SINGLE, size: 4, color: '000000' };
    const trs = [];
    for (const r of rows) {
      const cells = []; let col = 0;
      for (const c of Array.from(r.cells)) {
        const kids = []; const cctx = { ...ctx, st: { ...ctx.st, ...(c.tagName === 'TH' ? { bold: true } : {}) } };
        if (c.style.textAlign) cctx.pp = paraProps(c, {});
        await blocks(c, cctx, kids); if (!kids.length) kids.push(new D.Paragraph({ children: [] }));
        const span = c.colSpan || 1;
        const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0) || 1000; col += span;
        const bg = hex(c.style.backgroundColor);
        cells.push(new D.TableCell({
          children: kids, columnSpan: span, width: { size: w, type: D.WidthType.DXA },
          shading: bg ? { type: D.ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 }
        }));
      }
      trs.push(new D.TableRow({ children: cells }));
    }
    return new D.Table({
      width: { size: contentW, type: D.WidthType.DXA }, columnWidths: widths,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      rows: trs
    });
  }

  const children = [];
  await blocks(pageEl, { st: {}, pp: null }, children);
  if (!children.length) children.push(new D.Paragraph({ children: [] }));

  const hs = (id, name, size, before, after, color, extra = {}) => ({
    id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { size, color, ...extra }, paragraph: { spacing: { before, after } }
  });
  const doc = new D.Document({
    creator: 'LocalDocs', title,
    numbering: { config: numConfigs },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', quickFormat: true, run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 276 } } },
        hs('Title', 'Title', 52, 0, 60, '000000'), hs('Subtitle', 'Subtitle', 30, 0, 320, '666666'),
        hs('Heading1', 'heading 1', 40, 400, 120, '000000'), hs('Heading2', 'heading 2', 32, 360, 120, '000000'),
        hs('Heading3', 'heading 3', 28, 320, 80, '434343'), hs('Heading4', 'heading 4', 24, 280, 80, '666666'),
        hs('Heading5', 'heading 5', 22, 240, 80, '666666'), hs('Heading6', 'heading 6', 22, 240, 80, '666666', { italics: true })
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: pageW, height: pageH, orientation: ps.orient === 'landscape' ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
          margin: { top: Math.round(ps.mt * TW), bottom: Math.round(ps.mb * TW), left: Math.round(ps.ml * TW), right: Math.round(ps.mr * TW) }
        }
      },
      children
    }]
  });
  return D.Packer.toBlob(doc);
}
