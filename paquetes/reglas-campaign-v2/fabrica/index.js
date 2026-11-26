/* Fábrica de Campaign-V2: el motor compartido (paquetes/fabrica, ticket 04.3) con el catálogo de la misión 1.
 * Dos usos del mismo mundo de fábrica:
 *   - en un hito de fábrica (hN) la aplicación lo juega como una sesión de la serie Campaign (`moduloFabrica`);
 *   - durante una Batalla sigue trabajando sin programas ni cambio de hito y abastece la bodega (`crearPlanta`). */
import { crearMotor, crearReglamentoFabrica, validar, modoEnSnap } from '../../fabrica/index.js';
import * as catalogo from './catalogo.js';

export const motor = crearMotor(catalogo);
export { catalogo };

/** Luz de una máquina según su estado, con el lenguaje del consolidado (9.2): verde trabaja, ámbar espera y el rojo
 * queda para el daño o el ataque. `aviso`: la espera necesita a otro (salida llena, sin energía) y enciende el piloto.
 * @param {string} estado lo que da `estadoMaquina` */
export function luzEstado(estado) {
  const luz = { working: 'green', moving: 'green', changeover: 'amber', blocked: 'amber', no_power: 'amber' }[estado] ?? 'off';
  return { luz, aviso: estado === 'blocked' || estado === 'no_power' };
}

/** ¿Es un hito de fábrica? Las claves hN son de fábrica; bN, de Batalla. */
export const esFabrica = clave => typeof clave === 'string' && /^h\d+$/.test(clave);

/** Hitos de fábrica del nivel, en orden: la posición de cada clave es su índice en el mundo de fábrica. */
export const hitosFabrica = nivel => nivel.hitos.filter(esFabrica);

/** El nivel en el formato del motor: la planta del nivel V2 y sus hitos de fábrica en orden.
 * @param {any} contenido módulo del nivel (nivel.js con sus reexportaciones) */
export function nivelFabrica(contenido) {
  const nivel = contenido.default, planta = contenido.fabrica;
  const hitos = hitosFabrica(nivel).map(h => {
    const { clave, fabrica: _, ...datos } = contenido[h];
    return { ...datos, clave: clave.toUpperCase(), v2: clave };
  });
  return {
    serie: 'campaign', clave: nivel.clave, revision: nivel.revision, titulo: 'Primera fábrica',
    mapa: planta.mapa, unidades: planta.unidades, hitos, inicial: planta.inicial, vivos: planta.vivos,
    presupuesto: planta.presupuesto, premioHito: planta.premioHito, energia: planta.energia, bodegaInicial: planta.bodegaInicial,
    // Campos que la aplicación común espera de cualquier reto.
    robots: planta.unidades.filter(u => Object.hasOwn(planta.inicial, u.id)).map(u => ({ id: u.id })),
    lanzadores: [], sensores: [], oleadas: [], metas: {}, pista: '', objetivo: '', leccion: '',
  };
}

/** La planta durante las Batallas: el mismo mundo, sin programas y sin cumplir hitos. */
export function crearPlanta(def) {
  const conexiones = new WeakMap();
  const conexion = m => {
    if (!conexiones.has(m)) conexiones.set(m, motor.conectar(m));
    return conexiones.get(m);
  };
  return {
    crear(guardado) {
      const m = motor.crear(def, guardado);
      m.activo = true;
      return m;
    },
    paso(m, dt) { conexion(m).paso(dt, { sinHitos: true }); },
    serializar: motor.serializar, metas: motor.metas,
  };
}

/** Lo que la aplicación espera del paquete de una campaña de fábrica (la misma forma que reglas-campaign).
 * @param {any} contenido módulo del nivel */
export function moduloFabrica(contenido) {
  const def = nivelFabrica(contenido);
  const { reglamento, quieto, probarColocar } = crearReglamentoFabrica(motor, { id: 'campaign', catalogo });
  return {
    ...catalogo, default: reglamento, VERSION: motor.VERSION,
    crear: motor.crear, serializar: motor.serializar, indexar: motor.indexar, instantaneaHistorica: motor.instantanea,
    instantanea: motor.instantanea, validar, modoEnSnap, metas: motor.metas, cuantos: motor.cuantos, enLotes: motor.enLotes,
    estadoMaquina: motor.estadoMaquina, totalEntrada: motor.totalEntrada, esMaquina: motor.esMaquina, esRobot: motor.esRobot,
    nivel: { RETOS: [def], NIVEL: def, MAPA: def.mapa },
    restaurar: (guardado, reto = def) => motor.crear(reto, guardado),
    quieto, probarColocar, luzEstado,
  };
}
