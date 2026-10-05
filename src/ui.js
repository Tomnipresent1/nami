// Things every print's screen shares: the palette, lettering, paper grain, the red seal, the ink bar and the pause menu.
// (The Great Wave's art.js still has its own older copies of these; new prints use this file.)
import { VH, clamp, smooth } from './ocean.js';
import { PAUSE_Y0, PAUSE_DY, SENS_OPTS, SENS_DEG } from './sim.js';

export const PAPER = '#efe4c6', INK = '#16213b', SEAL = '#b3342b', MUTED = '#4a5470';
export const FONT = "Georgia, 'Times New Roman', serif";

export const mixHex = (a, b, t) => {
  t = clamp(t, 0, 1);
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
};
/** A colour that inks in: layer = [colour on bare paper, final colour, ink where it starts, ink where it is done]. */
export const inked = (layer, ink) => mixHex(layer[0], layer[1], smooth((ink - layer[2]) / (layer[3] - layer[2])));

function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 150 + Math.random() * 105, fibre = Math.random() < 0.02 ? 40 : 0;
    d.data[i] = v - fibre; d.data[i + 1] = v - fibre * 0.8; d.data[i + 2] = v - 20 - fibre; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function createUI(canvas) {
  const ctx = canvas.getContext('2d');
  const grainPattern = ctx.createPattern(makeGrain(), 'repeat');

  function text(str, x, y, size, color = INK, align = 'center', weight = '') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = size > 40 ? '8px' : '2px';
    ctx.fillStyle = PAPER; ctx.globalAlpha = 0.85; ctx.strokeStyle = PAPER; ctx.lineWidth = size > 30 ? 7 : 4; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  /** Paper grain over everything + a warm vignette. */
  function paperGrain(W) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = grainPattern;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    ctx.restore();
    const g = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.45, W / 2, VH / 2, W * 0.62);
    g.addColorStop(0, 'rgba(120,80,30,0)'); g.addColorStop(1, 'rgba(120,80,30,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VH);
  }
  function seal(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); ctx.scale(s, s);
    ctx.fillStyle = SEAL; ctx.fillRect(-26, -26, 52, 52);
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.strokeRect(-20, -20, 40, 40);
    ctx.beginPath(); ctx.moveTo(-12, 8); ctx.quadraticCurveTo(-8, -14, 2, -4); ctx.quadraticCurveTo(10, -14, 14, 4); ctx.moveTo(-12, 14); ctx.quadraticCurveTo(0, 6, 14, 14);
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function inkBar(ink01) {
    ctx.fillStyle = 'rgba(22,33,59,0.18)'; roundRect(24, 22, 170, 10, 5); ctx.fill();
    ctx.fillStyle = INK; roundRect(24, 22, Math.max(10, 170 * ink01), 10, 5); ctx.fill();
    text('INK', 24, 46, 13, INK, 'left');
  }
  /** The game's message, fading in and out, near the top. */
  function message(m, W, y = 110) {
    if (!m) return;
    const a = Math.min(1, m.t / 0.6, (m.total - m.t) / 0.5);
    ctx.globalAlpha = clamp(a, 0, 1); text(m.text, W / 2, y, 26, INK, 'center', 'italic'); ctx.globalAlpha = 1;
  }
  /**
   * The pause menu. rows: [id, label, value] (label '' = a single centred action). o: { W, sel, armed, build, footer: [text, colour] }
   * Rows sit at PAUSE_Y0 + i * PAUSE_DY so taps line up with the game's pauseTap.
   */
  function pauseMenu(rows, o) {
    const { W } = o;
    ctx.fillStyle = 'rgba(239,228,198,0.9)'; ctx.fillRect(0, 0, W, VH);
    text('PAUSED', W / 2, 78, 54, INK, 'center');
    rows.forEach(([id, label, value], i) => {
      const y = PAUSE_Y0 + i * PAUSE_DY, sel = o.sel === i;
      if (sel) { ctx.fillStyle = 'rgba(22,33,59,0.1)'; ctx.fillRect(W / 2 - 330, y - 19, 660, 38); }
      if (label === '') text(value, W / 2, y, 22, id === 'restart' && o.armed ? SEAL : INK, 'center', id === 'resume' ? 'bold' : '');
      else { text(label, W / 2 - 310, y, 18, MUTED, 'left'); text('<', W / 2 + 20, y, 20, sel ? INK : '#8a90a0'); text(value, W / 2 + 140, y, 20, INK); text('>', W / 2 + 270, y, 20, sel ? INK : '#8a90a0'); }
    });
    if (o.footer) text(o.footer[0], W / 2, PAUSE_Y0 + rows.length * PAUSE_DY + 12, 16, o.footer[1] || MUTED);
    text('v' + o.build, 18, VH - 18, 12, MUTED, 'left');
  }
  const sensLabel = (i) => SENS_OPTS[i] + ' (' + SENS_DEG[i] + ')';

  return { ctx, text, paperGrain, seal, roundRect, inkBar, message, pauseMenu, sensLabel };
}
