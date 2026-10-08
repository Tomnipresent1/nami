// THE LAMPLIGHTER's painting (v1.4.3): an OBLIQUE view like Moronobu's teahouse (research 16): the house fronts face you flat,
// and depth runs gently up and to the right (OBLIQUE per unit of depth), so you see the tops of the roofs, the arcade's floor
// running back to the shops, and a sliver of each post's side; nobody shrinks with distance. Kiyochika's night colours
// (research 12): a strip of dim grey-olive sky that never changes, a five-storey pagoda behind the roofs. He walks the street out
// in front; each red lantern he lights glows and warms the arcade, the shops and the windows around it.
// Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { HOUSES, OBLIQUE, EAVE_Y, LANTERN_Y, ARCADE_DEPTH, SILL_Y, WALK_Y, lanternX, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#5a5b52';           // (Tom: the sky still a bit bright low down; it never changes)
const FAR = '#272c28', PAGODA = '#191c1c';
const ROOF = '#2a2e33', ROOF_LINE = '#15171a', ROOF_LIT = '#454a50';            // a roof's top, seen from above
const WOOD = '#25211d', WOOD_DARK = '#171512', POST = '#1b1815', POST_SIDE = '#3a3229';
const SHOJI = ['#2e2f2b', '#f0c98a'];                     // a paper window: dark, and lit softly by the lanterns
const SHOP = ['#141210', '#d39a5a'];                      // the shop behind the noren, at the back of the arcade
const NOREN = [['#1c2438', '#4a6696'], ['#3f1f1a', '#c4482f'], ['#3b3222', '#b99a52']];   // indigo, red, ochre: [dark, lit]
const FLOOR = ['#22201c', '#6a5038'];                     // the arcade's floor
const GROUND = ['#34332e', '#26251f'];                    // the street
const SIL = '#17181b';                                    // people in the dark
// plain working clothes (Tom: work, not leisure): indigo, brown, grey, dull green, ochre-brown, navy, tea, blue-grey
const ROBES = ['#3b4458', '#5a4a3a', '#4a4a46', '#3d4a3c', '#6a5532', '#2f3a4f', '#5b4e45', '#47505a'];
const SKIN = '#d9b38c';
const COAT = ['#6e221c', '#a8382c'];                      // the lamplighter's coat: deep red (Tom), with a pale collar
const FIG = 3.2;                                          // how big people are drawn: the same everywhere (an oblique view)
const LR = [13, 17];                                      // a lantern's half-width and half-height
const ROOF_DEPTH = 70;                                    // the arcade's roof, front edge back to the upper storey
const UPPER_TOP = 104;                                    // the top of the upper storey (on its own front, ROOF_DEPTH back)
const WARM_R = 105;                                       // how far a lantern's light reaches across the fronts

/** A point d units deep behind front-plane point x, y. */
const at = (x, y, d) => [x + d * OBLIQUE[0], y + d * OBLIQUE[1]];
/** Where a house's front starts and ends (the first one runs on past the left edge, so the slant never shows a gap there). */
const span = (h, W) => [h.u0 === 0 ? -70 : h.u0 * W, h.u1 * W];

