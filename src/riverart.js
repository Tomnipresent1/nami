// THE RIVER (print 5, portrait trial): the painting. After Hiroshige's "Kawaguchi Ferry and Zenkoji Temple": a wide pale river
// sweeping down from the top left in long curves, deep indigo shading along its banks, rocky far bank with fields and dark woods,
// the temple roofs up in the trees, timber rafts poled down the stream, a ferry crossing, pines and a willow on the near bank.
// The picture is RIVER_W wide and sim.H tall; on a sideways screen (the PC, or the album card) it sits upright in the middle.
import { clamp } from './ocean.js';
import { RIVER_W, RTUNE, REEDS, REED_S, REED_D, FERRY_S, RIVER_PAUSE_ROWS, DONE_CHOICES, DONE_WAIT, frame, riverPoint, scaleAt,
  pauseRowY, doneButton, unloadButton } from './river.js';
import { createUI, inked, PAPER, INK, MUTED, SEAL } from './ui.js';
import { BUILD } from './version.js';
import { pixelRatio } from './quality.js';

// [colour on bare paper, final colour, ink where it starts, ink where it is done]
const LAYERS = {
  sky: ['#e4dfcc', '#26314c', 35, 100],
  woods: ['#cfcfc2', '#28332f', 25, 90],
  field: ['#dedcc2', '#6f8c5c', 10, 60],
  rock: ['#ecebe2', '#d5d7d0', 0, 40],
  water: ['#e8e4d4', '#c2ced8', 0, 40],
  indigo: ['#cfd0d2', '#1d3260', 15, 80],
  ground: ['#d8d5c8', '#8c9296', 10, 60],
  grass: ['#d9dcc6', '#5a8850', 20, 70],
  log: ['#dcc6aa', '#a6673a', 10, 50],
  thatch: ['#eee2b6', '#e3c048', 30, 80],
  pine: ['#d4d8c6', '#3f6a48', 25, 75],
  trunk: ['#d6ccbc', '#6b5640', 20, 70],
};
const START_INK = 30;
const SKIN = '#e6c8a2', YOU = '#a8452f', BOX = '#ead7a8';
const ROBES = ['#2f3d5c', '#4a5468', '#3a3f4a', '#5b6650'];
const PORTERS = [{ robe: '#3d6b5a', hat: true }, { robe: '#2f3d5c', hat: false }, { robe: '#6b5a48', hat: true }];
// the dark woods: a dense stand of thin trunks along the top, as in the print
const TRUNKS = Array.from({ length: 150 }, (_, i) => ({ u: ((i * 0.618034) % 1) * 1.04 - 0.02, top: (i * 0.37) % 1, w: 1 + ((i * 7) % 3) * 0.6 }));
const RIPPLES = Array.from({ length: 46 }, (_, i) => ({ s: (i * 0.618034) % 1, d: 0.12 + ((i * 0.381966 * 5) % 1) * 0.76, len: 0.012 + ((i * 13) % 5) * 0.004 }));

