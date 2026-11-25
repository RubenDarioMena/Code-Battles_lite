// Frontera de la batalla. War conserva casillas y el campo de V2 conserva metros.
import { pasoDe } from '../nucleo/index.js';
import { puntoEnMarco, puntoEnMetros } from './marco.js';
import * as movimiento from './mecanicas/movimiento/reglas.js';
import * as vehiculo from './mecanicas/vehiculo/reglas.js';
import * as tirador from './mecanicas/tirador/reglas.js';

/** @type {Array<[{ ficha: import('./index.js').FichaMecanica, crear?: Function, orden?: Function, programa?: { api: Function, ordenar: Function },
 * tiro?: Function, objetivos?: Function, puntual?: Function }, (campo: any, dt: number) => void]>} */
const pasos = [
  [movimiento, (campo, dt) => movimiento.paso(campo, dt)],
  [vehiculo, (campo, dt) => vehiculo.paso(campo, dt)],
  [tirador, (campo, dt) => tirador.paso(campo, dt)],
];
export const fichas = pasos.map(([modulo]) => modulo.ficha);
const porTipo = Object.fromEntries(pasos.map(([modulo]) => [modulo.ficha.id, modulo]));
export const piezasMoviles = { capacidades: Object.fromEntries(
  pasos.filter(([m]) => m.programa).map(([m]) => [m.ficha.id, m.programa])) };

export function crearCampo(reto, marco) {
  if (!reto.unidades?.length && !reto.hostiles?.length) return null;
  const [x0, y0] = marco.origen;
  const [ancho, fondo] = marco.tam ?? [32, 18];
  const convertir = def => ({ ...def, home: puntoEnMetros(def.home, marco.origen) });
  const aliados = (reto.unidades ?? []).map(convertir), hostiles = (reto.hostiles ?? []).map(convertir);
  return { origen: marco.origen, t: 0, limites: { x0, y0, x1: x0 + (reto.mapa?.cols ?? ancho),
    y1: y0 + fondo, muro: x0 + 3, puertas: marco.puertas.map(f => y0 + f + .5) },
    defs: aliados, aliados: Object.fromEntries(aliados.map(d => [d.id, porTipo[d.tipo].crear(d)])),
    hostiles: hostiles.map(d => porTipo[d.tipo].crear(d)), enemigosWar: [], eventos: [], impactos: [],
    proyectiles: [], reponer: {}, secuencia: 0 };
}

export function ordenarCampo(c, orden, alturas) {
  if (!c || !Object.hasOwn(c.aliados, orden.unidad)) return false;
  const u = c.aliados[orden.unidad];
  if (!u) return true;
  const m = porTipo[u.clase], { verbo, args } = orden;
  if (verbo === 'clicProgramado' || verbo === 'intentoPuntual') {
    if (orden.origen !== 'jugador') return true;
    const punto = puntoEnMetros(args.at(-1), c.origen);
    if (verbo === 'clicProgramado') c.eventos.push({ evento: args[0], unidad: u.id, datos: punto });
    else m.puntual?.(c, u, punto, alturas);
  } else if (!u.capacidades.some(id => porTipo[id].orden(c, u, verbo, args?.[0]))) m.orden?.(c, u, verbo, args?.[0]);
  return true;
}

export function instantaneaCampo(c, snap, alturas) {
  if (!c) return;
  snap.moviles = {};
  snap.limites = { ...c.limites, puertas: [...c.limites.puertas] };
  for (const [id, u] of Object.entries(c.aliados)) {
    snap.moviles[id] = u ? { ...u.position, position: { ...u.position }, home: { ...u.home }, moving: u.moving,
      viaje: u.viaje, resultado: u.resultado, hp: u.hp, missiles: u.missiles, capacidades: [...u.capacidades] } : null;
    snap.maq[id] = snap.moviles[id];
    if (!u) continue;
    const modulo = porTipo[u.clase];
    snap.moviles[id].lecturas = [...modulo.ficha.lecturas, ...u.capacidades.flatMap(k => porTipo[k].ficha.lecturas)];
    if (modulo.tiro) snap.tiro[id] = modulo.tiro(u, alturas);
    if (modulo.objetivos) snap.auto[id] = modulo.objetivos(c, u, alturas);
  }
}

