// THE RIVER (print 5, portrait trial): the painting. After Hiroshige's "Kawaguchi Ferry and Zenkoji Temple": a wide pale river
// sweeping down from the top left in long curves, deep indigo shading along its banks, rocky far bank with fields and dark woods,
// the temple roofs up in the trees, timber rafts poled down the stream, a ferry crossing, pines and a willow on the near bank.
// The picture is RIVER_W wide and sim.H tall; on a sideways screen (the PC, or the album card) it sits upright in the middle.
import { clamp } from './ocean.js';
import { RIVER_W, RTUNE, START_S, SCROLL_UP, camEnd, centre, halfWidth, REEDS, REED_S, REED_D, FERRY_S, SHOW_FERRY, RIVER_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT, frame, riverPoint, scaleAt,
  pauseRowY, doneButton, unloadButton } from './river.js';
import { createUI, inked, PAPER, INK, MUTED, SEAL } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// [colour on bare paper, final colour, ink where it starts, ink where it is done]
const LAYERS = {
  sky: ['#e4dfcc', '#26314c', 35, 100],
  woods: ['#cfcfc2', '#353f3c', 25, 90],     // (v1.5.16, Tom's palette, research/delivery 20: from his dark grey-green)
  field: ['#dedcc2', '#77492a', 10, 60],     // (v1.5.12, Tom's mockup, research/delivery 17: warm brown #6d4325 once the paper grain is over it; was green)
  rock: ['#ecebe2', '#d5d7d0', 0, 40],
  water: ['#e8e4d4', '#a3c6b7', 0, 40],     // the river: Tom's sage (#97b8aa on screen, under the grain), not blue
  indigo: ['#cfd0d2', '#495450', 15, 80],   // ... shading to his dark grey-green along the banks (was indigo)
  ground: ['#d8d5c8', '#a5512a', 10, 60],   // the near bank's path and lower ground: his rust (was grey-blue)
  grass: ['#d9dcc6', '#77492a', 20, 70],     // (the same brown on the near bank, was green #5a8850)
  log: ['#dcc6aa', '#a6673a', 10, 50],
  thatch: ['#eee2b6', '#e3c048', 30, 80],
  pine: ['#d4d8c6', '#c4512b', 25, 75],     // autumn: no green trees (v1.5.16)
  trunk: ['#d6ccbc', '#6b5640', 20, 70],
};
// autumn foliage (v1.5.16, Tom: "no green, just orange and red")
const AUTUMN = ['#d9792f', '#c4452a', '#e08a3c', '#b8392a', '#d26a2e', '#cf5a2a'];
const REED = '#8a877a';
// [u across, v down (picture heights; < 0 = the stretch above the print), size]: placed clear of the river at every screen height
// (v1.5.17: the near shore's huts and trees made way for the forest; these are the far shore's, and three below the landing)
// (v1.5.20: the far shore's and the three below the landing are part of the forest now)
const MAPLES = [];
// three little villages on the far shore, where Tom circled them (centres: u across, v down in picture heights), five huts each
// (v1.5.22, Tom: the middle one gone; each layout loose and uneven: [dx, dy (units), size, turn (radians)], the first the biggest)
const VILLAGES = [
  // (a 5th entry of 1 = a red roof, v1.5.25)
  { u: 0.88, v: -0.4, huts: [[0, 0, 1.15, 0.04], [-54, -26, 0.72, -0.1, 1], [26, -56, 0.66, 0.12], [-28, 46, 0.78, 0.07], [60, 18, 0.7, -0.06, 1], [10, 62, 0.62, 0.15]] },
  { u: 0.88, v: 0.07, huts: [[8, -6, 1.12, -0.05, 1], [-46, -50, 0.7, 0.1], [54, -34, 0.76, -0.12], [-60, 20, 0.66, 0.06, 1], [30, 48, 0.72, 0.09]] },
];
const RED_ROOFS = true;                                   // two red roofs in each village, one at the landing (v1.5.25 trial; false = all thatch)
const HUT_WALL = '#3a2a1f';                                // the huts' walls: dark enough to read against the brown ground (v1.5.21; was #6b5a48)
// the near shore's forest (v1.5.17): mainly browns, a few oranges, a scattering of yellows
const FOREST_BROWN = ['#7a4a2a', '#8b5a34', '#6c4226', '#94623a', '#83522e', '#a06a3c'];
const FOREST_ORANGE = ['#d9792f', '#c9692a', '#e08a3c'];
const FOREST_YELLOW = ['#f2bd1c', '#e8ac10'];   // (v1.5.20: a little more saturated, Tom)
// three crown shapes: [dx, dy, radius, second colour?]
const TREE_SHAPES = [
  [[-8, -22, 10, 1], [8, -23, 10, 1], [0, -31, 12, 0], [-6, -28, 8, 0]],
  [[-9, -20, 9, 1], [9, -21, 9, 0], [0, -26, 12, 0], [3, -34, 9, 1]],
  [[0, -22, 11, 1], [-7, -30, 10, 0], [7, -31, 10, 0], [0, -37, 8, 1]],
];
const STEER_PIVOT = 1;                                    // the raft turns about its stern (+1, steered from the front) or bow (-1)
const FLOW = 1.4;                                         // the flow lines' pace, as a multiple of the rafts' (the current)
const WATER_INSIDE_OUT = false;                           // true = dark mid-stream fading lighter to the banks (v1.5.18 trial: no)
const SHOW_PRINT_WOODS = false;                           // the print's dark woods band, temple roofs and lower huts (off from v1.5.19)
const BOKASHI = 22;                                       // layers in the soft indigo fade along each bank
// the other rafts' timber, each its own (v1.5.14, Tom: browns, ochres, khakis); yours keeps the 'log' colour
const WOODS = ['#9a6136', '#8a6a3c', '#b08a4a', '#9c7b45', '#7d5a34', '#a8915c'];
const SKIN = '#e6c8a2', YOU = '#a8452f';
// the boxes on the rafts: red, blue and yellow, muted but vibrant (v1.5.24, Tom); yours are one of each, unloaded in this order
const BOX_COLOURS = ['#b5482f', '#41679c', '#dba62f'];
const BOX_EDGE = 'rgba(40, 26, 16, 0.75)';
const YOUR_CARGO = [0, 1, 2];
const ROBES = ['#2f3d5c', '#4a5468', '#3a3f4a', '#5b6650'];
const PORTERS = [{ robe: '#3d6b5a', hat: true }, { robe: '#2f3d5c', hat: false }, { robe: '#6b5a48', hat: true }];
// the dark woods: a dense stand of thin trunks along the top, as in the print
const TRUNKS = Array.from({ length: 150 }, (_, i) => ({ u: ((i * 0.618034) % 1) * 1.04 - 0.02, top: (i * 0.37) % 1, w: 1 + ((i * 7) % 3) * 0.6 }));
const RIPPLES = Array.from({ length: 90 }, (_, i) => ({ s: (i * 0.618034) % 1, d: 0.12 + ((i * 0.381966 * 5) % 1) * 0.76, len: 0.012 + ((i * 13) % 5) * 0.004 }));

