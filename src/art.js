// NAMI's painting. Everything is drawn live in code in the style of a Japanese woodblock print: cream paper, dark key-block
// outlines, flat blues. The colour is "ink": the more you earn, the more of the print is filled in.
// This file only draws; it never changes the game.
import { BASE_Y, HORIZON, VH, smooth, clamp, ambient, waveX, waveAmp, waveCurl, waveBreak, waveHeightAt, T_LAND, T_BREAK, T_BREAK_END, T_GONE } from './ocean.js';
import { PAUSE_ROWS, PAUSE_Y0, PAUSE_DY, SENS_OPTS, SENS_DEG, STEER_OPTS, SCREEN_MIRRORED } from './sim.js';
import { BUILD } from './version.js';

// ---------- palette ----------
const PAPER = '#efe4c6', INK = '#16213b', FOAM = '#f8f1df', WOOD = '#cfa86a', ROBE = '#2d4b7d', SKIN = '#e6c8a2', SEAL = '#b3342b';
const mixHex = (a, b, t) => {
  t = clamp(t, 0, 1);
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
};
const FONT = "Georgia, 'Times New Roman', serif";
// Mt Fuji drifts slowly left-to-right across the far background and comes round again on the left (classic side-scroller).
// It is the farthest thing in the picture, so it moves slowest: this fraction of the boat's travel.
const FUJI_DRIFT = 0.3;
// Parallax for a 2.5-D sky: the HIGH clouds are nearest (they pass overhead) so they move fastest; the low clouds sit near the horizon,
// farther away, so they move slower; the mountain is farthest and slowest. Fractions of the boat's travel: [high, middle, low].
const CLOUD_DRIFT = [0.9, 0.65, 0.45];
const ROW_RATE = 3;              // rowing stroke speed (radians of the stroke cycle per second): calm, the same uphill and down
const SHOW_FOAM_PILE = false;
const SHOW_WARNING = false;
const SHOW_CALM = false;
const START_INK = 25;          // how much colour the print already has when play starts (0 = bare paper sketch)        // the calm ring: nothing can lower calm now (foam is harmless), so it is hidden     // the shadow + dashed line marking where the foam will land (Tom: off; the foaming crest is the warning now)    // the row of white foam bumps along the water after a wave lands (Tom: off for now)

// the print colours in as ink goes up: [colour on bare paper, final colour, ink where it starts, ink where it is done]
const LAYERS = {
  sky: [PAPER, '#e7d1a0', 14, 34],              // the top of the sky: the print's warm buff...
  skyLow: [PAPER, '#f1eadb', 14, 34],           // ...fading to a paler, cooler cream toward the horizon (Tom: like the print, minus its dark band)
  cloud: [PAPER, '#b9c6c8', 20, 40],
  fuji: ['#e4dcc2', '#6f8fb5', 28, 48],
  farSea: ['#dfe3d6', '#4f7fb2', 6, 30],
  sea: ['#cfdde2', '#2f5f9b', 6, 44],
  deep: ['#b5c9d8', '#1d3d73', 36, 66],
  foreground: ['#c3d3dc', '#173366', 6, 50],     // colours in with the main sea so the nearest water is always the darkest
};
const layerColor = (name, ink) => { const L = LAYERS[name]; return mixHex(L[0], L[1], smooth((ink - L[2]) / (L[3] - L[2]))); };

// ---------- grain texture (made once) ----------
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

