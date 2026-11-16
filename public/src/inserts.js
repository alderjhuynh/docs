'use strict';

function insertHR() { restoreSelIfNeeded(); document.execCommand('insertHTML', false, '<hr><p><br></p>'); markDirty(); }
function insertPageBreak() { restoreSelIfNeeded(); document.execCommand('insertHTML', false, '<hr class="pagebreak"><p><br></p>'); markDirty(); }
function insertDate() { restoreSelIfNeeded(); document.execCommand('insertText', false, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })); markDirty(); }
function specialChars() {
  const chars = '© ® ™ § ¶ † ‡ • … – — ‘ ’ “ ” « » ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ π Ω μ α β γ δ ε θ λ σ φ ← → ↑ ↓ ↔ ⇒ ⇔ ✓ ✗ ★ ☆ ♥ ♦ ♠ ♣ € £ ¥ ¢ ¼ ½ ¾ ² ³ ¹ ‰ ¿ ¡ ç é è ñ ö ü ß æ ø å'.split(' ');
  const g = el('div', { className: 'chars' });
  chars.forEach(c => { const b = el('button', { type: 'button', textContent: c }); b.onclick = () => { $('#dlg').close(); restoreSelIfNeeded(); document.execCommand('insertText', false, c); markDirty(); }; g.append(b); });
  dialog('Special characters', g, [{ label: 'Close' }]);
}
