// THE LAMPLIGHTER's painting (v1.4.4): the big wooden teahouse of the Meiji photograph (research 17), its front receding gently to
// the left (between orthographic and true perspective: see VIEW in lamplighter.js), in Kiyochika's night colours (research 12).
// Three storeys: the top one cut off by the picture's edge near you, a balcony with people on the second, and along the ground
// floor the covered walkway behind its low railing, where he walks and the red lanterns hang. A curved gable over the entrance.
// Beyond the corner the street runs on into the distance, a pagoda against the sky. Each lantern he lights glows and warms the
// walkway, the lattice behind it and the windows above. Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { VIEW, scaleAt, zToX, yAt, BEAM_Y, LANTERN_Y, WALK_Y, RAIL_Y, STREET_Y, BALCONY_Y, ENTRANCE_Z, lightButton, LAMP_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT, EVENING_WAIT } from './lamplighter.js';
import { createUI, mixHex, INK, MUTED } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// ---- the palette (after Kiyochika's "Night Stalls at Asakusa") ----
const SKY_TOP = '#1f2225', SKY_LOW = '#5a5b52';           // (the sky never changes)
const PAGODA = '#191c1c', FAR_HOUSE = '#1d1c1a';
const ROOF = '#24282d', ROOF_EDGE = '#3d4247';
const WOOD = '#2a241f', WOOD_DARK = '#171512', POST = '#1b1815', WOOD_END = '#352d25';
const RAIL = ['#2e2822', '#6e5236'];                      // the railing's boards: dark, and warmed by a lantern
const SHOJI = ['#2e2f2b', '#f0c98a'];                     // paper windows upstairs
const LATTICE = ['#141210', '#d39a5a'];                   // the paper behind the ground floor's lattice
const NOREN = ['#1c2438', '#4a6696'];                     // the indigo noren over the entrance
const GROUND = ['#3b3a34', '#24231f'];                    // the street: lighter far off, darker near you
const SIL = '#17181b';
// plain working clothes: indigo, brown, grey, dull green, ochre-brown, navy, tea, blue-grey
const ROBES = ['#3b4458', '#5a4a3a', '#4a4a46', '#3d4a3c', '#6a5532', '#2f3a4f', '#5b4e45', '#47505a'];
const KIMONO = ['#4a3a4a', '#3a4a5a', '#5a4038', '#3d4a44', '#4d4536'];   // upstairs: guests, a little finer, still muted
const SKIN = '#d9b38c';
const COAT = ['#6e221c', '#a8382c'];                      // the lamplighter's coat: deep red, with a pale collar
const FIG = 3.3;                                          // people's size at scale 1 (the right edge); smaller further off
const LR = [13, 17];                                      // a lantern's half-width and half-height (at scale 1)
const WARM_Z = 30;                                        // how far (in depth) a lantern's light spreads along the building
const ZN = -80, ZC = VIEW.ZC;                             // the building runs from past the right edge to the corner
const BAY = 27.5, POST0 = ZC - 8;                         // the walkway's posts: one between each pair of lanterns

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
  const vline = (z, y0a, y0b) => { const [x, ya] = P(z, y0a), yb = yAt(z, y0b); ctx.moveTo(x, ya); ctx.lineTo(x, yb); };
  const hline = (z0, z1, y0) => { ctx.moveTo(...P(z0, y0)); ctx.lineTo(...P(z1, y0)); };

  // ---------- light ----------
  let lights = [];                         // this frame's lanterns: { z, glow }
  const warmAt = (z) => {
    let w = 0;
    for (const l of lights) if (l.glow > 0) w = Math.max(w, l.glow * Math.exp(-(((z - l.z) / WARM_Z) ** 2)));
    return w;
  };
  const lit = (pair, w) => mixHex(pair[0], pair[1], w);

  // ---------- sky, the street beyond the corner, the ground ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.HORIZON);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.6, '#3a3c37'); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VIEW.HORIZON + 2);
    const gg = ctx.createLinearGradient(0, VIEW.HORIZON, 0, VH);
    gg.addColorStop(0, GROUND[0]); gg.addColorStop(1, GROUND[1]);
    ctx.fillStyle = gg; ctx.fillRect(0, VIEW.HORIZON, W, VH - VIEW.HORIZON);
    // a pagoda far off, against the sky (as at Asakusa)
    const px = W * 0.07, base = 150;
    ctx.fillStyle = PAGODA;
    for (let i = 0; i < 5; i++) {
      const y = base - i * 20, w = 40 - i * 5, bw = w * 0.5;
      ctx.fillRect(px - bw / 2, y - 11, bw, 11);
      ctx.beginPath(); ctx.moveTo(px - w - 4, y - 14); ctx.quadraticCurveTo(px - w * 0.5, y - 10, px - bw * 0.5, y - 19);
      ctx.lineTo(px + bw * 0.5, y - 19); ctx.quadraticCurveTo(px + w * 0.5, y - 10, px + w + 4, y - 14);
      ctx.lineTo(px + w - 3, y - 11); ctx.lineTo(px - w + 3, y - 11); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(px - 1.5, base - 5 * 20 - 30, 3, 34);
    // across the side street, the houses beyond run on into the distance (lower, darker)
    const z0 = ZC + 70;
    band(z0, 6000, 175, 500, FAR_HOUSE);
    band(z0, 6000, 150, 175, ROOF);
    band(z0, 6000, 330, 400, '#2c2924');                                           // a row of dim shop fronts
    ctx.strokeStyle = '#121110'; ctx.lineWidth = 1; ctx.beginPath();
    for (let z = z0 + 30; z < 3000; z += 45 + z * 0.2) vline(z, 175, 500);
    ctx.stroke();
    ctx.fillStyle = '#24201b'; const [ex, ey0] = P(z0, 150), ey1 = yAt(z0, 500); ctx.fillRect(ex, ey0, 12 * scaleAt(z0), ey1 - ey0);   // its corner, facing us
  }

  // ---------- the teahouse ----------
  function drawUpper() {
    // the top storey (cut off by the picture's edge near you) and its roof
    band(ZN, ZC, -90, -40, ROOF);
    band(ZN, ZC, -40, -28, ROOF_EDGE);
    band(ZN, ZC, -28, 62, WOOD);
    windows(-18, 50, 0.4);
    band(ZN, ZC, 62, 76, ROOF_EDGE); band(ZN, ZC, 76, 90, ROOF);                 // the roof between the top and middle storeys
    // the middle storey: paper windows behind the balcony
    band(ZN, ZC, 90, BALCONY_Y, WOOD);
    windows(98, 176, 0.55);
  }
  /** A row of paper windows between y0a and y0b along the whole front, warmed (a little) by the lanterns below. */
  function windows(y0a, y0b, warmth) {
    for (let z = ZC - 6; z > ZN; z -= 18) {
      const z1 = z - 15;
      band(z, z1, y0a, y0b, lit(SHOJI, warmAt(z - 7) * warmth));
    }
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
    for (let z = ZC - 6; z > ZN; z -= 18) { vline(z - 7.5, y0a, y0b); for (let y = y0a + 13; y < y0b; y += 13) hline(z, z - 15, y); }
    ctx.stroke();
  }
  function drawBalconyFront() {
    // the balcony's rail, in front of the people upstairs
    band(ZN, ZC, BALCONY_Y - 34, BALCONY_Y - 30, WOOD_DARK);
    band(ZN, ZC, BALCONY_Y - 8, BALCONY_Y, WOOD_DARK);
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 2; ctx.beginPath();
    for (let z = ZC - 2; z > ZN; z -= 4.5) vline(z, BALCONY_Y - 32, BALCONY_Y - 6);
    ctx.stroke();
    // the walkway's roof below it, and its front beam (the lanterns hang from that)
    band(ZN, ZC, BALCONY_Y, BEAM_Y - 12, ROOF);
    band(ZN, ZC, BEAM_Y - 14, BEAM_Y - 11, ROOF_EDGE);
    band(ZN, ZC, BEAM_Y - 11, BEAM_Y, WOOD_DARK);
  }
  function drawWalkwayBack() {
    // the underside of the walkway's roof, in shadow
    band(ZN, ZC, BEAM_Y, 236, '#100f0d');
    // the ground floor's front: bays of fine lattice with lit paper behind, the entrance with its noren
    for (let z = POST0; z > ZN; z -= BAY) {
      const z1 = z - BAY, mid = z - BAY / 2;
      if (Math.abs(mid - ENTRANCE_Z) < BAY / 2) { band(z, z1, 236, 476, lit(['#0f0e0c', '#b07a46'], warmAt(mid) * 0.7)); band(z - 3, z1 + 3, 248, 330, lit(NOREN, warmAt(mid) * 0.9)); continue; }
      band(z, z1, 236, 476, lit(LATTICE, warmAt(mid) * 0.85));
    }
    ctx.strokeStyle = POST; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let z = ZC; z > ZN; z -= 2.6) { if (Math.abs(z - ENTRANCE_Z) < BAY / 2) continue; vline(z, 240, 476); }
    for (let z = POST0; z > ZN; z -= BAY) hline(z, z - BAY, 300);
    ctx.stroke();
    // the walkway's floor (mostly hidden behind the railing)
    band(ZN, ZC, 476, RAIL_Y[1], '#1c1a17');
  }
  function drawWalkwayFront() {
    // the railing: solid boards, warmed where a lantern hangs over it
    for (let z = POST0; z > ZN; z -= BAY) {
      const mid = z - BAY / 2;
      if (Math.abs(mid - ENTRANCE_Z) < BAY / 2) continue;                 // the way in, at the entrance
      band(z, z - BAY, RAIL_Y[0], RAIL_Y[1], lit(RAIL, warmAt(mid) * 0.75));
    }
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1; ctx.beginPath();
    for (let z = ZC; z > ZN; z -= 5.5) { if (Math.abs(z - ENTRANCE_Z) < BAY / 2) continue; vline(z, RAIL_Y[0] + 6, RAIL_Y[1]); }
    ctx.stroke();
    for (let z = POST0; z > ZN; z -= BAY) { const mid = z - BAY / 2; if (Math.abs(mid - ENTRANCE_Z) >= BAY / 2) band(z, z - BAY, RAIL_Y[0], RAIL_Y[0] + 6, WOOD_DARK); }
    // the posts holding up the walkway's roof
    for (let z = POST0; z > ZN; z -= BAY) { const [x, y0] = P(z, BEAM_Y), y1 = yAt(z, RAIL_Y[1]), k = scaleAt(z); ctx.fillStyle = POST; ctx.fillRect(x - 5 * k, y0, 10 * k, y1 - y0); }
    // the corner: the building's end, facing the side street, with the railing turning round it
    const k = scaleAt(ZC), [cx, ctop] = P(ZC, -90), cbot = yAt(ZC, RAIL_Y[1]), ew = 30 * k;
    ctx.fillStyle = WOOD_END; ctx.fillRect(cx - ew, ctop, ew, cbot - ctop);
    ctx.fillStyle = WOOD_DARK; for (const y0 of [-40, 62, 90, BALCONY_Y, BEAM_Y]) ctx.fillRect(cx - ew - 4, yAt(ZC, y0) - 6 * k, ew + 4, 8 * k);
    ctx.fillStyle = lit(RAIL, warmAt(ZC) * 0.6); ctx.fillRect(cx - ew, yAt(ZC, RAIL_Y[0]), ew, (RAIL_Y[1] - RAIL_Y[0]) * k);
    ctx.fillStyle = POST; ctx.fillRect(cx - 5 * k, yAt(ZC, BEAM_Y), 10 * k, (RAIL_Y[1] - BEAM_Y) * k);
    // the curved gable over the entrance (karahafu), as in the photograph
    const za = ENTRANCE_Z + 16, zb = ENTRANCE_Z - 16, [xa, ya] = P(za, BEAM_Y - 8), [xb, yb] = P(zb, BEAM_Y - 8), [xm, ym] = P(ENTRANCE_Z, BEAM_Y - 64);
    ctx.fillStyle = ROOF; ctx.beginPath();
    ctx.moveTo(xa - 8, ya + 4); ctx.quadraticCurveTo(xa + (xm - xa) * 0.3, ym + 28 * scaleAt(za), xm, ym);
    ctx.quadraticCurveTo(xb - (xb - xm) * 0.3, ym + 28 * scaleAt(zb), xb + 8, yb + 4); ctx.lineTo(xb, yb + 12); ctx.lineTo(xa, ya + 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ROOF_EDGE; ctx.lineWidth = 3 * scaleAt(ENTRANCE_Z); ctx.beginPath();
    ctx.moveTo(xa - 8, ya + 4); ctx.quadraticCurveTo(xa + (xm - xa) * 0.3, ym + 28 * scaleAt(za), xm, ym); ctx.quadraticCurveTo(xb - (xb - xm) * 0.3, ym + 28 * scaleAt(zb), xb + 8, yb + 4); ctx.stroke();
    ctx.fillStyle = mixHex('#3d3428', '#c9a46a', warmAt(ENTRANCE_Z) * 0.6); ctx.beginPath(); ctx.ellipse(xm, ym + 26 * scaleAt(ENTRANCE_Z), 9 * scaleAt(ENTRANCE_Z), 6 * scaleAt(ENTRANCE_Z), 0, 0, Math.PI * 2); ctx.fill();   // its carved crest
  }

  // ---------- lanterns ----------
  function drawLanterns(sim, time) {
    for (const l of sim.lanterns) {
      const k = scaleAt(l.z), x = zToX(l.z, W), top = yAt(l.z, BEAM_Y), y = yAt(l.z, LANTERN_Y) + Math.sin(time * 0.9 + l.z) * 0.8, g = l.glow, rx = LR[0] * k, ry = LR[1] * k;
      ctx.strokeStyle = POST; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - ry); ctx.stroke();
      if (g > 0.01) {
        const grd = ctx.createRadialGradient(x, y - 2, 1, x, y, ry);
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
  /** Warm light added on top: halos round the lit lanterns, a wash over the walkway, a pool on the street beyond the railing. */
  function drawGlow(sim) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of sim.lanterns) {
      if (l.glow <= 0.01) continue;
      const k = scaleAt(l.z), x = zToX(l.z, W), a = l.glow, wy = yAt(l.z, 360);
      let g = ctx.createRadialGradient(x, wy, 6, x, wy, 170 * k);
      g.addColorStop(0, `rgba(255,150,80,${0.16 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 170 * k, wy - 170 * k, 340 * k, 340 * k);
      ctx.save(); ctx.translate(x, yAt(l.z, 540)); ctx.scale(1, 0.25);
      g = ctx.createRadialGradient(0, 0, 2, 0, 0, 150 * k);
      g.addColorStop(0, `rgba(255,160,90,${0.18 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 150 * k, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const ly = yAt(l.z, LANTERN_Y);
      g = ctx.createRadialGradient(x, ly, 4, x, ly, 62 * k);
      g.addColorStop(0, `rgba(255,190,120,${0.5 * a})`); g.addColorStop(0.4, `rgba(255,110,60,${0.2 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ly, 62 * k, 0, Math.PI * 2); ctx.fill();
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
  /** A person, feet at x, y, drawn at size sz. o: { face, step, bow, still, sit, body, head, legs, collar, sash, band, knot,
   *  pattern ('stripe' | 'check'), cloth, apron, porter (box colour), bundle (colour), fan (colour), fanT } */
  function drawBody(x, y, sz, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz, sz);
    const f = o.face, stride = Math.sin(o.step * Math.PI * 2) * (o.still ? 0 : 4.5);
    if (o.sit) ctx.translate(0, 9);                          // (sitting: only head and shoulders show over the balcony rail)
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
    if (o.fan) {                                               // a round fan, waved now and then
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
  function drawStreetWalker(w, time) {
    const k = scaleAt(w.z) * 1.1, x = zToX(w.z, W), y = yAt(w.z, STREET_Y), sz = FIG * k;
    const wm = clamp(warmAt(w.z) * 0.6, 0, 1), show = 0.3 + 0.7 * wm, dim = (c) => mixHex(SIL, c, show);
    const body = dim(ROBES[w.robe]), head = mixHex('#2a2522', SKIN, 0.2 + wm * 0.7), face = -w.dir;   // (more depth = walking left on screen)
    w.lanternAt = null;
    if (w.kind === 'rickshaw') {
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      const d = face, cx = -d * 40, wr = 28;
      ctx.strokeStyle = SIL; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(d * 8, -50); ctx.lineTo(cx, -44); ctx.stroke();
      ctx.fillStyle = dim('#3a3330');
      ctx.beginPath(); ctx.moveTo(cx - 28, -40); ctx.lineTo(cx + 24, -40); ctx.lineTo(cx - d * 14, -106);
      ctx.quadraticCurveTo(cx - d * 48, -108, cx - d * 36, -42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = head; ctx.beginPath(); ctx.arc(cx - d * 6, -76, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111113'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, -wr, wr, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath();
      const turn = w.z / 4;
      for (let j = 0; j < 6; j++) { const a = turn + (j * Math.PI) / 6; ctx.moveTo(cx - Math.cos(a) * wr, -wr - Math.sin(a) * wr); ctx.lineTo(cx + Math.cos(a) * wr, -wr + Math.sin(a) * wr); }
      ctx.stroke();
      ctx.fillStyle = '#e0553a'; ctx.beginPath(); ctx.ellipse(cx + d * 22, -52, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      w.lanternAt = [x + (cx + d * 22) * k, y - 52 * k, k];
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
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer: ['HOLD A FINGER TO WALK, LET GO TO STOP', MUTED] });
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
    drawUpper();
    for (const w of sim.walkers) if (w.lane === 'balcony') drawBalconyPerson(w, time);         // upstairs, behind the balcony rail
    drawBalconyFront();
    drawWalkwayBack();
    sim.flameAt = null;
    if (sim.state !== 'title') drawPlayer(sim, time);
    drawLanterns(sim, time);
    drawWalkwayFront();
    const street = sim.walkers.filter((w) => w.lane === 'street').sort((a, b) => b.z - a.z);   // far ones first
    for (const w of street) drawStreetWalker(w, time);
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