export function createRiverArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  const W = RIVER_W;
  let H = 1200, scale = 1, ox = 0, oy = 0, artInk = 100, lastT = 0;

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
  function bankLine(d, s0 = -0.45, s1 = 1.75, n = 110) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; pts.push(riverPoint(s, d, H)); }
    return pts;
  }
  const trace = (pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };

  // ---------- the land ----------
  function drawLand(ink) {
    // fields on the far bank under a sky band and the dark woods
    ctx.fillStyle = C('field', ink); ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    g.addColorStop(0, C('sky', ink)); g.addColorStop(0.18, C('woods', ink)); g.addColorStop(1, C('woods', ink));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.3);
    for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, H * (0.26 + 0.03 * Math.sin(x / 47)) + 8 * Math.sin(x / 13));
    ctx.closePath(); ctx.fill();
    // thin trunks in the woods
    ctx.strokeStyle = C('woods', ink * 1.1); ctx.globalAlpha = 0.55;
    for (const t of TRUNKS) {
      const x = t.u * W, y0 = H * (0.03 + 0.06 * t.top), y1 = H * (0.25 + 0.04 * Math.sin(x / 47));
      ctx.lineWidth = t.w; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 2, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
  function hut(x, y, k, ink) {
    ctx.fillStyle = '#6b5a48'; ctx.fillRect(x - 16 * k, y, 32 * k, 12 * k);
    ctx.fillStyle = C('thatch', ink); ctx.beginPath(); ctx.moveTo(x - 24 * k, y + 2 * k); ctx.lineTo(x - 10 * k, y - 16 * k); ctx.lineTo(x + 12 * k, y - 16 * k); ctx.lineTo(x + 26 * k, y + 2 * k); ctx.closePath(); ctx.fill();
  }

  function drawRiver(ink, t) {
    const far = bankLine(1), near = bankLine(0);
    // the far bank's rocky white edge, just outside the water
    ctx.strokeStyle = C('rock', ink); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [lw, a] of [[34, 0.5], [20, 1]]) { ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); trace(far); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // the water
    ctx.save();
    ctx.beginPath(); trace(far); for (let i = near.length - 1; i >= 0; i--) ctx.lineTo(near[i][0], near[i][1]); ctx.closePath();
    ctx.fillStyle = C('water', ink); ctx.fill();
    ctx.clip();
    // deep indigo shading along both banks (the print's bokashi), softest toward mid-stream
    const indigo = C('indigo', ink);
    ctx.strokeStyle = indigo;
    for (const [pts, k] of [[far, 1], [near, 0.85]]) for (const [lw, a] of [[150, 0.14], [100, 0.18], [60, 0.25], [26, 0.35]]) {
      ctx.globalAlpha = a * k; ctx.lineWidth = lw; ctx.beginPath(); trace(pts); ctx.stroke();
    }
    // and a dark band of current running down the middle
    ctx.globalAlpha = 0.16; ctx.lineWidth = 46; ctx.beginPath(); trace(bankLine(0.6)); ctx.stroke();
    ctx.globalAlpha = 0.12; ctx.lineWidth = 22; ctx.beginPath(); trace(bankLine(0.6)); ctx.stroke();
    // little pale streaks drifting with the current
    ctx.strokeStyle = '#eef1ee'; ctx.lineWidth = 1.4;
    for (const r of RIPPLES) {
      const s = ((r.s + t / RTUNE.journeySecs * 0.9) % 1.3) - 0.15;
      const a = riverPoint(s, r.d, H), b = riverPoint(s + r.len, r.d, H);
      ctx.globalAlpha = 0.35 * clamp(Math.min(s + 0.15, 1.15 - s) * 6, 0, 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawReeds(ink) {
    ctx.strokeStyle = C('pine', ink); ctx.lineWidth = 1.2;
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
    ctx.beginPath(); trace(near); ctx.lineTo(-60, H + 60); ctx.lineTo(-60, -60); ctx.closePath();
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
    // the ferry hut's yellow roof at the bottom, as in the print
    ctx.fillStyle = C('thatch', ink);
    ctx.beginPath(); ctx.moveTo(W * 0.38, H + 4); ctx.lineTo(W * 0.5, H * 0.95); ctx.lineTo(W * 0.62, H * 0.95); ctx.lineTo(W * 0.74, H + 4); ctx.closePath(); ctx.fill();
  }
  const landing = () => riverPoint(1, -0.16, H);

  function drawTrees(ink) {
    pine(W * 0.1, H * 0.86, 1.15, ink);
    willow(W * 0.27, H * 0.8, ink);
    pine(W * 0.93, H * 0.99, 0.9, ink);
  }
  function pine(x, y, k, ink) {
    ctx.strokeStyle = C('trunk', ink); ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 18 * k, y - 80 * k, x - 20 * k, y - 140 * k, x + 6 * k, y - 210 * k); ctx.stroke();
    ctx.fillStyle = C('pine', ink);
    for (const [dx, dy, w] of [[6, -210, 46], [-26, -170, 40], [24, -150, 38], [-10, -118, 34], [20, -95, 28]]) {
      ctx.beginPath(); ctx.ellipse(x + dx * k, y + dy * k, w * k, 9 * k, -0.08, 0, Math.PI * 2); ctx.fill();
    }
  }
  function willow(x, y, ink) {
    ctx.strokeStyle = C('trunk', ink); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.quadraticCurveTo(x - 10, y - 40, x + 20, y - 90); ctx.stroke();
    ctx.strokeStyle = C('pine', ink); ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const a = (i / 25) * Math.PI, sx = x + 20 + Math.cos(a) * 46, sy = y - 90 - Math.sin(a) * 20;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 4, sy + 40, sx + 2, sy + 70 + (i % 4) * 8); ctx.stroke();
    }
  }

  // ---------- people, rafts, the ferry ----------
  function figure(x, y, k, robe, hat, lean = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(lean); ctx.scale(k, k);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-4, -12); ctx.moveTo(3, 0); ctx.lineTo(4, -12); ctx.stroke();
    ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.lineTo(5, -30); ctx.lineTo(-5, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(0, -34, 4.4, 0, Math.PI * 2); ctx.fill();
    if (hat) { ctx.fillStyle = '#d9bb5f'; ctx.beginPath(); ctx.moveTo(-9, -35); ctx.lineTo(0, -42); ctx.lineTo(9, -35); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  /** A timber raft lying along the stream at s, d, poled from the back. */
  function raft(s, d, len, pole, robe, boxes = 0, you = false) {
    const [x, y] = riverPoint(s, d, H), f = frame(s, H), k = scaleAt(s);
    const L = 120 * k * len, Wd = 15 * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(f.ty, f.tx));
    // a faint wake
    ctx.strokeStyle = '#eef1ee'; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-L / 2 - 4, -Wd / 2 - 2); ctx.lineTo(-L / 2 - 30 * k, -Wd / 2 - 7 * k); ctx.moveTo(-L / 2 - 4, Wd / 2 + 2); ctx.lineTo(-L / 2 - 30 * k, Wd / 2 + 7 * k); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C('log', 100); ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    ctx.strokeStyle = '#6e4224'; ctx.lineWidth = 0.9;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-L / 2, -Wd / 2 + (Wd * i) / 4); ctx.lineTo(L / 2, -Wd / 2 + (Wd * i) / 4); ctx.stroke(); }
    ctx.strokeRect(-L / 2, -Wd / 2, L, Wd);
    ctx.beginPath(); ctx.moveTo(-L / 2 + 6, -Wd / 2); ctx.lineTo(-L / 2 + 6, Wd / 2); ctx.moveTo(L / 2 - 6, -Wd / 2); ctx.lineTo(L / 2 - 6, Wd / 2); ctx.stroke();
    // the boxes (yours)
    for (let i = 0; i < boxes; i++) {
      const bx = -L * 0.05 + i * 17 * k;
      ctx.fillStyle = BOX; ctx.fillRect(bx - 7 * k, -7 * k, 14 * k, 14 * k);
      ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 1; ctx.strokeRect(bx - 7 * k, -7 * k, 14 * k, 14 * k);
    }
    ctx.restore();
    // the raftsman stands upright at the back, his pole reaching down into the water
    const back = [x - f.tx * L * 0.38, y - f.ty * L * 0.38];
    const sw = Math.sin(pole * 2.2);
    ctx.strokeStyle = '#4e3b29'; ctx.lineWidth = 1.6 * k + 0.4;
    ctx.beginPath(); ctx.moveTo(back[0] - f.tx * 40 * k + 10 * k * sw, back[1] - 44 * k - f.ty * 20 * k); ctx.lineTo(back[0] + f.tx * 34 * k - 6 * k * sw, back[1] + 10 * k + f.ty * 16 * k); ctx.stroke();
    figure(back[0], back[1] + 3 * k, k * (you ? 1.05 : 0.95), robe, !you || true, 0.12 * sw);
    if (you) {   // a soft ring so you can always find yourself
      ctx.strokeStyle = 'rgba(168,69,47,0.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, L * 0.62, 16 * k + 6, Math.atan2(f.ty, f.tx), 0, Math.PI * 2); ctx.stroke();
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
        ctx.fillStyle = BOX; ctx.fillRect(x - 3, y - 47, 15, 13); ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 1; ctx.strokeRect(x - 3, y - 47, 15, 13);
      }
    });
    if (lift) {   // the box on its way up from the raft into his hands
      const p = sim.player, f = frame(1, H), k = scaleAt(1), slot = -120 * k * 0.05 + (RTUNE.boxes - sim.boxes) * 17 * k;
      const [rx, ry] = riverPoint(p.s, p.d, H), from = [rx + f.tx * slot, ry + f.ty * slot];
      const q = sim.porters[lift.n], to = [L[0] - 18 - lift.n * 26 + 3, L[1] + 10 + (lift.n % 2) * 9 - 40];
      const u = clamp(lift.t / (RTUNE.liftSecs * 0.6), 0, 1), x = from[0] + (to[0] - from[0]) * u, y = from[1] + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * 30;
      if (q.state !== 'gone') { ctx.fillStyle = BOX; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 1; ctx.strokeRect(x - 7, y - 7, 14, 14); }
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
    ctx.fillStyle = BOX; ctx.fillRect(cx - 13, cy - 26, 26, 24); ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 13, cy - 26, 26, 24);
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
    const target = sim.state === 'title' || sim.state === 'complete' ? 100 : sim.inkShown;
    artInk += (target - artInk) * Math.min(1, dt * (sim.state === 'play' ? 6 : 1.4));
    const ink = START_INK + artInk * (1 - START_INK / 100);

    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawLand(ink);
    drawRiver(ink, sim.t);
    drawNearBank(ink);
    drawReeds(ink);
    // everything on the water, furthest (highest up the picture) first
    const things = sim.others.map((o) => ({ s: o.s, f: () => raft(o.s, o.d, o.len, o.pole, ROBES[Math.floor(o.phase) % ROBES.length]) }));
    things.push({ s: FERRY_S, f: () => ferry(sim.ferry) });
    if (sim.state !== 'title') things.push({ s: sim.player.s, f: () => raft(sim.player.s, sim.player.d, 1.05, sim.player.pole, YOU, sim.boxes - (sim.lift ? 1 : 0), true) });
    things.sort((a, b) => a.s - b.s).forEach((th) => th.f());
    drawPorters(sim);
    drawTrees(ink);
    ui.paperGrain(W, H);
    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (uiState.bare) return;
    if (sim.state !== 'title') {
      ui.inkBar(sim.inkShown / 100);
      message(sim.message);
      drawUnloadButton(sim, now / 1000);
      if (sim.state === 'complete') drawComplete(sim);
    }
    if (sim.paused) drawPause(sim);
  }

  return { draw, resize, toPicture };
}
