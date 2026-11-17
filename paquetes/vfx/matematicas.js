/** Hash local, independiente del orden de evaluación y del RNG de la partida. */
export function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function azar(semilla, canal) {
  let h = (semilla + Math.imul(canal + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const sortear = (v, a) => Array.isArray(v) ? v[0] + (v[1] - v[0]) * a : (v ?? 0);
export const avance = (k, t) => k === 0 ? t : -Math.expm1(-k * t) / k;
export function claves(lista, u) {
  const f = Math.min(1, Math.max(0, u)) * (lista.length - 1), i = Math.floor(f);
  return lista[i] + ((lista[i + 1] ?? lista[i]) - lista[i]) * (f - i);
}
export function rgb(valor) {
  if (Array.isArray(valor) && valor.length === 3 && valor.every(x => Number.isFinite(x) && x >= 0 && x <= 1)) return valor;
  if (typeof valor !== 'string' || !/^#[\da-f]{3}([\da-f]{3})?$/i.test(valor)) throw new Error(`Color sin resolver: ${String(valor)}`);
  const hex = valor.length === 4 ? valor.slice(1).split('').map(c => c + c).join('') : valor.slice(1);
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}
function raiz(f, a, b) {
  const signo = Math.sign(f(a));
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2;
    if (Math.sign(f(m)) === signo) a = m; else b = m;
  }
  return (a + b) / 2;
}
/** Primer contacto, incluso si la trayectoria vuelve a subir. Se divide en
 * tramos monótonos por las raíces de z' (z'' tiene como máximo una raíz). */
export function contacto(z0, vz, k, deriva, g, vida) {
  const z = t => z0 + vz * avance(k, t) + deriva * t + .5 * g * t * t;
  const dz = t => vz * Math.exp(-k * t) + deriva + g * t;
  if (z0 < 0 || (z0 === 0 && (dz(0) < 0 || (dz(0) === 0 && g - k * vz <= 0)))) return 0;
  const extremos = [0, vida];
  const ratio = g / (k * vz);
  if (k > 0 && ratio > 0) {
    const t = -Math.log(ratio) / k;
    if (t > 0 && t < vida) extremos.push(t);
  }
  extremos.sort((a, b) => a - b);
  const cortes = [0, vida];
  for (let i = 1; i < extremos.length; i++) {
    const a = extremos[i - 1], b = extremos[i];
    if (dz(a) * dz(b) < 0) cortes.push(raiz(dz, a, b));
    if (dz(b) === 0) cortes.push(b);
  }
  cortes.sort((a, b) => a - b);
  for (let i = 1; i < cortes.length; i++) {
    const a = cortes[i - 1], b = cortes[i];
    if (z(b) <= 0 && b > 0) return z(a) === 0 ? a : raiz(z, a, b);
  }
  return Infinity;
}