export function createRiverArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  const W = RIVER_W;
  let H = 1200, scale = 1, ox = 0, oy = 0, lastT = 0, cam = 0;   // cam: how far the view has scrolled (picture y at the top; <= 0)

  function resize() {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0)) return;
    const dpr = pixelRatio();
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  }
  /** Screen (client) point -> picture point, for the finger and taps. */
  function toPicture(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const px = ((clientX - r.left) / (r.width || 1)) * canvas.width, py = ((clientY - r.top) / (r.height || 1)) * canvas.height;
    return [(px - ox) / scale, (py - oy) / scale];
  }
  const C = (name, ink) => inked(LAYERS[name], ink);

  // ---------- the river's outline ----------
  function bankLine(d, s0 = START_S - 0.75, s1 = 2.3, n = 260) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; pts.push(riverPoint(s, d, H)); }
    return pts;
  }
  const trace = (pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };

  // ---------- the land ----------
  function drawLand(ink) {
    // fields on the far bank, the whole way down (both screens: the scroller's upper stretch and the print below it)
    const top = -SCROLL_UP * H;
    ctx.fillStyle = C('field', ink); ctx.fillRect(0, top - 60, W, 1.6 * H - top + 120);
    // (v1.5.19: the far shore is forest now, round a little village up the stretch above; the print's dark woods band, Zenko-ji's
    // roofs and the lower huts, path and travellers are switched off: SHOW_PRINT_WOODS)
    if (SHOW_PRINT_WOODS) {
    // the dark woods: a band across the print's top, reaching up into the stretch above (no sky: we look down from above)
    const wTop = (x) => H * (-0.2 + 0.04 * Math.sin(x / 61)) + 10 * Math.sin(x / 17);
    ctx.fillStyle = C('woods', ink);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wTop(x));
    for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, H * (0.26 + 0.03 * Math.sin(x / 47)) + 8 * Math.sin(x / 13));
    ctx.closePath(); ctx.fill();
    // thin trunks in the woods
    ctx.strokeStyle = C('woods', ink * 1.1); ctx.globalAlpha = 0.55;
    for (const t of TRUNKS) for (const band of [0, 1]) {
      const x = t.u * W, y0 = band ? H * (0.03 + 0.06 * t.top) : wTop(x) + 12 + H * 0.05 * t.top, y1 = band ? H * (0.25 + 0.04 * Math.sin(x / 47)) : H * 0.02;
      ctx.lineWidth = t.w; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 2, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    }
    if (!SHOW_PRINT_WOODS) return;
    // Zenko-ji's roofs up in the trees, top right
    roof(W * 0.8, H * 0.105, 64, '#5a2e2a', '#3d2220'); roof(W * 0.66, H * 0.13, 40, '#4a2a26', '#311c1a');
    // thatched huts on the far bank
    hut(W * 0.86, H * 0.33, 1, ink); hut(W * 0.98, H * 0.37, 0.8, ink); hut(W * 0.74, H * 0.37, 0.6, ink);
    // a path across the far fields, with two small travellers
    ctx.strokeStyle = C('rock', ink); ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W * 0.62, H * 0.44); ctx.quadraticCurveTo(W * 0.8, H * 0.36, W * 1.02, H * 0.39); ctx.stroke();
    figure(W * 0.88, H * 0.388, 0.45, '#2f3d5c', true); figure(W * 0.92, H * 0.39, 0.45, '#4a5468', false);
  }
  function roof(x, y, w, c, dark) {
    ctx.fillStyle = dark; ctx.fillRect(x - w * 0.36, y, w * 0.72, w * 0.22);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w / 2, y + 4); ctx.quadraticCurveTo(x, y - w * 0.32, x + w / 2, y + 4); ctx.closePath(); ctx.fill();
  }
  function hut(x, y, k, ink, rot = 0, roof = null) {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.fillStyle = HUT_WALL; ctx.fillRect(-16 * k, 0, 32 * k, 12 * k);
    ctx.fillStyle = roof || C('thatch', ink); ctx.beginPath(); ctx.moveTo(-24 * k, 2 * k); ctx.lineTo(-10 * k, -16 * k); ctx.lineTo(12 * k, -16 * k); ctx.lineTo(26 * k, 2 * k); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawRiver(ink, t) {
    const far = bankLine(1), near = bankLine(0);
    // (the far bank's pale rocky edge is gone, v1.5.17: Tom read it as a path along the river)
    // the water
    ctx.save();
    ctx.beginPath(); trace(far); for (let i = near.length - 1; i >= 0; i--) ctx.lineTo(near[i][0], near[i][1]); ctx.closePath();
    // INSIDE OUT (v1.5.18, Tom: dark in the middle, lighter at the banks: the same two colours, swapped; false = the old way)
    const mid = WATER_INSIDE_OUT ? C('indigo', ink) : C('water', ink), edge = WATER_INSIDE_OUT ? C('water', ink) : C('indigo', ink);
    ctx.fillStyle = mid; ctx.fill();
    ctx.clip();
    // deep indigo shading along both banks (the print's bokashi), fading smoothly toward mid-stream. (v1.5.4, Tom: it looked
    // banded: four thick stripes stacked up. Now many thin layers, each a touch wider and fainter, so the steps can't be seen.)
    ctx.strokeStyle = edge;
    for (const [pts, k] of [[far, 1], [near, 0.85]]) for (let i = 0; i < BOKASHI; i++) {
      const u = i / (BOKASHI - 1);
      ctx.globalAlpha = 0.055 * k; ctx.lineWidth = 12 + 170 * u * u; ctx.beginPath(); trace(pts); ctx.stroke();
    }
    // and a soft darker drift of current down the middle
    for (let i = 0; i < 8; i++) { ctx.globalAlpha = 0.022; ctx.lineWidth = 10 + i * 9; ctx.beginPath(); trace(bankLine(0.6)); ctx.stroke(); }
    // little pale streaks drifting with the current
    ctx.strokeStyle = '#eef1ee'; ctx.lineWidth = 1.4;
    for (const r of RIPPLES) {
      // (they run a little faster than the rafts, v1.5.13: at the rafts' own pace the water looked still)
      const span = 1.75 - START_S, s = ((r.s * span + t / RTUNE.journeySecs * FLOW) % span) + START_S - 0.15;
      const a = riverPoint(s, r.d, H), b = riverPoint(s + r.len, r.d, H);
      ctx.globalAlpha = 0.35 * clamp(Math.min(s - START_S + 0.15, 1.6 - s) * 6, 0, 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawReeds(ink) {
    ctx.strokeStyle = REED; ctx.lineWidth = 1.2;
    for (const r of REEDS) {
      for (let k = 0; k < 40; k++) {
        const s = r.s + ((k * 0.618) % 1 - 0.5) * 2 * REED_S, d = r.d + ((k * 0.382 * 3) % 1 - 0.5) * 1.6 * REED_D;
        const [x, y] = riverPoint(s, d, H), h = (9 + (k % 4) * 3) * scaleAt(s);
        ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ((k % 3) - 1) * 2, y - h); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // the near bank: everything on the bottom-left side of the river
  function drawNearBank(ink) {
    const near = bankLine(0);
    ctx.beginPath(); trace(near); ctx.lineTo(-60, 1.7 * H); ctx.lineTo(-60, -SCROLL_UP * H - 120); ctx.closePath();
    const g = ctx.createLinearGradient(0, H * 0.5, W * 0.5, H);
    g.addColorStop(0, C('grass', ink)); g.addColorStop(0.55, C('grass', ink)); g.addColorStop(1, C('ground', ink));
    ctx.fillStyle = g; ctx.fill();
    // the grey path along the bank to the landing
    const L = landing();
    ctx.fillStyle = C('ground', ink);
    ctx.beginPath(); ctx.moveTo(-20, H * 0.72); ctx.quadraticCurveTo(W * 0.2, H * 0.8, L[0] + 20, L[1] - 6); ctx.lineTo(L[0] + 30, L[1] + 40);
    ctx.quadraticCurveTo(W * 0.15, H * 0.95, -20, H * 0.9); ctx.closePath(); ctx.fill();
    // the landing stage: a few planks out into the water
    ctx.fillStyle = '#7a5f42';
    const [bx, by] = riverPoint(1, -0.02, H), [ex, ey] = riverPoint(1, 0.09, H);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(ey - by, ex - bx));
    ctx.fillRect(-10, -14, Math.hypot(ex - bx, ey - by) + 12, 28);
    ctx.strokeStyle = '#4e3b29'; ctx.lineWidth = 1; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 9, -14); ctx.lineTo(-10 + i * 9, 14); ctx.stroke(); }
    ctx.restore();
  }
  const landing = () => riverPoint(1, -0.16, H);

  function drawTrees(ink) {
    // autumn FOREST on both shores (v1.5.19: the far shore too, round its village); the near (left) shore from the top down to just
    // above the landing (v1.5.17, Tom: no huts; mainly brown,
    // a few orange, a scattering of yellow). Only the trees in view are drawn.
    for (const t of forestFor(H)) if (t.y > cam - 90 && t.y < cam + H + 20) tree(t, ink);
    // autumn trees on the far shore, and a few below the landing (v1.5.16)
    MAPLES.forEach(([u, v, k], i) => maple(W * u, H * v, k, AUTUMN[i % AUTUMN.length], AUTUMN[(i + 3) % AUTUMN.length], ink));
    // the huts at the landing, yellow thatch: the ferry hut (moved up from the bottom edge, Tom v1.5.13) and, where the tall pine
    // and the willow stood, two more the same size (v1.5.23, Tom, research/delivery 28)
    for (const [x, y, k, rot, red] of landingHuts(H)) hut(x, y, k, ink, rot, red ? BOX_COLOURS[0] : null);
    // (v1.5.20: the red pine by the water, bottom right, removed: Tom)
  }

  // ---------- the forest on the near shore ----------
  let forest = null;
  /** Where the forest's trees stand for this picture height: a jittered grid over the near shore, each tree kept clear of the water
   *  by more than its crown, from the top of the scroll down to just above the landing hut. Made once per height. */
  function forestFor(h) {
    if (forest && forest.h === h) return forest.trees;
    let seed = 1859; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [], step = 30, top = -SCROLL_UP * h - 60, bottom = h * 1.75, nearBottom = h * 0.64;
    for (let y = top; y < bottom; y += step * 0.8) for (let x = -10; x < W + 10; x += step) {
      const tx = x + (r() - 0.5) * step * 0.9, ty = y + (r() - 0.5) * step * 0.7, k = 0.8 + r() * 0.45;
      // how far it stands from the near bank (along the river's normal at the nearest point of the middle line)
      let best = 1e9, bs = 0;
      for (let s = START_S - 0.8; s <= 2.3; s += 0.01) { const c = centre(s, h), d = Math.hypot(c[0] - tx, c[1] - ty); if (d < best) { best = d; bs = s; } }
      const c = centre(bs, h), f = frame(bs, h), across = (tx - c[0]) * f.nx + (ty - c[1]) * f.ny, out = Math.abs(across) - halfWidth(bs, h);
      if (out < 26 * k) continue;                              // in the water, or a crown over the water
      // the near shore: forest down to just above the landing hut, and again below the porters' ground (v1.5.20)
      if (across < 0 && ty > nearBottom && ty < h * 0.93) continue;
      // the far shore too (v1.5.19), except the villages' clearings
      // (tested on the crown, which stands ~28 units above the trunk's foot and is ~16 across: it must not cover a hut or a path)
      const cy = ty - 28 * k, cr = 17 * k;
      // a clearing that hugs each hut (so the villages' edges are as loose as their layouts)
      if ([...villageHuts(h), ...landingHuts(h)].some(([hx, hy, hk]) => Math.hypot(tx - hx, cy - (hy - 4)) < 30 * hk + cr || Math.hypot(tx - hx, ty - hy) < 20 * hk)) continue;
      const pick = r(), col = pick < 0.8 ? FOREST_BROWN : pick < 0.93 ? FOREST_ORANGE : FOREST_YELLOW;   // 80% brown, 13% orange, 7% yellow
      trees.push({ x: tx, y: ty, k, c1: col[Math.floor(r() * col.length)], c2: col[Math.floor(r() * col.length)], v: Math.floor(r() * 3) });
    }
    trees.sort((a, b) => a.y - b.y);                           // further up first, so nearer crowns overlap them
    forest = { h, trees };
    return trees;
  }
  /** One forest tree: a short trunk and a round crown of a few blobs; three slightly different shapes. */
  function tree(t, ink) {
    const { x, y, k, c1, c2, v } = t;
    ctx.strokeStyle = C('trunk', ink); ctx.lineWidth = 3.4 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k, y - 18 * k); ctx.stroke();
    for (const [dx, dy, rr, two] of TREE_SHAPES[v]) {
      ctx.fillStyle = two ? c2 : c1; ctx.beginPath(); ctx.arc(x + dx * k, y + dy * k, rr * k, 0, Math.PI * 2); ctx.fill();
    }
  }
  // ---------- the villages on the far shore (v1.5.20, Tom's notes, research/delivery 23; v1.5.22: two villages, no paths, no
  // people, each its own loose, organic layout) ----------
  /** Where a village's huts stand (world x, y, size, a slight turn), from the top down so lower roofs overlap higher ones. */
  // [x, y, size, turn, red roof?]
  const landingHuts = (h) => [[W * 0.15, h * 0.66, 2.2, 0, RED_ROOFS], [W * 0.27, h * 0.75, 2.2, 0, false], [W * 0.11, h * 0.88, 2.2, 0, false]];
  const villageHuts = (h) => VILLAGES.flatMap((vg) => vg.huts.map(([dx, dy, k, rot, red]) => [W * vg.u + dx, h * vg.v + dy, k, rot, RED_ROOFS && !!red])).sort((a, b) => a[1] - b[1]);
  function drawVillages(ink) {
    for (const [x, y, k, rot, red] of villageHuts(H)) hut(x, y, k, ink, rot, red ? BOX_COLOURS[0] : null);
  }
  /** A round autumn tree (a maple, say): a short trunk and a crown of overlapping blobs in two leaf colours. */
  function maple(x, y, k, c1, c2, ink) {
    ctx.strokeStyle = C('trunk', ink); ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * k, y - 34 * k); ctx.stroke();
    for (const [dx, dy, r, c] of [[-12, -40, 15, c2], [12, -42, 14, c2], [0, -54, 17, c1], [-14, -56, 12, c1], [14, -58, 12, c1], [2, -40, 13, c1]]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2); ctx.fill();
    }
  }


  // ---------- people, rafts, the ferry ----------
  /** Your boxes as the raft shows them: one colour each, null where a box has gone up (or is on its way up) to a porter. */
  const yourBoxes = (sim) => { const gone = RTUNE.boxes - sim.boxes + (sim.lift ? 1 : 0); return YOUR_CARGO.map((c, i) => (i < gone ? null : c)); };
  function figure(x, y, k, robe, hat, lean = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(lean); ctx.scale(k, k);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-4, -12); ctx.moveTo(3, 0); ctx.lineTo(4, -12); ctx.stroke();
    ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.lineTo(5, -30); ctx.lineTo(-5, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(0, -34, 4.4, 0, Math.PI * 2); ctx.fill();
    if (hat) { ctx.fillStyle = '#d9bb5f'; ctx.beginPath(); ctx.moveTo(-9, -35); ctx.lineTo(0, -42); ctx.lineTo(9, -35); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  /** A timber raft lying along the stream at s, d, poled from the back. yaw (radians, + = bow toward the far bank): it turns about
   *  its STERN, so the bow swings round toward where it is going: steered from the front (v1.5.7, Tom's trial; v1.5.5-v1.5.6
   *  turned about the bow, steered from the back, which felt off). PIVOT: +1 = turn about the stern, -1 = about the bow. */
  function raft(s, d, len, pole, robe, boxes = [], you = false, yaw = 0, wood = null) {
    const [x0, y0] = riverPoint(s, d, H), f = frame(s, H), k = scaleAt(s);
    const L = 120 * k * len, Wd = 15 * k;
    const turn = (f.nx * -f.ty + f.ny * f.tx) >= 0 ? 1 : -1, rot = Math.atan2(f.ty, f.tx) + turn * yaw, tx = Math.cos(rot), ty = Math.sin(rot);
    const pv = -STEER_PIVOT * L * 0.35, piv = [x0 + f.tx * pv, y0 + f.ty * pv], x = piv[0] - tx * pv, y = piv[1] - ty * pv;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // a faint wake
    ctx.strokeStyle = '#eef1ee'; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-L / 2 - 4, -Wd / 2 - 2); ctx.lineTo(-L / 2 - 30 * k, -Wd / 2 - 7 * k); ctx.moveTo(-L / 2 - 4, Wd / 2 + 2); ctx.lineTo(-L / 2 - 30 * k, Wd / 2 + 7 * k); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = wood || C('log', 100); ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    ctx.strokeStyle = '#6e4224'; ctx.lineWidth = 0.9;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-L / 2, -Wd / 2 + (Wd * i) / 4); ctx.lineTo(L / 2, -Wd / 2 + (Wd * i) / 4); ctx.stroke(); }
    ctx.strokeRect(-L / 2, -Wd / 2, L, Wd);
    ctx.beginPath(); ctx.moveTo(-L / 2 + 6, -Wd / 2); ctx.lineTo(-L / 2 + 6, Wd / 2); ctx.moveTo(L / 2 - 6, -Wd / 2); ctx.lineTo(L / 2 - 6, Wd / 2); ctx.stroke();
    // the boxes: a list of colour numbers (null = a box already handed up: the rest keep their places). Yours start a little
    // forward of the middle; the others' loads sit centred a touch forward, clear of the raftsman at the back
    const first = you ? -L * 0.05 : L * 0.05 - ((boxes.length - 1) * 17 * k) / 2;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i] == null) continue;
      const bx = first + i * 17 * k;
      ctx.fillStyle = BOX_COLOURS[boxes[i]]; ctx.fillRect(bx - 7 * k, -7 * k, 14 * k, 14 * k);
      ctx.strokeStyle = BOX_EDGE; ctx.lineWidth = 1; ctx.strokeRect(bx - 7 * k, -7 * k, 14 * k, 14 * k);
    }
    ctx.restore();
    // the raftsman stands upright at the back, his pole reaching down into the water
    const back = [x - tx * L * 0.38, y - ty * L * 0.38];
    const sw = Math.sin(pole * 2.2);
    ctx.strokeStyle = '#4e3b29'; ctx.lineWidth = 1.6 * k + 0.4;
    ctx.beginPath(); ctx.moveTo(back[0] - tx * 40 * k + 10 * k * sw, back[1] - 44 * k - ty * 20 * k); ctx.lineTo(back[0] + tx * 34 * k - 6 * k * sw, back[1] + 10 * k + ty * 16 * k); ctx.stroke();
    figure(back[0], back[1] + 3 * k, k * (you ? 1.05 : 0.95), robe, !you || true, 0.12 * sw);
    if (you) {   // a soft ring so you can always find yourself
      ctx.strokeStyle = 'rgba(168,69,47,0.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, L * 0.62, 16 * k + 6, rot, 0, Math.PI * 2); ctx.stroke();
    }
  }
  function ferry(fy) {
    const [x, y] = riverPoint(FERRY_S, fy.d, H), f = frame(FERRY_S, H), k = scaleAt(FERRY_S);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(f.ny, f.nx) + Math.PI);   // the ferry lies across the stream
    ctx.fillStyle = '#5a4330'; ctx.beginPath(); ctx.moveTo(-60 * k, -6 * k); ctx.lineTo(54 * k, -6 * k); ctx.lineTo(66 * k, -11 * k); ctx.lineTo(56 * k, 6 * k); ctx.lineTo(-56 * k, 6 * k); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 22 * k;
      figure(x + f.nx * o, y + f.ny * o + 2, k * 0.7, ['#3d6b5a', '#5b6650', '#2f3d5c', '#e8e2d0'][i], i % 2 === 0, 0);
    }
  }
  function drawPorters(sim) {
    const L = landing(), dir = [-0.96, -0.28], lift = sim.lift;
    sim.porters.forEach((q, i) => {
      if (q.state === 'gone') return;
      const home = [L[0] - 18 - i * 26, L[1] + 10 + (i % 2) * 9];
      const x = home[0] + dir[0] * q.walk, y = home[1] + dir[1] * q.walk, k = 1.05;
      const P = PORTERS[i];
      figure(x, y, k, P.robe, P.hat, q.state === 'reach' ? 0.25 : 0);
      if (q.state === 'carry' && !(lift && lift.n === i)) {     // the box on his shoulder
        ctx.fillStyle = BOX_COLOURS[YOUR_CARGO[i]]; ctx.fillRect(x - 3, y - 47, 15, 13); ctx.strokeStyle = BOX_EDGE; ctx.lineWidth = 1; ctx.strokeRect(x - 3, y - 47, 15, 13);
      }
    });
    if (lift) {   // the box on its way up from the raft into his hands
      const p = sim.player, f = frame(1, H), k = scaleAt(1), slot = -120 * k * 0.05 + (RTUNE.boxes - sim.boxes) * 17 * k;
      const [rx, ry] = riverPoint(p.s, p.d, H), from = [rx + f.tx * slot, ry + f.ty * slot];
      const q = sim.porters[lift.n], to = [L[0] - 18 - lift.n * 26 + 3, L[1] + 10 + (lift.n % 2) * 9 - 40];
      const u = clamp(lift.t / (RTUNE.liftSecs * 0.6), 0, 1), x = from[0] + (to[0] - from[0]) * u, y = from[1] + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * 30;
      if (q.state !== 'gone') { ctx.fillStyle = BOX_COLOURS[YOUR_CARGO[lift.n]]; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeStyle = BOX_EDGE; ctx.lineWidth = 1; ctx.strokeRect(x - 7, y - 7, 14, 14); }
    }
  }

  // ---------- the screens on top ----------
  function message(m) {
    if (!m) return;
    const a = Math.min(1, m.t / 0.6, (m.total - m.t) / 0.5);
    ctx.globalAlpha = clamp(a, 0, 1); ui.text(m.text, W / 2, 104, 21, INK, 'center', 'italic'); ctx.globalAlpha = 1;
  }
  function drawUnloadButton(sim, time) {
    if (sim.state !== 'unload' || sim.boxes <= 0) return;
    const [cx, cy, r] = unloadButton(H), pulse = 0.5 + 0.5 * Math.sin(time * 4), busy = !!sim.lift;
    ctx.save(); ctx.globalAlpha = busy ? 0.45 : 1;
    ctx.fillStyle = `rgba(234,215,168,${0.3 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(cx, cy, r + 10 + 6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(239,228,198,0.94)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = BOX_COLOURS[YOUR_CARGO[Math.min(2, RTUNE.boxes - sim.boxes)]]; ctx.fillRect(cx - 13, cy - 26, 26, 24); ctx.strokeStyle = BOX_EDGE; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 13, cy - 26, 26, 24);
    ui.text('UNLOAD', cx, cy + 22, 14, INK, 'center');
    ui.text(sim.boxes + ' LEFT', cx, cy + r + 24, 13, MUTED, 'center');
    ctx.restore();
  }
  function drawPause(sim) {
    ctx.fillStyle = 'rgba(239,228,198,0.92)'; ctx.fillRect(0, 0, W, H);
    ui.text('PAUSED', W / 2, H * 0.17, 50, INK, 'center');
    RIVER_PAUSE_ROWS.forEach((id, i) => {
      const y = pauseRowY(i, H), sel = sim.pauseRow === i;
      if (sel) { ctx.fillStyle = 'rgba(22,33,59,0.1)'; ui.roundRect(W / 2 - 250, y - 32, 500, 64, 10); ctx.fill(); }
      const label = { resume: 'RESUME', album: 'BACK TO THE ALBUM', sound: 'SOUND: ' + (sim.settings.sound ? 'ON' : 'OFF'),
        restart: sim.restartArmed ? 'TAP AGAIN TO START OVER' : 'START THE PRINT OVER' }[id];
      ui.text(label, W / 2, y, 22, id === 'restart' && sim.restartArmed ? SEAL : INK, 'center', id === 'resume' ? 'bold' : '');
    });
    ui.text('SLIDE A FINGER TO POLE ACROSS THE STREAM', W / 2, pauseRowY(RIVER_PAUSE_ROWS.length, H), 14, MUTED, 'center');
    ui.text('v' + BUILD, 18, H - 18, 12, MUTED, 'left');
  }
  function drawComplete(sim) {
    const a = clamp(sim.completeT / 2, 0, 1);
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a;
    ui.text('THE RIVER', W / 2, H * 0.3, 46, INK, 'center', 'bold');
    ui.text('DELIVERED', W / 2, H * 0.3 + 52, 22, INK, 'center');
    ui.seal(W - 80, H - 90, 1.5);
    ctx.globalAlpha = 1;
    if (sim.completeT < DONE_WAIT) return;
    const b = clamp((sim.completeT - DONE_WAIT) / 0.6, 0, 1);
    DONE_CHOICES.forEach((label, i) => {
      const [cx, cy, w, h] = doneButton(i, H), sel = sim.doneChoice === i;
      ctx.globalAlpha = b;
      ctx.fillStyle = sel ? 'rgba(214,200,166,0.95)' : 'rgba(239,228,198,0.9)'; ui.roundRect(cx - w / 2, cy - h / 2, w, h, 10); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = sel ? 2.4 : 1.4; ctx.stroke();
      ui.text(label, cx, cy, 22, INK, 'center', i === 0 ? 'bold' : '');
    });
    ctx.globalAlpha = 1;
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    H = sim.H;
    // fit the upright picture into the canvas (on a sideways screen it stands in the middle on plain paper)
    scale = Math.min(canvas.width / W, canvas.height / H); ox = (canvas.width - W * scale) / 2; oy = (canvas.height - H * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ink = 100;                    // (v1.5.5, Tom: no inking-in on this print: full colour from the start)

    // the view follows your raft down the river (v1.5.8): it keeps you about a third of the way down the screen, easing along,
    // and settles on the print itself at the landing. Behind the album card and at the end it shows the print.
    // (v1.5.15, Tom: keep scrolling until the landing is in the middle of the screen; it rests there while you unload)
    let camTo = 0;
    if (!uiState.bare && sim.state !== 'title') camTo = sim.state === 'play' ? clamp(riverPoint(sim.player.s, sim.player.d, H)[1] - H * 0.32, -SCROLL_UP * H, camEnd(H)) : camEnd(H);
    if (Math.abs(camTo - cam) > H * 0.5 || uiState.bare) cam = camTo; else cam += (camTo - cam) * Math.min(1, dt * 1.2);
    if (Number.isFinite(uiState.camAt)) cam = uiState.camAt;   // (for tests and whole-river pictures: point the camera anywhere)
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.translate(0, -cam);
    drawLand(ink);
    drawVillages(ink);
    drawRiver(ink, sim.t);
    drawNearBank(ink);
    drawReeds(ink);
    // everything on the water, furthest (highest up the picture) first
    const things = sim.others.map((o) => ({ s: o.s, f: () => raft(o.s, o.d, o.len, o.pole, ROBES[Math.floor(o.phase) % ROBES.length], o.cargo || [], false, 0, WOODS[(o.wood || 0) % WOODS.length]) }));
    if (SHOW_FERRY) things.push({ s: FERRY_S, f: () => ferry(sim.ferry) });
    if (sim.state !== 'title') things.push({ s: sim.player.s, f: () => raft(sim.player.s, sim.player.d, 1.05, sim.player.pole, YOU, yourBoxes(sim), true, sim.player.yaw) });
    things.sort((a, b) => a.s - b.s).forEach((th) => th.f());
    drawPorters(sim);
    drawTrees(ink);
    ctx.translate(0, cam);
    ui.paperGrain(W, H);
    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      message(sim.message);
      drawUnloadButton(sim, now / 1000);
      if (sim.state === 'complete') drawComplete(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  /** Where the picture was last painted on the canvas (canvas pixels): [x, y, width, height]. For the album's upright card. */
  const pictureRect = () => [ox, oy, W * scale, H * scale];
  return { draw, resize, toPicture, pictureRect };
}
