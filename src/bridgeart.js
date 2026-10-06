// SUDDEN SHOWER's painting, after Hiroshige: a black storm cloud fading to grey, the misty far shore, a jade river with a raft
// poling slowly by, the great wooden bridge rising from the lower left on its dark legs, the crowd hunched under hats and umbrellas,
// and fine rain falling in two sets of lines at slightly different angles. Drawn live in code; this file only draws.
import { VH, clamp } from './ocean.js';
import { deckFront, deckDepth, deckPoint, figScale, BRIDGE_PAUSE_ROWS, BRIDGE_STEER_OPTS, CROWD_OPTS, FINGER_OPTS, CROSS_CHOICES, DONE_CHOICES, DONE_WAIT } from './bridge.js';
import { CHOICE_WAIT } from './choice.js';
import { createUI, inked, INK, SEAL, MUTED } from './ui.js';
import { BUILD } from './version.js';

const START_INK = 25;            // like the Great Wave: the print starts with some colour already in
// [colour on bare paper, final colour, ink where it starts, ink where it is done]
const LAYERS = {
  cloud: ['#e9e1cc', '#121418', 10, 42],       // the black storm cloud at the top
  sky: ['#ece5d2', '#a4a8a6', 10, 42],         // where the cloud fades to grey
  shore: ['#e0dacb', '#3d4a4c', 18, 46],
  river: ['#e9e6d6', '#b6cebd', 6, 36],
  riverDeep: ['#dbe1d8', '#2c5878', 6, 52],
  deck: ['#f1e5c7', '#d2ba8a', 14, 44],
  wood: ['#d6c9ae', '#5d4932', 20, 50],         // rails and the side beam
  legs: ['#d2cbbf', '#3a3633', 24, 56],
};
const STRAW = '#d9bb5f', SKIN = '#e6c8a2';
const ROBES = ['#3a3f4a', '#55606b', '#2d4b7d', '#6b5a48', '#4a4038'];
const UMBRELLAS = ['#3d5a80', '#5b4a3a', '#2f3b46', '#7a6a4e'];
const FIG = 1.75;                // how big the people are drawn (big enough to read on a phone)
const YOU = '#a8452f';           // the lone walker's robe: one warm colour in the grey rain, easy to find

// the rain: two sets of fine lines at slightly different angles (Hiroshige crossed them like this)
const RAIN_N = 340;
const RAIN = Array.from({ length: RAIN_N }, (_, i) => ({ u: (i * 0.6180339) % 1, v: (i * 0.3819660 * 7) % 1, len: 70 + ((i * 37) % 80), set: i % 2, speed: 520 + ((i * 53) % 160) }));
const LEAN = [0.17, 0.06];

