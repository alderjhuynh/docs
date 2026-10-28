'use strict';

function insertImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth; const max = page.clientWidth - parseFloat(getComputedStyle(page).paddingLeft) - parseFloat(getComputedStyle(page).paddingRight);
      if (w > max) w = max;
      restoreSelIfNeeded();
      document.execCommand('insertHTML', false, `<img src="${r.result}" style="width:${Math.round(w)}px">`); markDirty();
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}
let selImg = null, resizing = null;
function selectImg(img) {
  deselectImg(); selImg = img; img.classList.add('sel'); positionImgBox();
}
function deselectImg() { if (selImg) selImg.classList.remove('sel'); selImg = null; $('#imgBox').hidden = true; }
function positionImgBox() {
  const box = $('#imgBox'); if (!selImg || !selImg.isConnected) { box.hidden = true; return; }
  const r = selImg.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  box.hidden = false;
  Object.assign(box.style, { left: (r.left - c.left + canvas.scrollLeft - 2) + 'px', top: (r.top - c.top + canvas.scrollTop - 2) + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
}
if (!$('#imgBox').parentElement.isSameNode(canvas)) canvas.append($('#imgBox'));
page.addEventListener('click', e => { if (e.target.tagName === 'IMG') selectImg(e.target); else deselectImg(); });
canvas.addEventListener('scroll', positionImgBox);
$('#imgBox .h').addEventListener('mousedown', e => {
  e.preventDefault(); if (!selImg) return;
  resizing = { x: e.clientX, w: selImg.getBoundingClientRect().width / state.zoom, ratio: selImg.naturalHeight / selImg.naturalWidth };
});
document.addEventListener('mousemove', e => {
  if (!resizing) return;
  const w = Math.max(20, resizing.w + (e.clientX - resizing.x) / state.zoom);
  selImg.style.width = Math.round(w) + 'px'; selImg.style.height = ''; positionImgBox();
});
document.addEventListener('mouseup', () => { if (resizing) { resizing = null; markDirty(); } });