// La pantalla común selecciona en casillas. Los muertos solo figuran en el árbol.
export function entidadesCampo(c) {
  const maquinas = [], ausentes = [];
  for (const def of c.defs) {
    const u = c.aliados[def.id];
    if (!u) {
      ausentes.push({ id: def.id, clase: def.tipo, segundos: Math.ceil(c.reponer[def.id] - c.t) });
      continue;
    }
    const { x, y } = puntoEnMarco(u.position, c.origen);
    maquinas.push({ id: u.id, clase: u.clase, modelo: u.modelo, cx: x, cy: y, x, y, hp: u.hp, hpMax: def.vida,
      misiles: u.missiles, programable: true, rol: porTipo[u.clase].ficha.rol });
  }
  const enemigos = c.hostiles.map(({ def, traza, ...e }) => puntoEnMarco(e, c.origen));
  const trazas = c.hostiles.map(e => e.traza).filter(p => p && c.t < p.t0 + p.dur);
  const misiles = [...c.proyectiles, ...trazas].map(p => ({ ...p, movil: true, x0: p.x0 - c.origen[0], x1: p.x1 - c.origen[0],
    y0: p.y0 - c.origen[1], y1: p.y1 - c.origen[1] }));
  const puertas = c.limites.puertas.map(y => puntoEnMarco({ x: c.limites.muro, y }, c.origen));
  return { maquinas, ausentes, enemigos, misiles, puertas };
}

function copiarSucesos(m, parte) {
  for (const s of parte.sucesos.desde(pasoDe(parte.t))) m.sucesos.anotar({ ...s, paso: pasoDe(m.t) });
}

export function paso(m, dt, planta, war) {
  m.t += dt;
  planta.paso(m.fabrica, dt);
  copiarSucesos(m, m.fabrica);
  const b = m.batalla, c = m.campo;
  if (!b) return planta.metas(m.fabrica).every(meta => meta.cumplida) ? { fin: 'victoria', motivo: null, mensaje: null } : null;
  for (const l of b.lanzadores) {
    const ritmo = m.bodega.misiles > 0 ? b.def.suministro : 0;
    war.fijarSuministro(l, ritmo);
    if (ritmo && l.misiles < b.def.cargador && l.carga + ritmo * dt >= 1 - 1e-9) m.bodega.misiles--;
  }
  // El puente consume impactos del paso anterior antes de que War evalúe las metas.
  if (c?.impactos.length) {
    const anterior = b.sucesos.desde(pasoDe(b.t)).length;
    for (const p of c.impactos.splice(0)) {
      const punto = puntoEnMarco({ x: p.x1, y: p.y1 }, c.origen);
      war.danoEnArea(b, punto.x, punto.y, p.radio, p.dano, p.de);
    }
    for (const s of b.sucesos.desde(pasoDe(b.t)).slice(anterior)) m.sucesos.anotar({ ...s, paso: pasoDe(m.t) });
  }
  if (m.puntuales.size) war.pasoConIntentoPuntual(b, dt, m.puntuales, (unidad, motivo) =>
    m.sucesos.anotar({ paso: pasoDe(m.t), tipo: 'puntual-descartada', unidad, datos: { motivo } }));
  else war.paso(b, dt);
  copiarSucesos(m, b);
  if (c) {
    c.t = b.t;
    for (const d of c.defs) if (c.reponer[d.id] <= c.t + 1e-9) {
      c.aliados[d.id] = porTipo[d.tipo].crear(d);
      delete c.reponer[d.id];
    }
    c.enemigosWar = war.leerEnemigos(b).map(e => puntoEnMetros(e, c.origen));
    for (const [, avanzar] of pasos) avanzar(c, dt);
  }
  return war.evaluar(b);
}