export function createBridgeArt(canvas) {
  const ui = createUI(canvas), ctx = ui.ctx;
  let W = 1300, scale = 1, artInk = 100, lastT = 0;
  const drops = [];                          // splash droplets
  let seenSplashes = 0;

  function resize(w) {
    const cssH = canvas.clientHeight || window.innerHeight, cssW = canvas.clientWidth || window.innerWidth;
    if (!(cssW > 0 && cssH > 0) || !Number.isFinite(w)) return;
    W = w; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = (cssH * dpr) / VH;
  }
  const C = (name, ink) => inked(LAYERS[name], ink);
  const yF = (x) => deckFront(x, W), yB = (x) => deckFront(x, W) - deckDepth(x, W);
  const scAt = (x) => figScale(x / W, 0.5);

  // ---------- sky, shore, river ----------
  function drawSky(ink, t) {
    const g = ctx.createLinearGradient(0, 0, 0, 215);
    g.addColorStop(0, C('cloud', ink)); g.addColorStop(0.22, C('cloud', ink)); g.addColorStop(0.75, C('sky', ink)); g.addColorStop(1, C('sky', ink));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 216);
    // the storm cloud's ragged lower edge, drifting slowly
    ctx.fillStyle = C('cloud', ink); ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, 64 + 16 * Math.sin((x + t * 9) / 95) + 9 * Math.sin((x - t * 5) / 37) + 6 * Math.sin((x + t * 3) / 17));
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, 98 + 18 * Math.sin((x + t * 6 + 300) / 120) + 8 * Math.sin((x - t * 4) / 44));
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawShore(ink, rain) {
    // the far bank (Atake): a low line of trees, misty in the rain
    ctx.fillStyle = C('shore', ink);
    ctx.beginPath(); ctx.moveTo(0, 224);
    for (let x = 0; x <= W + 12; x += 12) ctx.lineTo(x, 186 + 9 * Math.sin(x * 0.045) + 6 * Math.sin(x * 0.13 + 1) + 4 * Math.sin(x * 0.31));
    ctx.lineTo(W, 224); ctx.closePath(); ctx.fill();
    const mist = ctx.createLinearGradient(0, 170, 0, 226);
    mist.addColorStop(0, 'rgba(200,204,198,0)'); mist.addColorStop(1, `rgba(200,204,198,${0.25 + rain * 0.35})`);
    ctx.fillStyle = mist; ctx.fillRect(0, 170, W, 56);
  }
  function drawRiver(ink, t) {
    const g = ctx.createLinearGradient(0, 222, 0, VH);
    g.addColorStop(0, C('river', ink)); g.addColorStop(0.35, C('river', ink)); g.addColorStop(1, C('riverDeep', ink));
    ctx.fillStyle = g; ctx.fillRect(0, 222, W, VH - 222);
    // faint current lines drifting downstream
    ctx.strokeStyle = INK; ctx.globalAlpha = 0.08; ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const y = 240 + ((i * 47) % 340), len = 40 + ((i * 29) % 70), x = (((i * 211 - t * (6 + y * 0.02)) % (W + 200)) + W + 200) % (W + 200) - 100;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawRaft(t) {
    // a long raft of logs, one man poling it slowly along
    const x = ((t * 10 + W * 0.12) % (W + 500)) - 250, y = 262 + Math.sin(t * 0.7) * 1.2;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#3a332c'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, -6); ctx.lineTo(92, -2); ctx.lineTo(-88, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-60, -22); ctx.lineTo(-48, 14); ctx.stroke();    // the pole
    ctx.fillStyle = '#4a4038'; ctx.fillRect(-66, -18, 6, 14);
    ctx.fillStyle = STRAW; ctx.beginPath(); ctx.moveTo(-70, -18); ctx.quadraticCurveTo(-63, -26, -56, -18); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- the bridge ----------
  function drawLegs(ink) {
    const n = 14, gap = W / (n - 1);
    ctx.strokeStyle = C('legs', ink); ctx.lineCap = 'butt';
    const tops = [];
    for (let i = 0; i < n; i++) { const x = i * gap + gap * 0.3; tops.push([x, yF(x) + 14]); }
    // cross-bracing between neighbouring legs
    ctx.lineWidth = 2.2;
    for (let i = 0; i < n - 1; i++) {
      const [x1, y1] = tops[i], [x2, y2] = tops[i + 1], mid1 = y1 + (VH - y1) * 0.45, mid2 = y2 + (VH - y2) * 0.45;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - 3, mid2); ctx.moveTo(x2, y2); ctx.lineTo(x1 - 3, mid1); ctx.moveTo(x1 - 2, mid1); ctx.lineTo(x2 - 2, mid2); ctx.stroke();
    }
    for (const [x, y] of tops) { ctx.lineWidth = 7 * scAt(x); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, VH + 10); ctx.stroke(); }
  }
  function drawDeck(ink, sim) {
    // the side beam under the near edge
    ctx.fillStyle = C('wood', ink);
    ctx.beginPath(); ctx.moveTo(-10, yF(-10));
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, yF(x));
    for (let x = W + 10; x >= -10; x -= 10) ctx.lineTo(x, yF(x) + 15 * scAt(x));
    ctx.closePath(); ctx.fill();
    // the deck: pale wet planks
    ctx.fillStyle = C('deck', ink);
    ctx.beginPath(); ctx.moveTo(-10, yF(-10));
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, yF(x));
    for (let x = W + 10; x >= -10; x -= 10) ctx.lineTo(x, yB(x));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = 0.1;
    for (let x = 4; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, yF(x)); ctx.lineTo(x + 2, yB(x)); ctx.stroke(); }
    ctx.globalAlpha = 0.85; ctx.lineWidth = 1.6;
    ctx.beginPath(); for (let x = -10; x <= W + 10; x += 10) (x === -10 ? ctx.moveTo(x, yF(x)) : ctx.lineTo(x, yF(x))); ctx.stroke();
    ctx.globalAlpha = 1;
    // puddles: grey sky reflected, with rain rings
    for (const q of sim.puddles) {
      if (q.size < 0.08) continue;
      const [cx, cy] = deckPoint(q.s, q.d, W), sc = figScale(q.s, q.d), rx = q.r * q.size * sc, ry = rx * 0.32;
      ctx.fillStyle = '#8d9898'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.stroke();
      for (let k = 0; k < 2; k++) {
        const ph = (sim.t * 0.8 + q.seed + k * 0.5) % 1, ox = Math.sin(q.seed * 7 + k * 3 + Math.floor(sim.t * 0.8 + q.seed + k * 0.5) * 2.1) * rx * 0.5;
        ctx.globalAlpha = 0.4 * (1 - ph); ctx.strokeStyle = '#eef0ea'; ctx.beginPath(); ctx.ellipse(cx + ox, cy, 2 + ph * rx * 0.35, (2 + ph * rx * 0.35) * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawFarRail(ink) {
    ctx.strokeStyle = C('wood', ink); ctx.lineWidth = 2;
    const top = (x) => yB(x) - 40 * scAt(x), mid = (x) => yB(x) - 19 * scAt(x);
    ctx.beginPath(); for (let x = -10; x <= W + 10; x += 10) (x === -10 ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x))); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = -10; x <= W + 10; x += 10) (x === -10 ? ctx.moveTo(x, mid(x)) : ctx.lineTo(x, mid(x))); ctx.stroke();
    ctx.lineWidth = 2.4; for (let x = 6; x < W; x += W / 30) { ctx.beginPath(); ctx.moveTo(x, yB(x) + 2); ctx.lineTo(x, top(x)); ctx.stroke(); }
  }
  function drawNearRail(ink) {
    ctx.strokeStyle = C('wood', ink); ctx.globalAlpha = 0.9;
    const top = (x) => yF(x) - 24 * scAt(x);
    ctx.lineWidth = 2.6; ctx.beginPath(); for (let x = -10; x <= W + 10; x += 10) (x === -10 ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x))); ctx.stroke();
    ctx.lineWidth = 3; for (let x = 20; x < W; x += W / 22) { ctx.beginPath(); ctx.moveTo(x, yF(x) + 1); ctx.lineTo(x, top(x)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // ---------- people ----------
  function drawFigure(x, y, sc, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * FIG, sc * FIG);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const f = o.facing;
    // a dark reflection on the wet planks
    ctx.fillStyle = 'rgba(30,30,35,0.18)'; ctx.beginPath(); ctx.ellipse(0, 1, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    const bodies = o.kind === 'pair' ? [-7, 7] : [0];
    for (const bx of bodies) {
      const stride = Math.sin((o.step + bx * 0.05) * Math.PI * 2) * 5;
      ctx.save(); ctx.translate(bx, 0);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2 + stride, 0); ctx.moveTo(2, -10); ctx.lineTo(2 - stride, 0); ctx.stroke();
      // hunched into the rain, leaning the way they walk (more when bowing)
      ctx.translate(0, -9); ctx.rotate(f * (0.2 + o.bow * 0.6));
      ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(-6.5, 1); ctx.lineTo(6.5, 1); ctx.lineTo(5, -23); ctx.lineTo(-5, -23); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      if (o.sash) { ctx.strokeStyle = o.sash; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5.5, -10); ctx.lineTo(5.5, -10); ctx.stroke(); }
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(f * 1.5, -27, 3.8, 0, Math.PI * 2); ctx.fill();
      if (o.kind === 'hat') { ctx.fillStyle = STRAW; ctx.beginPath(); ctx.moveTo(-15, -25); ctx.quadraticCurveTo(0, -42, 15, -25); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke(); }
      ctx.restore();
    }
    if (o.kind === 'umbrella') {
      ctx.save(); ctx.translate(0, -9); ctx.rotate(f * 0.25);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f * 3, -14); ctx.lineTo(f * 3, -40); ctx.stroke();
      ctx.fillStyle = o.canopy; ctx.beginPath(); ctx.ellipse(f * 3, -38, 19, 9, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha *= 0.6; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(f * 3, -47); ctx.lineTo(f * 3 + k * 8.5, -38); ctx.stroke(); }
      ctx.restore();
    }
    if (o.kind === 'pair') {
      // two people sharing one straw rain-mat thrown over their heads
      ctx.save(); ctx.translate(0, -9); ctx.rotate(f * 0.2);
      ctx.fillStyle = '#c9a94e'; ctx.beginPath(); ctx.moveTo(-21, -10); ctx.quadraticCurveTo(-18, -40, 2, -42); ctx.quadraticCurveTo(20, -40, 22, -12); ctx.lineTo(14, -16); ctx.lineTo(-12, -14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.globalAlpha *= 0.35; for (let k = -16; k <= 16; k += 4) { ctx.beginPath(); ctx.moveTo(k * 0.6, -40); ctx.lineTo(k, -14); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawPeople(sim) {
    const list = [];
    for (const w of sim.walkers) {
      const [x, y] = deckPoint(w.s, w.d, W);
      if (x < -60 || x > W + 60) continue;
      list.push({ x, y, sc: figScale(w.s, w.d), o: { kind: w.kind, facing: -1, step: w.stopT > 0 ? 0 : w.step, bow: w.stopT > 0 ? Math.sin((w.stopT / 1.4) * Math.PI) : 0,
        robe: ROBES[w.id % ROBES.length], canopy: UMBRELLAS[w.id % UMBRELLAS.length] } });
    }
    if (sim.state !== 'title') {
      const p = sim.player, [x, y] = deckPoint(p.s, p.d, W);
      list.push({ x, y, sc: figScale(p.s, p.d) * 1.08, o: { kind: 'hat', facing: 1, step: p.stopT > 0 ? 0 : p.step, bow: p.bow, robe: YOU, sash: '#e8d9b0',
        alpha: sim.state === 'crossed' ? clamp(1 - sim.crossedT / 1.2, 0, 1) : p.enterT } });   // you fade away at the far bank
    }
    list.sort((a, b) => a.y - b.y);
    for (const f of list) drawFigure(f.x, f.y, f.sc, f.o);
  }

  // ---------- rain ----------
  function drawRain(sim, near) {
    const t = sim.t, n = Math.round(RAIN_N * (near ? sim.rain : 0.6 * sim.rain)), span = VH + 240;
    ctx.strokeStyle = near ? '#1d2026' : '#3a4044'; ctx.lineWidth = near ? 1 : 0.8; ctx.globalAlpha = near ? 0.38 : 0.2;
    ctx.beginPath();
    for (let i = near ? 0 : 1; i < n; i += near ? 1 : 2) {
      const r = RAIN[i], lean = LEAN[r.set];
      const y = ((r.v * span + t * r.speed * (near ? 1 : 0.7)) % span) - 120;
      const x = r.u * (W + 300) - 150 + lean * y;
      ctx.moveTo(x, y); ctx.lineTo(x - lean * r.len, y - r.len);
    }
    ctx.stroke();
    if (near) {
      // gusts: a denser sheet sweeping across
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (const g of sim.gusts) for (let i = 0; i < 90; i++) {
        const r = RAIN[(i * 3) % RAIN_N], y = ((r.v * span + t * r.speed * 1.15) % span) - 120;
        const x = g.x + (r.u - 0.5) * g.width + LEAN[0] * y;
        ctx.moveTo(x, y); ctx.lineTo(x - LEAN[0] * r.len, y - r.len);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- screens ----------
  function drawPause(sim, uiState) {
    const s = sim.settings;
    const rows = BRIDGE_PAUSE_ROWS.map((id) => ({
      resume: [id, '', 'RESUME'], album: [id, '', 'BACK TO THE ALBUM'], crowd: [id, 'CROWD', CROWD_OPTS[s.crowd || 0]], finger: [id, 'FINGER SPEED', FINGER_OPTS[s.finger ?? 1]], steer: [id, 'STEERING', BRIDGE_STEER_OPTS[s.steer]], sens: [id, 'TILT AMOUNT', ui.sensLabel(s.sens)],
      sound: [id, 'SOUND', s.sound ? 'ON' : 'OFF'], recentre: [id, '', 'SET TILT STRAIGHT AHEAD'], restart: [id, '', sim.restartArmed ? 'TAP AGAIN TO START THE PRINT OVER' : 'START THE PRINT OVER'],
    })[id]);
    const tilt = uiState && uiState.tilt;
    const footer = !sim.tiltSteer ? ['SLIDE YOUR FINGER UP AND DOWN TO STEP ASIDE', MUTED]
      : tilt && tilt.ok ? ['TILT LIVE: ROCK THE PHONE TO STEP ASIDE', '#2a6a3a'] : ['NO TILT SENSOR - YOUR FINGER STILL WORKS', SEAL];
    ui.pauseMenu(rows, { W, sel: sim.pauseRow, armed: sim.restartArmed, build: BUILD, footer });
  }
  function drawCrossed(sim) {
    const a = clamp(sim.crossedT / 0.7, 0, 1);
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#efe4c6'; ctx.fillRect(0, 0, W, VH);
    ctx.globalAlpha = a;
    ui.text('THE FAR BANK', W / 2, 205, 44, INK, 'center', 'bold');
    ui.text(sim.stats.crossings === 1 ? 'YOU HAVE CROSSED THE BRIDGE' : 'CROSSING ' + sim.stats.crossings + ' COMPLETE', W / 2, 258, 20, MUTED, 'center');
    ui.choices(CROSS_CHOICES, { W, sel: sim.crossChoice, ready: sim.crossedT >= CHOICE_WAIT, alpha: a });
  }
  function drawComplete(sim) {
    ctx.globalAlpha = clamp(sim.completeT / 2, 0, 1);
    ui.text('SUDDEN SHOWER', W / 2, 185, 44, INK, 'center', 'bold');
    ui.text('COMPLETE', W / 2, 235, 24, INK, 'center');
    ui.seal(W - 90, VH - 90, 1.6);
    ctx.globalAlpha = 1;
    if (sim.completeT >= DONE_WAIT) ui.choices(DONE_CHOICES, { W, sel: sim.crossChoice, ready: true, alpha: clamp((sim.completeT - DONE_WAIT) / 0.6, 0, 1) });
  }

  // ---------- one frame ----------
  function draw(sim, uiState = {}, now = 0) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const t = sim.t;
    const target = sim.state === 'title' || sim.state === 'complete' ? 100 : sim.inkShown;
    artInk += (target - artInk) * Math.min(1, dt * (sim.state === 'play' ? 6 : 1.4));
    const ink = START_INK + artInk * (1 - START_INK / 100);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky(ink, t);
    drawShore(ink, sim.rain);
    drawRiver(ink, t);
    drawRaft(t);
    drawRain(sim, false);
    drawLegs(ink);
    drawDeck(ink, sim);
    drawFarRail(ink);
    drawPeople(sim);
    drawNearRail(ink);

    // splashes from your feet
    // (the page takes the game's events for the sound before this runs, so splashes are spotted by the count going up)
    if (sim.stats.splashes > seenSplashes && sim.state !== 'title') {
      const [x, y] = deckPoint(sim.player.s, sim.player.d, W);
      for (let i = 0; i < 14; i++) drops.push({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 60, life: 1 });
    }
    seenSplashes = sim.stats.splashes;
    ctx.fillStyle = '#e9ede6';
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt * 1.8;
      if (p.life <= 0) { drops.splice(i, 1); continue; }
      ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawRain(sim, true);
    ctx.fillStyle = '#5d6466'; ctx.globalAlpha = 0.04 + 0.07 * sim.rain; ctx.fillRect(0, 0, W, VH); ctx.globalAlpha = 1;   // the shower greys everything a little
    ui.paperGrain(W);
    if (uiState.bare) return;
    if (sim.state !== 'title') { ui.inkBar(sim.inkShown / 100); ui.message(sim.message, W); if (sim.state === 'complete') drawComplete(sim); if (sim.state === 'crossed') drawCrossed(sim); }
    if (sim.paused) drawPause(sim, uiState);
  }

  return { draw, resize };
}
