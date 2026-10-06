// KAMATA's painting, after Hiroshige: a rose-pink sky, the pale green garden fading to deep teal at your feet, bare dark plum trees
// starred with white blossom, golden thatched tea huts, the parked kago with its green cloth stirring, people in bright kimono,
// and petals blowing through the air. A paper-theatre camera: everything is a flat painted cut-out standing in the garden, and the
// camera follows behind and above you, so the cut-outs slide past and grow as you walk in. This file only draws.
import { VH, clamp } from './ocean.js';
import { pathX, HUTS, KAGO, POND, GARDEN_PAUSE_ROWS, G_FINGER_OPTS, STROLL_CHOICES, DONE_CHOICES, DONE_WAIT } from './garden.js';
import { CHOICE_WAIT } from './choice.js';
import { createUI, inked, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';

// ---- the camera (all of these can be tuned for feel) ----
// F = zoom (bigger = a longer lens: flatter, more layered, closer to the prints' "cheated" near-orthographic look). back = how far behind
// you the camera floats; F / back sets your size (kept the same as v24). horizon = how far down the screen the horizon sits.
// (v24: F 440, back 7, horizon 250, height 3: felt wide and sparse; Tom wants intimate and enclosed)
const CAM = { F: 900, horizon: 290, height: 2.8, back: 14, follow: 0.7, ease: 2 };
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
const KIMONO = ['#b2362e', '#2f7a5b', '#2d4b7d', '#7a5a8c', '#4a4a55', '#c06a3a'];
const OBI = ['#e7c76a', '#d9d2c0', '#9b2c2c', '#2d4b7d'];
const YOU = '#a8452f';

// ---- painted cut-outs, made once ----
function rng(seed) { let a = Math.floor(seed * 1e6) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TREE_PX = 90;                          // sprite pixels per garden unit (a tree is about 7 units tall)
function makeTree(kind) {
  const W = 900, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(kind + 0.123);
  const tips = [];
  const branch = (bx, by, ang, len, w, depth) => {
    const bend = (r() - 0.5) * 0.5, ex = bx + Math.cos(ang) * len, ey = by - Math.sin(ang) * len;
    const mx = (bx + ex) / 2 + Math.cos(ang + Math.PI / 2) * len * bend * 0.3, my = (by + ey) / 2 - Math.sin(ang + Math.PI / 2) * len * bend * 0.3;
    x.strokeStyle = '#3d302d'; x.lineWidth = w; x.lineCap = 'round';
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
  const bx = W / 2, by = H - 8, split = H * (0.36 + r() * 0.12);
  x.fillStyle = '#3a2d2a';
  x.beginPath(); x.moveTo(bx - 34, by); x.quadraticCurveTo(bx - 20 + (r() - 0.5) * 30, by - split * 0.5, bx - 22, by - split);
  x.lineTo(bx + 20, by - split); x.quadraticCurveTo(bx + 18 + (r() - 0.5) * 30, by - split * 0.5, bx + 36, by); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(120,96,86,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(bx - 6, by - 10); x.quadraticCurveTo(bx + 4, by - split * 0.5, bx - 4, by - split + 10); x.stroke();
  branch(bx - 12, by - split + 4, Math.PI / 2 + 0.45 + r() * 0.2, H * 0.24, 26, 5);
  branch(bx + 12, by - split + 4, Math.PI / 2 - 0.45 - r() * 0.2, H * 0.24, 24, 5);
  if (r() < 0.6) branch(bx, by - split, Math.PI / 2 + (r() - 0.5) * 0.3, H * 0.2, 18, 4);
  // white plum blossom, with a few pink-hearted ones and dark buds
  for (const [tx, ty] of tips) {
    if (r() < 0.25) { x.fillStyle = '#3a2d2a'; x.beginPath(); x.arc(tx, ty, 2.2, 0, Math.PI * 2); x.fill(); continue; }
    const s = 4.5 + r() * 3;
    x.fillStyle = '#fbf6ec'; x.beginPath(); x.arc(tx, ty, s, 0, Math.PI * 2); x.fill();
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
    trees = [0, 1, 2, 3].map(makeTree);
    huts = { single: makeHut(false), double: makeHut(true) };
    // the far orchard along the horizon: rows of little blossoming trees, misty
    farBand = document.createElement('canvas'); farBand.width = 1600; farBand.height = 110;
    const x = farBand.getContext('2d'), r = rng(0.77);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 70; i++) {
      const tx = r() * 1600, h = 30 + r() * 40 - row * 8, base = 108 - row * 6;
      x.strokeStyle = `rgba(70,56,60,${0.35 + row * 0.15})`; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(tx, base); x.lineTo(tx, base - h * 0.5);
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.6; x.moveTo(tx, base - h * 0.45); x.lineTo(tx + Math.cos(a) * h * 0.5, base - h * 0.45 + Math.sin(a) * h * 0.5); }
      x.stroke();
      x.fillStyle = `rgba(250,244,236,${0.5 + row * 0.15})`;
      for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(tx + (r() - 0.5) * h * 0.8, base - h * (0.4 + r() * 0.55), 1.6, 0, Math.PI * 2); x.fill(); }
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
  const fadeFor = (dz, sx = W / 2) => {
    const edge = clamp((Math.abs(sx - W / 2) / (W / 2) - 0.3) / 0.35, 0, 1);
    return Math.max(clamp((dz - 6) / 4, 0, 1), edge * clamp((dz - 1.5) / 1.5, 0, 1)) * (1 - 0.5 * clamp((dz - 70) / 150, 0, 1));
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
    for (let x = -off; x < W; x += 1600) ctx.drawImage(farBand, x, CAM.horizon - 104, 1600, 110);
    ctx.restore();
    ctx.fillStyle = C('farTrees', ink); ctx.globalAlpha = 0.25; ctx.fillRect(0, CAM.horizon - 6, W, 8); ctx.globalAlpha = 1;
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
    const sp = trees[t.kind], s = p[2], w = sp.w * s, h = sp.h * s;
    ctx.save(); ctx.globalAlpha = fadeFor(p[3], p[0]);
    // the crown sways with the breeze; the trunk stays put (a shear about the base)
    const sway = (Math.sin(time * 1.1 + t.seed) * 0.5 + Math.sin(time * 2.3 + t.seed * 2) * 0.2) * wind * 0.045;
    ctx.setTransform(scale, 0, sway * scale, scale, (p[0] - sway * p[1]) * scale, 0);
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
    ctx.save(); ctx.translate(0, -0.75); ctx.scale(1, 1 - 0.35 * bow); ctx.translate(0, 0.12 * bow);
    ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.lineTo(0.2, 0); ctx.lineTo(0.17, -0.55); ctx.lineTo(-0.17, -0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.obi; ctx.fillRect(-0.2, -0.22, 0.4, 0.13);
    ctx.fillStyle = o.front ? SKIN : HAIR; ctx.beginPath(); ctx.arc(0, -0.68, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR; ctx.beginPath(); ctx.arc(0, o.front ? -0.74 : -0.7, 0.12, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.84, 0.07, 0, Math.PI * 2); ctx.fill();                       // hair bun
    ctx.restore();
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
    ui.text('BEYOND THE THIRD HUT', W / 2, 205, 40, INK, 'center', 'bold');
    ui.text(sim.stats.strolls === 1 ? 'A STROLL THROUGH THE PLUM GARDEN' : 'STROLL ' + sim.stats.strolls + ' COMPLETE', W / 2, 256, 20, MUTED, 'center');
    ctx.globalAlpha = 1;
    ui.choices(STROLL_CHOICES, { W, sel: sim.choice, ready: sim.arrivedT >= CHOICE_WAIT + 0.8, alpha: a });
  }
  function drawComplete(sim) {
    ctx.globalAlpha = clamp(sim.completeT / 2, 0, 1);
    ui.text('KAMATA', W / 2, 185, 48, INK, 'center', 'bold');
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

    // the camera drifts along behind you (a little behind your sideways steps, so it feels like floating, not bolted on)
    const wantX = showYou ? p.x * CAM.follow + pathX(p.z) * (1 - CAM.follow) : pathX(0);
    const wantZ = (showYou ? p.z : 0) - CAM.back;
    if (sim.paused) { /* hold still */ } else if (Math.abs(wantZ - cam.z) > 30) { cam.x = wantX; cam.z = wantZ; }
    else { cam.x += (wantX - cam.x) * Math.min(1, dt * CAM.ease); cam.z += (wantZ - cam.z) * Math.min(1, dt * CAM.ease * 2); }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky(ink);
    drawFarBand(ink);
    drawGround(ink);
    drawShadows(sim, ink);

    // everything standing in the garden, far to near
    const list = [];
    for (const t of sim.garden.trees) { const q = project(t.x, 0, t.z); if (q && q[3] < 230 && q[0] > -900 && q[0] < W + 900) list.push([q[3], 'tree', t, q]); }
    for (const h of HUTS) { const q = project(h.x, 0, h.z); if (q && q[3] < 230) list.push([q[3], 'hut', h, q]); }
    { const q = project(KAGO.x, 0, KAGO.z); if (q && q[3] < 230) list.push([q[3], 'kago', KAGO, q]); }
    for (const o of sim.people) { const q = project(o.x, 0, o.z); if (q && q[3] < 200) list.push([q[3], 'person', o, q]); }
    if (showYou) { const q = project(p.x, 0, p.z); if (q) list.push([q[3], 'you', p, q]); }
    list.sort((a, b) => b[0] - a[0]);
    for (const [, kind, o, q] of list) {
      if (kind !== 'you' && fadeFor(q[3], q[0]) < 0.02) continue;
      if (kind === 'tree') drawTree(o, q, sim.wind, time);
      else if (kind === 'hut') drawHut(o, q);
      else if (kind === 'kago') drawKago(q, sim.wind, time);
      else if (kind === 'person') drawPerson(q, { robe: KIMONO[o.look % KIMONO.length], obi: OBI[o.look % OBI.length], front: o.kind === 'walk' || o.look % 2 === 0,
        step: o.kind === 'walk' && o.bowT <= 0 ? time * 0.9 + o.phase : 0, bow: o.bowT > 0 ? Math.sin((o.bowT / 1.4) * Math.PI) : 0 });
      else drawPerson(q, { robe: YOU, obi: '#e8d9b0', front: false, step: o.step, bow: o.bow, alpha: o.fade });
    }

    drawPetals(sim.paused ? 0 : dt, sim.wind, showYou && p.v > 0.1 ? 1 : 0);
    ui.paperGrain(W);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      ui.inkBar(sim.inkShown / 100); ui.message(sim.message, W);
      if (sim.state === 'arrived') drawArrived(sim);
      if (sim.state === 'complete') drawComplete(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  return { draw, resize, cam };
}
