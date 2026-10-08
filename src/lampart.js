// THE LAMPLIGHTER's painting: a Meiji street at night in Kiyochika's colours (research 12): a dim grey-olive sky that stays a
// little bright above the roofs, a big pine and a far pagoda in silhouette, a row of two-storey wooden house fronts seen flat-on
// (lattice windows, noren curtains, red eave lanterns), and the open street in front. Every lamp he lights pours warm light over
// the street and the fronts around it: their windows glow, the shops behind the noren warm up, the red lanterns come alive.
// Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { STREET_BACK, streetScale, lampX, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#5a5b52';           // (Tom: the sky still a bit bright low down; it never changes)
const FAR = '#272c28', FAR2 = '#1e2320';                  // the pine, the pagoda and the trees behind the roofs
const ROOF = '#23272c', ROOF_LINE = '#15181b';
const WOOD = '#25211d', WOOD_DARK = '#171512';
const SHOJI = ['#2e2f2b', '#f3cf8a'];                     // a paper window: dark, and lit from the lamps
const SHOP = ['#1b1916', '#d9a560'];                      // the shop behind the noren
const NOREN = [['#1c2438', '#4a6696'], ['#3f1f1a', '#c4482f'], ['#3b3222', '#b99a52']];   // indigo, red, ochre: [dark, lit]
const LANTERN = ['#3a1d1a', '#ea4b30'];
const GROUND = ['#363530', '#262521'];                    // the street, at the back and at the front
const SIL = '#17181b';                                    // people in the dark: silhouettes, as in Kiyochika
const ROBES = ['#3b4458', '#5a4a3a', '#3a4a3f', '#55404a', '#4a4a4a'];
const SKIN = '#d9b38c';
const COAT = '#2f4373';                                   // the lamplighter's happi coat: indigo, with a pale collar
const FIG = 1.7;                                          // how big the people are drawn
const LAMP_H = 140;                                       // a lamp post's height (at scale 1)
const WARM_R = 175;                                       // how far a lamp's light reaches across the house fronts

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The row of house fronts across the picture: the same every time for a given width. */
function buildHouses(W) {
  const r = mulberry32(1878), out = [];
  for (let x = -40; x < W + 40;) {
    const w = 150 + r() * 120;
    out.push({ x0: x, w, ridge: 150 + r() * 34, noren: Math.floor(r() * 3), lanterns: r() < 0.6 ? 3 + Math.floor(r() * 4) : 0,
      sign: r() < 0.45, lattice: r() < 0.4, rail: r() < 0.6, seed: r() * 100 });
    x += w;
  }
  return out;
}