export function createArt(canvas) {
  const ctx = canvas.getContext('2d');
  const grain = makeGrain();
  const grainPattern = ctx.createPattern(grain, 'repeat');
  let W = 1300, scale = 1, dpr = 1;
  let artInk = 100;                         // the ink we are SHOWING (eases toward the real value)
  const spray = [];                         // little foam drops
  const splash = [];
  let lastT = 0, time = 0, travel = 0;          // travel = how far the boat has sailed (drives the parallax)

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;     // nothing to draw into right now: keep the last good size
    W = w; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }

  const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  const outline = (w = 2.2, a = 0.9) => { ctx.strokeStyle = INK; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1; };

  // ---------- sky, clouds, mountain ----------
  function drawSky(ink, t) {
    const top = layerColor('sky', ink), low = layerColor('skyLow', ink);
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, top); g.addColorStop(0.3, top); g.addColorStop(1, low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 4);
    // long flat cloud bands drifting slowly (like the print's yellowed sky)
    const cc = layerColor('cloud', ink);
    // nearer (lower) clouds slide past faster than the high ones
    const bands = [[28, 30, CLOUD_DRIFT[0], 0], [78, 22, CLOUD_DRIFT[1], 380], [128, 26, CLOUD_DRIFT[2], 760]];
    for (const [y, h, sp, off] of bands) {
      ctx.fillStyle = cc;
      // two copies half a loop apart, so there is always cloud drifting across
      const span = W + 800;
      for (const half of [0, span / 2]) {
        const x0 = ((((off + half - travel * sp) % span) + span) % span) - 780;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        for (let i = 0; i <= 6; i++) ctx.quadraticCurveTo(x0 + i * 110 + 55, y - h * (i % 2 ? 0.8 : 1.1), x0 + (i + 1) * 110, y);
        ctx.lineTo(x0 + 770, y + h * 0.5); ctx.quadraticCurveTo(x0 + 400, y + h * 1.4, x0, y + h * 0.5); ctx.closePath();
        ctx.fill(); outline(1.4, 0.35);
      }
    }
  }
  // Fuji's centre ON SCREEN (moving right). It starts near the left, where the eye is, and wraps round the screen like a
  // cylinder: whatever slides off the right edge comes straight back in on the left, so there is always a whole mountain's worth showing.
  const FUJI_START_X = 115;                 // where its centre starts: this far in from the left edge (it is about 200 wide)
  function fujiScreenX() { return ((((FUJI_START_X + travel * FUJI_DRIFT) % W) + W) % W); }
  function drawFuji(ink) {
    const sx = fujiScreenX();
    for (const cx of [sx, sx - W, sx + W]) {                          // the mountain, plus the copy wrapping round at whichever edge it is crossing
      if (cx < -120 || cx > W + 120) continue;                        // (half-width is about 100 at this size)
      drawFujiAt(SCREEN_MIRRORED ? W - cx : cx, ink);                 // the world is drawn flipped
    }
  }
  function drawFujiAt(fx, ink) {
    // far away and still: drawn at half size and softened toward the sky colour (aerial haze)
    const base = HORIZON + 6, top = HORIZON - 118;
    ctx.save(); ctx.translate(fx, base); ctx.scale(0.52, 0.52); ctx.translate(-fx, -base);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(fx - 190, base);
    ctx.quadraticCurveTo(fx - 70, base - 14, fx - 14, top + 6);
    ctx.quadraticCurveTo(fx, top - 4, fx + 14, top + 6);
    ctx.quadraticCurveTo(fx + 80, base - 20, fx + 200, base);
    ctx.closePath();
    ctx.fillStyle = mixHex(layerColor('fuji', ink), layerColor('sky', ink), 0.3); ctx.fill(); outline(2.4, 0.6);
    // snow cap with a ragged lower edge
    ctx.beginPath();
    ctx.moveTo(fx - 14, top + 6); ctx.quadraticCurveTo(fx, top - 4, fx + 14, top + 6);
    const pts = [[fx + 30, top + 34], [fx + 18, top + 28], [fx + 8, top + 48], [fx - 4, top + 36], [fx - 16, top + 52], [fx - 28, top + 34]];
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath(); ctx.fillStyle = mixHex(PAPER, '#f6f1e2', smooth((ink - 28) / 20)); ctx.fill(); outline(1.4, 0.7);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function drawHills(ink) {
    // low hills on the right horizon
    ctx.beginPath(); ctx.moveTo(W * 0.62, HORIZON + 6);
    ctx.quadraticCurveTo(W * 0.7, HORIZON - 26, W * 0.78, HORIZON - 10); ctx.quadraticCurveTo(W * 0.88, HORIZON - 32, W + 10, HORIZON - 6); ctx.lineTo(W + 10, HORIZON + 6); ctx.closePath();
    ctx.fillStyle = layerColor('fuji', ink); ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1; outline(1.4, 0.5);
  }

  // ---------- the sea ----------
  function seaBand(baseY, heightFn, color, lineAlpha = 0.7, lw = 1.8, step = 14) {
    const pts = [];
    for (let x = -24; x <= W + 24; x += step) pts.push([x, baseY - heightFn(x)]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineTo(W + 20, VH + 10); ctx.lineTo(-20, VH + 10); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    path(pts); outline(lw, lineAlpha);
  }
  function drawFarSea(ink, t) {
    seaBand(HORIZON + 8, (x) => ambient((x + travel * 0.32) * 1.6 + 300, t * 0.6, 0.18), layerColor('farSea', ink), 0.5, 1.4);
    seaBand(HORIZON + 38, (x) => ambient((x + travel * 0.5) * 1.3 + 90, t * 0.7, 0.34), mixHex(layerColor('farSea', ink), layerColor('sea', ink), 0.5), 0.55, 1.6);
    seaBand(HORIZON + 86, (x) => ambient((x + travel * 0.7) * 1.1 + 500, t * 0.85, 0.55), layerColor('sea', ink), 0.6, 1.8);
  }
  function drawMainSea(sea, ink, t) {
    seaBand(BASE_Y, (x) => ambient(x, t) + sea.waves.reduce((s, w) => s + waveHeightAt(w, x), 0), layerColor('sea', ink), 0.85, 2.4, FOAM_GRID);
    // little foam curls riding the everyday swell
    ctx.fillStyle = FOAM;
    for (let k = -1; k < W / 120 + 2; k++) {
      const x = k * 120 - (((t * 38 + travel * 0.8) % 120) + 120) % 120 + (k % 3) * 17;
      const h = ambient(x, t) + sea.waves.reduce((s, w) => s + waveHeightAt(w, x), 0);
      if (h < 3) continue;
      const y = BASE_Y - h;
      ctx.beginPath(); ctx.moveTo(x - 16, y + 3); ctx.quadraticCurveTo(x - 4, y - 10, x + 14, y - 2); ctx.quadraticCurveTo(x + 4, y + 2, x - 16, y + 3); ctx.fill(); outline(1.2, 0.6);
    }
  }

  // ---------- the great wave ----------
  const bez = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
  };
  const bezT = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [3 * v * v * (p1[0] - p0[0]) + 6 * v * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]), 3 * v * v * (p1[1] - p0[1]) + 6 * v * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1])];
  };

  // ---------- the great wave: a smooth swell whose crest turns to foam (it never curls over itself) ----------
  const FOAM_GRID = 6;                      // the wave and the sea are sampled on the same grid, so their edges line up exactly
  function drawGreatWave(w, ink, t) {
    const amp = waveAmp(w);
    if (amp < 0.5) return;
    const fade = smooth(amp / 70);          // as it dies down the wave's own colouring melts into the sea (no misaligned edge)
    const xc = waveX(w), yAt = (x) => BASE_Y - (ambient(x, t) + waveHeightAt(w, x));
    const x0 = Math.ceil((xc - 240) / FOAM_GRID) * FOAM_GRID, x1 = Math.floor((xc + 560) / FOAM_GRID) * FOAM_GRID;
    const pts = [];
    for (let x = x1; x >= x0; x -= FOAM_GRID) pts.push([x, yAt(x)]);

    const seaC = layerColor('sea', ink), deepC = layerColor('deep', ink);
    const gx0 = x0, gx1 = xc + 380, gp = (x) => clamp((x - gx0) / (gx1 - gx0), 0.02, 0.98);
    const g = ctx.createLinearGradient(gx0, 0, gx1, 0);
    g.addColorStop(0, seaC); g.addColorStop(gp(xc - 120), deepC); g.addColorStop(gp(xc + 40), deepC); g.addColorStop(gp(xc + 200), mixHex(deepC, seaC, 0.55)); g.addColorStop(1, seaC);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineTo(x0, VH + 10); ctx.lineTo(x1, VH + 10); ctx.closePath();
    ctx.globalAlpha = fade; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); outline(3, 0.95 * fade);

    // flowing foam lines along the back of the wave
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const off = 22 + k * 30;
      ctx.beginPath();
      for (let x = xc + 20; x <= xc + 480; x += 24) { const y = yAt(x) + off + Math.sin(x * 0.03 + t * 1.4 + k) * 3; if (x === xc + 20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = FOAM; ctx.globalAlpha = (0.55 - k * 0.08) * fade; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- froth: the wave never falls over (think of a huge swell a trawler has to ride over). While it stands tall its crest
  // froths: white bubbles swell into being, live a little while and shrink away again, new ones taking their place. As the wave
  // declines no new ones are born, and the last ones fade the same way they appeared. Nothing rolls down the face. ----------
  const foams = new Map();                  // wave id -> { bubbles, lastT }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const FROTH_START = 1.8;                  // seconds into the wave's life when the crest starts to froth
  function stepFoam(w) {
    let F = foams.get(w.id);
    if (!F) { F = { bubbles: [], lastT: w.t }; foams.set(w.id, F); }
    const dts = Math.max(0, Math.min(0.1, w.t - F.lastT)); F.lastT = w.t;    // sea time: freezes when paused
    // how frothy the crest is: builds as the wave rises, eases off as it declines
    const froth = smooth((w.t - FROTH_START) / 2.2) * (1 - smooth((w.t - T_BREAK_END) / 1.0));
    if (dts > 0 && froth > 0 && F.bubbles.length < 150) {
      let n = 70 * froth * dts;
      while (n > 0) {
        if (Math.random() < n) {
          const dx = rnd(-45, 75), mid = 1 - Math.min(1, Math.abs(dx - 12) / 60);
          F.bubbles.push({ dx, r: Math.random() < 0.3 ? rnd(3, 6) : rnd(7, 15), lift: rnd(0, 24) * mid, seed: rnd(0, 6.3), born: w.t, life: rnd(1.3, 2.8) });
        }
        n -= 1;
      }
    }
    F.bubbles = F.bubbles.filter((b) => w.t - b.born < b.life);
    return F;
  }
  function drawFoam(sea, t) {
    for (const w of sea.waves) {
      const F = stepFoam(w);
      if (!F.bubbles.length) continue;
      const xc = waveX(w), yAt = (x) => BASE_Y - (ambient(x, t) + waveHeightAt(w, x));
      const tall = Math.min(1, waveAmp(w) / Math.max(1, w.H));                 // the heap sinks back as the wave goes down
      ctx.save();
      for (const b of F.bubbles) {
        const age = w.t - b.born;
        const size = smooth(age / 0.35) * (1 - smooth((age - (b.life - 0.5)) / 0.5));   // swells in, shrinks out
        if (size <= 0.02) continue;
        const r = b.r * size;
        const x = xc + b.dx + Math.sin(t * 2 + b.seed) * 2;
        const y = yAt(x) - r * 0.55 - b.lift * tall;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = FOAM; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.globalAlpha = 0.55; ctx.stroke();
      }
      ctx.restore();
      // a few drops flung up off the frothing crest
      const froth = smooth((w.t - FROTH_START) / 2.2) * (1 - smooth((w.t - T_BREAK_END) / 1.0));
      if (froth > 0.5 && Math.random() < 0.35 * froth) spray.push({ x: xc + rnd(-20, 40), y: yAt(xc) - rnd(10, 26), vx: rnd(-40, 10), vy: rnd(-55, -20), life: 1 });
    }
    for (const id of [...foams.keys()]) if (!sea.waves.some((w) => w.id === id)) foams.delete(id);
  }

  // the dark patch on the water that tells you where the foam will land, and the white water afterwards
  function drawZone(w, ink, t) {
    const [zl, zr] = w.zone;
    const alpha = w.t < 1.2 ? 0 : w.t < T_LAND ? smooth((w.t - 1.2) / 2.2) * 0.42 : 0;
    if (alpha > 0) {
      ctx.save();
      // a soft shadow: darkest at the water line, fading away downward and at both ends (no hard edge)
      const top = [];
      for (let x = zl; x <= zr; x += 10) top.push([x, BASE_Y - (ambient(x, t) + waveHeightAt(w, x)) + 2]);
      const hg = ctx.createLinearGradient(zl, 0, zr, 0);
      hg.addColorStop(0, 'rgba(22,33,59,0)'); hg.addColorStop(0.25, 'rgba(22,33,59,1)'); hg.addColorStop(0.75, 'rgba(22,33,59,1)'); hg.addColorStop(1, 'rgba(22,33,59,0)');
      ctx.fillStyle = hg;
      for (let k = 1; k <= 6; k++) {
        ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + k * 5);
        ctx.closePath(); ctx.globalAlpha = alpha / 6; ctx.fill();
      }
      ctx.globalAlpha = Math.min(0.8, alpha * 2); ctx.setLineDash([7, 6]); path(top); ctx.lineWidth = 2; ctx.strokeStyle = FOAM; ctx.stroke();
      ctx.restore();
    }
    if (SHOW_FOAM_PILE && w.t >= T_LAND - 0.3 && w.t < T_GONE) {
      const k = (w.t - (T_LAND - 0.3)) / (T_GONE - T_LAND + 0.3), a = 1 - smooth((k - 0.45) / 0.55);
      const spread = 25 + 55 * Math.min(1, k * 2.4);
      ctx.save(); ctx.globalAlpha = Math.min(1, smooth(k * 8)) * a; ctx.fillStyle = FOAM;
      for (let x = zl - spread; x <= zr + spread; x += 17) {
        const y = BASE_Y - ambient(x, t);
        const r = 11 + 7 * Math.abs(Math.sin(x * 0.31 + w.id));
        ctx.beginPath(); ctx.arc(x, y - 1, r, Math.PI, 0); ctx.closePath(); ctx.fill(); outline(1.2, 0.6 * a);
      }
      ctx.restore();
    }
  }

  // ---------- boats ----------
  function drawBoat(x, y, ang, s, row, opts = {}) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang + (opts.roll || 0)); ctx.scale(s, s);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    // oars first (behind the hull), dipping into the water
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const ox = -44 + i * 17, a = 0.55 + Math.sin(row + i * 0.35) * 0.35;
      ctx.beginPath(); ctx.moveTo(ox, -10); ctx.lineTo(ox - Math.sin(a) * 6 + 12, -10 + Math.cos(a) * 40); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    }
    // hull: a long narrow boat with a lifted bow and stern
    ctx.beginPath();
    ctx.moveTo(-70, -22); ctx.quadraticCurveTo(-72, -6, -50, 6); ctx.quadraticCurveTo(0, 20, 52, 4); ctx.quadraticCurveTo(70, -8, 78, -30);
    ctx.quadraticCurveTo(48, -6, 0, -4); ctx.quadraticCurveTo(-40, -2, -70, -22); ctx.closePath();
    ctx.fillStyle = WOOD; ctx.fill(); outline(2.4, 0.95);
    // rowers in blue, leaning with the stroke
    for (let i = 0; i < 6; i++) {
      const bx = -44 + i * 17, lean = Math.sin(row + i * 0.35) * 0.35;
      ctx.save(); ctx.translate(bx, -6); ctx.rotate(lean);
      ctx.fillStyle = ROBE; ctx.fillRect(-4.5, -17, 9, 15); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-4.5, -17, 9, 15);
      ctx.beginPath(); ctx.arc(0, -21, 4, 0, Math.PI * 2); ctx.fillStyle = SKIN; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -22.5, 4.2, Math.PI, 0); ctx.fillStyle = INK; ctx.fill();
      ctx.restore();
    }
    // the steersman at the back
    ctx.fillStyle = '#7a5a8c'; ctx.fillRect(-66, -30, 7, 14); ctx.beginPath(); ctx.arc(-62.5, -34, 4, 0, Math.PI * 2); ctx.fillStyle = SKIN; ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- paper, vignette ----------
  function drawPaper() {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = grainPattern;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    ctx.restore();
    const g = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.45, W / 2, VH / 2, W * 0.62);
    g.addColorStop(0, 'rgba(120,80,30,0)'); g.addColorStop(1, 'rgba(120,80,30,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VH);
  }

  // ---------- HUD + screens ----------
  function text(str, x, y, size, color = INK, align = 'center', weight = '') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = size > 40 ? '8px' : '2px';
    ctx.fillStyle = PAPER; ctx.globalAlpha = 0.85; ctx.strokeStyle = PAPER; ctx.lineWidth = size > 30 ? 7 : 4; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  function drawSeal(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); ctx.scale(s, s);
    ctx.fillStyle = SEAL; ctx.fillRect(-26, -26, 52, 52);
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.strokeRect(-20, -20, 40, 40);
    ctx.beginPath(); ctx.moveTo(-12, 8); ctx.quadraticCurveTo(-8, -14, 2, -4); ctx.quadraticCurveTo(10, -14, 14, 4); ctx.moveTo(-12, 14); ctx.quadraticCurveTo(0, 6, 14, 14);
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  function drawHud(sea, ui) {
    // ink bar (top left) + calm ring (top right)
    const ink = sea.inkShown / 100;
    ctx.fillStyle = 'rgba(22,33,59,0.18)'; roundRect(24, 22, 170, 10, 5); ctx.fill();
    ctx.fillStyle = INK; roundRect(24, 22, Math.max(10, 170 * ink), 10, 5); ctx.fill();
    text('INK', 24, 46, 13, INK, 'left');
    const cx = W - 250, cy = 36, r = 17, calm = sea.calm / 100;
    if (SHOW_CALM) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(22,33,59,0.18)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = calm < 0.35 ? SEAL : INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + 0.3, -Math.PI / 2 + 0.3 + (Math.PI * 2 - 0.6) * calm); ctx.stroke();
    ctx.restore();
    text('CALM', cx, cy + 30, 13, INK, 'center');
    }
    if (sea.zen) text('ZEN', W / 2, 24, 14, INK, 'center');
    if (ui && ui.tilt && sea.tiltSteer) {
      if (ui.tilt.ok) { ctx.fillStyle = 'rgba(22,33,59,0.2)'; ctx.fillRect(W / 2 - 40, 44, 80, 3); ctx.fillStyle = INK; ctx.fillRect(W / 2 + ui.tilt.steer * 38 - 3, 41, 6, 9); }
      else if ((time * 2 | 0) % 2) text('NO TILT SENSOR - SLIDE TO STEER', W / 2, 46, 14, SEAL);
    }
    if (sea.message) {
      const m = sea.message, a = Math.min(1, m.t / 0.6, (m.total - m.t) / 0.5 + 0.0);
      ctx.globalAlpha = clamp(a, 0, 1); text(m.text, W / 2, 110, 26, INK, 'center', 'italic'); ctx.globalAlpha = 1;
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function tiltLines(t) {
    if (!t) return { ok: false, lines: [] };
    if (t.ok) return { ok: true, lines: ['TILT LIVE'] };
    if (!t.secure) return { ok: false, lines: ['NO TILT: PAGE IS NOT "SECURE"', 'OPEN AS file:/// IN CHROME'] };
    if (!t.events) return { ok: false, lines: ['NO SENSOR EVENTS RECEIVED'] };
    return { ok: false, lines: ['SENSOR SENT EMPTY DATA'] };
  }
  function drawPause(sea, ui) {
    ctx.fillStyle = 'rgba(239,228,198,0.9)'; ctx.fillRect(0, 0, W, VH);
    text('PAUSED', W / 2, 78, 54, INK, 'center');
    const s = sea.settings;
    const rows = {
      resume: ['', 'RESUME'], album: ['', 'BACK TO THE ALBUM'], steer: ['STEERING', STEER_OPTS[s.steer]], sens: ['TILT AMOUNT', SENS_OPTS[s.sens] + ' (' + SENS_DEG[s.sens] + ')'],
      zen: ['ZEN MODE', s.zen ? 'ON - NO WAVES BREAK' : 'OFF'], sound: ['SOUND', s.sound ? 'ON' : 'OFF'],
      recentre: ['', 'SET TILT STRAIGHT AHEAD'], restart: ['', sea.restartArmed ? 'TAP AGAIN TO START THE PRINT OVER' : 'START THE PRINT OVER'],
    };
    PAUSE_ROWS.forEach((id, i) => {
      const y = PAUSE_Y0 + i * PAUSE_DY, sel = sea.pauseRow === i, r = rows[id];
      if (sel) { ctx.fillStyle = 'rgba(22,33,59,0.1)'; ctx.fillRect(W / 2 - 330, y - 19, 660, 38); }
      if (r[0] === '') text(r[1], W / 2, y, 22, id === 'restart' && sea.restartArmed ? SEAL : INK, 'center', id === 'resume' ? 'bold' : '');
      else { text(r[0], W / 2 - 310, y, 18, '#4a5470', 'left'); text('<', W / 2 + 20, y, 20, sel ? INK : '#8a90a0'); text(r[1], W / 2 + 140, y, 20, INK); text('>', W / 2 + 270, y, 20, sel ? INK : '#8a90a0'); }
    });
    const st = tiltLines(ui && ui.tilt), ty = PAUSE_Y0 + PAUSE_ROWS.length * PAUSE_DY + 12;
    if (sea.tiltSteer) {
      if (st.ok) { text('TILT TEST: ROCK THE PHONE', W / 2, ty, 16, '#2a6a3a'); ctx.fillStyle = 'rgba(22,33,59,0.2)'; ctx.fillRect(W / 2 - 100, ty + 22, 200, 4); ctx.fillStyle = INK; ctx.fillRect(W / 2 + ui.tilt.steer * 96 - 5, ty + 17, 10, 14); }
      else st.lines.forEach((l, i) => text(l, W / 2, ty + i * 22, 16, SEAL));
    } else text('SLIDE YOUR FINGER LEFT AND RIGHT TO STEER', W / 2, ty, 16, '#4a5470');
    text('v' + BUILD, 18, VH - 18, 12, '#4a5470', 'left');
  }
  function drawTitle(sea, ui) {
    text('NAMI', W / 2, 200, 120, INK, 'center', 'bold');
    text('THE GREAT WAVE', W / 2, 282, 26, INK, 'center');
    if ((time * 1.4 | 0) % 2 === 0) text(ui && ui.touch ? 'TOUCH TO BEGIN' : 'PRESS ANY KEY TO BEGIN', W / 2, 520, 22, INK, 'center');
    text(sea.settings.steer < 2 ? 'ROCK THE PHONE LIKE A BOAT' : 'SLIDE TO STEER', W / 2, 556, 15, '#4a5470', 'center');
    drawSeal(W - 70, VH - 64, 1);
  }
  function drawComplete(sea) {
    const a = smooth(sea.completeT / 2);
    ctx.globalAlpha = a;
    text('THE GREAT WAVE', W / 2, 185, 44, INK, 'center', 'bold');
    text('COMPLETE', W / 2, 235, 24, INK, 'center');
    drawSeal(W - 90, VH - 90, 1.6);
    if (sea.completeT > 4 && (time * 1.4 | 0) % 2 === 0) text('TOUCH TO KEEP SAILING', W / 2, 520, 20, INK, 'center');
    ctx.globalAlpha = 1;
  }

  // ---------- draw one frame ----------
  function draw(sea, ui = {}, now = 0) {
    const t = sea.t;
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; time += dt;
    // the print starts fully inked on the title screen and drains to a sketch when you begin
    if (!sea.paused) travel += dt * Math.max(12, 40 + sea.boat.vx * 0.35);
    const target = sea.state === 'title' ? 100 : sea.state === 'complete' ? 100 : sea.inkShown;
    artInk += (target - artInk) * Math.min(1, dt * (sea.state === 'play' ? 6 : 1.4));
    // the print never starts as bare paper: some ink is already in (a deeper blue feels calmer to play on). The colour still runs all
    // the way to the finished print: shown ink = START_INK at 0 progress, 100 at 100.
    const ink = START_INK + artInk * (1 - START_INK / 100);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, VH);
    if (SCREEN_MIRRORED) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); }
    drawSky(ink, t);
    drawFuji(ink);
    drawHills(ink);
    drawFarSea(ink, t);
    drawMainSea(sea, ink, t);
    for (const w of sea.waves) { drawGreatWave(w, ink, t); if (SHOW_WARNING) drawZone(w, ink, t); }

    // companion boats (just scenery, as in the print) then yours
    const surf = (x) => ambient(x, t) + sea.waves.reduce((s, w) => s + waveHeightAt(w, x), 0);
    const comp = SCREEN_MIRRORED ? [[W * 0.22, 0.55], [W * 0.1, 0.42]] : [[W * 0.78, 0.55], [W * 0.9, 0.42]];
    for (const [cxp, sc] of comp) {
      const x = cxp + Math.sin(time * 0.2 + cxp) * 12, h = surf(x), sl = (surf(x + 3) - surf(x - 3)) / 6;
      drawBoat(x, BASE_Y - h - 6 * sc, -Math.atan(sl), sc, time * 3 + cxp);
    }
    const b = sea.boat;
    const row = time * ROW_RATE;                      // one steady, relaxed stroke, uphill or down (no frantic rowing)
    if (sea.state !== 'title') drawBoat(b.x, b.y - 4, b.ang, 1, row, { roll: b.toss > 0 ? Math.sin((2.4 - b.toss) * 2.6) * 0.14 * smooth(b.toss / 2.4) : 0 });

    // foam last, so the boat sails THROUGH it
    drawFoam(sea, t);

    // foreground water, darker, for depth
    const fg = layerColor('foreground', ink);
    seaBand(BASE_Y + 82, (x) => ambient((x + travel * 1.3) * 0.8 + 700, t * 1.1, 1.4), fg, 0.8, 2.2);

    // spray + splash: update then draw
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt * 0.9;
      if (p.life <= 0) { spray.splice(i, 1); continue; }
      ctx.fillStyle = FOAM; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.life * 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const e of sea.events) {
      if (e.type === 'hit') for (let i = 0; i < 18; i++) splash.push({ x: sea.boat.x + (Math.random() - 0.5) * 90, y: sea.boat.y - 6, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 70, life: 1 });
    }
    for (let i = splash.length - 1; i >= 0; i--) {
      const p = splash[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.life -= dt * 0.6;
      if (p.life <= 0) { splash.splice(i, 1); continue; }
      ctx.fillStyle = FOAM; ctx.globalAlpha = Math.min(1, p.life * 1.4); ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); outline(1, 0.5 * p.life);
    }
    ctx.globalAlpha = 1;
    if (SCREEN_MIRRORED) ctx.restore();

    drawPaper();
    if (ui.bare) return;                              // just the picture (the album's live thumbnail)
    if (sea.state === 'title') drawTitle(sea, ui);
    else { drawHud(sea, ui); if (sea.state === 'complete') drawComplete(sea); }
    if (sea.paused) drawPause(sea, ui);
  }

  /** Plain paper (grain + vignette) across the whole screen, for the album. */
  function paper() { ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, VH); drawPaper(); }

  return { draw, resize, paper, debug: () => ({ travel, fujiX: fujiScreenX(), W }) };
}
