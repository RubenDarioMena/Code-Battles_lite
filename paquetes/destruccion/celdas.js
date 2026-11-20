import { FISICA, congelar } from './tablas.js';
import { dentro, medidas, vector, norma, local, resta, conj, rotar, global, cavidad, sdfSolido, producto, punto, cruz } from './geometria.js';
const lado = FISICA.celda;
const modelos = new WeakMap();
function exigir(ok, campo) { if (!ok) throw new TypeError('Robot inválido · ' + campo); }
const positivo = n => Number.isFinite(n) && n > 0;
const nombre = s => typeof s === 'string' && s.trim().length > 0;
function validarForma(f, zona = false) {
  exigir(f && (f.tipo === 'caja' && vector(f.medidas, 3) && f.medidas.every(positivo)
    || f.tipo === 'esfera' && positivo(f.radio)
    || !zona && f.tipo === 'cilindro' && positivo(f.radio) && positivo(f.alto) && ['x', 'y', 'z'].includes(f.eje)), 'forma');
  if (f.hueco !== undefined) exigir(!zona && ['caja', 'cilindro'].includes(f.tipo) &&
    Number.isFinite(f.hueco) && f.hueco >= lado && medidas(f).every(x => x > 2 * f.hueco), 'hueco: grosor o cavidad inválidos');
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
  for (const p of d.piezas) {
    const padre = ids.get(p.padre);
    if (padre && esInterior(padre, p)) validarInterior(padre, p);
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
  const interior = cavidad(p.forma);
  let total = 0, vacias = 0;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = centros.length;
    const v = [x, y, z].map((a, k) => min[k] + (a + .5) * lado);
    centros.push(v);
    if (!dentro(p.forma, v)) continue;
    if (interior && sdfSolido(interior, v) < -1e-10) { vacias++; continue; }
    base[i] = 1; total++;
    if (p.funcion && dentro(p.zonaFuncion, resta(v, p.zonaFuncion.pos))) modulo.push(i);
  }
  exigir(!interior || vacias && total, 'hueco sin celdas de cavidad o pared');
  const g = { dim, min, centros, base, total, modulo, baseRle: Object.freeze(compactar(base)) };
  modelos.set(p, g);
  return g;
}

const ejes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function esInterior(p, h) {
  return h.padre === p.id && p.forma.hueco && dentro(p.forma, local(p, h.pos));
}
// SAT entre el cubo de la hija y los vóxeles de pared de su caja envolvente.
// La tangencia (montaje al ras) no es penetración.
function validarInterior(p, h) {
  const g = malla(p), hija = malla(h), rot = producto(conj(p.rot), h.rot);
  const e = ejes.map(a => rotar(rot, a));
  const planos = [...ejes, ...e, ...ejes.flatMap(a => e.map(b => cruz(a, b)))].filter(a => norma(a) > 1e-9);
  const radios = planos.map(a => lado / 2 * [...ejes, ...e].reduce((s, b) => s + Math.abs(punto(a, b)), 0));
  const alcance = ejes.map(a => lado / 2 * e.reduce((s, b) => s + Math.abs(punto(a, b)), 0));
  hija.centros.forEach((v, i) => {
    if (!hija.base[i]) return;
    const c = local(p, global(h, v));
    exigir(dentro(p.forma, c), h.id + ' fuera de la cavidad de ' + p.id);
    const desde = c.map((x, k) => Math.max(0, Math.floor((x - alcance[k] - g.min[k]) / lado)));
    const hasta = c.map((x, k) => Math.min(g.dim[k] - 1, Math.floor((x + alcance[k] - g.min[k]) / lado)));
    for (let z = desde[2]; z <= hasta[2]; z++) for (let y = desde[1]; y <= hasta[1]; y++)
      for (let x = desde[0]; x <= hasta[0]; x++) {
        const j = x + g.dim[0] * (y + g.dim[1] * z);
        if (!g.base[j]) continue;
        const delta = resta(c, g.centros[j]);
        exigir(planos.some((a, k) => Math.abs(punto(delta, a)) >= radios[k] - 1e-10),
          h.id + ' se solapa con la pared de ' + p.id);
      }
  });
}

