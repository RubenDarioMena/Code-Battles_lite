// Genera el spec de build_animation para el piloto await (30 fps, 1920x1080).
import fs from 'node:fs';
const FPS = 30, END = 690, G = 940;
const BUSY_X = 400, ASYNC_X = 1220, PAD = 130;
const f0 = 1000 / 650, f1 = 1000 / 28;
const busyStart = 3, staggerStart = 10.93;
const T = staggerStart - busyStart;
const phase = (t) => { const u = Math.min(Math.max(t - busyStart, 0), T); return f0 * u + ((f1 - f0) * u * u) / (2 * T); };
const r1 = (v) => Math.round(v * 10) / 10;

// estado por fotograma: {frame: {fig: changes}, ease?, overshoot...}
const keys = new Map();
const key = (f, figs = {}, extra = {}) => {
  const k = keys.get(f) ?? {figures: {}};
  for (const [id, ch] of Object.entries(figs)) k.figures[id] = {...k.figures[id], ...ch};
  Object.assign(k, extra);
  keys.set(f, k);
};
const breath = (f) => r1(1.8 * Math.sin((f / FPS) * 1.6));

// --- intro (0-90)
key(0, {
  ground: {x: 960, y: 942}, padL: {x: BUSY_X + PAD, y: 944}, padR: {x: ASYNC_X + PAD, y: 944},
  busy: {x: BUSY_X, ground: G, pose: 'stand', scale: 1.3, face: 'side'},
  async: {x: ASYNC_X, ground: G, pose: 'stand', scale: 1.3, face: 'side'},
});
for (let f = 0; f < 90; f += 15) key(f, {busy: {lean: r1(1.5 * Math.sin(f / FPS * 2.2))}});
// anticipación: se inclina y mira la plataforma
key(80, {busy: {pose: 'look_down', lean: 4}});

// --- bucle de polling (90-328): medios ciclos
// A 30 fps no caben 35 comprobaciones/s: la frecuencia visible sube de forma
// lineal de ~1,4 a 7,5 comprobaciones/s (medio ciclo de 11 a 2 fotogramas).
const busyKeys = [];
let down = true;
for (let f = 90; f <= 324; ) {
  busyKeys.push([f, down]);
  const u = (f - 90) / (328 - 90);
  f += Math.max(2, Math.round(11 / (1 + 4.5 * u)));
  down = !down;
}
for (const [f, d] of busyKeys) {
  const u = (f - 90) / (328 - 90);
  // cuanto más rápido, más se inclina y menos se endereza
  key(f, {busy: d ? {pose: 'pick_up', lean: r1(6 * u)} : {pose: u > 0.6 ? 'reach' : 'look_down', lean: r1(2 + 10 * u)}});
}

// --- tambaleo (328-376)
key(330, {busy: {pose: 'sad', lean: 0, overshoot: 0.2}});
// tambaleo: se balancea y da pasitos para no caerse, cada vez más amplio
const wob = [[338, -8, 392, 'walk_pass_a'], [346, 9, 408, 'walk_contact_b'], [353, -12, 390, 'walk_pass_b'], [360, 11, 410, 'walk_contact_a'], [366, -15, 388, 'sad'], [371, 6, 396, 'sad']];
for (const [f, l, x, pose] of wob) key(f, {busy: {lean: l, x, ground: G, pose}});
// desplome (física: 11 fotogramas de caída, ease-in)
key(376, {busy: {pose: 'fall_back', lean: -6, x: 400}}, {ease: 'ease-out'});
key(381, {busy: {pose: 'fall_back', lean: -14}}, {ease: 'ease-in'});
key(392, {busy: {pose: 'lie', lean: 0, overshoot: 0.15}});

// --- encogimiento de hombros del de await
key(422, {async: {face: 'side'}});
key(430, {async: {face: 'front'}});
key(434, {async: {flip: true, face: 'side'}});
key(438, {async: {pose: 'shrug', overshoot: 0.2}});
key(462, {async: {pose: 'stand'}});
key(470, {async: {face: 'front'}});
key(475, {async: {flip: false, face: 'side'}});

// --- cajas (física: bounce, restitución 0.15)
key(479, {boxL: {x: BUSY_X + PAD, y: -60}, boxR: {x: ASYNC_X + PAD, y: -60}});
key(510, {boxL: {y: 905, arc: 0}, boxR: {y: 905, arc: 0}});
key(519, {boxL: {y: 905, arc: 21.7}, boxR: {y: 905, arc: 21.7}});
// el de await la recoge
key(520, {async: {pose: 'stand'}}, {ease: 'ease-in-out'});
key(531, {async: {pose: 'pick_up'}, boxR: {y: 905}});
key(534, {async: {pose: 'pick_up', lean: 3}, boxR: {y: 905}});
key(546, {async: {pose: 'hold_out', lean: -3, overshoot: 0.1}, boxR: {attach: {to: 'async', at: 'rightHand'}}});

// respiración del de await en todos los keyframes donde no actúa
const acting = (f) => (f >= 422 && f <= 475) || (f >= 520 && f <= 546);
for (let f = 0; f < END; f += 12) if (!(f > 470 && f < 520) && !(f > 370 && f < 395) && !(f > 519 && f < 547) && !keys.has(f)) key(f, {});
// rellena huecos largos tras el desplome con respiraciones del caído (inmóvil)
const frames = [...keys.keys()].sort((a, b) => a - b).filter((f) => !(f > 479 && f < 519 && f !== 510));
const kf = frames.map((f, i) => {
  const k = keys.get(f);
  if (!acting(f)) k.figures.async = {...k.figures.async, lean: breath(f)};
  const next = frames[i + 1] ?? END;
  return {hold: next - f, ...k};
});
const spec = {
  title: 'await vs polling ocupado', background: '#0B0F13', width: 1920, height: 1080, fps: FPS,
  cast: [
    {id: 'ground', kind: 'rect', width: 1920, height: 4, color: '#26313A'},
    {id: 'padL', kind: 'rect', width: 110, height: 10, color: '#B4935A'},
    {id: 'padR', kind: 'rect', width: 110, height: 10, color: '#B4935A'},
    {id: 'busy', kind: 'stickman', color: '#DCE3E6', headColor: '#DCE3E6', eyes: true, eyeColor: '#0B0F13'},
    {id: 'async', kind: 'stickman', color: '#DCE3E6', headColor: '#DCE3E6', eyes: true, eyeColor: '#0B0F13'},
    {id: 'boxL', kind: 'rect', width: 70, height: 70, color: '#E2894F'},
    {id: 'boxR', kind: 'rect', width: 70, height: 70, color: '#E2894F'},
  ],
  keyframes: kf,
};
fs.writeFileSync(process.argv[2], JSON.stringify(spec));
console.error(kf.length, 'keyframes', kf.reduce((s, k) => s + k.hold, 0), 'frames', busyKeys.length, 'half-cycles');
