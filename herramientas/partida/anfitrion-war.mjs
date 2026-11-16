import { jugar, prepararEscenario } from './jugar.mjs';

/** @typedef {string | { lenguaje: 'js' | 'python', codigo: string }} Fuente */
/** @typedef {{ reto: number, semilla: number, programas?: Record<string, Fuente>, maxPasos?: number,
 * alPaso?: (paso: number, instantanea: any) => void }} OpcionesWar */

/** Normaliza solo los argumentos del hook terminar y el estado final, sin tiempo real.
 * Es autocontenida para poder usarla también en el contraste del navegador.
 * @param {any} mundo @param {string} fin @param {string|null} motivo
 * @param {string|null} texto @param {number|null} [linea] @param {string|null} [idProg] */
export function resultadoWar(mundo, fin, motivo, texto, linea, idProg) {
  return { fin, motivo, t: mundo.t, texto: texto ?? null, linea: linea ?? null, idProg: idProg ?? null };
}

/** Ejecuta War sobre las fuentes actuales del juego.
 * @param {OpcionesWar} opciones */
export async function ejecutarWar(opciones) {
  const inicio = performance.now();
  const config = prepararEscenario({ ...opciones, reglas: 'war' });
  const r = await jugar({ ...opciones, ...config });
  const f = r.final;
  return { reglas: 'war', reto: opciones.reto, semilla: opciones.semilla,
    resultado: resultadoWar({ ...r.partida.mundo, ...r.registro }, f.fin, f.motivo, f.mensaje, f.linea, f.unidad),
    metricas: { pasos: r.pasos, t: r.partida.mundo.t, mensajes: r.mensajes, ms: performance.now() - inicio },
    hash: r.huella.hash, instantanea: r.huella.instantanea };
}
