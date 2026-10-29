// Lógica de la escena piloto `await` vs polling ocupado, como funciones puras del
// tiempo (segundos). Así cualquier fotograma se puede calcular fuera de orden y el
// render es reproducible en ambos motores.
import pilot from './await-pilot.json';
import {restPose, type Pose, type Vec} from './stickman';

export type Lang = 'es' | 'en';
export type PilotParams = Omit<typeof pilot, 'lang'> & {lang: Lang};
export const defaultPilot = pilot as PilotParams;

export interface Cues {
  busyStart: number;
  staggerStart: number;
  collapseStart: number;
  collapseEnd: number;
  shrugStart: number;
  boxArrives: number;
  liftStart: number;
  outroStart: number;
  end: number;
}

export function cues(p: PilotParams): Cues {
  const t = p.timing;
  const busyStart = t.introSeconds;
  const boxArrives = busyStart + t.waitSeconds;
  const collapseEnd = busyStart + t.waitSeconds * t.collapseAt;
  const collapseStart = collapseEnd - t.collapseSeconds;
  const staggerStart = Math.max(busyStart + 1, collapseStart - t.staggerSeconds);
  return {
    busyStart,
    staggerStart,
    collapseStart,
    collapseEnd,
    shrugStart: collapseEnd + t.shrugDelaySeconds,
    boxArrives,
    liftStart: boxArrives + 0.7,
    outroStart: boxArrives + 1.8,
    end: boxArrives + t.outroSeconds,
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
/** 0→1 entre a y b con suavizado. */
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

/** Intentos acumulados: integral de una frecuencia que acelera linealmente. */
function phase(p: PilotParams, c: Cues, t: number) {
  const f0 = 1000 / p.polling.startIntervalMs;
  const f1 = 1000 / p.polling.endIntervalMs;
  const T = c.staggerStart - c.busyStart;
  const tau = Math.min(Math.max(t - c.busyStart, 0), T);
  return f0 * tau + ((f1 - f0) * tau * tau) / (2 * T);
}

export function attemptsAt(p: PilotParams, c: Cues, t: number) {
  return Math.floor(phase(p, c, t));
}

/** Comprobaciones por segundo (0 cuando deja de comprobar). */
export function frequencyAt(p: PilotParams, c: Cues, t: number) {
  if (t < c.busyStart || t >= c.staggerStart) return 0;
  const f0 = 1000 / p.polling.startIntervalMs;
  const f1 = 1000 / p.polling.endIntervalMs;
  return f0 + ((f1 - f0) * (t - c.busyStart)) / (c.staggerStart - c.busyStart);
}

/** 0 legible · 1 totalmente borroso. */
export function blurAmount(p: PilotParams, c: Cues, t: number) {
  return clamp01((frequencyAt(p, c, t) - 5) / 18);
}

export function busyPose(p: PilotParams, c: Cues, t: number): Pose {
  const cycling = (1 - Math.cos(2 * Math.PI * phase(p, c, t))) / 2;
  const tired = ramp(t, c.staggerStart, c.staggerStart + 0.25);
  const crouch = t < c.busyStart ? 0 : cycling * (1 - tired) + 0.3 * tired;
  const staggerK = t >= c.staggerStart && t < c.collapseEnd ? ramp(t, c.staggerStart, c.collapseStart) : 0;
  const wobble = Math.sin((t - c.staggerStart) * 9) * 0.14 * staggerK;
  return {
    ...restPose,
    facing: 1,
    crouch: crouch * (1 - ramp(t, c.collapseStart, c.collapseEnd)),
    wobble,
    collapse: easeInQuad(clamp01((t - c.collapseStart) / (c.collapseEnd - c.collapseStart))),
    breathe: Math.sin(t * 2.2),
  };
}

const easeInQuad = (x: number) => x * x;

export function asyncPose(p: PilotParams, c: Cues, t: number): Pose {
  const s = c.shrugStart;
  const look = ramp(t, s, s + 0.35) * (1 - ramp(t, s + 1.9, s + 2.3));
  const shrug = ramp(t, s + 0.45, s + 0.8) * (1 - ramp(t, s + 1.3, s + 1.65));
  return {
    ...restPose,
    facing: 1,
    look,
    shrug,
    crouch: 0.55 * ramp(t, c.liftStart - 0.35, c.liftStart) * (1 - ramp(t, c.liftStart, c.liftStart + 0.4)),
    lift: ramp(t, c.liftStart, c.liftStart + 0.4),
    breathe: Math.sin(t * 1.6),
  };
}

/** Altura sobre la plataforma de entrega (0 = apoyada). Cae con un rebote. */
export function boxDrop(c: Cues, t: number) {
  const x = (t - c.boxArrives + 0.45) / 0.45;
  // Antes de caer queda fuera de cuadro.
  if (x <= 0) return 2000;
  if (x < 1) return 420 * (1 - x * x);
  const b = clamp01((t - c.boxArrives) / 0.3);
  return Math.sin(b * Math.PI) * 26 * (1 - b);
}

/** Posición de la caja del personaje que espera con await (relativa a sus pies). */
export function asyncBoxPosition(c: Cues, t: number, padX: number, hands: Vec, boxSize: number): Vec {
  const resting: Vec = {x: padX, y: -boxSize / 2 - boxDrop(c, t)};
  const k = ramp(t, c.liftStart + 0.05, c.liftStart + 0.4);
  return {x: resting.x + (hands.x - resting.x) * k, y: resting.y + (hands.y - resting.y) * k};
}

/** Instantes de muestreo para el motion blur (el primero es el fotograma actual). */
export function blurSamples(p: PilotParams, t: number) {
  const n = Math.max(1, p.motionBlur.samples);
  return Array.from({length: n}, (_, k) => t - (p.motionBlur.shutterSeconds * k) / n);
}
