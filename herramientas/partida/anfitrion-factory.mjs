import { jugar, prepararEscenario } from './jugar.mjs';

/** @typedef {{ reto: number, intento?: number, semilla?: number, escenario?: any,
 * programas?: Record<string, import('./anfitrion-war.mjs').Fuente>, maxPasos?: number,
 * pasoAPaso?: boolean, maxLineas?: number, alLinea?: (pausa: { unidad: string, linea: number, t: number }) => void,
 * motor?: 'vm'|'interprete', crearPrograma?: typeof import('./programa.mjs').crearPrograma,
 * alPaso?: (paso: number, instantanea: any) => void }} OpcionesFactory */

/** Resultado común con factory-comun: datos finales sin reloj real ni redondear t.
 * Autocontenida para observar exactamente la misma forma en el navegador.
 * @param {any} mundo @param {number} intento @param {string} fin
 * @param {string|null} motivo @param {string|null} mensaje @param {number|null} [linea] */
export function resultadoFactory(mundo, intento, fin, motivo, mensaje, linea) {
  return {
    fin, motivo: motivo ?? null, mensaje: mensaje ?? null, linea: linea ?? null,
    t: mundo.t, intento, derrames: mundo.derrames, vacios: mundo.vacios, stockOculto: mundo.stockOculto,
    metas: Array.from(mundo.def.metas, meta => {
      const e = mundo.porId[meta.id];
      const valor = meta.tipo === 'vaciar' ? e.stock[meta.mat] || 0 : e.recibido[meta.mat] || 0;
      return { ...meta, valor, cumplida: meta.tipo === 'vaciar' ? valor === 0 && mundo.robot.carga !== meta.mat : valor >= meta.n };
    }),
    robot: { x: mundo.robot.x, y: mundo.robot.y, carga: mundo.robot.carga, viajes: mundo.robot.viajes },
    resultados: structuredClone(mundo.resultados), eventos: structuredClone(mundo.eventos),
  };
}

/** Ejecuta Factory; retos 1–6 oficiales y 7 propio, intento equivale a semilla.
 * @param {OpcionesFactory} opciones */
export async function ejecutarFactory(opciones) {
  const inicio = performance.now();
  const config = prepararEscenario({ ...opciones, reglas: 'factory' });
  const r = await jugar({ ...opciones, ...config });
  const intento = config.semilla, f = r.final;
  return { reglas: 'factory', reto: opciones.reto, semilla: intento, intento,
    resultado: resultadoFactory({ ...r.partida.mundo, ...r.registro }, intento, f.fin, f.motivo, f.mensaje, f.linea),
    metricas: { pasos: r.pasos, t: r.partida.mundo.t, mensajes: r.mensajes, ms: performance.now() - inicio },
    hash: r.huella.hash, instantanea: r.huella.instantanea };
}