export function createLampArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  let W = 1300, scale = 1, lastT = 0, btnA = 0;

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;
    W = w; const dpr = pixelRatio();
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }

  // ---------- light ----------
  let lights = [];                         // this frame's lanterns: { x, glow }
  /** How warmly lit things are at x (0..1), from the nearest lit lanterns. */
  const warmAt = (x) => {
    let w = 0;
    for (const l of lights) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-(((x - l.x) / WARM_R) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);
  const quad = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...pts[0]); for (const q of pts.slice(1)) ctx.lineTo(...q); ctx.closePath(); ctx.fill(); };

  // ---------- sky and the pagoda (they never change) ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.5, '#3a3c37'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 130);
    ctx.strokeStyle = '#6a6b62'; ctx.lineWidth = 1; ctx.globalAlpha = 0.1;
    for (let i = 0; i < 6; i++) {
      const y = 14 + ((i * 23) % 50), x = ((i * 337) % (W + 200)) - 100, len = 120 + ((i * 71) % 200);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // a five-storey pagoda as at Asakusa (Kiyochika, research 12): broad tiers with upswept eaves, a tall spire with rings
    const px = W * 0.3, base = 96;
    ctx.fillStyle = PAGODA;
    for (let i = 0; i < 4; i++) {
      const y = base - i * 22, w = 50 - i * 6, bw = w * 0.5;
      ctx.fillRect(px - bw / 2, y - 12, bw, 12);
      ctx.beginPath(); ctx.moveTo(px - w - 5, y - 16); ctx.quadraticCurveTo(px - w * 0.5, y - 11, px - bw * 0.5, y - 21);
      ctx.lineTo(px + bw * 0.5, y - 21); ctx.quadraticCurveTo(px + w * 0.5, y - 11, px + w + 5, y - 16);
      ctx.lineTo(px + w - 3, y - 12); ctx.lineTo(px - w + 3, y - 12); ctx.closePath(); ctx.fill();
    }
    const top = base - 4 * 22 - 16;
    ctx.fillRect(px - 2, top - 26, 4, 32);
    for (let k = 0; k < 5; k++) ctx.fillRect(px - 5 + k * 0.4, top - 22 + k * 5, 10 - k * 0.8, 2);
    ctx.fillStyle = FAR;
    ctx.beginPath(); ctx.moveTo(0, 130);
    for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, 84 + 7 * Math.sin(x * 0.019 + 2) + 5 * Math.sin(x * 0.061) + 3 * Math.sin(x * 0.17));
    ctx.lineTo(W, 130); ctx.closePath(); ctx.fill();
  }

  // ---------- the house fronts, back to front ----------
  /** The back of the arcade: the shop fronts with their noren, and the arcade's floor running forward to the sill. */
  function drawArcadeBack() {
    const D = ARCADE_DEPTH, [dx, dy] = at(0, 0, D);
    HOUSES.forEach((h, hi) => {
      const [x0, x1] = span(h, W), w = x1 - x0, top = EAVE_Y + dy, bot = SILL_Y + dy;
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 + dx, top, w, bot - top);
      const shops = 2, sw = (w - 20) / shops;
      for (let k = 0; k < shops; k++) {
        const sx = x0 + dx + 10 + k * sw, wm = warmAt(sx + sw / 2 - dx * 0.6);
        const t0 = top + 12, b0 = bot - 4;
        ctx.fillStyle = lit(SHOP, wm * 0.8); ctx.fillRect(sx + 8, t0, sw - 16, b0 - t0);
        ctx.strokeStyle = POST; ctx.lineWidth = 2; ctx.beginPath();
        for (let x = sx + 10; x < sx + sw * 0.22; x += 6) { ctx.moveTo(x, t0); ctx.lineTo(x, b0); }
        for (let x = sx + sw * 0.78; x < sx + sw - 8; x += 6) { ctx.moveTo(x, t0); ctx.lineTo(x, b0); }
        ctx.stroke();
        const nc = NOREN[(hi + k) % 3], nx = sx + sw * 0.24, nw = sw * 0.52, pnl = (nw - 6) / 3;
        ctx.fillStyle = lit(nc, wm * 0.9);
        for (let i = 0; i < 3; i++) ctx.fillRect(nx + i * (pnl + 3), t0 + 30, pnl, 62);
        ctx.fillStyle = POST; ctx.fillRect(nx - 4, t0 + 27, nw + 8, 4);
        if (k === 0) { const bx = sx + sw * 0.05, sg = warmAt(bx - dx * 0.6); ctx.fillStyle = mixHex('#4a4740', '#e8dcb8', sg * 0.9); ctx.fillRect(bx, t0 + 34, 15, 64);
          ctx.fillStyle = WOOD_DARK; for (let j = 0; j < 5; j++) ctx.fillRect(bx + 4 + ((j * 3) % 5), t0 + 40 + j * 11, 6, 6); }
      }
      // the floor: a band running from the shop fronts forward to the sill
      quad([[x0, SILL_Y], [x1, SILL_Y], [x1 + dx, bot], [x0 + dx, bot]], lit(FLOOR, warmAt(x0 + w / 2) * 0.5));
      // its stone seams run back into the arcade: the clearest sign of the slant
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let x = x0 + 12; x < x1; x += 26) { ctx.moveTo(x, SILL_Y); ctx.lineTo(x + dx, bot); }
      for (const t of [0.35, 0.7]) { ctx.moveTo(x0 + dx * t, SILL_Y + dy * t); ctx.lineTo(x1 + dx * t, SILL_Y + dy * t); }
      ctx.stroke();
      // the posts along the back
      ctx.fillStyle = POST;
      for (const f of [0, 0.25, 0.75]) ctx.fillRect(x0 + w * f + dx - 3, top, 6, bot - top);
    });
  }
  /** The front of the arcade: its posts (each with a sliver of side showing), the fascia beam, the stone sill. */
  function drawArcadeFront() {
    const [sx, sy] = at(0, 0, 16);
    for (const h of HOUSES) {
      const [x0, x1] = span(h, W), w = x1 - x0;
      ctx.fillStyle = '#3a372f'; ctx.fillRect(x0, SILL_Y, w, 8);                                    // the sill's face
      for (const f of [0, 0.25, 0.75]) {
        const x = x0 + w * f;
        quad([[x + 5, EAVE_Y], [x + 5 + sx, EAVE_Y + sy], [x + 5 + sx, SILL_Y + sy], [x + 5, SILL_Y]], POST_SIDE);
        ctx.fillStyle = POST; ctx.fillRect(x - 5, EAVE_Y, 10, SILL_Y - EAVE_Y + 6);
      }
    }
    ctx.fillStyle = POST; ctx.fillRect(W - 5, EAVE_Y, 10, SILL_Y - EAVE_Y + 6);
    ctx.fillStyle = WOOD_DARK; ctx.fillRect(0, EAVE_Y - 10, W, 11);                               // the fascia beam
  }
  /** Above the arcade: its roof seen from above, the upper storey set back with its paper windows, the top roof. */
  function drawUpper() {
    const [rdx, rdy] = at(0, 0, ROOF_DEPTH), [udx, udy] = at(0, 0, 60), tiles = [];
    HOUSES.forEach((h, hi) => {
      const [x0, x1] = span(h, W), w = x1 - x0;
      // the upper storey's front (ROOF_DEPTH back), with its paper windows and balcony rail
      const fx = x0 + rdx, fy0 = UPPER_TOP, fy1 = EAVE_Y - 10 + rdy;
      ctx.fillStyle = WOOD; ctx.fillRect(fx, fy0, w, fy1 - fy0);
      const n = Math.max(4, Math.round(w / 46)), pw = (w - 20) / n, top = fy0 + 8, bot = fy1 - 12;
      for (let i = 0; i < n; i++) {
        const px = fx + 10 + i * pw, wm = warmAt(px + pw / 2 - rdx) * 0.65;
        ctx.fillStyle = lit(SHOJI, wm); ctx.fillRect(px + 2, top, pw - 4, bot - top);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1.2; ctx.beginPath();
        if (hi === 1) for (let x = px + 6; x < px + pw - 3; x += 5) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
        else { for (let y = top + 11; y < bot; y += 11) { ctx.moveTo(px + 2, y); ctx.lineTo(px + pw - 2, y); } ctx.moveTo(px + pw / 2, top); ctx.lineTo(px + pw / 2, bot); }
        ctx.stroke();
      }
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(fx + 4, bot - 6, w - 8, 3); ctx.fillRect(fx + 4, fy1 - 5, w - 8, 3);
      for (let x = fx + 10; x < fx + w - 6; x += 11) ctx.fillRect(x, bot - 5, 2.5, fy1 - bot);
      // the top roof, from the upper storey's eave running back
      quad([[fx - 6, fy0], [fx + w + 6, fy0], [fx + w + 6 + udx, fy0 + udy], [fx - 6 + udx, fy0 + udy]], ROOF);
      for (let x = fx - 2; x < fx + w + 4; x += 9) tiles.push([x, fy0 - 1, x + udx, fy0 + udy + 1]);
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(fx - 6, fy0 - 3, w + 12, 5);
      // the arcade's roof, seen from above: front edge (the fascia) back to the upper storey
      quad([[x0 - 6, EAVE_Y - 10], [x1 + 6, EAVE_Y - 10], [x1 + 6 + rdx, EAVE_Y - 10 + rdy], [x0 - 6 + rdx, EAVE_Y - 10 + rdy]], ROOF);
      for (let x = x0 - 2; x < x1 + 4; x += 9) tiles.push([x, EAVE_Y - 11, x + rdx, EAVE_Y - 9 + rdy]);
    });
    ctx.strokeStyle = ROOF_LIT; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const [a, b, c, d] of tiles) { ctx.moveTo(a + 3, b); ctx.lineTo(c + 3, d); }
    ctx.stroke();
    ctx.strokeStyle = ROOF_LINE; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const [a, b, c, d] of tiles) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke();
    // the dividing walls between the houses' top roofs, seen side-on
    for (const h of HOUSES.slice(1)) {
      const x = h.u0 * W + rdx;
      quad([[x - 3, UPPER_TOP], [x + 3, UPPER_TOP], [x + 3 + udx, UPPER_TOP + udy], [x - 3 + udx, UPPER_TOP + udy]], WOOD_DARK);
    }
  }

  // ---------- the street ----------
  function drawStreet() {
    const g = ctx.createLinearGradient(0, SILL_Y, 0, VH);
    g.addColorStop(0, GROUND[0]); g.addColorStop(1, GROUND[1]);
    ctx.fillStyle = g; ctx.fillRect(0, SILL_Y + 8, W, VH - SILL_Y - 8);
    ctx.strokeStyle = '#1e1d1a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4; ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const y = SILL_Y + 20 + ((i * 37) % (VH - SILL_Y - 30)), x = ((i * 263) % (W + 100)) - 50, len = 50 + ((i * 37) % 140);
      ctx.moveTo(x, y); ctx.lineTo(x + len, y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---------- lanterns ----------
  function drawLanterns(sim, time) {
    for (const l of sim.lanterns) {
      const x = lanternX(l, W), y = LANTERN_Y + Math.sin(time * 0.9 + l.u * 40) * 0.8, g = l.glow;
      ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, EAVE_Y); ctx.lineTo(x, y - LR[1]); ctx.stroke();
      if (g > 0.01) {
        const grd = ctx.createRadialGradient(x, y - 2, 1, x, y, LR[1]);
        grd.addColorStop(0, mixHex('#4a2420', '#ffe0a8', g)); grd.addColorStop(0.55, mixHex('#3a1d1a', '#f06a3a', g)); grd.addColorStop(1, mixHex('#3a1d1a', '#c8331f', g));
        ctx.fillStyle = grd;
      } else ctx.fillStyle = '#3a1d1a';
      ctx.beginPath(); ctx.ellipse(x, y, LR[0], LR[1], 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,8,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let k = -2; k <= 2; k++) { const yy = y + k * LR[1] * 0.33, ww = LR[0] * Math.sqrt(1 - (k * 0.33) ** 2); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); }
      ctx.stroke();
      ctx.fillStyle = POST; ctx.fillRect(x - 7, y - LR[1] - 2, 14, 4); ctx.fillRect(x - 7, y + LR[1] - 2, 14, 4);
    }
  }
  /** Warm light added on top: halos round the lit lanterns, a wash into the arcade, a pool on the street. */
  function drawGlow(sim) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of sim.lanterns) {
      if (l.glow <= 0.01) continue;
      const x = lanternX(l, W), a = l.glow;
      let g = ctx.createRadialGradient(x + 20, 340, 6, x + 20, 340, 170);
      g.addColorStop(0, `rgba(255,150,80,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 150, 170, 340, 340);
      ctx.save(); ctx.translate(x - 30, SILL_Y + 40); ctx.scale(1, 0.3);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 140);
      g.addColorStop(0, `rgba(255,160,90,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      g = ctx.createRadialGradient(x, LANTERN_Y, 4, x, LANTERN_Y, 60);
      g.addColorStop(0, `rgba(255,190,120,${0.5 * a})`); g.addColorStop(0.4, `rgba(255,110,60,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, LANTERN_Y, 60, 0, Math.PI * 2); ctx.fill();
    }
    for (const w of sim.walkers) {
      if (!w.lanternAt) continue;
      const [x, y] = w.lanternAt, g = ctx.createRadialGradient(x, y, 1, x, y, 36);
      g.addColorStop(0, 'rgba(255,120,70,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill();
    }
    if (sim.flameAt) {
      const [x, y, a] = sim.flameAt, g = ctx.createRadialGradient(x, y, 1, x, y, 32);
      g.addColorStop(0, `rgba(255,220,150,${0.7 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- people ----------
  /** A person, feet at x, y (body units, scaled by FIG). o: { face, step, bow, still, body, head, legs, collar, sash, band, knot,
   *  pattern ('stripe' | 'check'), cloth (a head cloth colour), apron (colour), porter (box colour), bundle (colour) } */
  function drawBody(x, y, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(FIG, FIG);
    const f = o.face, stride = Math.sin(o.step * Math.PI * 2) * (o.still ? 0 : 4.5);
    ctx.fillStyle = 'rgba(8,8,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 10, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.legs || SIL; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + stride, 0); ctx.moveTo(2, -10); ctx.lineTo(2 - stride, 0); ctx.stroke();
    ctx.translate(0, -9); ctx.rotate(f * (0.05 + o.bow * 0.5 + (o.porter ? 0.08 : 0)));
    if (o.bundle) { ctx.fillStyle = o.bundle; ctx.beginPath(); ctx.ellipse(-f * 6, -16, 5.5, 6.5, 0, 0, Math.PI * 2); ctx.fill(); }   // a cloth bundle on the back
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-6.5, 1); ctx.lineTo(6.5, 1); ctx.lineTo(5.2, -23); ctx.lineTo(-5.2, -23); ctx.closePath();
    ctx.fillStyle = o.body; ctx.fill(); ctx.clip();
    if (o.pattern) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let k = -6; k <= 6; k += 2) { ctx.moveTo(k, 1); ctx.lineTo(k * 0.85, -23); }
      if (o.pattern === 'check') for (let k = -21; k <= 0; k += 3) { ctx.moveTo(-7, k); ctx.lineTo(7, k); }
      ctx.stroke();
    }
    if (o.apron) { ctx.fillStyle = o.apron; ctx.fillRect(f > 0 ? 0 : -6.5, -11, 6.5, 12); }
    ctx.restore();
    if (o.collar) { ctx.strokeStyle = o.collar; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3.5, -23); ctx.lineTo(1, -10); ctx.moveTo(3.5, -23); ctx.lineTo(1, -10); ctx.stroke(); }
    if (o.sash) { ctx.strokeStyle = o.sash; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-5.8, -9); ctx.lineTo(5.8, -9); ctx.stroke(); }
    ctx.fillStyle = o.head; ctx.beginPath(); ctx.arc(f * 1.4, -27, 3.9, 0, Math.PI * 2); ctx.fill();
    if (o.cloth) { ctx.fillStyle = o.cloth; ctx.beginPath(); ctx.arc(f * 1.4, -27.6, 4.1, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); }
    if (o.band) { ctx.strokeStyle = o.band; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f * 1.4 - 4, -28.5); ctx.lineTo(f * 1.4 + 4, -28.5); ctx.stroke(); }
    if (o.knot && !o.cloth) { ctx.fillStyle = o.knot; ctx.fillRect(f * 1.4 - 1.2 - f * 2, -33.5, 2.6, 3.4); }
    if (o.porter) {
      // a pole across the shoulder with a box hanging from each end, as in Moronobu's print
      ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-15, -21); ctx.lineTo(15, -22); ctx.stroke();
      ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-13, -21); ctx.lineTo(-13, -9); ctx.moveTo(13, -22); ctx.lineTo(13, -9); ctx.stroke();
      ctx.fillStyle = o.porter; ctx.fillRect(-17, -9, 8, 7); ctx.fillRect(9, -9, 8, 7);
    }
    ctx.restore();
  }
  function drawWalker(w) {
    const wm = clamp(warmAt(w.x) * (w.lane === 'arcade' ? 1 : 0.7), 0, 1), show = 0.3 + 0.7 * wm;     // (a little of their colour shows even in the dark)
    const body = mixHex(SIL, ROBES[w.robe], show), head = mixHex('#2a2522', SKIN, 0.2 + wm * 0.7), bow = Math.sin(w.nod * Math.PI) * 0.35;
    const dim = (c) => mixHex(SIL, c, show);
    w.lanternAt = null;
    if (w.kind === 'rickshaw') {
      const d = w.dir, cx = w.x - d * 40, wr = 28;
      ctx.strokeStyle = SIL; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w.x + d * 8, w.y - 50); ctx.lineTo(cx, w.y - 44); ctx.stroke();
      ctx.fillStyle = dim('#3a3330');
      ctx.beginPath(); ctx.moveTo(cx - 28, w.y - 40); ctx.lineTo(cx + 24, w.y - 40); ctx.lineTo(cx - d * 14, w.y - 106);
      ctx.quadraticCurveTo(cx - d * 48, w.y - 108, cx - d * 36, w.y - 42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = head; ctx.beginPath(); ctx.arc(cx - d * 6, w.y - 76, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111113'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, w.y - wr, wr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath();
      const turn = (w.x / wr) * d;
      for (let k = 0; k < 6; k++) { const a = turn + (k * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, w.y - wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, w.y - wr + Math.sin(a) * wr); }
      ctx.stroke();
      const lx = cx + d * 22, ly = w.y - 52;
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(lx, ly, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      w.lanternAt = [lx, ly];
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(d * 0.22); ctx.translate(-w.x, -w.y);
      drawBody(w.x, w.y, { face: d, step: w.step, bow: 0, body, head, cloth: dim('#8a8a80') });
      ctx.restore();
      return;
    }
    const o = { face: w.dir, step: w.step, bow, body, head, knot: SIL, pattern: w.pattern, cloth: w.cloth ? dim('#9a9a8e') : null, apron: w.apron ? dim('#26304a') : null,
      porter: w.kind === 'porter' ? dim('#6b5a3c') : null, bundle: w.kind === 'bundle' ? dim('#4d5a6a') : null };
    if (w.kind === 'pair') { drawBody(w.x - 16, w.y, o); drawBody(w.x + 16, w.y, { ...o, body: mixHex(SIL, ROBES[(w.robe + 3) % ROBES.length], show), step: w.step + 0.3, pattern: '' }); }
    else drawBody(w.x, w.y, o);
    if (w.kind === 'lantern') {
      // a red paper lantern carried low on a short stick, swinging a little
      const s = FIG, hx = w.x + w.dir * 7 * s, hy = w.y - 22 * s, lx = hx + w.dir * 5 * s + w.swing * 1.5 * s, ly = w.y - 12 * s;
      ctx.strokeStyle = SIL; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly - 5 * s); ctx.stroke();
      ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.ellipse(lx, ly, 4.2 * s, 5.6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1512'; ctx.fillRect(lx - 3 * s, ly - 6.2 * s, 6 * s, 1.4 * s); ctx.fillRect(lx - 3 * s, ly + 4.8 * s, 6 * s, 1.4 * s);
      w.lanternAt = [lx, ly];
    }
  }
  function drawPlayer(sim, time) {
    const p = sim.player, wm = clamp(warmAt(p.x + 40) * 0.8, 0, 1), x = p.x, y = WALK_Y, s = FIG;
    const coat = lit(COAT, 0.25 + wm * 0.6);
    ctx.save(); ctx.globalAlpha = p.fade;
    drawBody(x, y, { face: p.face, step: p.step, bow: Math.sin(p.nod * Math.PI) * 0.3, still: Math.abs(p.vx) < 3 && p.lightT <= 0,
      body: coat, legs: '#151518', head: mixHex('#a88a6a', SKIN, 0.4 + wm * 0.6), collar: '#d8c9a0', band: '#e8e0cc', sash: '#d8c9a0' });
    // his arm, and the pole with its small flame: carried slanting up ahead of him; to light a lantern he lifts his arm and
    // raises the pole until the flame is just under it (up and to the right, in the slanted view)
    const shoulder = [x + p.face * 2 * s, y - 29 * s], hand = [x + p.face * 7 * s, y - (20 + 14 * p.raise) * s];
    ctx.strokeStyle = coat; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    const len = 112, carry = p.face > 0 ? -1.0 : Math.PI + 1.0;                                    // about 57 degrees up
    let ang = carry, L = len;
    if (p.lantern >= 0 && p.raise > 0) {
      const l = sim.lanterns[p.lantern], tx = lanternX(l, W), ty = LANTERN_Y + LR[1] + 7;
      const want = Math.atan2(ty - hand[1], tx - hand[0]), wantL = Math.hypot(tx - hand[0], ty - hand[1]);
      ang = carry + (want - carry) * p.raise; L = len + (wantL - len) * p.raise;
    }
    const bob = Math.sin(p.step * Math.PI * 2) * 2;
    const tip = [hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L + bob * (1 - p.raise)];
    ctx.strokeStyle = '#2a241d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hand[0] - Math.cos(ang) * 22, hand[1] - Math.sin(ang) * 22); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    const fl = 1 + 0.15 * Math.sin(time * 17) + 0.1 * Math.sin(time * 31);
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(tip[0], tip[1] - 4 * fl, 3.4, 6 * fl, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(tip[0], tip[1] - 3, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    sim.flameAt = [tip[0], tip[1] - 3, p.fade];
  }

  // ---------- the heads-up bits ----------
  /** One small red lantern for each, lit as they are lit. */
  function drawCounter(sim) {
    sim.lanterns.forEach((l, i) => {
      const x = 32 + i * 15, y = 34;
      ctx.fillStyle = l.lit ? '#f0703f' : 'rgba(239,228,198,0.12)';
      ctx.strokeStyle = 'rgba(239,228,198,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }
  function flame(x, y, s) {
    ctx.fillStyle = '#e8892f'; ctx.beginPath(); ctx.moveTo(x, y - 22 * s); ctx.quadraticCurveTo(x + 13 * s, y - 2 * s, x, y + 10 * s); ctx.quadraticCurveTo(x - 13 * s, y - 2 * s, x, y - 22 * s); ctx.fill();
    ctx.fillStyle = '#ffe3a0'; ctx.beginPath(); ctx.moveTo(x, y - 10 * s); ctx.quadraticCurveTo(x + 6 * s, y + 1 * s, x, y + 7 * s); ctx.quadraticCurveTo(x - 6 * s, y + 1 * s, x, y - 10 * s); ctx.fill();
  }
  function drawLightButton(sim, dt, time) {
    const show = sim.state === 'play' && !sim.paused && sim.reachable >= 0;
    btnA += ((show ? 1 : 0) - btnA) * Math.min(1, dt * 8);
    if (btnA < 0.02) return;
    const [cx, cy, r] = lightButton(W), pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save(); ctx.globalAlpha = btnA;
    ctx.fillStyle = `rgba(255,214,140,${0.22 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(cx, cy, r + 10 + 6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(239,228,198,0.94)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    flame(cx, cy - 6, 1);
    ui.text('LIGHT', cx, cy + 32, 13, INK, 'center');
    ctx.restore();
  }
  function drawPause(sim) {
    const s = sim.settings;
    const rows = LAMP_PAUSE_ROWS.map((id) => ({
      resume: [id, '', 'RESUME'], album: [id, '', 'BACK TO THE ALBUM'], sound: [id, 'SOUND', s.sound ? 'ON' : 'OFF'],
      restart: [id, '', sim.restartArmed ? 'TAP AGAIN TO START THE PRINT OVER' : 'START THE PRINT OVER'],
    })[id]);
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer: ['HOLD A FINGER TO WALK, LET GO TO STOP', MUTED] });
  }
  function drawComplete(sim) {
    ctx.globalAlpha = clamp(sim.completeT / 2, 0, 1);
    ui.text('THE LAMPLIGHTER', W / 2, 150, 44, INK, 'center', 'bold');
    ui.text('COMPLETE', W / 2, 200, 24, INK, 'center');
    ui.seal(W - 90, VH - 90, 1.6);
    ctx.globalAlpha = 1;
    if (sim.completeT >= DONE_WAIT) ui.choices(DONE_CHOICES, { W, sel: sim.choice, ready: true, alpha: clamp((sim.completeT - DONE_WAIT) / 0.6, 0, 1) });
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const time = now / 1000;
    lights = sim.lanterns.map((l) => ({ x: lanternX(l, W), glow: l.glow }));

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky();
    drawArcadeBack();
    for (const w of sim.walkers) if (w.lane === 'arcade') drawWalker(w);       // inside the arcade, behind its front posts
    drawArcadeFront();
    drawUpper();
    drawLanterns(sim, time);
    drawStreet();
    for (const w of sim.walkers) if (w.lane === 'back') drawWalker(w);         // along the street, between him and the arcade
    sim.flameAt = null;
    if (sim.state !== 'title') drawPlayer(sim, time);
    for (const w of sim.walkers) if (w.lane === 'front') drawWalker(w);        // along the street, in front of him
    drawGlow(sim);
    ui.paperGrain(W);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      drawCounter(sim);
      ui.message(sim.message, W);
      drawLightButton(sim, dt, time);
      if (sim.state === 'complete') drawComplete(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  return { draw, resize };
}
