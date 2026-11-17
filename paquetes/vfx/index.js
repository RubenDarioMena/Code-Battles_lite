import { validarReceta, maximo } from './esquema.js';
import { hash, azar, sortear, avance, claves, rgb, contacto } from './matematicas.js';
export { validarReceta };
export { crearRecetasWar, recetaWar } from './recetas/war.js';
export const PRESUPUESTOS = Object.freeze({ alto: 2000, medio: 1200, bajo: 600, no: 0 });
const niveles = { alto: [1, 1], medio: [.6, .8], bajo: [.3, .6], no: [0, 0] };

function nivel(calidad = 'alto') {
  if (!Object.hasOwn(niveles, calidad)) throw new Error(`Calidad desconocida: ${calidad}`);
  return niveles[calidad];
}
function direccion(c, semilla, i, n, rumbo) {
  const a = azar(semilla, 1) * Math.PI * 2;
  let z = azar(semilla, 2) * 2 - 1;
  if (c.dir === 'arriba') return [0, 0, 1];
  if (c.dir === 'anillo') return [Math.cos(i * Math.PI * 2 / n), Math.sin(i * Math.PI * 2 / n), 0];
  if (c.dir === 'cono') {
    const angulo = rumbo + (azar(semilla, 1) - .5) * .7;
    z = (azar(semilla, 2) - .25) * .5;
    return [Math.cos(angulo) * Math.sqrt(1 - z * z), Math.sin(angulo) * Math.sqrt(1 - z * z), z];
  }
  if (c.dir === 'hemisferio') z = Math.abs(z);
  const r = Math.sqrt(1 - z * z);
  return [Math.cos(a) * r, Math.sin(a) * r, z];
}

/** Evalúa sin memoria; tv y dt en segundos. No retiene ni modifica el suceso.
 * @param {import('../protocolo/index.js').Suceso} suceso
 * @param {import('./index.js').Receta} receta @param {number} tv
 * @param {import('./index.js').OpcionesEvaluar} opciones
 * @param {(p: import('./index.js').Particula) => void} emitir */
export function evaluar(suceso, receta, tv, { dt, colores = {}, calidad = 'alto', sinDestellos = false }, emitir) {
  if (!(dt > 0) || !Number.isFinite(dt) || !Number.isFinite(tv)) throw new Error('dt debe ser positivo y tv finito');
  const [cantidad, escala] = nivel(calidad);
  if (!cantidad) return;
  const datos = suceso.datos || {};
  const origen = Array.isArray(datos.origen) ? datos.origen.map(Number)
    : [Number(datos.x || 0), Number(datos.y || 0), Number(datos.z || 0)];
  const rumbo = typeof datos.rumbo === 'number' ? datos.rumbo
    : Math.atan2(Number(datos.y || 0) - origen[1], Number(datos.x || 0) - origen[0]);
  const base = hash(JSON.stringify([suceso.paso, suceso.tipo, suceso.unidad ?? '']));
  for (const [ic, c] of receta.capas.entries()) {
    if (sinDestellos && c.destello) continue;
    const semillaCapa = hash(`${base}/${ic}`);
    const total = Array.isArray(c.n)
      ? c.n[0] + Math.floor(azar(semillaCapa, 0) * (c.n[1] - c.n[0] + 1)) : c.n;
    const n = total ? Math.max(1, Math.floor(total * cantidad)) : 0;
    for (let i = 0; i < n; i++) {
      const semilla = hash(`${semillaCapa}/${i}`);
      const vida = sortear(c.vida, azar(semilla, 3));
      const retraso = sortear(c.retraso, azar(semilla, 4));
      const tau = tv - suceso.paso * dt - retraso;
      if (tau < 0 || tau >= vida) continue;
      const d = direccion(c, semilla, i, n, rumbo), v = sortear(c.vel, azar(semilla, 5));
      const k = c.arrastre || 0, g = c.grav || 0, deriva = c.deriva || [0, 0, 0];
      const p0 = [origen[0] + Math.cos(rumbo) * (c.adelante || 0),
        origen[1] + Math.sin(rumbo) * (c.adelante || 0), origen[2] + (c.alto || 0)];
      const tocar = c.suelo ? contacto(p0[2], d[2] * v, k, deriva[2], g, vida) : Infinity;
      const coloresCapa = c.color.map(token => rgb(token.startsWith('#') ? token : colores[token]));
      for (let e = 0; e <= (c.estela || 0); e++) {
        const edad = tau - e * .018;
        if (edad < 0) continue;
        const t = Math.min(edad, tocar), u = edad / vida;
        const radio = c.dir === 'anillo' ? (c.radioFinal || 0) : 0;
        const distancia = v * avance(k, t) + radio;
        const color = [0, 1, 2].map(j => claves(coloresCapa.map(x => x[j]), u));
        emitir({ x: p0[0] + d[0] * distancia + deriva[0] * t,
          y: p0[1] + d[1] * distancia + deriva[1] * t,
          z: tocar <= edad ? 0 : p0[2] + d[2] * distancia + deriva[2] * t + .5 * g * t * t,
          tam: claves(c.tam, u) * (c.forma === 'brillo' ? escala : 1) / (1 + e * .3),
          alfa: claves(c.alfa, u) / (1 + e * .6), color: /** @type {[number,number,number]} */ (color),
          forma: c.forma, mezcla: c.mezcla, paso: suceso.paso, capa: ic, indice: i, estela: e });
      }
    }
  }
}

