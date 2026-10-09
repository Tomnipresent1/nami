// The album: NAMI's start screen. Each level is a print; tap one to play it.
// Layout and hit-testing are pure maths (tools/selftest.mjs checks them); drawAlbum paints it.
import { VH } from './ocean.js';

export const PRINTS = [
  { id: 'wave', title: 'THE GREAT WAVE', artist: 'HOKUSAI', ready: true },
  { id: 'shower', title: 'SUDDEN SHOWER', artist: 'HIROSHIGE', ready: true },
  { id: 'kamata', title: 'PLUM BLOSSOM', artist: 'HIROSHIGE', ready: true },     // (Hiroshige's "Plum Garden at Kamata"; id kept so saved progress stays)
  { id: 'lamp', title: 'THE LAMPLIGHTER', artist: 'AFTER KIYOCHIKA', ready: true },   // (Meiji Tokyo at night: our own composition; finished at v1.4.32)
  { id: 'river', title: 'THE RIVER', artist: 'HIROSHIGE', ready: true, portrait: true, note: 'UPRIGHT TRIAL' },   // (Kawaguchi ferry; played with the phone upright)
];

const PAPER = '#efe4c6', INK = '#16213b', SEAL = '#b3342b', MUTED = '#4a5470';
const FONT = "Georgia, 'Times New Roman', serif";
const CARD_TOP = 168;
const GAP = 56;

/**
 * Where each print's card sits on a picture W wide (and VH tall). The sideways prints share the top row, each card the screen's
 * own shape; the upright (portrait) prints sit in a second row underneath, in the same columns, upright cards (2:3) with their
 * words beside them (Tom, v1.5.2: room for about four there).
 */
export function albumLayout(W) {
  const n = PRINTS.filter((p) => !p.portrait).length;
  const w = Math.min(440, (W - 140 - GAP * (n - 1)) / n), h = (w * VH) / W;
  const x0 = (W - (n * w + (n - 1) * GAP)) / 2;
  const row2 = CARD_TOP + h + 112, pw = Math.min((Math.min(150, VH - 50 - row2) * 2) / 3, (w + GAP) * 0.45), ph = pw * 1.5;
  let a = 0, b = 0;
  return PRINTS.map((p) => {
    if (!p.portrait) return { x: x0 + a++ * (w + GAP), y: CARD_TOP, w, h };
    const x = x0 + b++ * (w + GAP);
    return { x, y: row2, w: pw, h: ph, portrait: true, lx: x + pw + 18, lw: w + GAP - pw - 18 - 22 };
  });
}

/** Which card (index) is at picture point x,y; -1 for none. The card's words (under it, or beside an upright one) count too. */
export function cardAt(x, y, W) {
  return albumLayout(W).findIndex((c) => c.portrait
    ? x >= c.x - 10 && x <= c.lx + c.lw && y >= c.y - 10 && y <= c.y + c.h + 10
    : x >= c.x - 10 && x <= c.x + c.w + 10 && y >= c.y - 10 && y <= c.y + c.h + 110);
}
/** What the line under a card says. info: { inProgress, ink, best, done } */
export function cardStatus(print, info = {}) {
  if (!print.ready) return 'STILL BEING CARVED';
  if (info.inProgress) return 'IN PROGRESS - INK ' + Math.floor(info.ink || 0) + '%';
  if (info.done > 0) return info.done === 1 ? 'COMPLETED' : 'COMPLETED x' + info.done;
  if (info.best > 0) return 'BEST INK ' + Math.floor(info.best) + '%';
  return 'NOT YET PRINTED';
}

/** Paint the album. ctx is already scaled so one unit = one picture unit. o: { W, thumbs: {id: canvas}, info: {id: {...}}, sel, time, note } */
export function drawAlbum(ctx, o) {
  const { W, time = 0 } = o;
  const text = (str, x, y, size, color = INK, weight = '') => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = size > 40 ? '8px' : '2px';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };

  text('NAMI', W / 2, 74, 64, INK, 'bold');
  text('CHOOSE A PRINT', W / 2, 124, 17, MUTED);

  albumLayout(W).forEach((c, i) => {
    const p = PRINTS[i], info = (o.info && o.info[p.id]) || {};
    // a soft shadow and a thin mount, like a print laid on the table
    ctx.fillStyle = 'rgba(60,40,10,0.18)'; ctx.fillRect(c.x + 5, c.y + 6, c.w, c.h);
    ctx.fillStyle = '#f7efd9'; ctx.fillRect(c.x - 7, c.y - 7, c.w + 14, c.h + 14);
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    const th = o.thumbs && o.thumbs[p.id];
    if (th) ctx.drawImage(th, c.x, c.y, c.w, c.h);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.globalAlpha = o.sel === i ? 0.9 : 0.45; ctx.lineWidth = o.sel === i ? 3 : 1.5;
    ctx.strokeRect(c.x - 7, c.y - 7, c.w + 14, c.h + 14); ctx.globalAlpha = 1;
    if (info.done > 0) seal(ctx, c.x + c.w - 22, c.y + c.h - 22, 0.6);

    if (c.portrait) {      // an upright print: its words beside it, left-aligned, shrunk to fit the column
      const side = (str, y, size, color, weight = '') => {
        ctx.font = `${weight} ${size}px ${FONT}`;
        const wid = ctx.measureText(str).width + str.length * 2;
        if (wid > c.lw) size = Math.max(9, size * c.lw / wid);
        ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillStyle = color; ctx.fillText(str, c.lx, y);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      };
      side(p.title, c.y + 34, 17, p.ready ? INK : MUTED, 'bold');
      side(p.artist, c.y + 60, 13, MUTED);
      side(cardStatus(p, info), c.y + 86, 13, p.ready ? INK : MUTED);
      if (p.note) side(p.note, c.y + 110, 12, '#a8452f', 'italic');
      return;
    }
    const cx = c.x + c.w / 2;
    text(p.title, cx, c.y + c.h + 36, Math.min(22, c.w / 12), p.ready ? INK : MUTED, 'bold');      // (smaller on narrow cards)
    text(p.artist, cx, c.y + c.h + 62, 13, MUTED);
    text(cardStatus(p, info), cx, c.y + c.h + 88, Math.min(14, c.w / 15), p.ready ? INK : MUTED);
    if (p.note) text(p.note, cx, c.y + c.h + 110, Math.min(12, c.w / 17), '#a8452f', 'italic');      // a little label under the card
  });

  if (o.note && o.note.t > 0) { ctx.globalAlpha = Math.min(1, o.note.t / 0.6); text(o.note.text, W / 2, 576, 20, INK, 'italic'); ctx.globalAlpha = 1; }
  else if ((time * 1.4 | 0) % 2 === 0) text(o.touch ? 'TAP A PRINT' : 'CHOOSE WITH THE ARROWS, THEN PRESS ENTER', W / 2, 576, 15, INK);
  ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.fillText('v' + o.build, 18, VH - 18);
}

function seal(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); ctx.scale(s, s);
  ctx.fillStyle = SEAL; ctx.fillRect(-26, -26, 52, 52);
  ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.strokeRect(-20, -20, 40, 40);
  ctx.restore();
}
