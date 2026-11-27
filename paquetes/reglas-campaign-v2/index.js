import { adjuntarSucesos, crearRng, copiaPlana, pasoDe } from '../nucleo/index.js';
import { crearPlanta, esFabrica, nivelFabrica } from './fabrica/index.js';
import { escenaEnMetros } from './marco.js';
import { crearCampo, entidadesCampo, instantaneaCampo, ordenarCampo, paso as avanzar } from './paso.js';
export { fichas, piezasMoviles } from './paso.js';
export { default as salida } from './ensayos/salida.js';
import salidaEnsayo from './ensayos/salida.js';
import ruedaEnsayo from './ensayos/rueda.js';
import minadorEnsayo from './ensayos/minador.js';
/** Ensayos de mecánica sueltos (`?ensayo=clave`), además de las Batallas del nivel. */
export const ensayos = { salida: salidaEnsayo, rueda: ruedaEnsayo, minador: minadorEnsayo };
import * as nivel1 from './niveles/nivel-1/nivel.js';

export { escenaEnMetros, puntoEnMarco, puntoEnMetros } from './marco.js';

export { fichaClic } from './mecanicas/clic/ficha.js';
import { lugarDeObjetivo } from './mecanicas/clic/reglas.js';
export { lugarDeObjetivo, repartirClic } from './mecanicas/clic/reglas.js';
export { validarNivel } from './validar.js';
/** Daño por componentes y recuperación de material (P8, consolidado 13.B). */
export * as danio from './danio/index.js';
export const niveles = { 'nivel-1': nivel1 };
export { esFabrica, hitosFabrica, moduloFabrica, nivelFabrica, motor as motorFabrica, catalogo as catalogoFabrica } from './fabrica/index.js';
const BODEGA_ENSAYO = 16;
const otraSemilla = rng => Math.floor(rng() * 4294967296);

