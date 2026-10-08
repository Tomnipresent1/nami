// THE LAMPLIGHTER's painting (v1.4.2): close and flat-on, like Moronobu's teahouse (research 16), in Kiyochika's night colours
// (research 12). A strip of dim grey-olive sky (a little brighter low down; it never changes) with a five-storey pagoda rising
// behind the roofs, as at Asakusa; three two-storey house fronts; their ground floors an inset ARCADE: posts along its front,
// red paper lanterns hanging from its eaves, shops with noren set back in its shadow. He walks the street just outside.
// Each lantern he lights glows red-orange and warms the arcade, the shops and the windows around it.
// Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { HOUSES, EAVE_Y, LANTERN_Y, ARCADE_Y, SILL_Y, WALK_Y, figScaleAt, lanternX, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#5a5b52';           // (Tom: the sky still a bit bright low down; it never changes)
const FAR = '#272c28', PAGODA = '#191c1c';
const ROOF = '#23272c', ROOF_LINE = '#15181b';
const WOOD = '#25211d', WOOD_DARK = '#171512', POST = '#1b1815';
const SHOJI = ['#2e2f2b', '#f0c98a'];                     // a paper window: dark, and lit from below by the lanterns
const SHOP = ['#141210', '#d39a5a'];                      // the shop behind the noren, deep in the arcade
const NOREN = [['#1c2438', '#4a6696'], ['#3f1f1a', '#c4482f'], ['#3b3222', '#b99a52']];   // indigo, red, ochre: [dark, lit]
const ARCADE = ['#1a1916', '#5a4430'];                    // the arcade's floor and shadows
const GROUND = ['#34332e', '#24231f'];                    // the street, near the arcade and at the front
const SIL = '#17181b';                                    // people in the dark: silhouettes, as in Kiyochika
const ROBES = ['#3b4458', '#5a4a3a', '#3a4a3f', '#55404a', '#4a4a4a'];
const SKIN = '#d9b38c';
const COAT = '#2f4373';                                   // the lamplighter's happi coat: indigo, with a pale collar
const FIG = 3.0;                                          // how big the people are drawn (close camera)
const WARM_R = 105;                                       // how far a lantern's light reaches across the fronts
const LR = [12, 16];                                      // a lantern's half-width and half-height

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
  /** How warmly lit the fronts are at x (0..1), from the nearest lit lanterns. */
  const warmAt = (x) => {
    let w = 0;
    for (const l of lights) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-(((x - l.x) / WARM_R) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);

  // ---------- sky and the pagoda (they never change) ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.5, '#3a3c37'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 160);
    ctx.strokeStyle = '#6a6b62'; ctx.lineWidth = 1; ctx.globalAlpha = 0.1;
    for (let i = 0; i < 8; i++) {
      const y = 18 + ((i * 29) % 70), x = ((i * 337) % (W + 200)) - 100, len = 120 + ((i * 71) % 200);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawPagoda() {
    // a five-storey pagoda as at Asakusa (Kiyochika, research 12): broad tiers with upswept eaves, a tall spire with rings
    const px = W * 0.3, base = 150;
    ctx.fillStyle = PAGODA;
    for (let i = 0; i < 5; i++) {
      const y = base - i * 27, w = 60 - i * 6.5, bw = w * 0.5;
      ctx.fillRect(px - bw / 2, y - 14, bw, 14);                                                  // the storey's body
      ctx.beginPath(); ctx.moveTo(px - w - 6, y - 19); ctx.quadraticCurveTo(px - w * 0.5, y - 13, px - bw * 0.5, y - 25);    // its roof, the
      ctx.lineTo(px + bw * 0.5, y - 25); ctx.quadraticCurveTo(px + w * 0.5, y - 13, px + w + 6, y - 19);                 // corners swept up
      ctx.lineTo(px + w - 4, y - 14); ctx.lineTo(px - w + 4, y - 14); ctx.closePath(); ctx.fill();
    }
    const top = base - 5 * 27 - 22;
    ctx.fillRect(px - 2, top - 34, 4, 40);                                                        // the spire
    for (let k = 0; k < 6; k++) ctx.fillRect(px - 6 + k * 0.4, top - 30 + k * 5, 12 - k * 0.8, 2);   // its rings
    // trees behind the roofs, as in the print
    ctx.fillStyle = FAR;
    ctx.beginPath(); ctx.moveTo(0, 160);
    for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, 132 + 9 * Math.sin(x * 0.019 + 2) + 6 * Math.sin(x * 0.061) + 3 * Math.sin(x * 0.17));
    ctx.lineTo(W, 160); ctx.closePath(); ctx.fill();
  }

  // ---------- the house fronts ----------
  function drawHouses() {
    const tiles = [];
    HOUSES.forEach((h, hi) => {
      const x0 = h.u0 * W, x1 = h.u1 * W, w = x1 - x0, ridge = [126, 118, 130][hi], eaveU = ridge + 30;
      // the upper roof
      ctx.fillStyle = ROOF;
      ctx.beginPath(); ctx.moveTo(x0 + 2, ridge); ctx.lineTo(x1 - 2, ridge); ctx.lineTo(x1 + 8, eaveU); ctx.lineTo(x0 - 8, eaveU); ctx.closePath(); ctx.fill();
      for (let x = x0 + 4; x < x1; x += 9) tiles.push([x, ridge + 3, x + (x - (x0 + x1) / 2) * 0.05, eaveU - 2]);
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 - 8, eaveU - 4, w + 16, 5); ctx.fillRect(x0, ridge - 4, w, 5);
      // the upper storey: paper windows (a fine lattice on the middle house), lit softly from the lanterns below
      ctx.fillStyle = WOOD; ctx.fillRect(x0, eaveU, w, 234 - eaveU);
      const n = Math.max(4, Math.round(w / 46)), pw = (w - 24) / n, top = eaveU + 8, bot = 214;
      for (let i = 0; i < n; i++) {
        const px = x0 + 12 + i * pw, wm = warmAt(px + pw / 2) * 0.7;
        ctx.fillStyle = lit(SHOJI, wm); ctx.fillRect(px + 2, top, pw - 4, bot - top);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1.2; ctx.beginPath();
        if (hi === 1) for (let x = px + 6; x < px + pw - 3; x += 5) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
        else { for (let y = top + 12; y < bot; y += 12) { ctx.moveTo(px + 2, y); ctx.lineTo(px + pw - 2, y); } ctx.moveTo(px + pw / 2, top); ctx.lineTo(px + pw / 2, bot); }
        ctx.stroke();
      }
      // the balcony rail
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 + 4, 208, w - 8, 4); ctx.fillRect(x0 + 4, 224, w - 8, 4);
      for (let x = x0 + 10; x < x1 - 6; x += 12) ctx.fillRect(x, 210, 3, 16);
      // the arcade's roof, its fascia beam along the front (the lanterns hang from it)
      ctx.fillStyle = ROOF;
      ctx.beginPath(); ctx.moveTo(x0, 234); ctx.lineTo(x1, 234); ctx.lineTo(x1 + 6, EAVE_Y - 4); ctx.lineTo(x0 - 6, EAVE_Y - 4); ctx.closePath(); ctx.fill();
      for (let x = x0 + 4; x < x1; x += 9) tiles.push([x, 236, x + (x - (x0 + x1) / 2) * 0.02, EAVE_Y - 5]);
      // inside the arcade: deep shadow, the shops set back with their noren, warmed by the lanterns
      const inTop = EAVE_Y + 4;
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0, inTop, w, SILL_Y - inTop);
      const shops = 2, sw = (w - 30) / shops;
      for (let k = 0; k < shops; k++) {
        const sx = x0 + 15 + k * sw, cx = sx + sw / 2, wm = warmAt(cx);
        ctx.fillStyle = lit(SHOP, wm * 0.8); ctx.fillRect(sx + 10, inTop + 18, sw - 20, ARCADE_Y - 8 - inTop - 18);
        // lattice either side of the doorway
        ctx.strokeStyle = POST; ctx.lineWidth = 2; ctx.beginPath();
        for (let x = sx + 12; x < sx + sw * 0.22; x += 6) { ctx.moveTo(x, inTop + 18); ctx.lineTo(x, ARCADE_Y - 8); }
        for (let x = sx + sw * 0.78; x < sx + sw - 10; x += 6) { ctx.moveTo(x, inTop + 18); ctx.lineTo(x, ARCADE_Y - 8); }
        ctx.stroke();
        // the noren across the doorway, in three panels
        const nc = NOREN[(hi + k) % 3], nx = sx + sw * 0.24, nw = sw * 0.52, pnl = (nw - 6) / 3;
        ctx.fillStyle = lit(nc, wm * 0.9);
        for (let i = 0; i < 3; i++) ctx.fillRect(nx + i * (pnl + 3), inTop + 18, pnl, 58);
        ctx.fillStyle = POST; ctx.fillRect(nx - 4, inTop + 15, nw + 8, 4);                       // the noren's rod
        // a hanging signboard
        if (k === 0) { const bx = sx + sw * 0.06, sg = warmAt(bx); ctx.fillStyle = mixHex('#4a4740', '#e8dcb8', sg * 0.9); ctx.fillRect(bx, inTop + 26, 16, 64);
          ctx.fillStyle = WOOD_DARK; for (let j = 0; j < 5; j++) ctx.fillRect(bx + 4 + ((j * 3) % 5), inTop + 32 + j * 11, 7, 6); }
      }
      // the arcade's floor, and the stone sill along its front
      ctx.fillStyle = lit(ARCADE, warmAt(x0 + w / 2) * 0.5); ctx.fillRect(x0, ARCADE_Y - 8, w, SILL_Y - ARCADE_Y + 8);
      ctx.fillStyle = '#3d3a33'; ctx.fillRect(x0, SILL_Y - 6, w, 8);
    });
    ctx.strokeStyle = ROOF_LINE; ctx.lineWidth = 1.3; ctx.beginPath();
    for (const [a, b, c, d] of tiles) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke();
    // shadow under the arcade's roof
    const sh = ctx.createLinearGradient(0, EAVE_Y, 0, EAVE_Y + 40);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, EAVE_Y, W, 40);
  }
  /** The arcade's posts and fascia beam: drawn in front of the people walking inside it. */
  function drawPosts() {
    ctx.fillStyle = POST;
    for (const h of HOUSES) {
      const x0 = h.u0 * W, w = (h.u1 - h.u0) * W;
      for (const f of [0, 0.25, 0.75]) { const x = x0 + w * f; ctx.fillRect(x - 5, EAVE_Y - 4, 10, SILL_Y - EAVE_Y + 2); ctx.fillRect(x - 8, SILL_Y - 6, 16, 6); }
    }
    ctx.fillRect(W - 5, EAVE_Y - 4, 10, SILL_Y - EAVE_Y + 2);
    ctx.fillStyle = WOOD_DARK; ctx.fillRect(0, EAVE_Y - 8, W, 10);                                 // the fascia beam
  }

  // ---------- the street ----------
  function drawStreet() {
    const g = ctx.createLinearGradient(0, SILL_Y, 0, VH);
    g.addColorStop(0, GROUND[0]); g.addColorStop(1, GROUND[1]);
    ctx.fillStyle = g; ctx.fillRect(0, SILL_Y, W, VH - SILL_Y);
    ctx.strokeStyle = '#1e1d1a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4; ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const y = SILL_Y + 12 + ((i * 37) % (VH - SILL_Y - 20)), x = ((i * 263) % (W + 100)) - 50, len = 50 + ((i * 37) % 140);
      ctx.moveTo(x, y); ctx.lineTo(x + len, y + 1);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---------- lanterns ----------
  function drawLanterns(sim, time) {
    for (const l of sim.lanterns) {
      const x = lanternX(l, W), y = LANTERN_Y + Math.sin(time * 0.9 + l.u * 40) * 0.8, g = l.glow;
      ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, EAVE_Y + 2); ctx.lineTo(x, y - LR[1]); ctx.stroke();
      if (g > 0.01) {
        const grd = ctx.createRadialGradient(x, y - 2, 1, x, y, LR[1]);
        grd.addColorStop(0, mixHex('#4a2420', '#ffe0a8', g)); grd.addColorStop(0.55, mixHex('#3a1d1a', '#f06a3a', g)); grd.addColorStop(1, mixHex('#3a1d1a', '#c8331f', g));
        ctx.fillStyle = grd;
      } else ctx.fillStyle = '#3a1d1a';
      ctx.beginPath(); ctx.ellipse(x, y, LR[0], LR[1], 0, 0, Math.PI * 2); ctx.fill();
      // the paper's ribs, and the black rims top and bottom
      ctx.strokeStyle = 'rgba(20,10,8,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let k = -2; k <= 2; k++) { const yy = y + k * LR[1] * 0.33, ww = LR[0] * Math.sqrt(1 - (k * 0.33) ** 2); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); }
      ctx.stroke();
      ctx.fillStyle = POST; ctx.fillRect(x - 7, y - LR[1] - 2, 14, 4); ctx.fillRect(x - 7, y + LR[1] - 2, 14, 4);
    }
  }
  /** Warm light added on top: halos round the lit lanterns, a wash over the arcade, a pool on the street. */
  function drawGlow(sim) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of sim.lanterns) {
      if (l.glow <= 0.01) continue;
      const x = lanternX(l, W), a = l.glow;
      let g = ctx.createRadialGradient(x, 380, 6, x, 380, 170);
      g.addColorStop(0, `rgba(255,150,80,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 170, 210, 340, 340);
      ctx.save(); ctx.translate(x, WALK_Y - 10); ctx.scale(1, 0.28);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 140);
      g.addColorStop(0, `rgba(255,160,90,${0.22 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      g = ctx.createRadialGradient(x, LANTERN_Y, 4, x, LANTERN_Y, 58);
      g.addColorStop(0, `rgba(255,190,120,${0.5 * a})`); g.addColorStop(0.4, `rgba(255,110,60,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, LANTERN_Y, 58, 0, Math.PI * 2); ctx.fill();
    }
    for (const w of sim.walkers) {
      if (!w.lanternAt) continue;
      const [x, y, s] = w.lanternAt, g = ctx.createRadialGradient(x, y, 1, x, y, 34 * s);
      g.addColorStop(0, 'rgba(255,120,70,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34 * s, 0, Math.PI * 2); ctx.fill();
    }
    if (sim.flameAt) {
      const [x, y, s] = sim.flameAt, g = ctx.createRadialGradient(x, y, 1, x, y, 30 * s);
      g.addColorStop(0, `rgba(255,220,150,${0.7 * s})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- people ----------
  /** A person, feet at x, y. o: { face, step, bow, still, body, head, legs, collar, sash, band, knot } */
  function drawBody(x, y, sz, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz);
    const f = o.face, stride = Math.sin(o.step * Math.PI * 2) * (o.still ? 0 : 4.5);
    ctx.fillStyle = 'rgba(8,8,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 10, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.legs || SIL; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + stride, 0); ctx.moveTo(2, -10); ctx.lineTo(2 - stride, 0); ctx.stroke();
    ctx.translate(0, -9); ctx.rotate(f * (0.05 + o.bow * 0.5));
    ctx.fillStyle = o.body; ctx.beginPath(); ctx.moveTo(-6.5, 1); ctx.lineTo(6.5, 1); ctx.lineTo(5.2, -23); ctx.lineTo(-5.2, -23); ctx.closePath(); ctx.fill();
    if (o.collar) { ctx.strokeStyle = o.collar; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3.5, -23); ctx.lineTo(1, -10); ctx.moveTo(3.5, -23); ctx.lineTo(1, -10); ctx.stroke(); }
    if (o.sash) { ctx.strokeStyle = o.sash; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-5.8, -9); ctx.lineTo(5.8, -9); ctx.stroke(); }
    ctx.fillStyle = o.head; ctx.beginPath(); ctx.arc(f * 1.4, -27, 3.9, 0, Math.PI * 2); ctx.fill();
    if (o.band) { ctx.strokeStyle = o.band; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f * 1.4 - 4, -28.5); ctx.lineTo(f * 1.4 + 4, -28.5); ctx.stroke(); }
    if (o.knot) { ctx.fillStyle = o.knot; ctx.fillRect(f * 1.4 - 1.2 - f * 2, -33.5, 2.6, 3.4); }
    ctx.restore();
  }
  function drawWalker(w) {
    const sc = figScaleAt(w.y), sz = sc * FIG, inside = w.lane === 'arcade', wm = clamp(warmAt(w.x) * (inside ? 1 : 0.6), 0, 1);
    const body = mixHex(SIL, ROBES[w.robe], wm * 0.85), head = mixHex('#1f1e1f', SKIN, wm * 0.8), bow = Math.sin(w.nod * Math.PI) * 0.35;
    w.lanternAt = null;
    if (w.kind === 'rickshaw') {
      const d = w.dir, cx = w.x - d * 36 * sc, wr = 26 * sc;
      ctx.strokeStyle = SIL; ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.moveTo(w.x + d * 8 * sc, w.y - 46 * sc); ctx.lineTo(cx, w.y - 40 * sc); ctx.stroke();                 // the shafts
      ctx.fillStyle = mixHex(SIL, '#3a3330', wm);
      ctx.beginPath(); ctx.moveTo(cx - 26 * sc, w.y - 36 * sc); ctx.lineTo(cx + 22 * sc, w.y - 36 * sc); ctx.lineTo(cx - d * 14 * sc, w.y - 98 * sc);
      ctx.quadraticCurveTo(cx - d * 44 * sc, w.y - 100 * sc, cx - d * 34 * sc, w.y - 38 * sc); ctx.closePath(); ctx.fill();          // the seat and hood
      ctx.fillStyle = head; ctx.beginPath(); ctx.arc(cx - d * 6 * sc, w.y - 70 * sc, 6.5 * sc, 0, Math.PI * 2); ctx.fill();         // the passenger
      ctx.strokeStyle = '#111113'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.arc(cx, w.y - wr, wr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2 * sc; ctx.beginPath();
      const turn = (w.x / wr) * d;
      for (let k = 0; k < 6; k++) { const a = turn + (k * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, w.y - wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, w.y - wr + Math.sin(a) * wr); }
      ctx.stroke();
      const lx = cx + d * 20 * sc, ly = w.y - 48 * sc;
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(lx, ly, 6 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill();
      w.lanternAt = [lx, ly, sc * 1.4];
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(d * 0.22); ctx.translate(-w.x, -w.y);
      drawBody(w.x, w.y, sz, { face: d, step: w.step, bow: 0, body, head });
      ctx.restore();
      return;
    }
    const bodies = w.kind === 'pair' ? [-9 * sz / FIG * 1.6, 9 * sz / FIG * 1.6] : [0];
    for (const bx of bodies) drawBody(w.x + bx, w.y, sz, { face: w.dir, step: w.step + bx * 0.01, bow, body, head, knot: SIL });
    if (w.kind === 'lantern') {
      // a red paper lantern carried low on a short stick, swinging a little
      const hx = w.x + w.dir * 7 * sz, hy = w.y - 22 * sz, lx = hx + w.dir * 5 * sz + w.swing * 1.5 * sz, ly = w.y - 12 * sz;
      ctx.strokeStyle = SIL; ctx.lineWidth = 1 * sz; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly - 5 * sz); ctx.stroke();
      ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.ellipse(lx, ly, 4.2 * sz, 5.6 * sz, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1512'; ctx.fillRect(lx - 3 * sz, ly - 6.2 * sz, 6 * sz, 1.4 * sz); ctx.fillRect(lx - 3 * sz, ly + 4.8 * sz, 6 * sz, 1.4 * sz);
      w.lanternAt = [lx, ly, sz / FIG];
    }
  }
  function drawPlayer(sim, time) {
    const p = sim.player, sz = FIG, wm = clamp(warmAt(p.x), 0, 1), x = p.x, y = WALK_Y;
    ctx.save(); ctx.globalAlpha = p.fade;
    drawBody(x, y, sz, { face: p.face, step: p.step, bow: Math.sin(p.nod * Math.PI) * 0.3, still: Math.abs(p.vx) < 3 && p.lightT <= 0,
      body: mixHex(COAT, '#4d66a8', wm * 0.6), legs: '#151518', head: mixHex('#a88a6a', SKIN, 0.4 + wm * 0.6), collar: '#d8c9a0', band: '#e8e0cc', sash: '#d8c9a0' });
    // his arm, and the pole with its small flame: carried slanting up ahead of him; to light a lantern he lifts his arm and
    // raises the pole until the flame is just under it
    const shoulder = [x + p.face * 2 * sz, y - 29 * sz], hand = [x + p.face * 7 * sz, y - (20 + 16 * p.raise) * sz];
    ctx.strokeStyle = mixHex(COAT, '#4d66a8', wm * 0.6); ctx.lineWidth = 2.6 * sz; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    const len = 92, carry = p.face > 0 ? -0.9 : Math.PI + 0.9;                                    // about 50 degrees up
    let ang = carry, L = len;
    if (p.lantern >= 0 && p.raise > 0) {
      const l = sim.lanterns[p.lantern], tx = lanternX(l, W), ty = LANTERN_Y + LR[1] + 6;
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
    drawPagoda();
    drawHouses();
    drawStreet();
    for (const w of sim.walkers) if (w.lane === 'arcade') drawWalker(w);       // inside the arcade, behind its posts
    drawPosts();
    drawLanterns(sim, time);
    sim.flameAt = null;
    if (sim.state !== 'title') drawPlayer(sim, time);
    for (const w of sim.walkers) if (w.lane === 'street') drawWalker(w);       // along the street, in front of him
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