/** Cola visual local: la evaluación es pura; solo anotar/vaciar/podar conservan memoria.
 * @param {import('./index.js').OpcionesEfectos} opciones */
export function crearEfectos({ recetas, recetaDe, dt, presupuesto }) {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('dt debe ser positivo y finito');
  for (const [nombre, r] of Object.entries(recetas)) {
    const errores = validarReceta(r);
    if (errores.length) throw new Error(`${nombre}: ${errores.join('; ')}`);
  }
  const limites = { ...PRESUPUESTOS, ...(typeof presupuesto === 'number'
    ? { alto: presupuesto, medio: presupuesto, bajo: presupuesto } : presupuesto) };
  for (const v of Object.values(limites)) if (!Number.isInteger(v) || v < 0) throw new Error('presupuesto: enteros no negativos requeridos');
  let sucesos = [];
  return {
    anotar(suceso) {
      const nombre = recetaDe(suceso);
      if (nombre == null) return;
      const receta = recetas[nombre];
      if (!receta) throw new Error(`Receta desconocida: ${nombre}`);
      const duracion = Math.max(...receta.capas.map(c => maximo(c.retraso || 0) + maximo(c.vida)));
      // Suceso es dato plano del protocolo; copia para aislar cambios del emisor.
      sucesos.push({ suceso: JSON.parse(JSON.stringify(suceso)), receta, fin: suceso.paso * dt + duracion });
    },
    vaciar() { sucesos = []; },
    particulas(tv, { colores = {}, calidad = 'alto', sinDestellos = false } = {}, emitir) {
      nivel(calidad);
      if (!Number.isFinite(tv)) throw new Error('tv debe ser finito');
      sucesos = sucesos.filter(s => tv < s.fin);
      let vivas = [];
      for (const s of sucesos) evaluar(s.suceso, s.receta, tv, { dt, colores, calidad, sinDestellos }, p => vivas.push(p));
      const limite = calidad === 'no' ? 0 : limites[calidad];
      if (vivas.length > limite) {
        const prioridad = p => p.forma === 'humo' ? 0 : (p.mezcla === 'normal' ? 1 : 2);
        // Desempates estables: orden original de anotación/capa/partícula/estela.
        const descartar = vivas.map((p, i) => ({ p, i })).sort((a, b) =>
          prioridad(a.p) - prioridad(b.p) || a.p.paso - b.p.paso || a.i - b.i);
        const fuera = new Set(descartar.slice(0, vivas.length - limite).map(x => x.i));
        vivas = vivas.filter((_, i) => !fuera.has(i));
      }
      if (emitir) vivas.forEach(emitir);
      return vivas;
    },
  };
}
