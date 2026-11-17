import soluciones from '../../pruebas/campaign-soluciones.cjs';
import { crearPartida } from '../../paquetes/nucleo/index.js';
import { cargar } from './cargar.mjs';
import { jugar } from './jugar.mjs';
import reglas, { nivel, quieto } from '../../paquetes/reglas-campaign/index.js';
import { crearHuella } from './huella.mjs';

/** Datos deterministas de terminarCampaign; excluye fecha, presentación y fuentes.
 * Autocontenida para inyectarla también en el navegador. Se llama antes de borrar uso.
 * @param {any} mundo @param {string} fin @param {string} motivo
 * @param {string|null} mensaje @param {number|null} [linea] @param {string|null} [programa] */
export function resultadoCampaign(mundo, fin, motivo, mensaje, linea, programa) {
  return structuredClone({ hito: mundo.hito, completado: mundo.completado, t: mundo.t,
    hitosT: mundo.hitosT, presupuesto: mundo.presupuesto, producidos: mundo.producidos,
    eventos: mundo.eventos, registro: { resultado: fin, motivo, mensaje: mensaje ?? null,
      linea: linea ?? null, programa: programa ?? null, tiempoJuego: Math.round(mundo.t * 100) / 100,
      hito: mundo.def.hitos[mundo.hito].clave, presupuesto: mundo.presupuesto,
      producidos: mundo.producidos, uso: mundo.uso, consolas: mundo.consolas } });
}

/** Lista de referencia H0–H5, con fuentes explícitas por lenguaje.
 * @param {'js'|'python'} [lenguaje] */
export function programasCampaign(lenguaje = 'js') {
  if (!['js', 'python'].includes(lenguaje)) throw new Error('--lenguaje debe ser js|python.');
  return soluciones[lenguaje].map(tramo => Object.fromEntries(Object.entries(tramo)
    .map(([id, codigo]) => [id, { lenguaje, codigo }])));
}

/** Secuencia de tramos sobre la misma partida; el corte precede a sus continuaciones.
 * @param {{lenguaje?: 'js'|'python', programas?: Record<string, import('./anfitrion-war.mjs').Fuente>[],
 * maxPasos?: number, alPaso?: (paso: number, instantanea: any) => void,
 * motor?: 'vm'|'interprete', crearPrograma?: typeof import('./programa.mjs').crearPrograma}} [opciones] */
export async function ejecutarCampaign({ lenguaje = 'js', programas, maxPasos = 30000, alPaso, crearPrograma, motor = 'interprete' } = {}) {
  if (!['js', 'python'].includes(lenguaje)) throw new Error('--lenguaje debe ser js|python.');
  const inicio = performance.now(), fuentes = programas ?? programasCampaign(lenguaje);
  if (!Array.isArray(fuentes) || !fuentes.length || fuentes.some(p => !p || typeof p !== 'object' || Array.isArray(p)))
    throw new Error('--programas de Campaign requiere una lista no vacía de objetos por unidad.');
  const escenario = { reto: nivel.NIVEL }, partida = crearPartida({ reglas, escenario, semilla: 1 });
  const mundo = partida.mundo, sesion = cargar(), total = crearHuella(), tramos = [], mensajes = {};
  const consolas = { log: 0, info: 0, warn: 0, error: 0 };
  let pasos = 0;
  for (const tramoFuentes of fuentes) {
    const programas = Object.fromEntries(Object.entries(tramoFuentes).map(([id, fuente]) =>
      [id, typeof fuente === 'string' ? { lenguaje, codigo: fuente } : fuente]));
    const desde = mundo.hito;
    const r = await jugar({ reglas, partida, escenario, programas, maxPasos, sesion, crearPrograma, motor,
      detener: (p, anfitrion) => p.mundo.hito !== desde || p.mundo.completado ||
        (mundo.programables.every(u => anfitrion.estado(u.id) === 'fin') && quieto(mundo)),
      alPaso: (_n, snap) => { total.paso(snap); alPaso?.(++pasos, snap); } });
    for (const k of Object.keys(consolas)) consolas[k] += r.registro.consolas[k];
    const motivo = mundo.hito !== desde || mundo.completado ? 'detenido' : 'quieto';
    const f = r.final ?? { fin: 'detenido', motivo, mensaje: null };
    // Campaign conserva el motivo de corte incluso cuando evaluar devuelve victoria.
    const final = r.error || r.limite ? f : { fin: 'detenido', motivo, mensaje: null };
    const resultado = resultadoCampaign({ ...mundo, ...r.registro, consolas }, final.fin, final.motivo,
      final.mensaje, final.linea, final.unidad);
    for (const [tipo, n] of Object.entries(r.mensajes)) mensajes[tipo] = (mensajes[tipo] || 0) + n;
    tramos.push({ desde, hito: resultado.hito, completado: resultado.completado,
      pasos: r.pasos, t: mundo.t, hash: r.huella.hash, resultado });
    partida.ordenar({ paso: partida.pasoActual, origen: 'sistema', unidad: 'campaign', verbo: 'fin-tramo', args: [] });
    partida.aplicarOrdenes();
    if (mundo.completado || mundo.hito === desde) break;
  }
  const h = total.terminar();
  return { reglas: 'campaign', resultado: tramos.at(-1).resultado, tramos,
    metricas: { pasos: h.pasos, t: mundo.t, mensajes, ms: performance.now() - inicio },
    hash: h.hash, instantanea: h.instantanea };
}
