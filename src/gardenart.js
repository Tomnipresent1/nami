// KAMATA's painting, after Hiroshige: a rose-pink sky, the pale green garden fading to deep teal at your feet, bare dark plum trees
// starred with white blossom, golden thatched tea huts, the parked kago with its green cloth stirring, people in bright kimono,
// and petals blowing through the air. A paper-theatre camera: everything is a flat painted cut-out standing in the garden, and the
// camera follows behind and above you, so the cut-outs slide past and grow as you walk in. This file only draws.
import { VH, clamp } from './ocean.js';
import { pathX, HUTS, KAGO, POND, TREE_KINDS, pickButton, KEEPER, VASE, OFFER_SPOT, GTUNE, GARDEN_PAUSE_ROWS, G_FINGER_OPTS, STROLL_CHOICES, DONE_CHOICES, DONE_WAIT } from './garden.js';
import { CHOICE_WAIT } from './choice.js';
import { createUI, inked, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';

// ---- the camera (all of these can be tuned for feel) ----
// F = zoom (bigger = a longer lens: flatter, more layered, closer to the prints' "cheated" near-orthographic look). back = how far behind
// you the camera floats; F / back sets your size (kept the same as v24). horizon = how far down the screen the horizon sits.
// (v24: F 440, back 7, horizon 250, height 3: felt wide and sparse; Tom wants intimate and enclosed. v25: F 900, back 14.
//  v26: flatter again, F 1250. v27: everything 30% bigger (Tom): F 1625, camera a little lower so you stay on screen)
const CAM = { F: 1625, horizon: 290, height: 2.35, back: 19.5, follow: 0.7, ease: 2 };
const START_INK = 25;
const LAYERS = {
  skyTop: ['#efd9c4', '#d4604f', 8, 40],      // deep rose at the top...
  skyMid: ['#f2e0cc', '#ea977e', 8, 40],
  skyLow: ['#f4e7d6', '#f6d3b6', 8, 40],      // ...pale peach at the horizon
  farTrees: ['#e6ddd0', '#b9a3a8', 14, 44],
  groundFar: ['#e9ecdc', '#cfe2c2', 6, 36],
  groundMid: ['#dde6d4', '#93c4a2', 6, 44],
  groundNear: ['#cfdccf', '#2b7869', 6, 56],  // the deep teal band along the bottom of the print
  pond: ['#dfe8ea', '#5c9fc9', 14, 44],
  shadow: ['#d5dccd', '#4f8a6e', 14, 50],
};
const SKIN = '#ecd2b0', HAIR = '#1d1a1c';
// What people wear (Tom: more variety, "it's a bit like walking through a cult headquarters"): kimono in an Edo-period palette with
// the patterns you see all through ukiyo-e: asanoha (hemp-leaf star), seigaiha (waves), ichimatsu (chequers), kikko (tortoiseshell),
// stripes, fine dots. [ground colour, pattern, pattern colour, sash, haori jacket colour or null]
const OUTFITS = [
  ['#2d4b7d', 'asanoha', '#a9c0d8', '#e7c76a', null],
  ['#6b4a35', 'stripes', '#a8835c', '#2a2420', '#2b2a30'],
  ['#3f5d55', 'dots', '#c9d6c6', '#9b2c2c', null],
  ['#8a2f2a', 'seigaiha', '#e3b9a4', '#e9dcb8', null],
  ['#4a4a55', 'check', '#6f6f7c', '#c7a45a', '#22242b'],
  ['#5d3f5f', 'kikko', '#b49cb4', '#e7c76a', null],
  ['#2a3f63', 'stripes', '#7f97b8', '#d9d2c0', null],
  ['#7a5a3a', 'dots', '#d8bf94', '#2d4b7d', '#3b2e26'],
  ['#3d5f7a', 'seigaiha', '#b9d0de', '#9b2c2c', null],
  ['#6e2e3a', 'asanoha', '#d9a9a6', '#2a2a2a', null],
  ['#56603e', 'kikko', '#aab38a', '#b2362e', '#2e3324'],
  ['#c06a3a', 'check', '#9a4f28', '#2d4b7d', null],
  ['#384a3e', 'plain', null, '#d9b85f', '#1f2622'],
  ['#9c7a4c', 'stripes', '#5e4a30', '#6e2e3a', null],
];
const TILE = 40, TILE_UNITS = 0.26;              // one pattern repeat is about a quarter of a unit (a hand's width) on the cloth
function makePatternTile(type, base, fg) {
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const x = c.getContext('2d'), T = TILE;
  x.fillStyle = base; x.fillRect(0, 0, T, T);
  x.strokeStyle = fg; x.fillStyle = fg; x.lineWidth = 2;
  if (type === 'stripes') { for (const sx of [6, 20, 26]) x.fillRect(sx, 0, sx === 20 ? 5 : 2, T); }
  else if (type === 'check') { x.fillRect(0, 0, T / 2, T / 2); x.fillRect(T / 2, T / 2, T / 2, T / 2); }
  else if (type === 'dots') { for (const [dx, dy] of [[10, 10], [30, 30], [30, 10], [10, 30], [20, 20]]) { x.beginPath(); x.arc(dx, dy, dx === 20 ? 2.5 : 1.8, 0, Math.PI * 2); x.fill(); } }
  else if (type === 'seigaiha') {
    // overlapping fans of concentric arcs, row upon row, like waves
    for (const [cx, cy] of [[0, T], [T, T], [T / 2, T / 2], [0, 0], [T, 0]]) for (const rr of [T * 0.48, T * 0.34, T * 0.2]) { x.beginPath(); x.arc(cx, cy, rr, Math.PI, 0); x.stroke(); }
  } else if (type === 'kikko') {
    x.lineWidth = 1.6; const h = T / 2;
    x.beginPath(); x.moveTo(T * 0.25, 0); x.lineTo(T * 0.75, 0); x.moveTo(T * 0.75, 0); x.lineTo(T, h); x.lineTo(T * 0.75, T); x.lineTo(T * 0.25, T); x.lineTo(0, h); x.lineTo(T * 0.25, 0); x.stroke();
  } else if (type === 'asanoha') {
    // the hemp-leaf star: lines radiating from the centre and corners
    x.lineWidth = 1.2; const m = T / 2;
    x.beginPath();
    for (const [px, py] of [[0, 0], [T, 0], [0, T], [T, T], [m, 0], [m, T], [0, m], [T, m]]) { x.moveTo(m, m); x.lineTo(px, py); }
    for (const [px, py] of [[0, 0], [T, 0], [0, T], [T, T]]) { x.moveTo(px, py); x.lineTo(m, py === 0 ? T * 0.25 : T * 0.75); }
    x.stroke();
  }
  return c;
}
const YOU = '#a8452f';

// ---- painted cut-outs, made once ----
function rng(seed) { let a = Math.floor(seed * 1e6) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TREE_PX = 76;                          // sprite pixels per garden unit (a tree is about 8 units tall)
// each painted tree has its own trunk tone and amount of blossom, so the orchard never looks like one tree repeated (Tom)
const TRUNKS = ['#3a2d2a', '#4a3a33', '#2e2523', '#53413a', '#3d3330', '#4b3b2e', '#352a2d', '#42332b'];
const BLOOM = [1, 0.8, 0.62, 1, 0.9, 0.7, 1, 0.85];
const PETAL = ['#fbf6ec', '#fdf3ee', '#f8f4ea', '#fbf1ef', '#fbf6ec', '#f6f1e6', '#fdf5f3', '#faf6ee'];
function makeTree(kind) {
  const W = 760, H = 608, k = H / 720, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(kind + 0.123), bark = TRUNKS[kind % TRUNKS.length];
  const tips = [];
  const branch = (bx, by, ang, len, w, depth) => {
    const bend = (r() - 0.5) * 0.5, ex = bx + Math.cos(ang) * len, ey = by - Math.sin(ang) * len;
    const mx = (bx + ex) / 2 + Math.cos(ang + Math.PI / 2) * len * bend * 0.3, my = (by + ey) / 2 - Math.sin(ang + Math.PI / 2) * len * bend * 0.3;
    x.strokeStyle = bark; x.lineWidth = w * k; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
    if (depth <= 2) for (let k = 0; k < 3; k++) { const u = 0.3 + r() * 0.7; tips.push([bx + (ex - bx) * u + (r() - 0.5) * 6, by + (ey - by) * u + (r() - 0.5) * 6]); }
    if (depth === 0) { tips.push([ex, ey]); return; }
    const n = depth > 3 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spread = 0.35 + r() * 0.45, a = ang + (i - (n - 1) / 2) * spread + (r() - 0.5) * 0.3;
      // plum branches kink sharply and reach up: keep them mostly upward
      branch(ex, ey, clamp(a, 0.15, Math.PI - 0.15), len * (0.62 + r() * 0.18), Math.max(1.2, w * 0.62), depth - 1);
    }
  };
  // a thick, gnarled trunk that splits low
  const bx = W / 2, by = H - 8, split = H * (0.36 + r() * 0.12), tw = (0.85 + r() * 0.35) * k;
  x.fillStyle = bark;
  x.beginPath(); x.moveTo(bx - 34 * tw, by); x.quadraticCurveTo(bx + (-20 + (r() - 0.5) * 30) * tw, by - split * 0.5, bx - 22 * tw, by - split);
  x.lineTo(bx + 20 * tw, by - split); x.quadraticCurveTo(bx + (18 + (r() - 0.5) * 30) * tw, by - split * 0.5, bx + 36 * tw, by); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(130,104,92,0.45)'; x.lineWidth = 3 * k; x.beginPath(); x.moveTo(bx - 6 * tw, by - 10); x.quadraticCurveTo(bx + 4 * tw, by - split * 0.5, bx - 4 * tw, by - split + 10); x.stroke();
  branch(bx - 12 * tw, by - split + 4, Math.PI / 2 + 0.45 + r() * 0.2, H * 0.24, 26, 5);
  branch(bx + 12 * tw, by - split + 4, Math.PI / 2 - 0.45 - r() * 0.2, H * 0.24, 24, 5);
  if (r() < 0.6) branch(bx, by - split, Math.PI / 2 + (r() - 0.5) * 0.3, H * 0.2, 18, 4);
  // white plum blossom, with a few pink-hearted ones and dark buds; some trees fuller than others
  const bloom = BLOOM[kind % BLOOM.length];
  for (const [tx, ty] of tips) {
    if (r() > bloom) continue;
    if (r() < 0.25) { x.fillStyle = bark; x.beginPath(); x.arc(tx, ty, 2.2 * k, 0, Math.PI * 2); x.fill(); continue; }
    const s = (4.5 + r() * 3) * k;
    x.fillStyle = PETAL[kind % PETAL.length]; x.beginPath(); x.arc(tx, ty, s, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(90,60,60,0.55)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = r() < 0.4 ? '#e09a9a' : '#d9b85f'; x.beginPath(); x.arc(tx, ty, s * 0.3, 0, Math.PI * 2); x.fill();
  }
  return { c, w: W / TREE_PX, h: H / TREE_PX };
}
const HUT_PX = 100;
function makeHut(double) {
  const W = double ? 1100 : 680, H = 520, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const one = (ox, w, h, roofH) => {
    const base = H - 6, eave = base - h;
    // the open front: a dark interior, a bench, posts
    x.fillStyle = '#4c3b30'; x.fillRect(ox + 30, eave, w - 60, h);
    x.fillStyle = '#c9a77a'; x.fillRect(ox + 40, base - 70, w - 80, 22);                       // bench
    x.fillStyle = '#6e5238'; for (const px of [ox + 30, ox + w / 2 - 6, ox + w - 42]) x.fillRect(px, eave, 12, h);
    x.fillStyle = '#d8c39a'; x.fillRect(ox + 34, eave + 10, w - 68, 26);                         // a rolled-up blind
    // seated visitors
    for (const [fx, col] of [[ox + w * 0.32, '#b2362e'], [ox + w * 0.62, '#2d4b7d']]) {
      x.fillStyle = col; x.fillRect(fx - 14, base - 118, 28, 50);
      x.fillStyle = SKIN; x.beginPath(); x.arc(fx, base - 128, 11, 0, Math.PI * 2); x.fill();
      x.fillStyle = HAIR; x.beginPath(); x.arc(fx, base - 133, 11, Math.PI, 0); x.fill();
    }
    // the thatched roof: a deep golden hip roof with a dark ridge
    const g = x.createLinearGradient(0, eave - roofH, 0, eave + 20);
    g.addColorStop(0, '#e9c97a'); g.addColorStop(1, '#bd8b3f');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(ox, eave + 22); x.lineTo(ox + w * 0.28, eave - roofH); x.lineTo(ox + w * 0.72, eave - roofH); x.lineTo(ox + w, eave + 22); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(110,74,30,0.45)'; x.lineWidth = 2;
    for (let i = 0; i <= 26; i++) { const u = i / 26; x.beginPath(); x.moveTo(ox + w * (0.28 + 0.44 * u), eave - roofH + 4); x.lineTo(ox + w * u, eave + 20); x.stroke(); }
    x.fillStyle = '#5a3f26'; x.fillRect(ox + w * 0.27, eave - roofH - 10, w * 0.46, 14);           // ridge
    x.strokeStyle = INK; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ox, eave + 22); x.lineTo(ox + w * 0.28, eave - roofH); x.lineTo(ox + w * 0.72, eave - roofH); x.lineTo(ox + w, eave + 22); x.closePath(); x.stroke();
  };
  if (double) { one(420, 660, 230, 180); one(0, 640, 240, 190); } else one(0, W, 240, 200);
  return { c, w: W / HUT_PX, h: H / HUT_PX };
}

export function createGardenArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  let W = 1300, scale = 1, artInk = 100, lastT = 0;
  let trees = null, huts = null, farBand = null;
  const cam = { x: pathX(0), z: -CAM.back };
  const petals = [];
  let grass = null;

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;
    W = w; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }
  function ensureSprites() {
    if (trees) return;
    trees = Array.from({ length: TREE_KINDS }, (_, i) => makeTree(i));
    huts = { single: makeHut(false), double: makeHut(true) };
    // the far orchard along the horizon: rows of little blossoming trees, misty
    // the far orchard: a dense thicket of little trees, rows behind rows, whose trunks come down past the horizon line, so the
    // place where ground meets sky is always hidden behind something, as in the print (Tom: keep the horizon hidden)
    farBand = document.createElement('canvas'); farBand.width = 1600; farBand.height = 200;
    const x = farBand.getContext('2d'), r = rng(0.77);
    for (let row = 0; row < 5; row++) for (let i = 0; i < 130; i++) {
      const tx = r() * 1600, h = 70 + r() * 70 - row * 9, base = 196 - row * 9;
      const a0 = 0.22 + row * 0.13;
      // a soft haze of blossom first, then the dark branches through it
      x.fillStyle = `rgba(246,232,226,${0.18 + row * 0.06})`;
      for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(tx + (r() - 0.5) * h * 0.7, base - h * (0.55 + r() * 0.35), h * (0.12 + r() * 0.1), 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = `rgba(70,56,60,${a0})`; x.lineWidth = 1.2 + row * 0.35;
      x.beginPath(); x.moveTo(tx, base); x.lineTo(tx + (r() - 0.5) * 6, base - h * 0.5);
      for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.7; x.moveTo(tx, base - h * 0.45); x.lineTo(tx + Math.cos(a) * h * 0.55, base - h * 0.45 + Math.sin(a) * h * 0.55); }
      x.stroke();
      x.fillStyle = `rgba(252,246,238,${0.45 + row * 0.1})`;
      for (let k = 0; k < 8; k++) { x.beginPath(); x.arc(tx + (r() - 0.5) * h * 0.9, base - h * (0.4 + r() * 0.6), 1.7, 0, Math.PI * 2); x.fill(); }
    }
    // tufts of grass dotted about the garden
    const g = rng(0.31); grass = [];
    for (let i = 0; i < 420; i++) grass.push({ x: pathX(0) + (g() - 0.5) * 70, z: g() * 260, s: 0.6 + g() * 0.8 });
    for (let i = 0; i < 120; i++) petals.push(newPetal(true));
  }
  const C = (name, ink) => inked(LAYERS[name], ink);
  const project = (x, y, z) => { const dz = z - cam.z; if (dz < 0.6) return null; const s = CAM.F / dz; return [W / 2 + (x - cam.x) * s, CAM.horizon + (CAM.height - y) * s, s, dz]; };
  // far things fade into the haze, near things fade so they never fill the screen
  // things between the camera and you: near the middle of the screen they fade out (so nothing blocks your view or turns into a
  // pale ghost); out at the edges they stay solid and sweep past, cropped by the frame like the print's big foreground trunk
  // (v26: only things that would actually stand in front of YOU fade, and quickly; the rest stay solid, no half-see-through ghosts)
  let youX = W / 2;
  const fadeFor = (dz, sx = W / 2) => {
    const haze = 1 - 0.5 * clamp((dz - 90) / 180, 0, 1);
    if (dz >= CAM.back - 1) return haze;                                        // beyond you: never in the way
    const inFront = Math.abs(sx - youX) < W * 0.13;
    return (inFront ? clamp((dz - CAM.back * 0.6) / (CAM.back * 0.12), 0, 1) : clamp((dz - 1.5) / 1.5, 0, 1)) * haze;
  };

  // ---------- backdrop ----------
  function drawSky(ink) {
    const g = ctx.createLinearGradient(0, 0, 0, CAM.horizon);
    g.addColorStop(0, C('skyTop', ink)); g.addColorStop(0.55, C('skyMid', ink)); g.addColorStop(1, C('skyLow', ink));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, CAM.horizon + 2);
  }
  function drawFarBand(ink) {
    ctx.save(); ctx.globalAlpha = clamp((ink - 10) / 40, 0.25, 1);
    const off = ((-cam.x * 6) % 1600 + 1600) % 1600;
    for (let x = -off; x < W; x += 1600) ctx.drawImage(farBand, x, CAM.horizon - 178, 1600, 200);     // its foot sits below the horizon line
    ctx.restore();
    // and a soft peach haze where sky meets ground, so there is never a hard line (Hiroshige's bokashi)
    const g = ctx.createLinearGradient(0, CAM.horizon - 70, 0, CAM.horizon + 40);
    const mist = C('skyLow', ink);
    g.addColorStop(0, mist + '00'); g.addColorStop(0.55, mist + 'b3'); g.addColorStop(0.75, mist + '99'); g.addColorStop(1, mist + '00');
    ctx.fillStyle = g; ctx.fillRect(0, CAM.horizon - 70, W, 110);
  }
  function drawGround(ink) {
    const g = ctx.createLinearGradient(0, CAM.horizon, 0, VH);
    g.addColorStop(0, C('groundFar', ink)); g.addColorStop(0.35, C('groundMid', ink)); g.addColorStop(0.75, C('groundMid', ink)); g.addColorStop(1, C('groundNear', ink));
    ctx.fillStyle = g; ctx.fillRect(0, CAM.horizon, W, VH - CAM.horizon);
    // the pond (blue water, off to the left, as in the print)
    const pts = [[POND.x0, POND.z0], [POND.x1, POND.z0], [POND.x1, POND.z1], [POND.x0, POND.z1]].map(([x, z]) => project(x, 0, Math.max(z, cam.z + 0.7)));
    if (pts.every(Boolean)) {
      ctx.fillStyle = C('pond', ink); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(240,248,250,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // grass tufts
    ctx.strokeStyle = 'rgba(40,90,70,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of grass) {
      const p = project(t.x, 0, t.z); if (!p || p[3] > 90) continue;
      const h = 0.25 * t.s * p[2];
      ctx.moveTo(p[0] - h * 0.5, p[1]); ctx.lineTo(p[0] - h * 0.2, p[1] - h); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + h * 0.1, p[1] - h * 1.2); ctx.moveTo(p[0] + h * 0.5, p[1]); ctx.lineTo(p[0] + h * 0.3, p[1] - h);
    }
    ctx.stroke();
  }
  function drawShadows(sim, ink) {
    // long soft tree shadows lying across the grass, as in the print
    ctx.fillStyle = C('shadow', ink);
    for (const t of sim.garden.trees) {
      const p = project(t.x - 1.4, 0, t.z - 0.3); if (!p || p[3] > 170 || p[3] < 2) continue;
      ctx.globalAlpha = 0.45 * fadeFor(p[3], p[0]);
      ctx.beginPath(); ctx.ellipse(p[0], p[1], 2.6 * p[2], 0.32 * p[2], 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- cut-outs ----------
  function drawTree(t, p, wind, time) {
    const sp = trees[t.kind % trees.length], s = p[2] * (t.size || 1), w = sp.w * s, h = sp.h * s;
    ctx.save(); ctx.globalAlpha = fadeFor(p[3], p[0]);
    // the crown sways with the breeze; the trunk stays put (a shear about the base). Some trees are drawn mirrored.
    const sway = (Math.sin(time * 1.1 + t.seed) * 0.5 + Math.sin(time * 2.3 + t.seed * 2) * 0.2) * wind * 0.045;
    ctx.setTransform((t.flip ? -1 : 1) * scale, 0, sway * scale, scale, (p[0] - sway * p[1]) * scale, 0);
    ctx.drawImage(sp.c, -w / 2, p[1] - h, w, h);
    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  function drawHut(hut, p) {
    const sp = hut.double ? huts.double : huts.single, s = p[2];
    ctx.save(); ctx.globalAlpha = fadeFor(p[3], p[0]);
    ctx.drawImage(sp.c, p[0] - (sp.w * s) / 2, p[1] - sp.h * s, sp.w * s, sp.h * s);
    ctx.restore();
  }
  // ---------- little birds: simple flat shapes in soft browns and russets, a little hazy, as if up among the far branches ----------
  // (v3.9, Tom: the green was too strong, too close and too detailed for the flat print style)
  const BIRD = [['#7a5446', '#5d4036'], ['#86604c', '#664737'], ['#6e4a40', '#553a31']];   // [body, wing]
  function drawBirds(sim) {
    for (const b of sim.birds || []) {
      const s = 12 * b.size, [body, wingC] = BIRD[Math.floor(b.size * 10) % BIRD.length];
      ctx.save(); ctx.globalAlpha = 0.82; ctx.translate(b.x, b.y); ctx.scale(b.dir * s, s);
      const wing = (sign) => {
        const tipY = -b.flap * 1.1 * sign;
        ctx.fillStyle = wingC; ctx.beginPath(); ctx.moveTo(-0.2, -0.12); ctx.quadraticCurveTo(-0.55, tipY - 0.2, -1.05, tipY); ctx.lineTo(0.25, -0.02); ctx.closePath(); ctx.fill();
      };
      wing(-0.6);
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 0.75, 0.36, -0.1, 0, Math.PI * 2); ctx.fill();               // body
      ctx.beginPath(); ctx.arc(0.6, -0.13, 0.26, 0, Math.PI * 2); ctx.fill();                                                 // head
      ctx.beginPath(); ctx.moveTo(-0.6, 0.02); ctx.lineTo(-1.2, -0.06); ctx.lineTo(-1.15, 0.13); ctx.closePath(); ctx.fill(); // tail
      ctx.beginPath(); ctx.moveTo(0.84, -0.12); ctx.lineTo(1.02, -0.08); ctx.lineTo(0.84, -0.04); ctx.closePath(); ctx.fill(); // beak
      wing(1);
      ctx.restore();
    }
  }

  // ---------- fallen blossom, the basket, the pick button ----------
  function sprigShape(sx, sy, s, angle, flat) {
    // a little twig of plum blossom lying on the grass (flattened, since it lies on the ground)
    ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s * flat); ctx.rotate(angle);
    ctx.strokeStyle = '#3a2d2a'; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.28, 0); ctx.lineTo(0.28, 0); ctx.moveTo(0.05, 0); ctx.lineTo(0.18, -0.12); ctx.moveTo(-0.1, 0); ctx.lineTo(-0.2, 0.1); ctx.stroke();
    for (const [bx, by] of [[-0.26, 0], [-0.12, -0.05], [0.02, 0.04], [0.16, -0.02], [0.18, -0.12], [-0.2, 0.1], [0.27, 0.02]]) {
      ctx.fillStyle = '#fdf8f0'; ctx.beginPath(); ctx.arc(bx, by, 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e09a9a'; ctx.beginPath(); ctx.arc(bx, by, 0.018, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawSprigs(sim, time) {
    if (!sim.sprigs) return;
    sim.sprigs.forEach((s, i) => {
      if (s.picked) return;
      const p = project(s.x, 0, s.z); if (!p || p[3] > 90) return;
      const a = fadeFor(p[3], p[0]); if (a < 0.02) return;
      ctx.globalAlpha = a;
      if (i === sim.reachable) {
        // within reach: a soft glow pulses around it
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.fillStyle = `rgba(255,250,235,${0.35 + 0.3 * pulse})`;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.85 * p[2], 0.3 * p[2], 0, 0, Math.PI * 2); ctx.fill();
      }
      sprigShape(p[0], p[1], p[2] * 2.1, s.angle, 0.6);                // (big enough to spot on a phone)
      ctx.globalAlpha = 1;
    });
  }
  let btnA = 0;
  function drawPickButton(sim, dt, time) {
    const show = sim.state === 'play' && !sim.paused && sim.reachable >= 0;
    btnA += ((show ? 1 : 0) - btnA) * Math.min(1, dt * 8);
    if (btnA < 0.02) return;
    const [cx, cy, r] = pickButton(W), pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save(); ctx.globalAlpha = btnA;
    ctx.fillStyle = `rgba(255,248,230,${0.25 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(cx, cy, r + 10 + 6 * pulse, 0, Math.PI * 2); ctx.fill();   // glow
    ctx.fillStyle = 'rgba(239,228,198,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    sprigShape(cx, cy - 8, 95, -0.4, 1);
    ui.text('GATHER', cx, cy + 30, 13, INK, 'center');
    ctx.restore();
  }

  function drawFence(f, p) {
    // a low bamboo fence: two rails and a row of thin uprights, as around the trees in the print
    const s = p[2], hw = (f.w / 2) * s, h = 0.55 * s;
    ctx.save(); ctx.globalAlpha = 0.9 * fadeFor(p[3], p[0]);
    ctx.strokeStyle = '#4b5a3c'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, 0.05 * s);
    ctx.beginPath(); ctx.moveTo(p[0] - hw, p[1] - h * 0.85); ctx.lineTo(p[0] + hw, p[1] - h * 0.85); ctx.moveTo(p[0] - hw, p[1] - h * 0.4); ctx.lineTo(p[0] + hw, p[1] - h * 0.4); ctx.stroke();
    ctx.lineWidth = Math.max(0.5, 0.035 * s);
    const n = Math.max(3, Math.round(f.w * 5));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const fx = p[0] - hw + (2 * hw * i) / n, top = h * (0.9 + 0.15 * Math.sin(f.seed + i * 1.7)); ctx.moveTo(fx, p[1]); ctx.lineTo(fx, p[1] - top); }
    ctx.stroke();
    ctx.restore();
  }
  function drawKago(p, wind, time) {
    // the parked palanquin: a long carrying pole on green stands, the basket seat with its patterned blue cushion, a green cloth over the pole
    const s = p[2];
    ctx.save(); ctx.globalAlpha = fadeFor(p[3], p[0]); ctx.translate(p[0], p[1]); ctx.scale(s, s);
    const swing = Math.sin(time * 1.3) * 0.03 * wind;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2f7a5b'; ctx.lineWidth = 0.13;                                              // stands
    for (const [a, b] of [[-1.2, -0.5], [1.0, 0.4]]) { ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo((a + b) / 2, -2.3); ctx.lineTo(b, 0); ctx.stroke(); }
    ctx.strokeStyle = '#d8b98a'; ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(-2.2, -2.15); ctx.lineTo(2.0, -2.4); ctx.stroke();   // pole
    ctx.strokeStyle = INK; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.save(); ctx.translate(0, -2.25); ctx.rotate(swing);                                          // the basket hangs and sways
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(-0.8, 1.15); ctx.moveTo(0.7, 0); ctx.lineTo(0.8, 1.15); ctx.stroke();
    ctx.fillStyle = '#d6b47a'; ctx.beginPath(); ctx.moveTo(-1.0, 1.1); ctx.lineTo(1.0, 1.1); ctx.lineTo(0.85, 1.75); ctx.lineTo(-0.85, 1.75); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,0.6)'; ctx.lineWidth = 0.02;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * 0.12, 1.1); ctx.lineTo(i * 0.12 + 0.3, 1.75); ctx.moveTo(i * 0.12, 1.1); ctx.lineTo(i * 0.12 - 0.3, 1.75); ctx.stroke(); }
    ctx.fillStyle = '#2f6f86'; ctx.beginPath(); ctx.moveTo(-1.05, 1.15); ctx.quadraticCurveTo(0, 0.75, 1.05, 1.1); ctx.lineTo(0.9, 1.35); ctx.quadraticCurveTo(0, 1.2, -0.95, 1.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,236,0.6)'; ctx.lineWidth = 0.02;                                 // the cushion's star pattern
    for (let i = -4; i <= 4; i++) { const cx = i * 0.22, cy = 1.12; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 0.08, cy + Math.sin(a) * 0.05); } ctx.stroke(); }
    ctx.restore();
    // the green cloth thrown over the pole end, stirring in the breeze
    ctx.fillStyle = '#2f8a63'; ctx.beginPath(); ctx.moveTo(0.9, -2.45);
    for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(0.9 + u * 1.4 + Math.sin(time * 2.4 + u * 5) * 0.06 * wind, -2.6 - Math.sin(u * Math.PI) * 0.25 + Math.sin(time * 1.9 + u * 3) * 0.05 * wind); }
    for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(1.0 + u * 1.3 + Math.sin(time * 2.1 + u * 4) * 0.1 * wind, -1.85 + u * 0.15 + Math.sin(time * 2.7 + u * 6) * 0.08 * wind); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.restore();
  }
  // the vase on the tea house's counter, holding the blossom she has handed over (it fills up over the strolls)
  function drawVase(p, count, time, wind) {
    const s = p[2];
    ctx.save(); ctx.globalAlpha = fadeFor(p[3], p[0]); ctx.translate(p[0], p[1]); ctx.scale(s, s);
    const n = Math.min(count, 24);
    ctx.strokeStyle = '#3a2d2a'; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      // sprigs fanning up out of the vase, each with a few blossoms, swaying just a little
      const a = -Math.PI / 2 + (((i * 0.618) % 1) - 0.5) * 1.6 + Math.sin(time * 1.3 + i) * 0.02 * wind, len = 0.28 + ((i * 0.37) % 1) * 0.22;
      const ex = Math.cos(a) * len, ey = -0.28 + Math.sin(a) * len;
      ctx.beginPath(); ctx.moveTo(0, -0.26); ctx.lineTo(ex, ey); ctx.stroke();
      for (let k = 1; k <= 3; k++) { ctx.fillStyle = '#fdf8f0'; ctx.beginPath(); ctx.arc(ex * (k / 3), -0.26 + (ey + 0.26) * (k / 3), 0.03, 0, Math.PI * 2); ctx.fill(); }
    }
    // the vase: blue and white porcelain
    ctx.fillStyle = '#e8eef0'; ctx.beginPath(); ctx.moveTo(-0.05, -0.3); ctx.quadraticCurveTo(-0.16, -0.15, -0.09, 0); ctx.lineTo(0.09, 0); ctx.quadraticCurveTo(0.16, -0.15, 0.05, -0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.015; ctx.stroke();
    ctx.strokeStyle = '#2f5f8a'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.11, -0.13); ctx.lineTo(0.11, -0.13); ctx.moveTo(-0.08, -0.07); ctx.quadraticCurveTo(0, -0.11, 0.08, -0.07); ctx.stroke();
    ctx.restore();
  }
  // a small woven basket (bottom centre at bx, by, in the figure's units), with blossom showing over the rim
  function basketShape(bx, by, count) {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(bx, by - 0.16, 0.1, Math.PI, 0); ctx.stroke();   // handle
    for (let i = 0; i < Math.min(count, 9); i++) {
      const a = (i * 2.39) % 6.28, rr = 0.03 + (i % 3) * 0.025;
      ctx.fillStyle = '#fdf8f0'; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * rr * 1.6, by - 0.17 - Math.abs(Math.sin(a)) * rr, 0.035, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#c9a55f'; ctx.beginPath(); ctx.moveTo(bx - 0.12, by - 0.16); ctx.lineTo(bx + 0.12, by - 0.16); ctx.lineTo(bx + 0.09, by); ctx.lineTo(bx - 0.09, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,0.7)'; ctx.lineWidth = 0.012;
    ctx.beginPath(); for (let k = -3; k <= 3; k++) { ctx.moveTo(bx + k * 0.03, by - 0.16); ctx.lineTo(bx + k * 0.025, by); } ctx.moveTo(bx - 0.11, by - 0.08); ctx.lineTo(bx + 0.11, by - 0.08); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(bx - 0.12, by - 0.16); ctx.lineTo(bx + 0.12, by - 0.16); ctx.lineTo(bx + 0.09, by); ctx.lineTo(bx - 0.09, by); ctx.closePath(); ctx.stroke();
  }
  // patterned cloth for outfit i, made once (scaled so one repeat is about a hand's width on the figure)
  const cloths = new Map();
  function cloth(i) {
    const k = i % OUTFITS.length;
    if (!cloths.has(k)) {
      const [base, type, fg] = OUTFITS[k];
      let fill = base;
      if (type !== 'plain') {
        fill = ctx.createPattern(makePatternTile(type, base, fg), 'repeat');
        if (fill && fill.setTransform && typeof DOMMatrix === 'function') fill.setTransform(new DOMMatrix([TILE_UNITS / TILE, 0, 0, TILE_UNITS / TILE, 0, 0]));
        else fill = base;                                                            // (no pattern support: plain cloth)
      }
      cloths.set(k, fill);
    }
    return cloths.get(k);
  }
  function drawPerson(p, o) {
    // a figure in kimono, about 1.6 tall; front: facing you, else seen from behind
    const s = p[2];
    ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * fadeFor(p[3], p[0]);
    ctx.translate(p[0], p[1]); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(30,60,45,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 0.35, 0.08, 0, 0, Math.PI * 2); ctx.fill();
    const bob = Math.abs(Math.sin(o.step * Math.PI)) * 0.03, sway = Math.sin(o.step * Math.PI) * 0.03;
    ctx.translate(sway, -bob);
    // bowing: fold forward from the hips (seen from the front or back, the top half dips and shortens)
    const bow = o.bow || 0;
    ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(-0.24, 0); ctx.lineTo(0.24, 0); ctx.lineTo(0.2, -0.75); ctx.lineTo(-0.2, -0.75); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.025; ctx.stroke();
    if (o.haori) { ctx.fillStyle = o.haori; ctx.fillRect(-0.205, -0.75, 0.41, 0.24); ctx.strokeRect(-0.205, -0.75, 0.41, 0.24); }   // the jacket's hem
    if (o.apron) { ctx.fillStyle = '#ece6d6'; ctx.fillRect(-0.15, -0.74, 0.3, 0.6); ctx.strokeRect(-0.15, -0.74, 0.3, 0.6); }        // the tea-house keeper's apron
    ctx.save(); ctx.translate(0, -0.75); ctx.rotate((o.idle || 0) * 0.035); ctx.scale(1, 1 - 0.35 * bow); ctx.translate(0, 0.12 * bow);   // (idle: shifting weight)
    ctx.fillStyle = o.haori || o.robe; ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.lineTo(0.2, 0); ctx.lineTo(0.17, -0.55); ctx.lineTo(-0.17, -0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (o.haori) { ctx.strokeStyle = 'rgba(230,220,200,0.6)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.08, -0.5); ctx.lineTo(0, -0.2); ctx.lineTo(0.08, -0.5); ctx.stroke(); }   // the jacket's open front
    else { ctx.fillStyle = o.obi; ctx.fillRect(-0.2, -0.22, 0.4, 0.13); }
    const look = o.look || 0;                                                                     // seen from behind: -1 left .. 1 right
    ctx.fillStyle = o.front ? SKIN : HAIR; ctx.beginPath(); ctx.arc(o.front ? look * 0.035 : 0, -0.68, 0.12, 0, Math.PI * 2); ctx.fill();   // (facing you: the face turns)
    if (!o.front && Math.abs(look) > 0.12) {
      // turning the head: a sliver of cheek shows at the edge of the head on the side she looks toward. It slides in from (and back
      // out round) that edge, clipped to the head, so it never crosses the back of her head (Tom saw a line there as she turned back)
      const k = clamp((Math.abs(look) - 0.12) / 0.6, 0, 1), side = Math.sign(look);
      ctx.save(); ctx.beginPath(); ctx.arc(0, -0.68, 0.12, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(side * (0.165 - 0.08 * k), -0.665, 0.06, 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = HAIR; ctx.beginPath(); ctx.arc(-look * 0.02, o.front ? -0.74 : -0.7, 0.12, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(-look * 0.05, -0.84, 0.07, 0, Math.PI * 2); ctx.fill();               // hair bun
    if (o.ornament) { ctx.fillStyle = '#c4473a'; ctx.beginPath(); ctx.arc(-look * 0.05 + 0.07, -0.87, 0.028, 0, Math.PI * 2); ctx.fill(); }   // a hairpin
    ctx.restore();
    if (o.basket != null) basketShape(0.31, -0.42, o.basket);         // her basket, hanging at her side
    ctx.restore();
  }

  // ---------- petals on the breeze (drawn over the scene, in three depths) ----------
  function newPetal(anywhere) {
    const depth = Math.random() < 0.12 ? 1.6 + Math.random() * 0.8 : 0.4 + Math.random();      // a few drift right past the camera, big and close
    return { x: anywhere ? Math.random() * 1500 : -20 - Math.random() * 200, y: anywhere ? Math.random() * VH : Math.random() * VH * 0.8 - 40,
      depth, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 4, ph: Math.random() * 6, pink: Math.random() < 0.3 };
  }
  function drawPetals(dt, wind, walking) {
    for (let i = 0; i < petals.length; i++) {
      const q = petals[i];
      q.ph += dt * 2;
      q.x += ((25 + 110 * wind) * q.depth + Math.sin(q.ph) * 14) * dt;
      q.y += (14 * q.depth + Math.cos(q.ph * 0.8) * 10 + walking * 6 * q.depth) * dt;
      q.rot += q.spin * dt * (0.5 + wind);
      if (q.x > W + 30 || q.y > VH + 20) petals[i] = newPetal(false);
      const sz = 2.2 + 3 * q.depth;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(q.ph)));
      ctx.globalAlpha = 0.85; ctx.fillStyle = q.pink ? '#f6d9da' : '#fdf8f0';
      ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- screens ----------
  function drawPause(sim) {
    const s = sim.settings;
    const rows = GARDEN_PAUSE_ROWS.map((id) => ({
      resume: [id, '', 'RESUME'], album: [id, '', 'BACK TO THE ALBUM'], finger: [id, 'FINGER SPEED', G_FINGER_OPTS[s.finger ?? 1]],
      sound: [id, 'SOUND', s.sound ? 'ON' : 'OFF'], restart: [id, '', sim.restartArmed ? 'TAP AGAIN TO START THE PRINT OVER' : 'START THE PRINT OVER'],
    })[id]);
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer: ['HOLD A FINGER TO WALK, SLIDE IT TO STEP ASIDE, LET GO TO STAND STILL', MUTED] });
  }
  function drawArrived(sim) {
    const a = clamp((sim.arrivedT - 0.8) / 0.7, 0, 1);
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#f4e7d6'; ctx.fillRect(0, 0, W, VH); ctx.globalAlpha = a;
    ui.text('THE TEA HOUSE', W / 2, 205, 40, INK, 'center', 'bold');
    ui.text(sim.basket > 0 ? 'YOU GAVE ' + sim.basket + (sim.basket === 1 ? ' SPRIG' : ' SPRIGS') + ' OF BLOSSOM FOR THE VASE'
      : sim.stats.strolls === 1 ? 'A STROLL THROUGH THE PLUM GARDEN' : 'STROLL ' + sim.stats.strolls + ' COMPLETE', W / 2, 256, 20, MUTED, 'center');
    ctx.globalAlpha = 1;
    ui.choices(STROLL_CHOICES, { W, sel: sim.choice, ready: sim.arrivedT >= CHOICE_WAIT + 0.8, alpha: a });
  }
  function drawComplete(sim) {
    ctx.globalAlpha = clamp(sim.completeT / 2, 0, 1);
    ui.text('PLUM BLOSSOM', W / 2, 185, 48, INK, 'center', 'bold');
    ui.text('COMPLETE', W / 2, 235, 24, INK, 'center');
    ui.seal(W - 90, VH - 90, 1.6);
    ctx.globalAlpha = 1;
    if (sim.completeT >= DONE_WAIT) ui.choices(DONE_CHOICES, { W, sel: sim.choice, ready: true, alpha: clamp((sim.completeT - DONE_WAIT) / 0.6, 0, 1) });
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    ensureSprites();
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const time = sim.t, p = sim.player, showYou = sim.state !== 'title';
    const target = sim.state === 'title' || sim.state === 'complete' ? 100 : sim.inkShown;
    artInk += (target - artInk) * Math.min(1, dt * (sim.state === 'play' ? 6 : 1.4));
    const ink = START_INK + artInk * (1 - START_INK / 100);

    // the camera drifts along behind you (a little behind your sideways steps, so it feels like floating, not bolted on);
    // at the tea house it turns a little toward the keeper, so you see them both
    const atTea = sim.offer && (sim.state === 'offering' || sim.state === 'arrived' || sim.strollDone);
    const wantX = atTea ? (p.x + KEEPER.x) / 2 : showYou ? p.x * CAM.follow + pathX(p.z) * (1 - CAM.follow) : pathX(0);
    const wantZ = (showYou ? p.z : 0) - CAM.back;
    if (sim.paused) { /* hold still */ } else if (Math.abs(wantZ - cam.z) > 30) { cam.x = wantX; cam.z = wantZ; }
    else { cam.x += (wantX - cam.x) * Math.min(1, dt * CAM.ease); cam.z += (wantZ - cam.z) * Math.min(1, dt * CAM.ease * 2); }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    { const q = project(p.x, 0, p.z); youX = showYou && q ? q[0] : W / 2; }
    drawSky(ink);
    drawGround(ink);
    drawFarBand(ink);                                  // after the ground, so the far trees stand over the horizon line
    drawShadows(sim, ink);
    drawSprigs(sim, time);

    // everything standing in the garden, far to near
    const list = [];
    for (const t of sim.garden.trees) { const q = project(t.x, 0, t.z); if (q && q[3] < 230 && q[0] > -900 && q[0] < W + 900) list.push([q[3], 'tree', t, q]); }
    for (const h of HUTS) { const q = project(h.x, 0, h.z); if (q && q[3] < 230) list.push([q[3], 'hut', h, q]); }
    for (const f of sim.garden.fences) { const q = project(f.x, 0, f.z); if (q && q[3] < 120 && q[0] > -400 && q[0] < W + 400) list.push([q[3], 'fence', f, q]); }
    { const q = project(KAGO.x, 0, KAGO.z); if (q && q[3] < 230) list.push([q[3], 'kago', KAGO, q]); }
    for (const o of sim.people) { const q = project(o.x, 0, o.z); if (q && q[3] < 200) list.push([q[3], 'person', o, q]); }
    if (showYou) { const q = project(p.x, 0, p.z); if (q) list.push([q[3], 'you', p, q]); }
    { const q = project(KEEPER.x, 0, KEEPER.z); if (q && q[3] < 200) list.push([q[3], 'keeper', sim.keeper, q]); }
    { const q = project(VASE.x, VASE.y, VASE.z); if (q && q[3] < 120) list.push([q[3], 'vase', null, q]); }
    // the basket passing from her hands to the keeper's
    const give = sim.offer && sim.offer.phase === 'give' ? clamp(sim.offer.t / GTUNE.giveSecs, 0, 1) : -1;
    if (give >= 0) {
      const e = give * give * (3 - 2 * give), from = [p.x + 0.3, 0.45, p.z], to = [KEEPER.x - 0.25, 0.75, KEEPER.z];
      const q = project(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + Math.sin(give * Math.PI) * 0.15, from[2] + (to[2] - from[2]) * e);
      if (q) list.push([q[3] - 0.01, 'basket', null, q]);
    }
    list.sort((a, b) => b[0] - a[0]);
    for (const [, kind, o, q] of list) {
      if (kind !== 'you' && fadeFor(q[3], q[0]) < 0.02) continue;
      if (kind === 'tree') drawTree(o, q, sim.wind, time);
      else if (kind === 'hut') drawHut(o, q);
      else if (kind === 'fence') drawFence(o, q);
      else if (kind === 'kago') drawKago(q, sim.wind, time);
      else if (kind === 'person') drawPerson(q, { robe: cloth(o.dress), obi: OUTFITS[o.dress % OUTFITS.length][3], haori: OUTFITS[o.dress % OUTFITS.length][4], front: o.face,
        step: o.step, bow: o.bowT > 0 ? Math.sin((o.bowT / 1.4) * Math.PI) : 0, look: o.head, idle: Math.sin(time * 0.7 + o.phase) });
      else if (kind === 'keeper') drawPerson(q, { robe: '#2f3d52', obi: '#ece6d6', front: true, step: 0, apron: true,
        bow: o.bowT > 0 ? Math.sin((o.bowT / GTUNE.bowSecs) * Math.PI) : 0, look: 0, idle: Math.sin(time * 0.6) * 0.5 });
      else if (kind === 'vase') drawVase(q, sim.vase, time, sim.wind);
      else if (kind === 'basket') { ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(q[2], q[2]); basketShape(0, 0.08, sim.basket); ctx.restore(); }
      else drawPerson(q, { robe: YOU, obi: '#e8d9b0', front: false, step: o.step, bow: Math.max(o.bow, Math.min(1, o.pick * 1.25)), alpha: o.fade, look: o.look,
        basket: sim.handedOver ? null : sim.basket, ornament: true });
    }

    drawBirds(sim);
    drawPetals(sim.paused ? 0 : dt, sim.wind, showYou && p.v > 0.1 ? 1 : 0);
    ui.paperGrain(W);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      ui.inkBar(sim.inkShown / 100); ui.message(sim.message, W);
      ui.text('BASKET  ' + sim.basket, 24, 70, 13, INK, 'left');
      drawPickButton(sim, dt, time);
      if (sim.state === 'arrived') drawArrived(sim);
      if (sim.state === 'complete') drawComplete(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  return { draw, resize, cam };
}