export function createLampArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  let W = 1300, scale = 1, lastT = 0, btnA = 0, houses = buildHouses(W), housesW = W;

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;
    W = w; const dpr = pixelRatio();
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }

  // ---------- light ----------
  let lamps = [];                          // this frame's lamps: { x, y, sc, glow, hx, hy }
  /** How warmly lit the house fronts are at x (0..1): the nearest lit lamps, the ones by the fronts the most. */
  const warmFront = (x) => {
    let w = 0;
    for (const l of lamps) if (l.glow > 0) w = Math.max(w, l.glow * (l.y < 450 ? 1 : 0.7) * Math.exp(-(((x - l.x) / WARM_R) ** 2)));
    return w;
  };
  /** How well lit someone standing at x, y is. */
  const warmAt = (x, y) => {
    let w = 0;
    for (const l of lamps) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-(((x - l.x) / 150) ** 2) - (((y - l.y) / 70) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);

  // ---------- sky and far things (they never change) ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.55, '#3d3f3a'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
    // faint streaks of cloud, as brushed in the print
    ctx.strokeStyle = '#6a6b62'; ctx.lineWidth = 1; ctx.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) {
      const y = 40 + ((i * 53) % 130), x = ((i * 337) % (W + 200)) - 100, len = 120 + ((i * 71) % 200);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawFar() {
    // trees behind the roofs: a soft bumpy mass
    ctx.fillStyle = FAR;
    ctx.beginPath(); ctx.moveTo(0, 260);
    for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, 182 + 12 * Math.sin(x * 0.021) + 7 * Math.sin(x * 0.067 + 1) + 4 * Math.sin(x * 0.17));
    ctx.lineTo(W, 260); ctx.closePath(); ctx.fill();
    // a far pagoda (right) and a tall pine (left of centre), as in Kiyochika's Asakusa
    const px = W * 0.84, base = 200;
    ctx.fillStyle = FAR2;
    for (let i = 0; i < 5; i++) {
      const y = base - i * 22, w = 46 - i * 6;
      ctx.beginPath(); ctx.moveTo(px - w, y); ctx.quadraticCurveTo(px, y - 12, px + w, y); ctx.lineTo(px + w * 0.55, y - 6); ctx.lineTo(px - w * 0.55, y - 6); ctx.closePath(); ctx.fill();
      ctx.fillRect(px - w * 0.35, y - 20, w * 0.7, 15);
    }
    ctx.fillRect(px - 1.5, base - 140, 3, 34);                         // the spire
    const tx = W * 0.3;
    ctx.fillStyle = FAR2; ctx.fillRect(tx - 3, 70, 6, 150);
    for (const [dy, w, dx] of [[78, 34, -6], [100, 52, 10], [124, 66, -8], [148, 78, 6], [172, 70, -4]]) {
      ctx.beginPath(); ctx.ellipse(tx + dx, dy, w, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(tx + dx + w * 0.4, dy - 4, w * 0.45, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- the house fronts ----------
  function drawHouses() {
    if (housesW !== W) { houses = buildHouses(W); housesW = W; }
    const tiles = [];
    for (const h of houses) {
      const { x0, w, ridge } = h, x1 = x0 + w, eaveU = ridge + 34;
      // the upper roof, tiles running down it
      ctx.fillStyle = ROOF;
      ctx.beginPath(); ctx.moveTo(x0 - 4, ridge); ctx.lineTo(x1 + 4, ridge); ctx.lineTo(x1 + 12, eaveU); ctx.lineTo(x0 - 12, eaveU); ctx.closePath(); ctx.fill();
      for (let x = x0; x < x1; x += 7) tiles.push([x, ridge + 2, x + (x - (x0 + x1) / 2) * 0.04, eaveU - 1]);
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 - 12, eaveU - 3, w + 24, 4);
      // the upper storey: paper windows (or a fine lattice), lit from the lamps
      ctx.fillStyle = WOOD; ctx.fillRect(x0, eaveU, w, 268 - eaveU);
      const n = Math.max(3, Math.round(w / 34)), pw = (w - 16) / n, top = eaveU + 7, bot = 252;
      for (let i = 0; i < n; i++) {
        const px = x0 + 8 + i * pw, wm = warmFront(px + pw / 2);
        ctx.fillStyle = lit(SHOJI, wm * 0.95); ctx.fillRect(px + 1.5, top, pw - 3, bot - top);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1;
        ctx.beginPath();
        if (h.lattice) for (let x = px + 5; x < px + pw - 2; x += 4) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
        else { for (let y = top + 9; y < bot; y += 9) { ctx.moveTo(px + 1.5, y); ctx.lineTo(px + pw - 1.5, y); } ctx.moveTo(px + pw / 2, top); ctx.lineTo(px + pw / 2, bot); }
        ctx.stroke();
      }
      if (h.rail) {
        ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 + 4, 247, w - 8, 3); ctx.fillRect(x0 + 4, 258, w - 8, 3);
        for (let x = x0 + 8; x < x1 - 4; x += 9) ctx.fillRect(x, 248, 2, 12);
      }
      // the lower pent roof over the shop
      ctx.fillStyle = ROOF;
      ctx.beginPath(); ctx.moveTo(x0 - 4, 266); ctx.lineTo(x1 + 4, 266); ctx.lineTo(x1 + 10, 288); ctx.lineTo(x0 - 10, 288); ctx.closePath(); ctx.fill();
      for (let x = x0; x < x1; x += 7) tiles.push([x, 268, x + (x - (x0 + x1) / 2) * 0.03, 287]);
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 - 10, 286, w + 20, 3);
      // the shop: warm inside behind the noren, a slatted lattice either side
      const sw = w * 0.62, sx = x0 + (w - sw) / 2, shopW = warmFront(x0 + w / 2);
      ctx.fillStyle = WOOD; ctx.fillRect(x0, 289, w, STREET_BACK - 289);
      ctx.fillStyle = lit(SHOP, shopW * 0.85); ctx.fillRect(sx, 289, sw, STREET_BACK - 289);
      ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = x0 + 5; x < sx - 2; x += 5) { ctx.moveTo(x, 292); ctx.lineTo(x, STREET_BACK); }
      for (let x = sx + sw + 4; x < x1 - 2; x += 5) { ctx.moveTo(x, 292); ctx.lineTo(x, STREET_BACK); }
      ctx.stroke();
      const nc = NOREN[h.noren], panels = 3, gap = 3, nw = (sw - gap * (panels - 1)) / panels;
      ctx.fillStyle = lit(nc, shopW * 0.9);
      for (let i = 0; i < panels; i++) ctx.fillRect(sx + i * (nw + gap), 289, nw, 36);
      // a hanging signboard by the door
      if (h.sign) {
        const bx = x0 + 10, sg = warmFront(bx);
        ctx.fillStyle = mixHex('#55524a', '#e8dcb8', sg * 0.9); ctx.fillRect(bx, 296, 14, 46);
        ctx.fillStyle = WOOD_DARK; ctx.globalAlpha = 0.8;
        for (let k = 0; k < 4; k++) ctx.fillRect(bx + 4 + ((k * 3) % 4), 301 + k * 10, 6, 5);
        ctx.globalAlpha = 1;
      }
      // the posts between the houses (and their firewalls rising above the roof)
      ctx.fillStyle = WOOD_DARK; ctx.fillRect(x0 - 3, ridge - 6, 6, STREET_BACK - ridge + 6); ctx.fillRect(x0 - 7, ridge - 10, 14, 6);
    }
    ctx.strokeStyle = ROOF_LINE; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const [a, b, c, d] of tiles) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
    ctx.stroke();
    // red paper lanterns hanging along the shop eaves (as at the Shintomi theatre): dull in the dark, alive near a lit lamp
    for (const h of houses) {
      if (!h.lanterns) continue;
      const span = h.w * 0.8, x0 = h.x0 + h.w * 0.1, step = span / (h.lanterns - 1);
      for (let i = 0; i < h.lanterns; i++) {
        const x = x0 + i * step, wm = warmFront(x);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 288); ctx.lineTo(x, 293); ctx.stroke();
        ctx.fillStyle = lit(LANTERN, wm); ctx.beginPath(); ctx.ellipse(x, 301, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = WOOD_DARK; ctx.fillRect(x - 4, 292, 8, 2); ctx.fillRect(x - 4, 309, 8, 2);
      }
    }
    // the foot of the fronts: a dark sill
    ctx.fillStyle = WOOD_DARK; ctx.fillRect(0, STREET_BACK - 4, W, 5);
  }

  // ---------- the street ----------
  function drawStreet() {
    const g = ctx.createLinearGradient(0, STREET_BACK, 0, VH);
    g.addColorStop(0, GROUND[0]); g.addColorStop(1, GROUND[1]);
    ctx.fillStyle = g; ctx.fillRect(0, STREET_BACK, W, VH - STREET_BACK);
    // faint ruts and footprints in the packed earth
    ctx.strokeStyle = '#2c2b26'; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const y = STREET_BACK + 14 + ((i * 41) % (VH - STREET_BACK - 40)), x = ((i * 263) % (W + 100)) - 50, len = 40 + ((i * 37) % 120);
      ctx.moveTo(x, y); ctx.lineTo(x + len, y + 1);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    // the gutter along the near edge, with its stones
    ctx.fillStyle = '#25241f'; ctx.fillRect(0, 584, W, 16);
    ctx.fillStyle = '#3a3832';
    for (let x = 4; x < W; x += 31) ctx.fillRect(x, 582, 26, 4);
  }
  /** Warm light: on the fronts, pooled on the street round each lit lamp's foot (added on top, like light). */
  function drawWash() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      if (l.glow <= 0.01) continue;
      const a = l.glow;
      // over the house fronts behind it
      let g = ctx.createRadialGradient(l.hx, l.hy, 4, l.hx, l.hy, 260 * l.sc);
      g.addColorStop(0, `rgba(255,190,105,${0.3 * a})`); g.addColorStop(0.45, `rgba(200,130,60,${0.12 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(l.hx - 270 * l.sc, l.hy - 270 * l.sc, 540 * l.sc, 540 * l.sc);
      // a pool on the street
      ctx.save(); ctx.translate(l.x, l.y); ctx.scale(1, 0.3);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 200 * l.sc);
      g.addColorStop(0, `rgba(255,200,120,${0.3 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 200 * l.sc, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- lamps ----------
  function drawLamp(l) {
    const { x, y, sc, glow } = l, top = y - LAMP_H * sc;
    ctx.fillStyle = 'rgba(10,10,10,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, 12 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1a19';
    ctx.fillRect(x - 6 * sc, y - 9 * sc, 12 * sc, 9 * sc);                // the base
    ctx.fillRect(x - 2.6 * sc, top, 5.2 * sc, LAMP_H * sc - 8 * sc);      // the post
    ctx.fillRect(x - 13 * sc, top + 14 * sc, 26 * sc, 2.6 * sc);          // the ladder bar
    // the lantern: a glass box, narrower at the foot, with a cap and a little finial
    const hw = 10 * sc, hb = 6.5 * sc, hh = 20 * sc, hy = top - hh;
    ctx.fillStyle = mixHex('#3d403c', '#fff3c8', glow);
    ctx.beginPath(); ctx.moveTo(x - hw, hy); ctx.lineTo(x + hw, hy); ctx.lineTo(x + hb, top); ctx.lineTo(x - hb, top); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.4 * sc; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x, top); ctx.stroke();
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.moveTo(x - hw - 4 * sc, hy + 1); ctx.lineTo(x, hy - 9 * sc); ctx.lineTo(x + hw + 4 * sc, hy + 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hy - 10 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill();
  }
  function drawHalos(sim, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      if (l.glow <= 0.01) continue;
      const flick = 1 + 0.03 * Math.sin(time * 9 + l.x) + 0.02 * Math.sin(time * 23 + l.y);
      const r = 62 * l.sc * flick, g = ctx.createRadialGradient(l.hx, l.hy, 2, l.hx, l.hy, r);
      g.addColorStop(0, `rgba(255,236,180,${0.75 * l.glow})`); g.addColorStop(0.3, `rgba(255,190,110,${0.3 * l.glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.hx, l.hy, r, 0, Math.PI * 2); ctx.fill();
    }
    // the passers-by's paper lanterns
    for (const w of sim.walkers) {
      if (!w.lanternAt) continue;
      const [x, y, s] = w.lanternAt, g = ctx.createRadialGradient(x, y, 1, x, y, 30 * s);
      g.addColorStop(0, 'rgba(255,120,70,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30 * s, 0, Math.PI * 2); ctx.fill();
    }
    // the little flame on the lamplighter's pole
    if (sim.flameAt) {
      const [x, y, s] = sim.flameAt, g = ctx.createRadialGradient(x, y, 1, x, y, 26 * s);
      g.addColorStop(0, 'rgba(255,220,150,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- people ----------
  /** A person (picture units at their feet). o: { face, step, bow, body (colour), head (colour), hat, band, scale } */
  function drawBody(x, y, sz, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz);
    const f = o.face, stride = Math.sin(o.step * Math.PI * 2) * (o.still ? 0 : 5);
    ctx.fillStyle = 'rgba(8,8,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.legs || SIL; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + stride, 0); ctx.moveTo(2, -10); ctx.lineTo(2 - stride, 0); ctx.stroke();
    ctx.translate(0, -9); ctx.rotate(f * (0.06 + o.bow * 0.55));
    ctx.fillStyle = o.body; ctx.beginPath(); ctx.moveTo(-6.5, 1); ctx.lineTo(6.5, 1); ctx.lineTo(5.2, -23); ctx.lineTo(-5.2, -23); ctx.closePath(); ctx.fill();
    if (o.collar) { ctx.strokeStyle = o.collar; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3.5, -23); ctx.lineTo(1, -10); ctx.moveTo(3.5, -23); ctx.lineTo(1, -10); ctx.stroke(); }
    if (o.sash) { ctx.strokeStyle = o.sash; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5.8, -9); ctx.lineTo(5.8, -9); ctx.stroke(); }
    ctx.fillStyle = o.head; ctx.beginPath(); ctx.arc(f * 1.4, -27, 3.9, 0, Math.PI * 2); ctx.fill();
    if (o.band) { ctx.strokeStyle = o.band; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f * 1.4 - 4, -28.5); ctx.lineTo(f * 1.4 + 4, -28.5); ctx.stroke(); }
    if (o.knot) { ctx.fillStyle = o.knot; ctx.fillRect(f * 1.4 - 1.2 - f * 2, -33.5, 2.6, 3.4); }
    if (o.hat) { ctx.fillStyle = o.hat; ctx.beginPath(); ctx.moveTo(-12, -26); ctx.quadraticCurveTo(0, -40, 12, -26); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function drawWalker(w) {
    const sc = streetScale(w.y), sz = sc * FIG, wm = clamp(warmAt(w.x, w.y) * 1.1, 0, 1);
    const body = mixHex(SIL, ROBES[w.robe], wm * 0.9), head = mixHex('#1f1e1f', SKIN, wm * 0.8), still = w.bowT > 0 || w.wait > 0;
    const bow = w.bowT > 0 ? Math.sin((w.bowT / 1.4) * Math.PI) : 0;
    w.lanternAt = null;
    if (w.kind === 'rickshaw') {
      // the puller leans into the shafts; the two-wheeled cart behind him, a passenger under the hood
      const d = w.dir, cx = w.x - d * 34 * sz / FIG, wr = 15 * sc;
      ctx.strokeStyle = SIL; ctx.lineWidth = 2.2 * sc;
      ctx.beginPath(); ctx.moveTo(w.x + d * 4 * sc, w.y - 24 * sc); ctx.lineTo(cx, w.y - 22 * sc); ctx.stroke();                 // the shafts
      ctx.fillStyle = mixHex(SIL, '#3a3330', wm);
      ctx.beginPath(); ctx.moveTo(cx - 16 * sc, w.y - 20 * sc); ctx.lineTo(cx + 14 * sc, w.y - 20 * sc); ctx.lineTo(cx + 10 * sc * -d, w.y - 52 * sc);
      ctx.quadraticCurveTo(cx - d * 26 * sc, w.y - 54 * sc, cx - d * 20 * sc, w.y - 22 * sc); ctx.closePath(); ctx.fill();          // the seat and hood
      ctx.fillStyle = head; ctx.beginPath(); ctx.arc(cx - d * 2 * sc, w.y - 38 * sc, 3.6 * sc, 0, Math.PI * 2); ctx.fill();         // the passenger
      ctx.strokeStyle = '#121214'; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.arc(cx, w.y - wr, wr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 0.8 * sc; ctx.beginPath();
      const turn = (w.x / (wr * 1.0)) * d;
      for (let k = 0; k < 6; k++) { const a = turn + (k * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, w.y - wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, w.y - wr + Math.sin(a) * wr); }
      ctx.stroke();
      // a red lantern hung on the cart
      const lx = cx + d * 12 * sc, ly = w.y - 26 * sc;
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(lx, ly, 4 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      w.lanternAt = [lx, ly, sc];
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(d * 0.25); ctx.translate(-w.x, -w.y);
      drawBody(w.x, w.y, sz, { face: d, step: w.step, bow: 0, still, body, head, hat: mixHex(SIL, '#6d6650', wm) });
      ctx.restore();
      return;
    }
    drawBody(w.x, w.y, sz, { face: w.dir, step: w.step, bow, still, body, head, knot: w.kind === 'plain' ? SIL : null });
    if (w.kind === 'umbrella') {
      // an open paper umbrella, pale against the dark (as in Kiyochika's Kudanzaka)
      const ux = w.x + w.dir * 3 * sz, uy = w.y - 46 * sz;
      ctx.strokeStyle = SIL; ctx.lineWidth = 1.2 * sz; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, w.y - 22 * sz); ctx.stroke();
      ctx.fillStyle = mixHex('#7d7663', '#d8c9a0', wm * 0.8); ctx.beginPath(); ctx.ellipse(ux, uy + 2 * sz, 19 * sz, 8 * sz, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    }
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
    const p = sim.player, sc = streetScale(p.y), sz = sc * FIG, wm = clamp(warmAt(p.x, p.y), 0, 1);
    ctx.save(); ctx.globalAlpha = p.fade;
    drawBody(p.x, p.y, sz, { face: p.face, step: p.step, bow: p.bow, still: Math.hypot(p.vx, p.vy) < 3 && p.lightT <= 0,
      body: mixHex(COAT, '#4d66a8', wm * 0.6), legs: '#151518', head: mixHex('#a88a6a', SKIN, 0.4 + wm * 0.6), collar: '#d8c9a0', band: '#e8e0cc', sash: '#d8c9a0' });
    // the long pole, with a small flame at its tip: carried slanting forward, raised to the lamp to light it
    const hand = [p.x + p.face * 7 * sz, p.y - 24 * sz], len = 110 * sc;
    const carry = p.face > 0 ? -0.72 : Math.PI + 0.72;                            // about 40 degrees up, ahead of him
    let ang = carry, L = len;
    if (p.lamp >= 0 && p.raise > 0) {
      const l = sim.lamps[p.lamp], tx = lampX(l, W), ty = l.y - LAMP_H * streetScale(l.y) + 2;
      const want = Math.atan2(ty - hand[1], tx - hand[0]), wantL = Math.hypot(tx - hand[0], ty - hand[1]);
      ang = carry + (want - carry) * p.raise; L = len + (wantL - len) * p.raise;
    }
    const bob = Math.sin(p.step * Math.PI * 2) * 1.5 * sc;
    const tip = [hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L + bob];
    ctx.strokeStyle = '#2a241d'; ctx.lineWidth = 2.2 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hand[0] - Math.cos(ang) * 14 * sc, hand[1] - Math.sin(ang) * 14 * sc); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    const fl = 1 + 0.15 * Math.sin(time * 17) + 0.1 * Math.sin(time * 31);
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(tip[0], tip[1] - 3 * sc * fl, 2.4 * sc, 4.2 * sc * fl, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(tip[0], tip[1] - 2 * sc, 1.2 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    sim.flameAt = [tip[0], tip[1] - 2 * sc, sc * p.fade];
  }

  // ---------- the heads-up bits ----------
  /** One small lamp for each on the street, lit as they are lit (instead of the other prints' ink bar). */
  function drawCounter(sim) {
    const list = [...sim.lamps].sort((a, b) => a.u - b.u);
    list.forEach((l, i) => {
      const x = 34 + i * 22, y = 40;
      ctx.fillStyle = 'rgba(239,228,198,0.75)'; ctx.fillRect(x - 1, y - 2, 2, 16);
      ctx.fillStyle = l.lit ? '#ffd98a' : 'rgba(239,228,198,0.25)';
      ctx.strokeStyle = 'rgba(239,228,198,0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - 6, y - 14); ctx.lineTo(x + 6, y - 14); ctx.lineTo(x + 4, y - 2); ctx.lineTo(x - 4, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ui.text('LAMPS', 26, 70, 13, INK, 'left');
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
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer: ['TAP THE STREET TO WALK THERE', MUTED] });
  }
  function drawComplete(sim) {
    ctx.globalAlpha = clamp(sim.completeT / 2, 0, 1);
    ui.text('THE LAMPLIGHTER', W / 2, 185, 44, INK, 'center', 'bold');
    ui.text('COMPLETE', W / 2, 235, 24, INK, 'center');
    ui.seal(W - 90, VH - 90, 1.6);
    ctx.globalAlpha = 1;
    if (sim.completeT >= DONE_WAIT) ui.choices(DONE_CHOICES, { W, sel: sim.choice, ready: true, alpha: clamp((sim.completeT - DONE_WAIT) / 0.6, 0, 1) });
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const time = now / 1000;
    lamps = sim.lamps.map((l) => {
      const x = lampX(l, W), sc = streetScale(l.y);
      return { x, y: l.y, sc, glow: l.glow, hx: x, hy: l.y - LAMP_H * sc - 10 * sc };
    });

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky();
    drawFar();
    drawHouses();
    drawStreet();
    drawWash();
    // lamps and people, nearest last
    const items = lamps.map((l) => ({ y: l.y, f: () => drawLamp(l) }));
    for (const w of sim.walkers) items.push({ y: w.y, f: () => drawWalker(w) });
    sim.flameAt = null;
    if (sim.state !== 'title') items.push({ y: sim.player.y + 0.5, f: () => drawPlayer(sim, time) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();
    drawHalos(sim, time);
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
