// THE LAMPLIGHTER's painting (v1.4.5): the big wooden teahouse of the Meiji photograph (research 17), in true perspective as in the
// photo (see VIEW in lamplighter.js): a low eye level, the front receding steeply to the left. Its ground floor is the inset walkway
// behind a low railing where he walks and the red lanterns hang; a curved gable over the main door; a balcony with people on the
// second storey; the top storey running off the top of the picture near you. To the left, the taller corner wing, and beyond it the
// street running on: separate houses, each with its own height, eaves and sides (Tom: not a "film set" front with nothing behind).
// Kiyochika's night colours (research 12). Each lantern he lights glows and warms the walkway, the lattice, the windows above.
// Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { VIEW, scaleAt, zToX, yAt, BEAM_Y, LANTERN_Y, WALK_Y, RAIL_Y, STREET_Y, BALCONY_Y, ENTRANCE_Z, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT, EVENING_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#55564e';           // (the sky never changes)
const ROOF = '#272b30', ROOF_TOP = '#30353a', ROOF_EDGE = '#3d4247';
const WOOD = '#2a241f', WOOD_DARK = '#171512', POST = '#1b1815', WOOD_SIDE = '#332b24';
const RAIL = ['#2e2822', '#6e5236'];                      // the railing's boards: dark, and warmed by a lantern
const SHOJI = ['#2e2f2b', '#f0c98a'];                     // paper windows upstairs
const LATTICE = ['#141210', '#d39a5a'];                   // the paper behind the ground floor's lattice
const NOREN = ['#1c2438', '#4a6696'];                     // the indigo noren over the main door
const GROUND = ['#3b3a34', '#211f1b'];                    // the street: lighter far off, darker near you
const FAR = ['#24221e', '#2b2823', '#201e1b'];            // the houses further along the street
const SIL = '#17181b';
const ROBES = ['#3b4458', '#5a4a3a', '#4a4a46', '#3d4a3c', '#6a5532', '#2f3a4f', '#5b4e45', '#47505a'];
const KIMONO = ['#4a3a4a', '#3a4a5a', '#5a4038', '#3d4a44', '#4d4536'];
const SKIN = '#d9b38c';
const COAT = ['#6e221c', '#a8382c'];                      // the lamplighter's coat: deep red, with a pale collar
const FIG = 2.9;                                          // people's size at scale 1 (the right edge): like the figures by the door (research 22)
const LR = [13, 17];                                      // a lantern's half-width and half-height (at scale 1)
const WARM_Z = 70;                                        // how far (in depth) a lantern's light spreads along the building
const ZN = -400, ZE = 1000;                               // the main building: from well past the right edge to its far end
const BAY = 80, POST0 = VIEW.ZC - 10;                     // the walkway's posts: one between each pair of lanterns
const WING = [ZE, 1450];                                  // the taller corner wing beyond it
const TOP = -150;                                         // the main building's top (its roof's eave)