// Para un interior, cada columna proyecta su apoyo por gravedad. Conserva también
// la celda más baja de la hija que proyecta a cada celda de suelo.
const apoyosInteriores = new WeakMap();
function parchesInterior(p, h) {
  if (apoyosInteriores.has(h)) return apoyosInteriores.get(h);
  const g = malla(p), pared = { ...p, g, mask: g.base }, suelo = new Map(), hija = malla(h);
  hija.centros.forEach((v, i) => {
    if (!hija.base[i]) return;
    const impacto = entradaRayo(pared, global(h, v), [0, 0, -1]);
    if (impacto && (!suelo.has(impacto.indice) || impacto.t < suelo.get(impacto.indice).t))
      suelo.set(impacto.indice, { t: impacto.t, i });
  });
  exigir(suelo.size, h.id + ' sin suelo en ' + p.id);
  const parches = { padre: [...suelo.keys()], hija: [...suelo.values()].map(v => v.i) };
  apoyosInteriores.set(h, parches);
  return parches;
}

// Las monturas exteriores conservan el parche alrededor del centro vivo más próximo.
export function contacto(p, vecina) {
  if (esInterior(p, vecina)) return parchesInterior(p, vecina).padre;
  if (esInterior(vecina, p)) return parchesInterior(vecina, p).hija;
  const g = malla(p), destino = local(p, vecina.pos);
  let mejor = Infinity, centro;
  g.centros.forEach((v, i) => {
    if (!g.base[i]) return;
    const d = norma(resta(v, destino));
    if (d < mejor) { mejor = d; centro = v; }
  });
  return g.centros.flatMap((v, i) => g.base[i] && norma(resta(v, centro)) <= FISICA.radioUnion ? [i] : []);
}

// Índices dentro de la caja de una cápsula, recortada a la rejilla de la pieza.
export function* cajaVolumen(g, v, radio) {
  const lo = v.a.map((a, k) => Math.max(0, Math.floor((Math.min(a, v.b[k]) - radio - g.min[k]) / lado)));
  const hi = v.a.map((a, k) => Math.min(g.dim[k] - 1, Math.floor((Math.max(a, v.b[k]) + radio - g.min[k]) / lado)));
  for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++)
    for (let x = lo[0]; x <= hi[0]; x++) yield x + g.dim[0] * (y + g.dim[1] * z);
}

export function vecinosDe6(n, nx, ny, plano = nx * ny) {
  const x = n % nx, y = Math.floor(n / nx) % ny;
  return [x > 0 ? n - 1 : -1, x + 1 < nx ? n + 1 : -1, y > 0 ? n - nx : -1,
    y + 1 < ny ? n + nx : -1, n - plano, n + plano];
}

export function componentes(p) {
  const [nx, ny] = p.g.dim, plano = nx * ny;
  const visto = new Uint8Array(p.mask.length), grupos = [];
  for (let i = 0; i < visto.length; i++) {
    if (!p.mask[i] || visto[i]) continue;
    const cola = [i]; visto[i] = 1;
    for (let j = 0; j < cola.length; j++) {
      const vecinos = vecinosDe6(cola[j], nx, ny, plano);
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
export function entradaRayo(p, origen, direccion, limite = Infinity) {
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
  if (t >= fin || t > limite) return null;
  const cel = d.map((v, k) => Math.min(dim[k] - 1, Math.max(0, Math.floor((o[k] + (t + 1e-9) * v - min[k]) / lado))));
  const signo = d.map(Math.sign);
  const sig = d.map((v, k) => Math.abs(v) < 1e-12 ? Infinity : (min[k] + (cel[k] + Number(v > 0)) * lado - o[k]) / v);
  while (t <= limite && t < fin && cel.every((v, k) => v >= 0 && v < dim[k])) {
    const indice = cel[0] + dim[0] * (cel[1] + dim[1] * cel[2]);
    if (p.mask[indice]) return { t, indice };
    t = Math.min(...sig);
    for (let k = 0; k < 3; k++) if (sig[k] <= t + 1e-10) {
      cel[k] += signo[k]; sig[k] += lado / Math.abs(d[k]);
    }
  }
  return null;
}
