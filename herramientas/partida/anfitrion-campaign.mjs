import { performance } from 'node:perf_hooks';
import soluciones from '../../pruebas/campaign-soluciones.cjs';
import { cargar } from './cargar.mjs';
import { ejecutarCiclo } from './ciclo.mjs';
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

/** Secuencia de tramos sobre el mismo mundo. maxPasos se aplica a cada tramo.
 * Las unidades omitidas quedan vacías. El corte precede a entregar mensajes del paso del hito.
 * @param {{lenguaje?: 'js'|'python', programas?: Record<string, import('./anfitrion-war.mjs').Fuente>[],
 * maxPasos?: number, alPaso?: (paso: number, instantanea: any) => void}} [opciones] */
export function ejecutarCampaign({ lenguaje = 'js', programas, maxPasos = 30000, alPaso } = {}) {
  if (!['js', 'python'].includes(lenguaje)) throw new Error('--lenguaje debe ser js|python.');
  const inicio = performance.now(), fuentes = programas ?? programasCampaign(lenguaje);
  if (!Array.isArray(fuentes) || !fuentes.length || fuentes.some(p => !p || typeof p !== 'object' || Array.isArray(p)))
    throw new Error('--programas de Campaign requiere una lista no vacía de objetos por unidad.');
  const sesion = { ...cargar(), mundo: null, huella: crearHuella(), pasos: 0 };
  sesion.mundo = sesion.contexto.CAMPAIGN.crear(sesion.contexto.CAMPAIGN_NIVEL.NIVEL);
  const tramos = [], mensajes = {};
  for (const tramoFuentes of fuentes) {
    const programas = Object.fromEntries(Object.entries(tramoFuentes).map(([id, fuente]) =>
      [id, typeof fuente === 'string' ? { lenguaje, codigo: fuente } : fuente]));
    const desde = sesion.mundo.hito;
    const tramo = ejecutarCiclo({ reglas: 'campaign', programas, maxPasos, alPaso, sesion,
      capturarResultado: resultadoCampaign, conectarReglas: conectarCampaign });
    for (const [tipo, n] of Object.entries(tramo.metricas.mensajes)) mensajes[tipo] = (mensajes[tipo] || 0) + n;
    tramos.push({ desde, hito: tramo.resultado.hito, completado: tramo.resultado.completado,
      pasos: tramo.metricas.pasos, t: tramo.metricas.t, hash: tramo.hash, resultado: tramo.resultado });
    if (sesion.mundo.completado || sesion.mundo.hito === desde) break;
  }
  const h = sesion.huella.terminar();
  return { reglas: 'campaign', resultado: tramos.at(-1).resultado, tramos,
    metricas: { pasos: h.pasos, t: sesion.mundo.t, mensajes, ms: performance.now() - inicio },
    hash: h.hash, instantanea: h.instantanea };
}

/** Encargos, modos, lecturas y cesiones de mensajeCampaign/finEncargoCampaign.
 * @param {any} C @param {any} mundo @param {any} ejec @param {Function} terminar */
export function conectarCampaign(C, mundo, ejec, terminar) {
  let hito = false;
  const registrar = (id, linea, que, resultado, clase) => mundo.eventos.push({
    t: +mundo.t.toFixed(2), maquina: id, linea: linea ?? '', que, resultado, clase });
  const contar = (id, fn) => { const u = mundo.uso[id] ||= {}; u[fn] = (u[fn] || 0) + 1; };
  const reglas = C.CAMPAIGN.conectar(mundo, {
    hito() { hito = true; },
    // entregaCampaign solo muestra consola y globo; no modifica datos de la simulación.
    terminarOrden(unidad, clave, res) {
      const corte = String(clave).lastIndexOf('#'), p = ejec.progs.get(String(clave).slice(0, corte));
      const id = +String(clave).slice(corte + 1), orden = p?.pend.get(id);
      if (!orden) return;
      p.pend.delete(id); registrar(unidad, orden.linea, orden.texto, res, res === 'ok' ? 'ok' : 'warn');
      if (p.acabado) return;
      p.estado = 'corre'; p.desde = 0; p.mensajes = 0;
      p.worker.postMessage({ type: 'despierta', id, resultado: res,
        snap: { t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: reglas.instantanea() } });
    },
  });
  return { reglas, detenido: () => hito,
    /** @param {any} p @param {any} m @param {Function} errorPrograma */
    mensaje(p, m, errorPrograma) {
      if (m.type === 'consola') {
        mundo.consolas[m.nivel] = (mundo.consolas[m.nivel] || 0) + 1;
        registrar(p.id, m.linea, ejec.lenguajes[p.id] === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
          m.texto, m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor');
      } else if (m.type === 'encargo') {
        p.pend.set(m.id, { tipo: 'encargo', unidad: m.unidad, linea: m.linea, texto: m.texto });
        p.estado = 'espera'; contar(p.id, m.verbo);
        reglas.iniciarOrden(m.unidad, { id: `${p.id}#${m.id}`, verbo: m.verbo, args: m.args });
      } else if (m.type === 'modo') {
        contar(p.id, m.verbo);
        const res = reglas.aplicarModo(m.unidad, m.verbo, m.args);
        registrar(p.id, m.linea, m.texto, res, res === 'ok' ? 'ok' : 'warn');
      } else if (m.type === 'lectura') {
        contar(p.id, 'count'); registrar(p.id, m.linea, m.texto, String(m.valor), 'sensor');
      } else if (m.type === 'espera') {
        contar(p.id, 'wait'); p.pend.set(m.id, { tipo: 'espera', despertar: mundo.t + m.s }); p.estado = 'espera';
      } else if (m.type === 'cede') {
        if (p.estado === 'corre' && p.pend.size) p.estado = 'espera';
      } else if (m.type === 'done') { p.acabado = true; p.estado = 'fin'; p.finT = mundo.t; }
      else if (m.type === 'error') errorPrograma(p, m.mensaje, m.linea);
      if (['modo', 'lectura', 'consola'].includes(m.type) && ++p.mensajes > 4000)
        errorPrograma(p, `El programa de ${p.id} dio 4000 órdenes y lecturas sin esperar. ¿Falta await wait(...) dentro del bucle?`, m.linea);
      return true;
    },
  };
}
