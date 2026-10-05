// The SHAPE of a great wave at one moment: a smooth outline that never loops back on itself and has no hard corners.
// Pure maths (no drawing) so tools/selftest.mjs can check every moment of a wave's life.
//
// How it is built:
//   * the BODY is just the water surface (the long back, the crest, the face) — already smooth because it is a smooth function;
//   * the LIP is an overhang added in front of the crest: a curved top edge from the crest out to the tip, and an underside that
//     curves back to meet the face. When the wave curls the lip reaches out; when it breaks the tip falls but never below the water
//     under it; as the wave settles the whole lip shrinks back into the crest (so no straight edge is ever left behind).
import { BASE_Y, ambient, waveX, waveAmp, waveCurl, waveBreak, waveHeightAt } from './ocean.js';

const bez = (p0, p1, p2, p3, u) => {
  const v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
};
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
/** Rounds the corners of a line (Chaikin's method); the two end points stay where they are. */
function roundCorners(pts, passes = 3) {
  for (let k = 0; k < passes; k++) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (i > 0) out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (i < pts.length - 2) out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

export const BACK_LEN = 560;   // how far behind the crest the shape is drawn
export const FRONT_LEN = 230;  // how far in front of the crest the face is drawn

/** Everything needed to draw wave w at sea time t. Returns null when the wave is too small to see. */
export function waveShape(w, t) {
  const amp = waveAmp(w);
  if (amp < 5) return null;
  const curl = waveCurl(w), brk = waveBreak(w), xc = waveX(w);
  const hAt = (x) => ambient(x, t) + waveHeightAt(w, x);
  const yAt = (x) => BASE_Y - hAt(x);
  const C = [xc, yAt(xc)];

  // ---- the lip (all sizes scale with curl, so at curl 0 it vanishes into the crest) ----
  const reach = 150 * curl;
  const tipX = xc - reach - 40 * brk * curl;
  const tipY0 = C[1] + 38 * curl;
  const fallY = tipY0 + (BASE_Y - 8 - tipY0) * brk * brk;
  const gap = 2 * Math.min(1, curl * 4);                              // the clearance above the water shrinks with the lip, so a tiny lip stays tiny
  const tip = [tipX, Math.min(fallY, yAt(tipX) - gap)];               // falls onto the water, never through it
  const lift = (30 + 30 * curl) * curl;
  // the lip starts a little way down the BACK of the wave and carries straight on in the direction the back is already rising,
  // so the silhouette goes up and over in one curve (starting it exactly at the crest left a little dip between crest and lip)
  const sx = xc + 55 * curl;
  const S0 = curl > 0.01 ? [sx, yAt(sx)] : C;
  const slope = (yAt(sx + 1) - yAt(sx - 1)) / 2;                       // how the back rises here (y grows downward)
  // reach far enough along the back's line that the curve clears the crest by itself (if it had to be pushed up over the
  // crest, the push itself made a little dip between crest and lip). Never reach past the tip (that folds the curve over);
  // if that is still not enough, lift the far end of the curve instead.
  // how far above the water the lip must stay: nothing where it leaves the water, easing up smoothly over the next 60 units
  // (a sudden margin right after the start is what made the little dip)
  const margin = (x) => (gap + 2 * curl) * Math.min(1, Math.max(0, (S0[0] - x) / 60)) ** 2;
  const maxL1 = Math.max(1, (S0[0] - tip[0]) * 0.7);
  let L1 = Math.min(maxL1, 0.45 * reach + 55 * curl), lift2 = lift;
  let lip1 = [S0[0] - L1, S0[1] - slope * L1], lip2 = [tip[0] + 0.15 * reach + 8 * curl, tip[1] - lift2];   // lip2: comes down onto the tip from above
  for (let k = 0; k < 10 && curl > 0.01; k++) {
    let clear = true;
    // only check over the crest, where the dip was (near the tip the curve is meant to come down onto the water)
    for (let i = 1; i < 18 && clear; i++) { const p = bez(S0, lip1, lip2, tip, i / 18); if (p[0] > xc - 40 && p[1] > yAt(p[0]) - margin(p[0])) clear = false; }
    if (clear) break;
    if (L1 < maxL1) L1 = Math.min(maxL1, L1 * 1.3); else lift2 = Math.min(lift2 * 1.2, lift * 2);   // never more than double
    lip1 = [S0[0] - L1, S0[1] - slope * L1]; lip2 = [tip[0] + 0.15 * reach + 8 * curl, tip[1] - lift2];
  }
  // the top edge never dips below the water it hangs over (that is what used to slice through the face as the lip fell)
  const top = [];
  for (let i = 1; i <= 18; i++) {
    const p = bez(S0, lip1, lip2, tip, i / 18);
    if (i < 18) p[1] = Math.min(p[1], yAt(p[0]) - margin(p[0]));
    top.push(p);
  }
  const topYAt = (x) => {                                              // the top edge's height at x (straight-line between its points)
    let prev = S0;
    for (const p of top) { if ((x <= prev[0] && x >= p[0]) || (x >= prev[0] && x <= p[0])) { const f = (x - prev[0]) / ((p[0] - prev[0]) || 1); return prev[1] + (p[1] - prev[1]) * f; } prev = p; }
    return null;
  };

  // underside: from the tip curving back to meet the face a little in front of the crest; kept above the water it hangs over
  // where the underside rejoins the face: the steepest part of the face (about 100 in front of the crest) for a full curl,
  // sliding back to the crest as the curl shrinks; arriving straight DOWN there makes the join a gentle bend, not a hairpin
  const fx = xc - 100 * Math.min(1, curl * 1.6);
  const F = [fx, yAt(fx)];
  // like the inside of a "C": leave the tip heading down and back under the lip, then come DOWN onto the face (no hairpin where they meet)
  const drop = Math.max(0, F[1] - tip[1]);
  const u1 = [tip[0] + (F[0] - tip[0]) * 0.35, tip[1] + 4 * curl];
  const u2 = [F[0], F[1] - Math.max(20, drop * 0.55) * curl];
  const under = [];
  for (let i = 1; i < 14; i++) {
    const p = bez(tip, u1, u2, F, i / 14);
    // keep the order top edge > underside > water at every x, so the three lines can never cross
    const floor = yAt(p[0]) - gap, ceil = topYAt(p[0]);
    if (ceil != null) p[1] = Math.max(p[1], ceil + 1.5 * curl);
    p[1] = Math.min(p[1], floor);
    if (ceil != null && ceil + 1.5 * curl > floor) p[1] = (ceil + floor) / 2;   // squeezed flat: the lip is lying on the water
    under.push(p);
  }

  // ---- the water surface: long back, crest, face ----
  const back = [];
  for (let x = xc + BACK_LEN; x > xc + 60; x -= 16) back.push([x, yAt(x)]);
  for (let x = xc + 60; x > S0[0]; x -= 6) back.push([x, yAt(x)]);
  back.push(S0);
  const crestSeg = [];                                                // the water from the crest back up to where the lip starts
  for (let x = xc; x < S0[0]; x += 6) crestSeg.push([x, yAt(x)]);
  const face = [F];
  for (let x = fx - 6; x >= xc - FRONT_LEN; x -= 6) face.push([x, yAt(x)]);
  const bodyFace = [];                                                // the whole face (for the body fill, under the lip too)
  for (let x = xc - 6; x >= xc - FRONT_LEN; x -= 6) bodyFace.push([x, yAt(x)]);
  const crestToF = [];                                                // the face between the crest and F (closes the lip shape)
  for (let x = fx + 6; x < xc; x += 6) crestToF.push([x, yAt(x)]);

  // from the tip, down the underside and on down the face, as ONE line with its corners rounded off (the tip itself stays a point:
  // the round foam head sits on it)
  const front = curl > 0.01 ? roundCorners([tip, ...under, ...face]) : null;
  // the single line the ink outline follows: back -> crest -> lip top -> tip -> underside -> face
  const outline = front ? [...back, ...top, ...front.slice(1)] : [...back, C, ...bodyFace];
  // the lip AND the hollow under it, as one shape: crest -> lip top -> tip -> underside -> face -> back up the water to the crest
  const lipShape = front ? [S0, ...top, ...front.slice(1), ...bodyFace.slice().reverse(), ...crestSeg] : null;

  return { amp, curl, brk, xc, C, S0, tip, lip1, lip2, F, top, under, back, face, bodyFace, crestToF, outline, lipShape, yAt };
}

// ---------- checks used by the tests ----------
const cross = (a, b, c, d) => {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
/** Does this polyline cross itself anywhere (a loop / "wire looping on itself")? */
export function selfCrossings(pts) {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) for (let j = i + 2; j < pts.length - 1; j++) if (cross(pts[i], pts[i + 1], pts[j], pts[j + 1])) n++;
  return n;
}
/** The sharpest bend (degrees) at any point, skipping points within `skip` of index `except` (the tip, which is covered by foam). */
export function sharpestBend(pts, except = -1, skip = 2) {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    if (except >= 0 && Math.abs(i - except) <= skip) continue;
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (l1 < 0.5 || l2 < 0.5) continue;
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    worst = Math.max(worst, (d * 180) / Math.PI);
  }
  return worst;
}
