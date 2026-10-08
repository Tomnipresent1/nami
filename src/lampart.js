// THE LAMPLIGHTER's painting (v1.4.6): a real 3-D scene (Tom: "abandon all notions of orthographic space"), seen through the camera
// in lamplighter.js (CAM): a level camera standing in the street, so every building is a solid block with real sides, eaves and
// roofs. The teahouse after the Meiji photograph (research 17): a left-hand block, a middle set back (research 27) with the main
// door under its curved gable, and the near block on the right; round its ground floor the covered walkway behind its low railing,
// where he walks and the red lanterns hang; balconies above; beyond it, the street's other houses running off into the distance.
// Kiyochika's night colours (research 12). Each lantern he lights glows and warms what is near it. This file only draws.
import { VH, clamp } from './ocean.js';
import { CAM, toCam, fromCam, A, B, RECESS, BEAM_H, LANTERN_H, RAIL_H, ENTRANCE_X, BALCONIES, pathAt, lanternAt, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT, EVENING_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#55564e';           // (the sky never changes)
const ROOF = '#2c3035', SOFFIT = '#121110', FASCIA = '#3a3d40';
const WOOD = '#2a241f', WOOD_SIDE = '#221d19', WOOD_DARK = '#171512', POST = '#1b1815';
const RAIL = ['#2e2822', '#6e5236'];                      // the railing's boards: dark, and warmed by a lantern
const SHOJI = ['#2e2f2b', '#f0c98a'];                     // paper windows upstairs
const LATTICE = ['#141210', '#d39a5a'];                   // the paper behind the ground floor's lattice
const NOREN = ['#1c2438', '#4a6696'];                     // the indigo noren over the main door
const GROUND = ['#3b3a34', '#211f1b'];
const FAR_WALL = ['#24221e', '#2a2722', '#1f1d1a'], FAR_SIDE = '#1c1a17';
const SIL = '#17181b';
const ROBES = ['#3b4458', '#5a4a3a', '#4a4a46', '#3d4a3c', '#6a5532', '#2f3a4f', '#5b4e45', '#47505a'];
const KIMONO = ['#4a3a4a', '#3a4a5a', '#5a4038', '#3d4a44', '#4d4536'];
const SKIN = '#d9b38c';
const COAT = ['#6e221c', '#a8382c'];                      // the lamplighter's coat: deep red, with a pale collar
const BODY_UNITS = 35, PERSON_H = 1.62;                   // a drawn person is ~35 units tall = 1.62 m
const LR = [0.2, 0.27];                                   // a lantern's half-width and half-height (metres)
const WARM_D = 2.6;                                       // how far (metres) a lantern's light reaches

// ---- the teahouse in plan (metres): three lines round its ground floor, each walked in the path's direction ----
const RAIL_LINE = [[-2, 0], [A + 2, 0], [A + 2, RECESS], [B - 2, RECESS], [B - 2, 0], [60, 0]];       // the railing (the walkway's open side)
const WALL_LINE = [[-2, 2], [A, 2], [A, RECESS + 2], [B, RECESS + 2], [B, 2], [60, 2]];               // the lattice wall (its building side)
const UP_LINE = [[-2, 0.3], [A + 1.7, 0.3], [A + 1.7, RECESS + 0.3], [B - 1.7, RECESS + 0.3], [B - 1.7, 0.3], [60, 0.3]];   // the storeys above
// the blocks above the walkway: [from X, to X] along UP_LINE's segments 0, 2, 4 (left, recess, near), how many storeys, how deep
const STOREY = 2.9, FLOOR1 = 3.3;
const BLOCKS = [{ seg: 0, storeys: 2, depth: 12, tone: 0 }, { seg: 2, storeys: 1, depth: 9, tone: 1 }, { seg: 4, storeys: 2, depth: 12, tone: 0 }];
// the street's other houses, beyond the left-hand block, running off into the distance (the same every time)
const FAR_HOUSES = (() => {
  const out = []; let x = -3, a = 11;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  while (x > -240) { const w = 6 + r() * 6; out.push({ x0: x - w, x1: x, z: r() * 1.2, h: 5.2 + r() * 2.6, tone: Math.floor(r() * 3), balcony: r() < 0.5 }); x -= w + (r() < 0.12 ? 3 : 0); }
  return out.reverse();                                    // furthest first
})();

export function createLampArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  let W = 1300, scale = 1, lastT = 0, btnA = 0;
  const camPos = [CAM.x, CAM.z];

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;
    W = w; const dpr = pixelRatio();
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }

  // ---------- 3-D drawing ----------
  const NEAR = 0.6;
  /** Project a world polygon ([X, Y, Z] points) to the picture, clipped where it passes behind the camera; null if none is left. */
  function proj(pts) {
    let cs = pts.map((p) => toCam(p[0], p[1], p[2]));
    if (cs.some((c) => c[2] < NEAR)) {
      const out = [];
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i], b = cs[(i + 1) % cs.length], ina = a[2] >= NEAR, inb = b[2] >= NEAR;
        if (ina) out.push(a);
        if (ina !== inb) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return null;
      cs = out;
    }
    return cs.map((c) => fromCam(c, W));
  }
  function poly(pts, fill) { const s = proj(pts); if (!s) return null; ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]); ctx.closePath(); ctx.fill(); return s; }
  /** A world line (stroked in the current style). */
  function line(a, b) {
    let ca = toCam(...a), cb = toCam(...b);
    if (ca[2] < NEAR && cb[2] < NEAR) return;
    if (ca[2] < NEAR) { const t = (NEAR - ca[2]) / (cb[2] - ca[2]); ca = ca.map((v, i) => v + (cb[i] - v) * t); }
    if (cb[2] < NEAR) { const t = (NEAR - cb[2]) / (ca[2] - cb[2]); cb = cb.map((v, i) => v + (ca[i] - v) * t); }
    const pa = fromCam(ca, W), pb = fromCam(cb, W);
    ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
  }
  const depthOf = (X, Y, Z) => toCam(X, Y, Z)[2];
  /** Is the side of a wall running from plan point p to q, facing `out`, turned toward the camera? */
  const facing = (p, q, out) => (camPos[0] - (p[0] + q[0]) / 2) * out[0] + (camPos[1] - (p[1] + q[1]) / 2) * out[1] > 0;
  /** Walk a plan polyline in pieces of at most `step` metres: cb(p, q, out, segIndex). */
  function pieces(line, step, cb) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i], [x1, z1] = line[i + 1], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
      const out = [(z1 - z0) / len, -(x1 - x0) / len];
      for (let j = 0; j < n; j++) cb([x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n], [x0 + ((x1 - x0) * (j + 1)) / n, z0 + ((z1 - z0) * (j + 1)) / n], out, i);
    }
  }
  const wallQuad = (p, q, y0, y1) => [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]];

  // ---------- light ----------
  let lights = [];
  const warmAt = (x, z) => {
    let w = 0;
    for (const l of lights) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-((Math.hypot(x - l.x, z - l.z) / WARM_D) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);

  // ---------- sky and ground ----------
  function drawSkyGround() {
    const g = ctx.createLinearGradient(0, 0, 0, CAM.eye);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.75, '#3a3c37'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, CAM.eye + 1);
    const gg = ctx.createLinearGradient(0, CAM.eye, 0, VH);
    gg.addColorStop(0, GROUND[0]); gg.addColorStop(1, GROUND[1]);
    ctx.fillStyle = gg; ctx.fillRect(0, CAM.eye, W, VH - CAM.eye);
  }

  // ---------- a pitched roof: its overhanging eave along the front (we see its underside), its tiled slope rising back ----------
  function roofAlong(p, q, out, y, overhang, depthBack, fill = ROOF) {
    const ox = out[0] * overhang, oz = out[1] * overhang, bx = -out[0] * depthBack, bz = -out[1] * depthBack;
    const e0 = [p[0] + ox, y, p[1] + oz], e1 = [q[0] + ox, y, q[1] + oz];
    poly([e0, e1, [q[0], y, q[1]], [p[0], y, p[1]]], SOFFIT);                                                   // the eave's underside
    poly([e0, e1, [q[0] + bx * 0.5, y + depthBack * 0.36, q[1] + bz * 0.5], [p[0] + bx * 0.5, y + depthBack * 0.36, p[1] + bz * 0.5]], fill);   // the tiled slope (where it shows)
    poly([e0, e1, [e1[0], y - 0.22, e1[2]], [e0[0], y - 0.22, e0[2]]], FASCIA);                                // the eave's edge
  }

  // ---------- the street's other houses ----------
  function drawFarHouses() {
    for (const h of FAR_HOUSES) {
      const z = h.z, back = z + 10, wall = FAR_WALL[h.tone], mid = 3.0;
      // the side facing you (only the part above the next house shows: that one is drawn after, over it)
      poly(wallQuad([h.x1, z], [h.x1, back], 0, h.h), FAR_SIDE);
      poly([[h.x1, h.h, z - 0.5], [h.x1, h.h + 1.9, z + 4.5], [h.x1, h.h, back]], FAR_SIDE);                  // its gable end
      roofAlong([h.x0, z], [h.x1, z], [0, -1], h.h, 0.6, 5);
      poly(wallQuad([h.x0, z + 0.3], [h.x1, z + 0.3], mid + 0.2, h.h), wall);                                  // the upper storey
      poly(wallQuad([h.x0 + 0.6, z + 0.25], [h.x1 - 0.6, z + 0.25], mid + 0.7, h.h - 0.5), '#2c2a25');         // its paper windows, unlit
      ctx.strokeStyle = '#121110'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = h.x0 + 1; x < h.x1 - 0.5; x += 0.9) line([x, mid + 0.7, z + 0.24], [x, h.h - 0.5, z + 0.24]);
      ctx.stroke();
      if (h.balcony) poly(wallQuad([h.x0, z - 0.4], [h.x1, z - 0.4], mid + 0.2, mid + 1.0), WOOD_DARK);
      roofAlong([h.x0, z], [h.x1, z], [0, -1], mid, 0.9, 1.4);                                                 // the shop's little roof
      poly(wallQuad([h.x0, z], [h.x1, z], 0, mid), '#1a1916');                                                 // the shop, shut for the night
      ctx.strokeStyle = '#100f0d'; ctx.beginPath();
      for (let x = h.x0 + 0.4; x < h.x1; x += 0.45) line([x, 0, z - 0.01], [x, mid - 0.2, z - 0.01]);
      ctx.stroke();
    }
  }

  // ---------- the teahouse ----------
  /** The storeys above the walkway: for each block, its side walls (where they face you), its storeys of paper windows, roofs. */
  function drawUpper() {
    // the sides of the left and near blocks, along the recess: the big solid walls you see the depth of (research 26)
    for (const b of BLOCKS) {
      const top = FLOOR1 + b.storeys * STOREY;
      for (const si of [b.seg - 1, b.seg + 1]) {
        if (si < 0 || si >= UP_LINE.length - 1) continue;
        const p = UP_LINE[si], q = UP_LINE[si + 1];
        // the wall along this connecting stretch belongs to whichever block is taller
        const other = BLOCKS.find((o) => o.seg === (si === b.seg - 1 ? b.seg - 2 : b.seg + 2));
        if (!other || other.storeys >= b.storeys) continue;
        const out = [(q[1] - p[1]) / Math.hypot(q[0] - p[0], q[1] - p[1]), -(q[0] - p[0]) / Math.hypot(q[0] - p[0], q[1] - p[1])];
        if (!facing(p, q, out)) continue;
        const near = p[1] < q[1] ? p : q;
        const base = FLOOR1 + other.storeys * STOREY + 0.2;
        poly(wallQuad([near[0], near[1]], [near[0], near[1] + b.depth], FLOOR1, top), WOOD_SIDE);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = 1; k <= b.storeys; k++) line([near[0], FLOOR1 + k * STOREY, near[1]], [near[0], FLOOR1 + k * STOREY, near[1] + b.depth]);
        for (let zz = near[1] + 1.2; zz < near[1] + b.depth; zz += 1.8) line([near[0], base, zz], [near[0], top - 0.2, zz]);
        ctx.stroke();
        poly([[near[0], top, near[1] - 0.6], [near[0], top + 2.2, near[1] + b.depth / 2], [near[0], top, near[1] + b.depth + 0.6]], WOOD_SIDE);   // its gable
      }
    }
    // each block's front: storeys of paper windows with balconies, a roof between storeys, the top roof
    for (const b of BLOCKS) {
      const p = UP_LINE[b.seg], q = UP_LINE[b.seg + 1], out = [0, -1];
      for (let k = 0; k < b.storeys; k++) {
        // (the lowest storey stands back behind its balcony; the people on the balcony are drawn in drawBalconies)
        const y0 = FLOOR1 + k * STOREY, y1 = y0 + STOREY - 0.3, set = k === 0 ? 0.9 : 0, fp = [p[0], p[1] + set], fq = [q[0], q[1] + set];
        poly(wallQuad(fp, fq, y0, y1 + 0.3), WOOD);
        pieces([fp, fq], 1.3, (a, c) => {
          const wm = warmAt((a[0] + c[0]) / 2, a[1] - 1.5) * (k === 0 ? 0.6 : 0.3);
          poly(wallQuad([a[0] + 0.08, a[1] - 0.01], [c[0] - 0.08, c[1] - 0.01], y0 + 0.5, y1 - 0.1), lit(SHOJI, wm));
        });
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
        for (let yy = y0 + 0.85; yy < y1 - 0.1; yy += 0.35) line([fp[0], yy, fp[1] - 0.02], [fq[0], yy, fq[1] - 0.02]);
        ctx.stroke();
        if (k < b.storeys - 1) roofAlong(p, q, out, y1 + 0.3, 0.7, 1.2);                       // a little roof between storeys
      }
      roofAlong(p, q, out, FLOOR1 + b.storeys * STOREY, 0.8, b.depth * 0.5);
    }
  }
  /** People upstairs and the balcony rails in front of them (the lowest storey of each block has a balcony over the walkway). */
  function drawBalconies(sim, time) {
    for (const w of sim.walkers) if (w.lane === 'balcony') drawBalconyPerson(w, time);
    for (const b of BLOCKS) {
      const p = UP_LINE[b.seg], q = UP_LINE[b.seg + 1], y = FLOOR1 + 0.05;
      poly(wallQuad([p[0], p[1] - 0.25], [q[0], q[1] - 0.25], y + 0.85, y + 0.98), WOOD_DARK);
      poly(wallQuad([p[0], p[1] - 0.25], [q[0], q[1] - 0.25], y, y + 0.12), WOOD_DARK);
      ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = p[0]; x <= q[0]; x += 0.22) line([x, y, p[1] - 0.25], [x, y + 0.9, p[1] - 0.25]);
      ctx.stroke();
    }
  }
  /** The ground floor's back: the lattice wall round the walkway (warmed by the lanterns), the main door with its noren. */
  function drawWalls() {
    pieces(WALL_LINE, 0.9, (p, q, out) => {
      if (!facing(p, q, out)) return;
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, door = Math.abs(mz - (RECESS + 2)) < 0.01 && Math.abs(mx - ENTRANCE_X) < 1.3;
      const wm = warmAt(mx, mz);
      if (door) {
        poly(wallQuad(p, q, 0, BEAM_H + 0.5), lit(['#0f0e0c', '#b07a46'], wm * 0.75));
        poly(wallQuad([p[0], p[1] - 0.02], [q[0], q[1] - 0.02], 1.75, 2.75), lit(NOREN, wm * 0.9));
        return;
      }
      poly(wallQuad(p, q, 0, BEAM_H + 0.5), lit(LATTICE, wm * 0.85));
      ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath();
      const n = 7;
      for (let j = 0; j <= n; j++) { const x = p[0] + ((q[0] - p[0]) * j) / n, z = p[1] + ((q[1] - p[1]) * j) / n; line([x + out[0] * 0.01, 0, z + out[1] * 0.01], [x + out[0] * 0.01, BEAM_H + 0.5, z + out[1] * 0.01]); }
      line([p[0] + out[0] * 0.01, 1.6, p[1] + out[1] * 0.01], [q[0] + out[0] * 0.01, 1.6, q[1] + out[1] * 0.01]);
      ctx.stroke();
    });
    // the walkway's floor, and the forecourt in front of the recess
    poly([[A + 2, 0.01, 0], [B - 2, 0.01, 0], [B - 2, 0.01, RECESS], [A + 2, 0.01, RECESS]], '#2c2a25');
  }
  /** The walkway's roof seen from below (between the beam over the railing and the lattice wall) and the beam's face. */
  function drawWalkwayRoof() {
    for (let i = 0; i < RAIL_LINE.length - 1; i++) {
      const r0 = RAIL_LINE[i], r1 = RAIL_LINE[i + 1], w0 = WALL_LINE[i], w1 = WALL_LINE[i + 1];
      poly([[r0[0], BEAM_H, r0[1]], [r1[0], BEAM_H, r1[1]], [w1[0], BEAM_H + 0.5, w1[1]], [w0[0], BEAM_H + 0.5, w0[1]]], SOFFIT);
    }
    pieces(RAIL_LINE, 2, (p, q, out) => { if (facing(p, q, out)) poly(wallQuad([p[0] + out[0] * 0.05, p[1] + out[1] * 0.05], [q[0] + out[0] * 0.05, q[1] + out[1] * 0.05], BEAM_H - 0.22, BEAM_H + 0.05), FASCIA); });
  }
  /** The walkway's near things, each with its depth so they can be drawn back to front with the people: the railing in short
   *  stretches, the posts, the lanterns. */
  function walkwayItems(sim, time, items) {
    pieces(RAIL_LINE, 1.0, (p, q, out) => {
      if (!facing(p, q, out)) return;
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      items.push({ d: depthOf(mx, 0.5, mz), f: () => {
        poly(wallQuad(p, q, 0, RAIL_H), lit(RAIL, warmAt(mx, mz) * 0.75));
        poly(wallQuad(p, q, RAIL_H - 0.1, RAIL_H), WOOD_DARK);
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
        for (const t of [0.25, 0.5, 0.75]) line([p[0] + (q[0] - p[0]) * t, 0, p[1] + (q[1] - p[1]) * t], [p[0] + (q[0] - p[0]) * t, RAIL_H - 0.1, p[1] + (q[1] - p[1]) * t]);
        ctx.stroke();
      } });
    });
    // posts: at each corner and every ~2.6 m between
    const posts = [];
    for (let i = 0; i < RAIL_LINE.length - 1; i++) {
      const [x0, z0] = RAIL_LINE[i], [x1, z1] = RAIL_LINE[i + 1], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.6));
      for (let j = 0; j < n; j++) posts.push([x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n]);
    }
    for (const [x, z] of posts) {
      const d = depthOf(x, 1.5, z) - 0.05;
      items.push({ d, f: () => { poly(wallQuad([x - 0.08, z - 0.08], [x + 0.08, z - 0.08], 0, BEAM_H), POST); poly(wallQuad([x + 0.08, z - 0.08], [x + 0.08, z + 0.08], 0, BEAM_H), POST); } });
    }
    for (const l of sim.lanterns) { const [x, y, z] = lanternAt(l); items.push({ d: depthOf(x, y, z) - 0.1, f: () => drawLantern(l, time) }); }
    // the curved gable over the main door (karahafu), as in the photograph: drawn in the railing's plane, above the beam
    const gz = RECESS - 0.15, gd = depthOf(ENTRANCE_X, 3.4, gz);
    items.push({ d: gd, f: () => {
      const pts = [], n = 24, half = 1.9;
      for (let j = 0; j <= n; j++) {
        const u = (j / n) * 2 - 1, x = ENTRANCE_X + u * half;
        const y = BEAM_H + 0.05 + 1.15 * (Math.cos(u * Math.PI / 2) ** 1.6) - 0.18 * Math.max(0, Math.abs(u) - 0.85) / 0.15;   // a bell curve, its ends flicked
        pts.push([x, y, gz]);
      }
      const top = pts, bottom = [[ENTRANCE_X + half, BEAM_H - 0.15, gz], [ENTRANCE_X - half, BEAM_H - 0.15, gz]];
      poly([...top, ...bottom], ROOF);
      ctx.strokeStyle = FASCIA; ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j < n; j++) line(top[j], top[j + 1]); ctx.stroke();
      const wm = warmAt(ENTRANCE_X, gz);
      const c = proj([[ENTRANCE_X, BEAM_H + 0.45, gz - 0.02]]); if (c) { ctx.fillStyle = mixHex('#3d3428', '#c9a46a', wm * 0.6); ctx.beginPath(); ctx.ellipse(c[0][0], c[0][1], 0.28 * c[0][2], 0.18 * c[0][2], 0, 0, Math.PI * 2); ctx.fill(); }
    } });
  }

  // ---------- lanterns ----------
  function drawLantern(l, time) {
    const [X, Y, Z] = lanternAt(l), c = proj([[X, Y + Math.sin(time * 0.9 + l.s) * 0.01, Z]]), top = proj([[X, BEAM_H, Z]]);
    if (!c || !top) return;
    const [x, y, k] = c[0], g = l.glow, rx = LR[0] * k, ry = LR[1] * k;
    ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, top[0][1]); ctx.lineTo(x, y - ry); ctx.stroke();
    if (g > 0.01) {
      const grd = ctx.createRadialGradient(x, y - 0.03 * k, 1, x, y, ry);
      grd.addColorStop(0, mixHex('#4a2420', '#ffe0a8', g)); grd.addColorStop(0.55, mixHex('#3a1d1a', '#f06a3a', g)); grd.addColorStop(1, mixHex('#3a1d1a', '#c8331f', g));
      ctx.fillStyle = grd;
    } else ctx.fillStyle = '#3a1d1a';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,8,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let j = -2; j <= 2; j++) { const yy = y + j * ry * 0.33, ww = rx * Math.sqrt(1 - (j * 0.33) ** 2); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); }
    ctx.stroke();
    ctx.fillStyle = POST; ctx.fillRect(x - 0.11 * k, y - ry - 0.03 * k, 0.22 * k, 0.06 * k); ctx.fillRect(x - 0.11 * k, y + ry - 0.03 * k, 0.22 * k, 0.06 * k);
  }
  /** Warm light added on top: halos round the lit lanterns, a wash over the walkway, a pool on the ground. */
  function drawGlow(sim) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of sim.lanterns) {
      if (l.glow <= 0.01) continue;
      const [X, Y, Z] = lanternAt(l), c = proj([[X, Y, Z]]), f = proj([[X, 0, Z]]);
      if (!c || !f) continue;
      const [x, y, k] = c[0], a = l.glow;
      let g = ctx.createRadialGradient(x, y + 0.9 * k, 4, x, y + 0.9 * k, 3 * k);
      g.addColorStop(0, `rgba(255,150,80,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 3 * k, y - 2.1 * k, 6 * k, 6 * k);
      ctx.save(); ctx.translate(f[0][0], f[0][1]); ctx.scale(1, 0.3);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 2.6 * k);
      g.addColorStop(0, `rgba(255,160,90,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 2.6 * k, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      g = ctx.createRadialGradient(x, y, 3, x, y, 1.1 * k);
      g.addColorStop(0, `rgba(255,190,120,${0.5 * a})`); g.addColorStop(0.4, `rgba(255,110,60,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 1.1 * k, 0, Math.PI * 2); ctx.fill();
    }
    for (const w of sim.walkers) {
      if (!w.lanternAt) continue;
      const [x, y, k] = w.lanternAt, g = ctx.createRadialGradient(x, y, 1, x, y, 0.6 * k);
      g.addColorStop(0, 'rgba(255,120,70,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 0.6 * k, 0, Math.PI * 2); ctx.fill();
    }
    if (sim.flameAt) {
      const [x, y, a, k] = sim.flameAt, g = ctx.createRadialGradient(x, y, 1, x, y, 0.55 * k);
      g.addColorStop(0, `rgba(255,220,150,${0.7 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 0.55 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- people ----------
  /** Which way someone walking along direction [dx, dz] faces in the picture (+1 right, -1 left), seen at world x, z. */
  function screenFacing(x, z, dx, dz) {
    const a = proj([[x, 0, z]]), b = proj([[x + dx * 0.2, 0, z + dz * 0.2]]);
    return a && b ? (b[0][0] >= a[0][0] ? 1 : -1) : 1;
  }
  /** A person, feet at x, y, drawn at size sz. o: { face, step, bow, still, sit, look, body, head, hair, legs, collar, sash, band, knot,
   *  pattern ('stripe' | 'check'), cloth, apron, porter (box colour), bundle (colour), fan (colour), fanT } */
  function drawBody(x, y, sz, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz);
    const f = o.face, stride = Math.sin(o.step * Math.PI * 2) * (o.still ? 0 : 4.5);
    if (o.sit) ctx.translate(0, 9);
    ctx.fillStyle = 'rgba(8,8,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 10, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = o.legs || SIL; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + stride, 0); ctx.moveTo(2, -10); ctx.lineTo(2 - stride, 0); ctx.stroke();
    ctx.translate(0, -9); ctx.rotate(f * (0.05 + o.bow * 0.5 + (o.porter ? 0.08 : 0)));
    if (o.bundle) { ctx.fillStyle = o.bundle; ctx.beginPath(); ctx.ellipse(-f * 6, -16, 5.5, 6.5, 0, 0, Math.PI * 2); ctx.fill(); }
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
    const hx = f * 1.4 + (o.look || 0) * 0.8;
    ctx.fillStyle = o.head; ctx.beginPath(); ctx.arc(hx, -27, 3.9, 0, Math.PI * 2); ctx.fill();
    if (o.hair) { ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(hx - f * 0.6, -31, 4.6, 2.8, 0, 0, Math.PI * 2); ctx.fill(); }
    if (o.cloth) { ctx.fillStyle = o.cloth; ctx.beginPath(); ctx.arc(hx, -27.6, 4.1, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); }
    if (o.band) { ctx.strokeStyle = o.band; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx - 4, -28.5); ctx.lineTo(hx + 4, -28.5); ctx.stroke(); }
    if (o.knot && !o.cloth && !o.hair) { ctx.fillStyle = o.knot; ctx.fillRect(hx - 1.2 - f * 2, -33.5, 2.6, 3.4); }
    if (o.fan) {
      ctx.save(); ctx.translate(hx + f * 5, -22); ctx.rotate(Math.sin(o.fanT * 5) * 0.35 * (Math.sin(o.fanT * 0.4) > 0 ? 1 : 0.1));
      ctx.strokeStyle = '#2a241d'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = o.fan; ctx.beginPath(); ctx.arc(0, -2.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (o.porter) {
      ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-15, -21); ctx.lineTo(15, -22); ctx.stroke();
      ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-13, -21); ctx.lineTo(-13, -9); ctx.moveTo(13, -22); ctx.lineTo(13, -9); ctx.stroke();
      ctx.fillStyle = o.porter; ctx.fillRect(-17, -9, 8, 7); ctx.fillRect(9, -9, 8, 7);
    }
    ctx.restore();
  }
  function drawStreetWalker(w) {
    w.lanternAt = null;
    const c = proj([[w.x, 0, w.z]]);
    if (!c) return;
    const [x, y, k] = c[0];
    if (x < -150 || x > W + 150) return;
    const sz = (k * PERSON_H) / BODY_UNITS, wm = clamp(warmAt(w.x, w.z) * 0.6, 0, 1), show = 0.3 + 0.7 * wm, dim = (cc) => mixHex(SIL, cc, show);
    const body = dim(ROBES[w.robe]), head = mixHex('#2a2522', SKIN, 0.2 + wm * 0.7), face = screenFacing(w.x, w.z, w.dir, 0);
    if (w.kind === 'rickshaw') {
      const r = sz * 1.06;
      ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
      const d = face, cx = -d * 40, wr = 28;
      ctx.strokeStyle = SIL; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(d * 8, -50); ctx.lineTo(cx, -44); ctx.stroke();
      ctx.fillStyle = dim('#3a3330');
      ctx.beginPath(); ctx.moveTo(cx - 28, -40); ctx.lineTo(cx + 24, -40); ctx.lineTo(cx - d * 14, -106);
      ctx.quadraticCurveTo(cx - d * 48, -108, cx - d * 36, -42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = head; ctx.beginPath(); ctx.arc(cx - d * 6, -76, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111113'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, -wr, wr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath();
      const turn = w.x * 1.2;
      for (let j = 0; j < 6; j++) { const a = turn + (j * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, -wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, -wr + Math.sin(a) * wr); }
      ctx.stroke();
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(cx + d * 22, -52, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      w.lanternAt = [x + (cx + d * 22) * r, y - 52 * r, k];
      ctx.save(); ctx.translate(x, y); ctx.rotate(d * 0.22); ctx.translate(-x, -y);
      drawBody(x, y, sz, { face: d, step: w.step, bow: 0, body, head, cloth: dim('#8a8a80') });
      ctx.restore();
      return;
    }
    drawBody(x, y, sz, { face, step: w.step, bow: Math.sin(w.nod * Math.PI) * 0.35, body, head, knot: SIL, pattern: w.pattern, cloth: w.cloth ? dim('#9a9a8e') : null,
      apron: w.apron ? dim('#26304a') : null, porter: w.kind === 'porter' ? dim('#6b5a3c') : null, bundle: w.kind === 'bundle' ? dim('#4d5a6a') : null });
    if (w.kind === 'lantern') {
      const s = sz, hx = x + face * 7 * s, hy = y - 22 * s, lx = hx + face * 5 * s + w.swing * 1.5 * s, ly = y - 12 * s;
      ctx.strokeStyle = SIL; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly - 5 * s); ctx.stroke();
      ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.ellipse(lx, ly, 4.2 * s, 5.6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1512'; ctx.fillRect(lx - 3 * s, ly - 6.2 * s, 6 * s, 1.4 * s); ctx.fillRect(lx - 3 * s, ly + 4.8 * s, 6 * s, 1.4 * s);
      w.lanternAt = [lx, ly, k];
    }
  }
  function drawBalconyPerson(w, time) {
    const c = proj([[w.x, FLOOR1 + 0.05, w.z]]);
    if (!c) return;
    const [x, y, k] = c[0], sz = (k * PERSON_H) / BODY_UNITS;
    const wm = clamp(warmAt(w.x, w.z - 1) * 0.5, 0, 1), show = 0.35 + 0.65 * wm;
    drawBody(x, y, sz, { face: w.goX != null ? screenFacing(w.x, w.z, w.dir, 0) : (w.robe % 2 ? 1 : -1), step: w.step, still: w.goX == null, sit: w.kind === 'sit', look: w.head,
      body: mixHex(SIL, KIMONO[w.robe % KIMONO.length], show), head: mixHex('#2a2522', SKIN, 0.25 + wm * 0.7), hair: w.robe % 3 ? '#121212' : null, knot: SIL,
      fan: w.fan ? mixHex(SIL, '#c9b88a', show) : null, fanT: time + w.phase, bow: 0 });
  }
  function drawPlayer(sim, time) {
    const p = sim.player, at = pathAt(p.s), c = proj([[at.x, 0, at.z]]);
    sim.flameAt = null;
    if (!c) return;
    const [x, y, k] = c[0], s = (k * PERSON_H) / BODY_UNITS, wm = clamp(warmAt(at.x, at.z) * 0.8, 0, 1);
    const face = screenFacing(at.x, at.z, at.dir[0] * p.face, at.dir[1] * p.face);
    const coat = lit(COAT, 0.25 + wm * 0.6);
    ctx.save(); ctx.globalAlpha = p.fade;
    drawBody(x, y, s, { face, step: p.step, bow: Math.sin(p.nod * Math.PI) * 0.3, still: Math.abs(p.vs) < 0.05 && p.lightT <= 0,
      body: coat, legs: '#151518', head: mixHex('#a88a6a', SKIN, 0.4 + wm * 0.6), collar: '#d8c9a0', band: '#e8e0cc', sash: '#d8c9a0' });
    // his arm, and the pole with its small flame: carried slanting up ahead of him; to light a lantern he lifts his arm and
    // raises the pole until the flame is just under it
    const shoulder = [x + face * 2 * s, y - 29 * s], hand = [x + face * 7 * s, y - (20 + 14 * p.raise) * s];
    ctx.strokeStyle = coat; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    const len = 34 * s, carry = face > 0 ? -1.05 : Math.PI + 1.05;
    let ang = carry, L = len;
    if (p.lantern >= 0 && p.raise > 0) {
      const [lx, ly, lz] = lanternAt(sim.lanterns[p.lantern]), t = proj([[lx, ly - LR[1] - 0.1, lz]]);
      if (t) {
        const want = Math.atan2(t[0][1] - hand[1], t[0][0] - hand[0]), wantL = Math.hypot(t[0][0] - hand[0], t[0][1] - hand[1]);
        let da = want - carry; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        ang = carry + da * p.raise; L = len + (wantL - len) * p.raise;
      }
    }
    const bob = Math.sin(p.step * Math.PI * 2) * 2 * s;
    const tip = [hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L + bob * (1 - p.raise)];
    ctx.strokeStyle = '#2a241d'; ctx.lineWidth = Math.max(1.2, 0.05 * k);
    ctx.beginPath(); ctx.moveTo(hand[0] - Math.cos(ang) * 7 * s, hand[1] - Math.sin(ang) * 7 * s); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    const fl = 1 + 0.15 * Math.sin(time * 17) + 0.1 * Math.sin(time * 31);
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(tip[0], tip[1] - 4 * fl * s, 3.4 * s, 6 * fl * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(tip[0], tip[1] - 3 * s, 1.7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    sim.flameAt = [tip[0], tip[1] - 3 * s, p.fade, k];
  }

  // ---------- the heads-up bits ----------
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
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer: ['HOLD A FINGER TO WALK; SLIDE IT BACK TO TURN; LET GO TO STOP', MUTED] });
  }
  function drawEnd(sim) {
    const done = sim.state === 'complete', wait = done ? DONE_WAIT : EVENING_WAIT;
    ctx.globalAlpha = clamp(sim.completeT / (done ? 2 : 1), 0, 1);
    if (done) { ui.text('THE LAMPLIGHTER', W / 2, 150, 44, INK, 'center', 'bold'); ui.text('COMPLETE', W / 2, 200, 24, INK, 'center'); ui.seal(W - 90, VH - 90, 1.6); }
    else { ui.text('THE EVENING IS OVER', W / 2, 150, 40, INK, 'center', 'bold'); ui.text(sim.litCount + ' OF ' + sim.lanterns.length + ' LANTERNS LIT', W / 2, 200, 22, INK, 'center'); }
    ctx.globalAlpha = 1;
    if (sim.completeT >= wait) ui.choices(DONE_CHOICES, { W, sel: sim.choice, ready: true, alpha: clamp((sim.completeT - wait) / 0.6, 0, 1) });
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const time = now / 1000;
    lights = sim.lanterns.map((l) => { const [x, , z] = lanternAt(l); return { x, z, glow: l.glow }; });

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSkyGround();
    drawFarHouses();
    const street = sim.walkers.filter((w) => w.lane !== 'balcony').sort((a, b) => depthOf(b.x, 0, b.z) - depthOf(a.x, 0, a.z));
    for (const w of street) if (w.x < -3) drawStreetWalker(w);                     // (far along the street, beyond the teahouse)
    drawUpper();
    drawBalconies(sim, time);
    drawWalls();
    drawWalkwayRoof();
    // the walkway's railing, posts and lanterns, and him: back to front
    const items = [];
    walkwayItems(sim, time, items);
    sim.flameAt = null;
    if (sim.state !== 'title') { const at = pathAt(sim.player.s); items.push({ d: depthOf(at.x, 0.9, at.z), f: () => drawPlayer(sim, time) }); }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.f();
    for (const w of street) if (w.x >= -3) drawStreetWalker(w);
    drawGlow(sim);
    ui.paperGrain(W);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      drawCounter(sim);
      ui.message(sim.message, W);
      drawLightButton(sim, dt, time);
      if (sim.state === 'complete' || sim.state === 'evening') drawEnd(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  return { draw, resize };
}
