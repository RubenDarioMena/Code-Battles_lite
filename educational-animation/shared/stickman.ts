// Stickman vectorial provisional. Sustituye a la secuencia PNG de StykAnimate
// mientras no exista; ambos motores dibujan el mismo esqueleto.
// Coordenadas: origen entre los pies, y hacia abajo (como canvas y SVG).

export interface Vec {
  x: number;
  y: number;
}

export interface Pose {
  /** 1 = mira a la derecha, -1 = a la izquierda. */
  facing: 1 | -1;
  /** 0 de pie · 1 agachado tocando el suelo. */
  crouch: number;
  /** 0 de pie · 1 tumbado. */
  collapse: number;
  /** Inclinación extra (radianes) para tambalearse. */
  wobble: number;
  /** 0..1 encogerse de hombros. */
  shrug: number;
  /** 0..1 sostener la caja frente al pecho. */
  lift: number;
  /** 0 mira al frente · 1 gira la cabeza hacia atrás. */
  look: number;
  /** -1..1 respiración sutil. */
  breathe: number;
}

export const restPose: Pose = {facing: 1, crouch: 0, collapse: 0, wobble: 0, shrug: 0, lift: 0, look: 0, breathe: 0};

export interface Skeleton {
  /** Polilíneas: piernas, torso y brazos. */
  limbs: Vec[][];
  head: Vec;
  headRadius: number;
  eye: Vec;
  /** Punto medio entre las manos (para colocar objetos sostenidos). */
  hands: Vec;
}

const L = {thigh: 78, shin: 78, torso: 112, neck: 12, head: 25, upper: 58, fore: 54};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)});
const add = (a: Vec, b: Vec): Vec => ({x: a.x + b.x, y: a.y + b.y});
const scale = (a: Vec, s: number): Vec => ({x: a.x * s, y: a.y * s});

/** IK de dos huesos: devuelve la articulación intermedia. bend elige el lado del codo/rodilla. */
function ik(a: Vec, target: Vec, l1: number, l2: number, bend: number): [Vec, Vec] {
  const dx = target.x - a.x;
  const dy = target.y - a.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const ang = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const mid = {x: a.x + Math.cos(ang + bend * A) * l1, y: a.y + Math.sin(ang + bend * A) * l1};
  const end = {x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d};
  return [mid, end];
}

function rotate(p: Vec, pivot: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = p.x - pivot.x;
  const y = p.y - pivot.y;
  return {x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c};
}

export function solveStickman(pose: Pose): Skeleton {
  const d = pose.facing;
  const c = clamp01(pose.crouch);
  const s = clamp01(pose.shrug);
  const l = clamp01(pose.lift);

  const hip: Vec = {x: -d * c * 16, y: -(L.thigh + L.shin - 4) + c * 82 + pose.breathe * 2};
  const backFoot: Vec = {x: -d * 18, y: 0};
  const frontFoot: Vec = {x: d * 22, y: 0};
  const [backKnee, backEnd] = ik(hip, backFoot, L.thigh, L.shin, -d);
  const [frontKnee, frontEnd] = ik(hip, frontFoot, L.thigh, L.shin, -d);

  const lean = d * (c * 0.85 - s * 0.05);
  const up: Vec = {x: Math.sin(lean), y: -Math.cos(lean)};
  const neck = add(hip, scale(up, L.torso));
  const shoulder = add(add(hip, scale(up, L.torso - 8)), {x: 0, y: -s * 12});
  const head = add(neck, scale(up, L.neck + L.head));

  const hand = (side: -1 | 1): Vec => {
    let h: Vec = {x: shoulder.x + side * 10 + d * 4, y: shoulder.y + 104};
    h = lerpV(h, {x: d * (58 + side * 6), y: -14}, c);
    h = lerpV(h, {x: shoulder.x + side * 80, y: shoulder.y + 34}, s);
    h = lerpV(h, {x: shoulder.x + d * 44 + side * 24, y: shoulder.y + 12}, l);
    return h;
  };
  const arms = ([-1, 1] as const).map((side) => {
    const bend = s > 0.01 ? -side * d * 1 : d;
    const [elbow, end] = ik(shoulder, hand(side), L.upper, L.fore, bend);
    return [shoulder, elbow, end];
  });

  const eyeDir = d * (1 - 2 * clamp01(pose.look));
  const eye: Vec = {x: head.x + eyeDir * 10, y: head.y - 4};

  const pivot: Vec = {x: -d * 18, y: 0};
  const angle = pose.wobble - d * pose.collapse * 1.48;
  const r = (p: Vec) => rotate(p, pivot, angle);
  const limbs = [
    [backEnd, backKnee, hip],
    [frontEnd, frontKnee, hip],
    [hip, neck],
    ...arms,
  ].map((line) => line.map(r));

  return {
    limbs,
    head: r(head),
    headRadius: L.head,
    eye: r(eye),
    hands: r(lerpV(arms[0][2], arms[1][2], 0.5)),
  };
}
