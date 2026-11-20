// Contacto barato de un grupo que vuela contra las piezas quietas (fijas en un robot o restos en reposo).
// No hay choques entre dos grupos que vuelan a la vez. Determinista: mismo orden, mismas cuentas.
import { FISICA } from './tablas.js';
import { suma, resta, escalar, punto, norma, unidad, rotar, local, global, eje, medidas } from './geometria.js';

const lado = FISICA.celda;
const muestras = new WeakMap();

// Puntos de prueba en el marco local de la pieza: esquinas, centros de arista y de cara de su caja
// envolvente, recortados a la forma. Una pieza cortada añade los extremos de sus columnas vivas.
function puntosForma(d) {
  if (muestras.has(d)) return muestras.get(d);
  const f = d.forma, m = medidas(f).map(x => x / 2), k = eje(f), puntos = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
    if (!a && !b && !c) continue;
    let v = [a * m[0], b * m[1], c * m[2]];
    if (f.tipo === 'esfera') v = escalar(unidad([a, b, c]), f.radio);
    else if (f.tipo === 'cilindro') {
      // Las esquinas de la caja caen fuera del cilindro: se llevan al borde de su sección.
      const radial = v.map((x, i) => i === k ? 0 : x), r = norma(radial);
      if (r > f.radio) v = suma(escalar(radial, f.radio / r), v.map((x, i) => i === k ? x : 0));
    }
    puntos.push(v);
  }
  muestras.set(d, puntos);
  return puntos;
}

function celda(p, v) {
  const { min, dim } = p.g;
  const c = v.map((x, i) => Math.floor((x - min[i]) / lado));
  if (c.some((x, i) => x < 0 || x >= dim[i])) return -1;
  return c[0] + dim[0] * (c[1] + dim[1] * c[2]);
}

// Una muestra cuenta si su celda (o la más cercana dentro de la rejilla) sigue viva.
function puntosVivos(p) {
  const pasa = v => {
    const i = celda(p, v.map((x, k) => Math.min(Math.max(x, p.g.min[k] + lado / 2), -p.g.min[k] - lado / 2)));
    return i >= 0 && p.mask[i];
  };
  // `rle` se rehace en cada cambio de máscara: sirve de llave de la caché.
  const guardado = vivos.get(p);
  if (guardado && guardado.llave === p.rle) return guardado.puntos;
  const base = puntosForma(p.d).filter(pasa);
  // De los extremos de columna de una pieza cortada basta una muestra repartida (tope de 64).
  const paso = Math.max(1, Math.ceil(p.extremos.length / 64));
  const puntos = p.vivas < p.g.total ? base.concat(p.extremos.filter((_, i) => i % paso === 0)) : base;
  vivos.set(p, { llave: p.rle, puntos });
  return puntos;
}
const vivos = new WeakMap();

// Distancia con signo a la forma, en el marco local de la pieza.
function sdf(f, v) {
  if (f.tipo === 'esfera') return norma(v) - f.radio;
  if (f.tipo === 'caja') {
    const q = v.map((x, i) => Math.abs(x) - f.medidas[i] / 2);
    return norma(q.map(x => Math.max(x, 0))) + Math.min(Math.max(...q), 0);
  }
  const k = eje(f), radial = Math.hypot(...v.filter((_, i) => i !== k));
  const d = [radial - f.radio, Math.abs(v[k]) - f.alto / 2];
  return Math.min(Math.max(d[0], d[1]), 0) + Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0));
}
// Gradiente del SDF en el marco local. En un eje de simetría (el centro de una caja, por ejemplo) el
// gradiente se anula: entonces no hay normal y quien llama empuja hacia arriba, contra la gravedad.
export function normal(f, v) {
  const e = 1e-4;
  const g = [0, 1, 2].map(i => {
    const a = [...v], b = [...v];
    a[i] += e; b[i] -= e;
    return sdf(f, a) - sdf(f, b);
  });
  return norma(g) > 1e-9 ? unidad(g) : null;
}

const radios = new WeakMap();
function radio(d) {
  if (!radios.has(d)) radios.set(d, norma(medidas(d.forma)) / 2);
  return radios.get(d);
}

function raizDe(w, p) {
  while (p.padre !== null) p = w.piezas[p.padre];
  return p;
}
// Obstáculo: fija en un robot, resto en reposo, o grupo en vuelo que ya apoya y está casi quieto.
export function quieta(w, p) {
  if (!p.vivas) return false;
  if (p.salida === 'en-pie') return true;
  if (['reposo', 'expuesto'].includes(p.salida)) return true;
  return p.salida === 'vuelo' && !!raizDe(w, p).mov?.apoyado;
}

// La penetración más honda del grupo contra cualquier pieza quieta: { hondo, n } en mundo, o null.
export function penetracion(w, grupo) {
  const propios = new Set(grupo);
  // Los obstáculos se eligen una vez por llamada; cada uno con el radio de su esfera envolvente.
  const obstaculos = w.piezas.filter(o => !propios.has(o) && quieta(w, o)).map(o => [o, radio(o.d)]);
  let peor = null;
  if (!obstaculos.length) return peor;
  for (const q of grupo) {
    const cerca = obstaculos.filter(([o, r]) => norma(resta(o.pos, q.pos)) <= r + radio(q.d));
    if (!cerca.length) continue;
    // Los puntos se llevan al mundo solo si hay algo cerca.
    const puntos = puntosVivos(q).map(v => global(q, v));
    for (const [o, r] of cerca) {
      for (const s of puntos) {
        // Un punto fuera de la esfera envolvente no puede estar dentro: se descarta sin cambiar de marco.
        const dx = s[0] - o.pos[0], dy = s[1] - o.pos[1], dz = s[2] - o.pos[2];
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        const v = local(o, s), d = sdf(o.d.forma, v);
        if (d >= 0 || !o.mask[celda(o, v)]) continue;
        if (peor && -d <= peor.hondo) continue;
        const n = normal(o.d.forma, v);
        peor = { hondo: -d, n: n ? rotar(o.rot, n) : [0, 0, 1] };
      }
    }
  }
  return peor;
}

// Saca el grupo de las piezas quietas y rebota su velocidad contra la normal. Devuelve si hubo contacto.
export function resolverContacto(w, grupo, mov) {
  let toca = false;
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const c = penetracion(w, grupo);
    if (!c) break;
    toca = true;
    for (const q of grupo) q.pos = suma(q.pos, escalar(c.n, c.hondo + 1e-5));
    const vn = punto(mov.v, c.n);
    if (vn < 0) {
      const tangente = resta(mov.v, escalar(c.n, vn));
      mov.v = suma(escalar(tangente, FISICA.friccion), escalar(c.n, -vn * FISICA.restitucion));
      mov.w = escalar(mov.w, FISICA.amortiguacion);
    }
  }
  return toca;
}
