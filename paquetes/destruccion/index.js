import { ARMAS, FISICA, RESTOS } from './tablas.js';
import { definirRobot, malla, contacto, expandir } from './celdas.js';
import { suma, rotar, producto, vector, norma, unidad } from './geometria.js';
import { buscar, disparo, pasoAcido } from './danio.js';
import { emitir, pasoVuelo, reposar } from './vuelo.js';
import { actualizarMascara, instantanea, resto, botin } from './estado.js';
export { definirRobot };
export { ARMAS, MATERIALES, FISICA, RESTOS, RENDIMIENTO } from './tablas.js';
export { etiqueta } from './estado.js';

function nuevo(semilla) {
  if (!Number.isSafeInteger(semilla)) throw TypeError('Semilla entera requerida');
  return { semilla, paso: 0, fraccion: 0, disparos: 0, fragmentos: 0, terminada: false, modo: 'hundiendose', robots: [], piezas: [], eventos: [] };
}
function rayo(origen, direccion) {
  if (!vector(origen, 3) || !vector(direccion, 3) || !norma(direccion)) throw TypeError('Rayo inválido');
  return unidad(direccion);
}
function agregar(w, def, pos, rumbo) {
  if (!vector(pos, 3) || !Number.isFinite(rumbo)) throw TypeError('Pose inválida');
  def = definirRobot(def);
  let id = def.id, n = 1;
  while (w.robots.some(r => r.id === id)) id = def.id + '#' + (++n);
  const rot = [0, 0, Math.sin(rumbo / 2), Math.cos(rumbo / 2)];
  const offset = w.piezas.length;
  for (const d of def.piezas) {
    const g = malla(d), indice = def.piezas.findIndex(q => q.id === d.padre), padre = def.piezas[indice];
    const p = {
      uid: w.piezas.length, robot: id, id: d.id, d, g, pos: suma(pos, rotar(rot, d.pos)), rot: producto(rot, d.rot),
      padre: padre ? offset + indice : null, contacto: padre ? contacto(d, padre) : [], contactoPadre: padre ? contacto(padre, d) : [],
      fragmento: 0, mask: g.base.slice(), version: 0, estado: 'intacta', funcion: d.funcion, salida: 'en-pie',
      mov: null, reposo: null, volumenes: [], acidos: [], laser: 0
    };
    actualizarMascara(p); w.piezas.push(p);
  }
  w.robots.push({ id, def, caido: false });
  return id;
}
function tick(w) {
  w.paso++;
  pasoAcido(w);
  pasoVuelo(w, p => reposar(w, p));
  for (const p of w.piezas) if (p.reposo && p.salida !== 'oculto') {
    const edad = w.paso * FISICA.dt - p.reposo.instante;
    if (edad + 1e-10 >= RESTOS.visible + RESTOS.salida) {
      p.salida = 'oculto'; emitir(w, p, 'resto-oculto');
    } else if (edad + 1e-10 >= RESTOS.visible) p.salida = 'saliendo';
  }
}
function guardar(w) {
  const piezas = w.piezas.map(({ d, g, mask, rle, vivas, fundidas, centro, extremos, ...p }) => ({ ...p, mascara: rle }));
  return JSON.stringify({ formato: 'cbl-destruccion', v: 1, ...w, piezas });
}
function restaurar(texto) {
  const { formato, v, ...w } = JSON.parse(texto);
  if (formato !== 'cbl-destruccion' || v !== 1) throw Error('Formato de destrucción incompatible');
  for (const r of w.robots) r.def = definirRobot(r.def);
  w.piezas = w.piezas.map(({ mascara, ...p }) => {
    p.d = w.robots.find(r => r.id === p.robot).def.piezas.find(d => d.id === p.id);
    p.g = malla(p.d); p.mask = expandir(mascara, p.g.base.length);
    actualizarMascara(p);
    return p;
  });
  return w;
}

export function crearMundo({ semilla }) {
  let w = nuevo(semilla);
  function abierto() { if (w.terminada) throw Error('Batalla terminada'); }
  return {
    agregarRobot(def, { pos = [0, 0, 0], rumbo = 0 } = {}) { abierto(); return agregar(w, def, pos, rumbo); },
    raycast({ origen, direccion }) { return buscar(w, origen, rayo(origen, direccion)); },
    disparar({ arma, origen, direccion, potencia = 1 }) {
      abierto();
      if (!Object.hasOwn(ARMAS, arma) || !Number.isFinite(potencia) || potencia <= 0) throw TypeError('Arma o potencia inválida');
      return disparo(w, { arma, origen: [...origen], direccion: rayo(origen, direccion), potencia });
    },
    avanzar(segundos) {
      if (!Number.isFinite(segundos) || segundos < 0) throw TypeError('Tiempo inválido');
      if (w.terminada) return;
      // Resto entero para que el guardado sea idéntico también al repartir un
      // intervalo entre fotogramas. Una unidad de resto equivale a 4,63 ps.
      const pasos = segundos / FISICA.dt, enteros = Math.floor(pasos);
      const escala = FISICA.fraccionesPorPaso;
      const resto = w.fraccion + Math.round((pasos - enteros) * escala);
      const n = enteros + Math.floor(resto / escala);
      w.fraccion = resto % escala;
      for (let i = 0; i < n; i++) tick(w);
    },
    desaparicion(modo) {
      abierto();
      if (!['hundiendose', 'desvaneciendose'].includes(modo)) throw TypeError('Salida inválida');
      w.modo = modo;
    },
    estado: () => instantanea(w), sucesos: () => structuredClone(w.eventos),
    terminarBatalla() {
      if (w.terminada) return;
      // Completar el vuelo y la corrosión pendientes antes de fijar la pose de recolección.
      // Con tope: un minuto simulado. Si algo no llega a reposar (no debería), se fija donde está.
      for (let n = 0; n < 3600 && w.piezas.some(p => p.vivas && (p.salida === 'vuelo' || p.acidos.length)); n++) tick(w);
      for (const p of w.piezas) if (p.vivas && p.salida === 'vuelo') {
        p.mov = null; p.acidos = []; p.salida = 'reposo'; p.reposo = resto(w, p);
        emitir(w, p, 'reposo', { pos: [...p.pos], rot: [...p.rot], forzado: true });
      }
      for (const p of w.piezas) if (p.reposo) p.salida = 'expuesto';
      w.terminada = true;
    },
    botin: () => botin(w), serializar: () => guardar(w), cargar(texto) { w = restaurar(texto); },
  };
}
export function cargar(texto) {
  const m = crearMundo({ semilla: 0 }); m.cargar(texto); return m;
}