// the houses further along the street, beyond a side street: each its own height (y0 of its eave), the same every time
const FAR_HOUSES = (() => {
  const out = []; let z = 1620, a = 7;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  while (z < 14000) { const len = 140 + r() * 220 + z * 0.08; out.push({ z0: z, z1: z + len, top: -40 + r() * 170, tone: Math.floor(r() * 3), balcony: r() < 0.5 }); z += len + (r() < 0.15 ? 60 : 0); }
  return out;
})();

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
  const P = (z, y0) => [zToX(z, W), yAt(z, y0)];
  /** A band along the building between depths z0 and z1, from y0a down to y0b (straight lines stay straight in this view). */
  const band = (z0, z1, y0a, y0b, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(...P(z0, y0a)); ctx.lineTo(...P(z1, y0a)); ctx.lineTo(...P(z1, y0b)); ctx.lineTo(...P(z0, y0b)); ctx.closePath(); ctx.fill();
  };
  /** A pitched roof seen from below: from its eave (y0) rising back to a ridge we see the tiles of, `rise` above it. */
  const roof = (z0, z1, y0, rise) => {
    band(z0, z1, y0 - rise, y0, ROOF_TOP);
    ctx.strokeStyle = ROOF; ctx.lineWidth = 1; ctx.beginPath();
    for (let j = 1; j < 4; j++) hline(z0, z1, y0 - (rise * j) / 4);
    ctx.stroke();
    band(z0, z1, y0 - 3, y0 + 8, ROOF_EDGE);
  };
  /** The side of a block whose front ends at depth z (the side facing you, seen where nothing nearer hides it). */
  const side = (z, y0a, y0b, fill) => {
    const [x, ya] = P(z, y0a), yb = yAt(z, y0b), w = 46 * scaleAt(z);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x, ya); ctx.lineTo(x + w, ya + (VIEW.HORIZON - ya) * 0.05); ctx.lineTo(x + w, yb + (VIEW.HORIZON - yb) * 0.05); ctx.lineTo(x, yb); ctx.closePath(); ctx.fill();
  };
  const vline = (z, y0a, y0b) => { const [x, ya] = P(z, y0a), yb = yAt(z, y0b); ctx.moveTo(x, ya); ctx.lineTo(x, yb); };
  const hline = (z0, z1, y0) => { ctx.moveTo(...P(z0, y0)); ctx.lineTo(...P(z1, y0)); };

  // ---------- light ----------
  let lights = [];
  const warmAt = (z) => {
    let w = 0;
    for (const l of lights) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-(((z - l.z) / WARM_Z) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);

  // ---------- sky, the street, and the houses along it ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.HORIZON);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.7, '#3a3c37'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VIEW.HORIZON + 2);
    const gg = ctx.createLinearGradient(0, VIEW.HORIZON, 0, VH);
    gg.addColorStop(0, GROUND[0]); gg.addColorStop(1, GROUND[1]);
    ctx.fillStyle = gg; ctx.fillRect(0, VIEW.HORIZON, W, VH - VIEW.HORIZON);
    // the houses further along, furthest first: each with its eave and roof, a dim upper storey, a shop front; the side of any
    // house that stands taller than the one in front of it shows, so they read as solid blocks
    for (let i = FAR_HOUSES.length - 1; i >= 0; i--) {
      const h = FAR_HOUSES[i], top = h.top, mid = top + (560 - top) * 0.45;
      roof(h.z0, h.z1, top, 70);
      band(h.z0, h.z1, top + 8, 600, FAR[h.tone]);
      band(h.z0 + 15, h.z1 - 15, top + 30, mid - 20, '#2c2a25');                          // the upper storey's paper windows, unlit
      roof(h.z0, h.z1, mid, 26);
      band(h.z0 + 15, h.z1 - 15, mid + 30, 590, '#1a1916');                               // the shop front, shut for the night
      if (h.balcony) band(h.z0, h.z1, mid - 22, mid - 14, WOOD_DARK);
      ctx.strokeStyle = '#121110'; ctx.lineWidth = 1; ctx.beginPath();
      for (let z = h.z0 + 15; z < h.z1 - 15; z += 30 + z * 0.01) { vline(z, top + 30, mid - 20); vline(z, mid + 30, 590); }
      ctx.stroke();
      const nearer = FAR_HOUSES[i - 1];
      if (!nearer || nearer.top > top + 10) side(h.z0, top - 70, 600, '#2a2723');
    }
  }

  // ---------- the corner wing (taller, a balcony on each storey) ----------
  function drawWing() {
    const [z0, z1] = WING, T = -330;
    roof(z0, z1, T, 120);
    band(z0, z1, T + 8, 600, WOOD);
    for (const [a, b] of [[T + 20, -170], [-140, 40], [70, 260]]) {                       // three storeys of paper windows
      for (let z = z0 + 10; z < z1 - 10; z += 34) band(z, z + 28, a, b, lit(SHOJI, 0));
      band(z0, z1, b - 34, b - 28, WOOD_DARK); band(z0, z1, b - 4, b + 2, WOOD_DARK);      // each storey's balcony rail
      ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1.4; ctx.beginPath(); for (let z = z0; z < z1; z += 9) vline(z, b - 30, b); ctx.stroke();
      roof(z0, z1, b + 10, 34);
    }
    band(z0, z1, 330, 600, '#141210');                                                      // its ground floor, shut
    ctx.strokeStyle = POST; ctx.lineWidth = 1.5; ctx.beginPath(); for (let z = z0; z < z1; z += 5) vline(z, 335, 600); ctx.stroke();
    side(z0, T - 120, 600, WOOD_SIDE);                                                      // its side, above the main building's roof
  }

  // ---------- the teahouse ----------
  function drawUpper() {
    // the top storey (running off the top of the picture near you) and the roof above it
    roof(ZN, ZE, TOP, 140);
    band(ZN, ZE, TOP + 8, 30, WOOD);
    windows(TOP + 22, 16, 0.35);
    roof(ZN, ZE, 46, 34);                                                                    // the roof between the top and middle storeys
    // the middle storey: paper windows behind the balcony
    band(ZN, ZE, 54, BALCONY_Y, WOOD);
    windows(64, 214, 0.55);
  }
  /** A row of paper windows between y0a and y0b along the whole front, warmed (a little) by the lanterns below. */
  function windows(y0a, y0b, warmth) {
    for (let z = ZE - 10; z > ZN; z -= 44) band(z, z - 38, y0a, y0b, lit(SHOJI, warmAt(z - 19) * warmth));
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
    for (let z = ZE - 10; z > ZN; z -= 44) { vline(z - 19, y0a, y0b); for (let y = y0a + 18; y < y0b; y += 18) hline(z, z - 38, y); }
    ctx.stroke();
  }
  function drawBalconyFront() {
    band(ZN, ZE, BALCONY_Y - 38, BALCONY_Y - 32, WOOD_DARK);
    band(ZN, ZE, BALCONY_Y - 8, BALCONY_Y, WOOD_DARK);
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 2; ctx.beginPath();
    for (let z = ZE - 2; z > ZN; z -= 11) vline(z, BALCONY_Y - 34, BALCONY_Y - 6);
    ctx.stroke();
    // the walkway's roof, rising back from its front beam (the lanterns hang from that)
    roof(ZN, ZE, BEAM_Y - 12, 48);
    band(ZN, ZE, BEAM_Y - 11, BEAM_Y, WOOD_DARK);
  }
  function drawWalkwayBack() {
    band(ZN, ZE, BEAM_Y, 318, '#100f0d');                                                    // the underside of the walkway's roof, in shadow
    // the ground floor's front: bays of fine lattice with paper behind, lit by the lanterns; the main door with its noren
    for (let z = POST0; z > ZN; z -= BAY) {
      const z1 = z - BAY, mid = z - BAY / 2;
      if (Math.abs(mid - ENTRANCE_Z) < BAY / 2) {
        band(z, z1, 318, 600, lit(['#0f0e0c', '#b07a46'], warmAt(mid) * 0.7));
        band(z - 8, z1 + 8, 330, 430, lit(NOREN, warmAt(mid) * 0.9));
        ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath(); for (const f of [0.33, 0.66]) vline(z - 8 - (BAY - 16) * f, 334, 430); ctx.stroke();
        continue;
      }
      band(z, z1, 318, 600, lit(LATTICE, warmAt(mid) * 0.85));
    }
    if (POST0 < ZE) band(ZE, POST0, 318, 600, lit(LATTICE, warmAt(POST0) * 0.85));
    ctx.strokeStyle = POST; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let z = ZE; z > ZN; z -= 6.5) { if (Math.abs(z - ENTRANCE_Z) < BAY / 2) continue; vline(z, 322, 600); }
    for (let z = POST0; z > ZN; z -= BAY) hline(z, z - BAY, 400);
    ctx.stroke();
    band(ZN, ZE, 596, RAIL_Y[1], '#1c1a17');                                                  // the walkway's floor
  }
  function drawWalkwayFront() {
    for (let z = POST0; z > ZN; z -= BAY) {
      const mid = z - BAY / 2;
      if (Math.abs(mid - ENTRANCE_Z) < BAY / 2) continue;                                     // the way in, at the main door
      band(z, z - BAY, RAIL_Y[0], RAIL_Y[1], lit(RAIL, warmAt(mid) * 0.75));
      band(z, z - BAY, RAIL_Y[0], RAIL_Y[0] + 7, WOOD_DARK);
    }
    band(ZE, POST0, RAIL_Y[0], RAIL_Y[1], lit(RAIL, warmAt(POST0) * 0.75)); band(ZE, POST0, RAIL_Y[0], RAIL_Y[0] + 7, WOOD_DARK);
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
    for (let z = ZE; z > ZN; z -= 13) { if (Math.abs(z - ENTRANCE_Z) < BAY / 2) continue; vline(z, RAIL_Y[0] + 7, RAIL_Y[1]); }
    ctx.stroke();
    for (let z = POST0; z > ZN; z -= BAY) { const [x, y0] = P(z, BEAM_Y), y1 = yAt(z, RAIL_Y[1]), k = scaleAt(z); ctx.fillStyle = POST; ctx.fillRect(x - 6 * k, y0, 12 * k, y1 - y0); }
    { const [x, y0] = P(ZE, BEAM_Y - 60), y1 = yAt(ZE, RAIL_Y[1]), k = scaleAt(ZE); ctx.fillStyle = POST; ctx.fillRect(x - 7 * k, y0, 14 * k, y1 - y0); }   // the corner post
    // the curved gable over the main door (karahafu), as in the photograph
    // (a wide, flowing bell curve: the flanks sweep up from flicked-out ends, concave, into a rounded crown)
    const za = ENTRANCE_Z + 75, zb = ENTRANCE_Z - 75, ka = scaleAt(za), kb = scaleAt(zb), km = scaleAt(ENTRANCE_Z);
    const [xa, ya] = P(za, BEAM_Y - 4), [xb, yb] = P(zb, BEAM_Y - 4), [xm, ym] = P(ENTRANCE_Z, BEAM_Y - 82);
    const curve = () => { ctx.moveTo(xa - 18 * ka, ya - 6 * ka); ctx.bezierCurveTo(xa + (xm - xa) * 0.55, ya + 2 * ka, xm - (xm - xa) * 0.4, ym, xm, ym);
      ctx.bezierCurveTo(xm + (xb - xm) * 0.4, ym, xb - (xb - xm) * 0.55, yb + 2 * kb, xb + 18 * kb, yb - 6 * kb); };
    ctx.fillStyle = ROOF_TOP; ctx.beginPath(); curve(); ctx.lineTo(xb, yb + 14 * kb); ctx.lineTo(xa, ya + 14 * ka); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ROOF_EDGE; ctx.lineWidth = 4 * km; ctx.beginPath(); curve(); ctx.stroke();
    ctx.fillStyle = mixHex('#3d3428', '#c9a46a', warmAt(ENTRANCE_Z) * 0.6); ctx.beginPath(); ctx.ellipse(xm, ym + 26 * km, 14 * km, 9 * km, 0, 0, Math.PI * 2); ctx.fill();   // its carved crest
    for (const zz of [za - 4, zb + 4]) { const [x, y0] = P(zz, BEAM_Y), y1 = yAt(zz, RAIL_Y[1]), k = scaleAt(zz); ctx.fillStyle = POST; ctx.fillRect(x - 7 * k, y0, 14 * k, y1 - y0); }   // its two posts
  }

  // ---------- lanterns ----------
  function drawLanterns(sim, time) {
    for (const l of sim.lanterns) {
      const k = scaleAt(l.z), x = zToX(l.z, W), top = yAt(l.z, BEAM_Y), y = yAt(l.z, LANTERN_Y) + Math.sin(time * 0.9 + l.z) * 0.8 * k, g = l.glow, rx = LR[0] * k, ry = LR[1] * k;
      ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - ry); ctx.stroke();
      if (g > 0.01) {
        const grd = ctx.createRadialGradient(x, y - 2 * k, 1, x, y, ry);
        grd.addColorStop(0, mixHex('#4a2420', '#ffe0a8', g)); grd.addColorStop(0.55, mixHex('#3a1d1a', '#f06a3a', g)); grd.addColorStop(1, mixHex('#3a1d1a', '#c8331f', g));
        ctx.fillStyle = grd;
      } else ctx.fillStyle = '#3a1d1a';
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,8,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let j = -2; j <= 2; j++) { const yy = y + j * ry * 0.33, ww = rx * Math.sqrt(1 - (j * 0.33) ** 2); ctx.moveTo(x - ww, yy); ctx.lineTo(x + ww, yy); }
      ctx.stroke();
      ctx.fillStyle = POST; ctx.fillRect(x - 7 * k, y - ry - 2 * k, 14 * k, 4 * k); ctx.fillRect(x - 7 * k, y + ry - 2 * k, 14 * k, 4 * k);
    }
  }
  function drawGlow(sim) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of sim.lanterns) {
      if (l.glow <= 0.01) continue;
      const k = scaleAt(l.z), x = zToX(l.z, W), a = l.glow, wy = yAt(l.z, 440);
      let g = ctx.createRadialGradient(x, wy, 6, x, wy, 190 * k);
      g.addColorStop(0, `rgba(255,150,80,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 190 * k, wy - 190 * k, 380 * k, 380 * k);
      ctx.save(); ctx.translate(x, yAt(l.z, 640)); ctx.scale(1, 0.22);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 160 * k);
      g.addColorStop(0, `rgba(255,160,90,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 160 * k, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const ly = yAt(l.z, LANTERN_Y);
      g = ctx.createRadialGradient(x, ly, 4, x, ly, 64 * k);
      g.addColorStop(0, `rgba(255,190,120,${0.5 * a})`); g.addColorStop(0.4, `rgba(255,110,60,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ly, 64 * k, 0, Math.PI * 2); ctx.fill();
    }
    for (const w of sim.walkers) {
      if (!w.lanternAt) continue;
      const [x, y, s] = w.lanternAt, g = ctx.createRadialGradient(x, y, 1, x, y, 36 * s);
      g.addColorStop(0, 'rgba(255,120,70,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 36 * s, 0, Math.PI * 2); ctx.fill();
    }
    if (sim.flameAt) {
      const [x, y, a, s] = sim.flameAt, g = ctx.createRadialGradient(x, y, 1, x, y, 32 * s);
      g.addColorStop(0, `rgba(255,220,150,${0.7 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 32 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- people ----------
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
    const k = scaleAt(w.z) * 1.15, x = zToX(w.z, W), y = yAt(w.z, STREET_Y), sz = FIG * k;
    if (x < -120 || x > W + 160) { w.lanternAt = null; return; }
    const wm = clamp(warmAt(w.z) * 0.6, 0, 1), show = 0.3 + 0.7 * wm, dim = (c) => mixHex(SIL, c, show);
    const body = dim(ROBES[w.robe]), head = mixHex('#2a2522', SKIN, 0.2 + wm * 0.7), face = -w.dir;
    w.lanternAt = null;
    if (w.kind === 'rickshaw') {
      const r = sz / 3.3;
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
      const turn = w.z / 14;
      for (let j = 0; j < 6; j++) { const a = turn + (j * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, -wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, -wr + Math.sin(a) * wr); }
      ctx.stroke();
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(cx + d * 22, -52, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      w.lanternAt = [x + (cx + d * 22) * r, y - 52 * r, r];
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
      w.lanternAt = [lx, ly, s / 3.3];
    }
  }
  function drawBalconyPerson(w, time) {
    const k = scaleAt(w.z), x = zToX(w.z, W), y = yAt(w.z, BALCONY_Y), sz = FIG * k * 0.95;
    const wm = clamp(warmAt(w.z) * 0.5, 0, 1), show = 0.35 + 0.65 * wm;
    drawBody(x, y, sz, { face: w.goZ != null ? -w.dir : (w.robe % 2 ? 1 : -1), step: w.step, still: w.goZ == null, sit: w.kind === 'sit', look: w.head,
      body: mixHex(SIL, KIMONO[w.robe % KIMONO.length], show), head: mixHex('#2a2522', SKIN, 0.25 + wm * 0.7), hair: w.robe % 3 ? '#121212' : null, knot: SIL,
      fan: w.fan ? mixHex(SIL, '#c9b88a', show) : null, fanT: time + w.phase, bow: 0 });
  }
  function drawPlayer(sim, time) {
    const p = sim.player, k = scaleAt(p.z), x = zToX(p.z, W), y = yAt(p.z, WALK_Y), s = FIG * k, wm = clamp(warmAt(p.z) * 0.8, 0, 1);
    const coat = lit(COAT, 0.25 + wm * 0.6);
    ctx.save(); ctx.globalAlpha = p.fade;
    drawBody(x, y, s, { face: p.face, step: p.step, bow: Math.sin(p.nod * Math.PI) * 0.3, still: Math.abs(p.vz) < 0.8 && p.lightT <= 0,
      body: coat, legs: '#151518', head: mixHex('#a88a6a', SKIN, 0.4 + wm * 0.6), collar: '#d8c9a0', band: '#e8e0cc', sash: '#d8c9a0' });
    // his arm, and the pole with its small flame: carried slanting up ahead of him; to light a lantern he lifts his arm and
    // raises the pole until the flame is just under it
    const shoulder = [x + p.face * 2 * s, y - 29 * s], hand = [x + p.face * 7 * s, y - (20 + 14 * p.raise) * s];
    ctx.strokeStyle = coat; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    const len = 34 * s, carry = p.face > 0 ? -1.05 : Math.PI + 1.05;
    let ang = carry, L = len;
    if (p.lantern >= 0 && p.raise > 0) {
      const l = sim.lanterns[p.lantern], tx = zToX(l.z, W), ty = yAt(l.z, LANTERN_Y) + (LR[1] + 7) * scaleAt(l.z);
      const want = Math.atan2(ty - hand[1], tx - hand[0]), wantL = Math.hypot(tx - hand[0], ty - hand[1]);
      ang = carry + (want - carry) * p.raise; L = len + (wantL - len) * p.raise;
    }
    const bob = Math.sin(p.step * Math.PI * 2) * 2 * k;
    const tip = [hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L + bob * (1 - p.raise)];
    ctx.strokeStyle = '#2a241d'; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(hand[0] - Math.cos(ang) * 7 * s, hand[1] - Math.sin(ang) * 7 * s); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    const fl = 1 + 0.15 * Math.sin(time * 17) + 0.1 * Math.sin(time * 31);
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(tip[0], tip[1] - 4 * fl * k, 3.4 * k, 6 * fl * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(tip[0], tip[1] - 3 * k, 1.7 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    sim.flameAt = [tip[0], tip[1] - 3 * k, p.fade, k];
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
    lights = sim.lanterns.map((l) => ({ z: l.z, glow: l.glow }));

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackground();
    const street = sim.walkers.filter((w) => w.lane === 'street').sort((a, b) => b.z - a.z);   // far ones first
    for (const w of street) if (w.z > WING[1]) drawStreetWalker(w);                             // (far along the street: behind the wing)
    drawWing();
    drawUpper();
    for (const w of sim.walkers) if (w.lane === 'balcony') drawBalconyPerson(w, time);         // upstairs, behind the balcony rail
    drawBalconyFront();
    drawWalkwayBack();
    sim.flameAt = null;
    if (sim.state !== 'title') drawPlayer(sim, time);
    drawLanterns(sim, time);
    drawWalkwayFront();
    for (const w of street) if (w.z <= WING[1]) drawStreetWalker(w);
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
