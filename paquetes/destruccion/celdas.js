import { FISICA, congelar } from './tablas.js';
import { dentro, medidas, vector, norma, local, resta, conj, rotar } from './geometria.js';
const lado = FISICA.celda;
const modelos = new WeakMap();
function exigir(ok, campo) { if (!ok) throw new TypeError('Robot inválido · ' + campo); }
const positivo = n => Number.isFinite(n) && n > 0;
const nombre = s => typeof s === 'string' && s.trim().length > 0;
function validarForma(f, zona = false) {
  exigir(f && (f.tipo === 'caja' && vector(f.medidas, 3) && f.medidas.every(positivo)
    || f.tipo === 'esfera' && positivo(f.radio)
    || !zona && f.tipo === 'cilindro' && positivo(f.radio) && positivo(f.alto) && ['x', 'y', 'z'].includes(f.eje)), 'forma');
}

export function definirRobot(valor) {
  const d = structuredClone(valor);
  exigir(nombre(d?.id) && Array.isArray(d.piezas) && d.piezas.length, 'id/piezas');
  const ids = new Map();
  for (const p of d.piezas) {
    exigir(nombre(p?.id) && !ids.has(p.id), 'id de pieza');
    ids.set(p.id, p);
    validarForma(p.forma);
    exigir(vector(p.pos, 3) && vector(p.rot, 4) && Math.abs(norma(p.rot) - 1) < 1e-6, 'pose');
    exigir(positivo(p.aguante) && Number.isFinite(p.union?.resistencia) && p.union.resistencia >= 0, 'aguante/unión');
    exigir(typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color), 'color');
    exigir(Array.isArray(p.materiales) && p.materiales.length && p.materiales.every(m => nombre(m?.material) && positivo(m.cantidad))
      && new Set(p.materiales.map(m => m.material)).size === p.materiales.length, 'materiales');
    exigir(p.funcion === null || nombre(p.funcion), 'función');
    if (p.funcion) {
      validarForma(p.zonaFuncion, true);
      exigir(vector(p.zonaFuncion.pos, 3), 'posición de zonaFuncion');
    }
    const g = malla(p);
    exigir(g.total && (!p.funcion || g.modulo.length), 'forma o zona sin centros de celda');
  }
  exigir(d.piezas.filter(p => p.padre === null).length === 1, 'raíz');
  for (const p of d.piezas) {
    const vistos = new Set();
    let q = p;
    while (q.padre !== null) {
      exigir(!vistos.has(q) && ids.has(q.padre), 'ciclo o padre ausente');
      vistos.add(q);
      q = ids.get(q.padre);
    }
  }
  return congelar(d);
}

export function malla(p) {
  if (modelos.has(p)) return modelos.get(p);
  const dim = medidas(p.forma).map(m => Math.max(1, Math.ceil(m / lado - 1e-9)));
  const [nx, ny, nz] = dim;
  exigir(nx * ny * nz <= 262144, 'más de 262144 celdas por pieza');
  const min = dim.map(n => -n * lado / 2);
  const centros = [], modulo = [], base = new Uint8Array(nx * ny * nz);
  let total = 0;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = centros.length;
    const v = [x, y, z].map((a, k) => min[k] + (a + .5) * lado);
    centros.push(v);
    if (!dentro(p.forma, v)) continue;
    base[i] = 1; total++;
    if (p.funcion && dentro(p.zonaFuncion, resta(v, p.zonaFuncion.pos))) modulo.push(i);
  }
  const g = { dim, min, centros, base, total, modulo };
  modelos.set(p, g);
  return g;
}

// Parche alrededor del centro vivo más próximo al centro de la pieza vecina.
export function contacto(p, vecina) {
  const g = malla(p), destino = local(p, vecina.pos);
  let mejor = Infinity, centro;
  g.centros.forEach((v, i) => {
    if (!g.base[i]) return;
    const d = norma(resta(v, destino));
    if (d < mejor) { mejor = d; centro = v; }
  });
  return g.centros.flatMap((v, i) => g.base[i] && norma(resta(v, centro)) <= FISICA.radioUnion ? [i] : []);
}

export function componentes(p) {
  const [nx, ny] = p.g.dim, plano = nx * ny;
  const visto = new Uint8Array(p.mask.length), grupos = [];
  for (let i = 0; i < visto.length; i++) {
    if (!p.mask[i] || visto[i]) continue;
    const cola = [i]; visto[i] = 1;
    for (let j = 0; j < cola.length; j++) {
      const n = cola[j], x = n % nx, y = Math.floor(n / nx) % ny;
      const vecinos = [x > 0 ? n - 1 : -1, x + 1 < nx ? n + 1 : -1, y > 0 ? n - nx : -1, y + 1 < ny ? n + nx : -1, n - plano, n + plano];
      for (const v of vecinos) if (p.mask[v] && !visto[v]) { visto[v] = 1; cola.push(v); }
    }
    grupos.push(cola);
  }
  return grupos.sort((a, b) => b.length - a.length);
}

export function compactar(mask) {
  const r = [];
  for (const v of mask) {
    if (r.length && r[r.length - 2] === v) r[r.length - 1]++;
    else r.push(v, 1);
  }
  return r;
}
export function expandir(r, n) {
  const mask = new Uint8Array(n);
  let i = 0;
  for (let j = 0; j < r.length; j += 2) {
    const [v, c] = [r[j], r[j + 1]];
    if (![0, 1, 2].includes(v) || !Number.isInteger(c) || c <= 0 || i + c > n) throw Error('RLE inválido');
    mask.fill(v, i, i + c); i += c;
  }
  if (i !== n) throw Error('Longitud RLE inválida');
  return mask;
}

// Intersección con las seis caras de la rejilla y recorrido Amanatides–Woo.
// En una arista se cruzan simultáneamente todos los ejes empatados.
export function entradaRayo(p, origen, direccion) {
  const o = local(p, origen), d = rotar(conj(p.rot), direccion);
  const { min, dim } = p.g;
  let t = 0, fin = Infinity;
  for (let k = 0; k < 3; k++) {
    const max = -min[k];
    if (Math.abs(d[k]) < 1e-12) {
      if (o[k] < min[k] || o[k] >= max) return null;
      continue;
    }
    const a = (min[k] - o[k]) / d[k], b = (max - o[k]) / d[k];
    t = Math.max(t, Math.min(a, b)); fin = Math.min(fin, Math.max(a, b));
  }
  if (t >= fin) return null;
  const cel = d.map((v, k) => Math.min(dim[k] - 1, Math.max(0, Math.floor((o[k] + (t + 1e-9) * v - min[k]) / lado))));
  const signo = d.map(Math.sign);
  const sig = d.map((v, k) => Math.abs(v) < 1e-12 ? Infinity : (min[k] + (cel[k] + Number(v > 0)) * lado - o[k]) / v);
  while (t < fin && cel.every((v, k) => v >= 0 && v < dim[k])) {
    const indice = cel[0] + dim[0] * (cel[1] + dim[1] * cel[2]);
    if (p.mask[indice]) return { t, indice };
    t = Math.min(...sig);
    for (let k = 0; k < 3; k++) if (sig[k] <= t + 1e-10) {
      cel[k] += signo[k]; sig[k] += lado / Math.abs(d[k]);
    }
  }
  return null;
}
