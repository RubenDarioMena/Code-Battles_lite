export const suma = (a, b) => a.map((v, i) => v + b[i]);
export const resta = (a, b) => a.map((v, i) => v - b[i]);
export const escalar = (v, k) => v.map(x => x * k);
export const punto = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norma = v => Math.hypot(...v);
/** @param {number[]} a @param {number[]} b */
export const cruz = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
export const unidad = v => escalar(v, 1 / norma(v));
export const conj = ([x, y, z, w]) => [-x, -y, -z, w];
/** @param {number[]} a @param {number[]} b */
export function producto([x, y, z, w], [a, b, c, d]) {
  return [w * a + x * d + y * c - z * b, w * b + y * d + z * a - x * c, w * c + z * d + x * b - y * a, w * d - x * a - y * b - z * c];
}
export function rotar(q, v) {
  const u = cruz(q, v);
  return suma(v, escalar(suma(escalar(u, q[3]), cruz(q, u)), 2));
}
export const local = (p, v) => rotar(conj(p.rot), resta(v, p.pos));
export const global = (p, v) => suma(p.pos, rotar(p.rot, v));
export const eje = f => ['x', 'y', 'z'].indexOf(f.eje);
export function medidas(f) {
  if (f.tipo === 'caja') return f.medidas;
  return [0, 1, 2].map(i => i === eje(f) ? f.alto : 2 * f.radio);
}
export function sdfSolido(f, v) {
  if (f.tipo === 'esfera') return norma(v) - f.radio;
  if (f.tipo === 'caja') {
    const q = v.map((x, i) => Math.abs(x) - f.medidas[i] / 2);
    return norma(q.map(x => Math.max(x, 0))) + Math.min(Math.max(...q), 0);
  }
  const k = eje(f), radial = Math.hypot(...v.filter((_, i) => i !== k));
  const d = [radial - f.radio, Math.abs(v[k]) - f.alto / 2];
  return Math.min(Math.max(d[0], d[1]), 0) + Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0));
}
export function cavidad(f) {
  if (!f.hueco) return null;
  const pared = 2 * f.hueco;
  return f.tipo === 'caja' ? { tipo: 'caja', medidas: f.medidas.map(x => x - pared) }
    : { tipo: 'cilindro', eje: f.eje, radio: f.radio - f.hueco, alto: f.alto - pared };
}
export function dentro(f, v) {
  if (f.tipo === 'caja') return v.every((x, i) => Math.abs(x) <= f.medidas[i] / 2 + 1e-10);
  const k = eje(f);
  return (k < 0 || Math.abs(v[k]) <= f.alto / 2 + 1e-10)
    && v.reduce((s, x, i) => s + (i === k ? 0 : x * x), 0) <= f.radio ** 2 + 1e-10;
}
// FNV-1a para las identidades, avalancha entera por índice de muestra.
export function hash(...claves) {
  let h = 2166136261;
  for (const c of JSON.stringify(claves)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function muestra(h, i) {
  let n = h ^ Math.imul(i + 1, 0x9e3779b1);
  n = Math.imul(n ^ n >>> 16, 0x85ebca6b);
  n = Math.imul(n ^ n >>> 13, 0xc2b2ae35);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
export function vector(v, n) {
  return Array.isArray(v) && v.length === n && Array.from(v).every(Number.isFinite);
}
// Ruido de valor 3D suave en [0, 1): trilineal con curva cúbica sobre una red de `paso` metros.
// Celdas vecinas reciben valores parecidos, así un borde irregular sale orgánico y no moteado.
export function ruidoSuave(h, v, paso) {
  const q = v.map(x => x / paso), i = q.map(Math.floor), f = q.map((x, k) => x - i[k]);
  const s = f.map(t => t * t * (3 - 2 * t));
  const nudo = (a, b, c) => muestra(h, Math.imul(i[0] + a, 73856093) ^ Math.imul(i[1] + b, 19349663) ^ Math.imul(i[2] + c, 83492791));
  const mezcla = (a, b, t) => a + (b - a) * t;
  const plano = c => mezcla(mezcla(nudo(0, 0, c), nudo(1, 0, c), s[0]), mezcla(nudo(0, 1, c), nudo(1, 1, c), s[0]), s[1]);
  return mezcla(plano(0), plano(1), s[2]);
}
