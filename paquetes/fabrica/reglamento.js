/* Reglamento común de una fábrica: el contrato de crearPartida (crearMundo, paso, aplicarOrden, respuestas,
 * instantanea, escena, evaluar) sobre un motor y su catálogo. Campaign y Campaign-V2 lo componen con sus datos. */
import { copiaPlana } from '../nucleo/index.js';

/** @param {ReturnType<import('./motor.js').crearMotor>} motor
 * @param {{ id?: string, catalogo: any, alCrear?: (mundo: any, escenario: any) => void }} opciones */
export function crearReglamentoFabrica(motor, { id = 'campaign', catalogo, alCrear = undefined }) {
  const conexiones = new WeakMap(), pendientes = new WeakMap();
  function conexion(mundo) {
    if (!conexiones.has(mundo)) {
      const respuestas = [];
      pendientes.set(mundo, respuestas);
      conexiones.set(mundo, motor.conectar(mundo, {
        terminarOrden(unidad, ref, resultado) {
          respuestas.push({ unidad, ref: String(ref), resultado,
            instantanea: structuredClone({ t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: motor.instantanea(mundo) }) });
        },
      }));
    }
    return conexiones.get(mundo);
  }
  const reglamento = {
    id, version: motor.VERSION,
    crearMundo(escenario, _rng) {
      const mundo = motor.crear(escenario.reto, escenario.guardado);
      mundo.activo = true;
      alCrear?.(mundo, escenario);
      return mundo;
    },
    paso(mundo, dt) { conexion(mundo).paso(dt); },
    aplicarOrden(mundo, orden) {
      const c = conexion(mundo);
      if (orden.origen === 'sistema' && orden.verbo === 'fin-tramo') {
        c.cancelarTareas(); c.soltarLuces(); return;
      }
      // El colocador es del jugador: los programas no mueven la planta.
      if (orden.verbo === 'colocar') {
        const resultado = orden.origen === 'jugador' ? c.colocar(orden.unidad, orden.args?.[0], orden.args?.[1]) : 'rechazado';
        pendientes.get(mundo).push({ unidad: orden.unidad, ref: orden.ref, resultado, modo: true });
        return;
      }
      if (['pickUp', 'deliver', 'goTo'].includes(orden.verbo))
        c.iniciarOrden(orden.unidad, { id: orden.ref ?? `${orden.origen}:${orden.paso}:${orden.unidad}`, verbo: orden.verbo, args: orden.args });
      else {
        const resultado = c.aplicarModo(orden.unidad, orden.verbo, orden.args);
        pendientes.get(mundo).push({ unidad: orden.unidad, ref: orden.ref, resultado, modo: true });
      }
    },
    respuestas(mundo) { conexion(mundo); return pendientes.get(mundo).splice(0); },
    instantanea(mundo) {
      return { t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: JSON.parse(JSON.stringify(motor.instantanea(mundo))) };
    },
    // Lo que dibujan las vistas: copia en datos planos, independiente del mundo.
    escena(mundo) {
      return copiaPlana({ t: mundo.t, activo: mundo.activo, hito: mundo.hito, maquinas: mundo.maquinas, robots: mundo.robots,
        tarimas: mundo.tarimas, misiles: mundo.misiles, explosiones: mundo.explosiones, bahia: mundo.bahia, porId: mundo.porId });
    },
    // El mundo continúa tras el último hito para ejecutar la salva y el suministro.
    evaluar(mundo) { return mundo.completado ? { fin: 'victoria', hito: mundo.hito, completado: true } : null; },
    api: {
      encargos: ['pickUp', 'deliver', 'goTo'], modos: ['start', 'stop', 'setRecipe', 'light', 'request'],
      lecturas: ['count'], espera: 'wait',
      piezas: structuredClone(catalogo.PIEZAS), recetas: structuredClone(catalogo.RECETAS),
      maquinas: structuredClone(catalogo.MAQUINAS), robots: structuredClone(catalogo.ROBOT), luces: [...catalogo.LUCES],
    },
  };
  /** Fuera del contrato común: permite decidir el final de un tramo sin modificar el mundo. */
  const quieto = mundo => conexion(mundo).quieto();
  /** Para el anfitrión de pruebas y V2: la conexión viva de un mundo (colocar, empezarHito…). */
  const conectado = mundo => conexion(mundo);
  return { reglamento, quieto, conectado };
}