export function crearReglamento(war, contenido, retos) {
  const nivel = contenido.default;
  const planta = crearPlanta(nivelFabrica(contenido));
  const iniciales = Object.fromEntries((retos[nivel.hitos.find(h => retos[h])]?.lanzadores ?? [])
    .map(({ id, x, y }) => [id, { x, y }]));
  const alturas = Object.fromEntries(Object.entries(war.api.tipos).map(([k, v]) => [k, v.z]));
  const tiro = l => ({ cx: l.cx, cy: l.cy, cd: l.cd, vel: war.velMisil, alturas: { ...alturas } });
  const bastiones = nivel.marco.bastiones ?? [];
  const clave = p => `${p.x},${p.y}`;
  function montarBatalla(m, reto, semilla) {
    m.cerrada = null;
    const elegidas = { ...m.torretas, ...m.colocadas };
    // Un lanzador nuevo que cae en un bastión ya ocupado pasa al primer bastión libre.
    const ocupados = new Set();
    const lanzadores = reto.lanzadores.map(l => {
      let p = { x: l.x, y: l.y, ...elegidas[l.id] };
      if (ocupados.has(clave(p))) {
        const libre = bastiones.find(([x, y]) => !ocupados.has(clave({ x, y })));
        if (libre) p = { x: libre[0], y: libre[1] };
      }
      ocupados.add(clave(p));
      return { ...l, ...p };
    });
    m.reto = reto;
    m.campo = crearCampo(reto, nivel.marco);
    m.puntuales = new Map();
    m.eventosPrograma = [];
    m.semillaIntento = semilla;
    m.batalla = war.crearMundo({ reto: { ...reto, lanzadores } }, crearRng(semilla));
    m.colocadas = {};
    m.torretas = posiciones(m);
    for (const { id } of [...lanzadores, ...(reto.unidades ?? [])]) m.programas[id] ??= (reto.inicial[id] ?? []).join('\n');
  }
  function posiciones(m) {
    const torretas = { ...m.torretas };
    for (const l of m.batalla?.lanzadores ?? []) torretas[l.id] = { x: l.cx - .5, y: l.cy - .5 };
    return { ...torretas, ...m.colocadas };
  }
  /** Colocador: la torreta pasa a un bastión libre. Si la Batalla aún no empezó, se vuelve a montar con
   * la misma semilla; si ya corre, la elección vale para la siguiente y entra en el checkpoint. */
  function colocar(m, unidad, indice) {
    const b = bastiones[indice], actuales = posiciones(m);
    const motivo = !b ? 'bastion' : !actuales[unidad] ? 'unidad'
      : Object.entries(actuales).some(([id, p]) => id !== unidad && p.x === b[0] && p.y === b[1]) ? 'ocupado' : null;
    if (motivo) return m.sucesos.anotar({ paso: pasoDe(m.t), tipo: 'colocar-descartada', unidad, datos: { motivo, indice } });
    m.colocadas[unidad] = { x: b[0], y: b[1] };
    if (m.batalla && m.batalla.t === 0) montarBatalla(m, m.reto, m.semillaIntento);
    m.sucesos.anotar({ paso: pasoDe(m.t), tipo: 'colocada', unidad, datos: { indice } });
  }
  /** La Batalla que dibujan las vistas: la que corre o, tras ganarla y antes de recargar en la fábrica, la última. */
  const enPantalla = m => m.batalla ? m : m.cerrada ?? m;
  function escena(m) {
    const { batalla, campo } = enPantalla(m);
    if (batalla) {
      const e = war.escena(batalla);
      if (campo) {
        const extras = entidadesCampo(campo);
        e.puertas = extras.puertas;
        for (const k of ['maquinas', 'enemigos', 'misiles']) e[k].push(...extras[k]);
        for (const u of extras.maquinas) e.porId[u.id] = u;
      }
      return e;
    }
    return copiaPlana({
      t: m.t, activo: true, hito: 0, maquinas: m.fabrica.maquinas, porId: m.fabrica.porId,
      robots: m.fabrica.robots, tarimas: m.fabrica.tarimas, misiles: [], explosiones: [] });
  }
  /** La escena para las vistas de Campaign-V2: en metros, con los bastiones y su ocupación. */
  function escenaMetros(m) {
    const { origen, tam = [32, 18] } = nivel.marco;
    const { batalla, reto } = enPantalla(m);
    if (!batalla) return { ...escenaEnMetros(escena(m), nivel.fabrica?.origen ?? [0, 0]), bastiones: listaBastiones(m) };
    const e = escenaEnMetros(escena(m), origen, [reto?.mapa?.cols ?? tam[0], tam[1]]);
    return m.modo === 'paridad' ? e : { ...e, bastiones: listaBastiones(m) };
  }
  function listaBastiones(m) {
    const [ox, oy] = nivel.marco.origen, actuales = Object.entries(posiciones(m));
    return bastiones.map(([x, y], indice) => ({ indice, cx: x + .5 + ox, cy: y + .5 + oy,
      ocupado: actuales.find(([, p]) => p.x === x && p.y === y)?.[0] ?? null }));
  }
  function serializar(m) {
    return copiaPlana({ clave: nivel.clave, revision: nivel.revision, hito: m.hito,
      fabrica: planta.serializar(m.fabrica), bodega: m.bodega.misiles, torretas: posiciones(m),
      programas: m.programas, vinculos: m.vinculos, fuentes: m.fuentes, semillaFabrica: m.semillaFabrica });
  }
  function crearMundo(e, rng) {
    if (e.modo === 'paridad') {
      const batalla = war.crearMundo({ reto: e.reto }, rng);
      const m = { hito: e.hito, modo: e.modo, batalla, fabrica: null, bodega: null };
      adjuntarSucesos(m, batalla.sucesos);
      return m;
    }
    const cp = e.checkpoint;
    const incompatible = cp && (cp.clave !== nivel.clave || cp.revision !== nivel.revision);
    const base = incompatible ? null : cp;
    const hito = incompatible ? nivel.hitos[0] : base?.hito ?? e.hito;
    const fabrica = planta.crear(base?.fabrica ?? e.fabrica);
    const m = { t: 0, hito, modo: e.modo, fabrica, bodega: fabrica.arsenal, batalla: null,
      semillaFabrica: base?.semillaFabrica ?? e.semillaFabrica ?? otraSemilla(rng), semillaIntento: null,
      torretas: copiaPlana(base?.torretas ?? e.torretas ?? (esFabrica(hito) ? iniciales : {})), colocadas: {}, final: null,
      programas: copiaPlana(e.programas ?? cp?.programas ?? {}), vinculos: copiaPlana(e.vinculos ?? cp?.vinculos ?? {}),
      fuentes: copiaPlana(e.fuentes ?? cp?.fuentes ?? {}), aviso: incompatible ? 'cv2.revision' : null, rng };
    adjuntarSucesos(m);
    // Sin checkpoint, la bodega es la de la planta (sus existencias iniciales); el ensayo trae la suya.
    m.bodega.misiles = base?.bodega ?? e.bodega ?? (e.modo === 'ensayo' && !esFabrica(hito) ? BODEGA_ENSAYO : m.bodega.misiles);
    if (!esFabrica(hito)) montarBatalla(m, retos[hito] ?? e.reto, e.semillaIntento ?? otraSemilla(rng));
    return m;
  }
  function restaurar(cp, semillaIntento, actuales = {}) {
    return crearMundo({ modo: 'campaign', checkpoint: cp, semillaIntento, ...actuales }, crearRng(semillaIntento));
  }
  /** Cierra el hito de fábrica en curso: la planta jugada en su sesión (si se da) sustituye a la del mundo y se pasa
   * al hito siguiente. Si es una Batalla, queda montada; tras el último hito, el nivel termina en victoria.
   * Devuelve false si el mundo no está en un hito de fábrica. */
  function cerrarFabrica(m, plantaJugada = null) {
    if (m.modo === 'paridad' || m.batalla || !esFabrica(m.hito)) return false;
    if (plantaJugada) {
      m.fabrica = planta.crear(planta.serializar(plantaJugada));
      m.bodega = m.fabrica.arsenal;
    }
    const siguiente = nivel.hitos[nivel.hitos.indexOf(m.hito) + 1];
    if (!siguiente) { m.final = { fin: 'victoria', motivo: 'nivel' }; return true; }
    m.hito = siguiente;
    if (!esFabrica(siguiente)) montarBatalla(m, retos[siguiente], otraSemilla(m.rng));
    return true;
  }
  function paso(m, dt) {
    if (m.modo === 'paridad') return war.paso(m.batalla, dt);
    // En un hito de fábrica la planta se juega en su propia sesión (moduloFabrica): aquí no avanza nada.
    if (m.final || !m.batalla) return;
    const b = m.batalla, fin = avanzar(m, dt, planta, war);
    if (!fin) return;
    const siguiente = nivel.hitos[nivel.hitos.indexOf(m.hito) + 1];
    // La pantalla de transición muestra el hito superado: después de montar la siguiente Batalla ya no existe.
    if (fin.fin === 'victoria') m.superado = { hito: m.hito, t: b?.t ?? m.t, derribos: b?.derribos ?? 0, total: b?.total ?? 0,
      brechas: b?.brechas ?? 0, atascos: b?.atascos ?? 0, misiles: b?.consumidos ?? 0 };
    if (fin.fin === 'victoria' && m.modo === 'campaign' && siguiente) {
      m.torretas = posiciones(m);
      m.hito = siguiente;
      // Tras la Batalla viene un hito de fábrica: el checkpoint guarda la planta y la página abre la fábrica.
      // Las vistas siguen dibujando la Batalla terminada, quieta detrás de la tarjeta, hasta que la página recarga en la
      // fábrica: `cerrada` no entra en el checkpoint.
      if (esFabrica(siguiente)) {
        // Las metas «hechos» cuentan lo fabricado en la sesión del hito: lo que la planta montó sola durante la Batalla
        // ya entró en la bodega y se disparó.
        m.fabrica.baseHito = { ...m.fabrica.producidos };
        Object.assign(m, { batalla: null, campo: null, reto: null, cerrada: { batalla: b, campo: m.campo, reto: m.reto } });
      } else montarBatalla(m, retos[siguiente], otraSemilla(m.rng));
    } else {
      m.final = fin;
      if (!b) m.sucesos.anotar({ paso: pasoDe(m.t), tipo: 'fin', datos: fin });
    }
  }
  return {
    id: 'campaign-v2', version: 1, api: war.api, crearMundo, paso, serializar, restaurar, cerrarFabrica,
    eventos(m) { return [...(m.eventosPrograma?.splice(0) ?? []), ...(m.campo?.eventos.splice(0) ?? [])]; },
    aplicarOrden(m, orden) {
      const { verbo, unidad, args } = orden;
      if (verbo === 'colocar') {
        if (m.modo !== 'paridad' && orden.origen === 'jugador') colocar(m, unidad, args?.[0]);
        return;
      }
      if (!m.batalla || ordenarCampo(m.campo, orden, alturas)) return;
      if (verbo === 'clicProgramado' || verbo === 'intentoPuntual') {
        if (m.modo === 'paridad' || orden.origen !== 'jugador' || !m.batalla.lanzadores.some(l => l.id === unidad)) return;
        if (verbo === 'clicProgramado') m.eventosPrograma.push({ evento: args[0], unidad, datos: args[1] });
        else if (m.puntuales.has(unidad)) m.sucesos.anotar({ paso: pasoDe(m.t), tipo: 'puntual-descartada', unidad, datos: { motivo: 'ocupado' } });
        else m.puntuales.set(unidad, lugarDeObjetivo(args[0], tiro(m.batalla.porId[unidad])));
      } else war.aplicarOrden(m.batalla, orden);
    },
    instantanea(m) {
      if (m.batalla) {
        const snap = war.instantanea(m.batalla);
        if (m.modo !== 'paridad') snap.tiro = Object.fromEntries(m.batalla.lanzadores.map(l => [l.id, tiro(l)]));
        instantaneaCampo(m.campo, snap, alturas);
        return snap;
      }
      return { t: m.t, maq: {}, auto: {}, vib: {}, bodega: m.bodega.misiles, metas: planta.metas(m.fabrica) }; },
    escena, escenaMetros,
    evaluar(m) { return m.modo === 'paridad' ? war.evaluar(m.batalla) : m.final; },
  };
}

// La interfaz histórica conserva un mundo vivo en casillas. Esta fachada añade las
// entidades del campo sin introducirlas en las listas que simula War.
export function mundoPantalla(m) {
  if (!m.campo) return m.batalla ?? m.fabrica;
  const b = m.batalla, c = m.campo;
  let entidades, ultimo = -1;
  function extras() {
    if (ultimo !== c.t) { entidades = entidadesCampo(c); ultimo = c.t; }
    return entidades;
  }
  return Object.create(b, {
    maquinas: { get: () => [...b.maquinas, ...extras().maquinas] },
    enemigos: { get: () => [...b.enemigos, ...extras().enemigos] },
    ausentes: { get: () => extras().ausentes },
    programables: { get: () => [...b.programables, ...extras().maquinas] },
    porId: { get: () => Object.fromEntries([...b.maquinas, ...extras().maquinas].map(u => [u.id, u])) },
  });
}
