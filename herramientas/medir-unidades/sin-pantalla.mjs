import { performance } from 'node:perf_hooks';
import { crearPartida } from '../../paquetes/nucleo/index.js';
import { crearConductor } from '../../paquetes/app/index.js';
import { crearAnfitrion, crearTrabajadorInterprete } from '../../paquetes/anfitrion/index.js';
import { cargar } from '../partida/cargar.mjs';
import { crearInstrumentador } from '../partida/instrumentar.mjs';
import { crearHuella } from '../partida/huella.mjs';
import { crearEscenario } from './escenarios.mjs';
import { instrumentarMedida } from './instrumentacion.mjs';
import { resumirPasos } from './estadisticas.mjs';

export async function medirSinPantalla({ serie, unidades, pasos = 1200, calentamiento = 40, semilla = 7 }) {
  globalThis.gc?.();
  const rssBase = process.memoryUsage().rss, inicio = performance.now();
  const e = crearEscenario(serie, unidades, semilla), sesion = cargar();
  const partida = crearPartida(e);
  /** @type {any} */
  const mundo = partida.mundo;
  const lenguaje = crearInstrumentador(sesion.contexto, mundo, serie);
  const anfitrion = crearAnfitrion({ reglas: e.reglas, piezas: sesion.piezasTrabajador,
    crearTrabajador: crearTrabajadorInterprete({ acorn: sesion.contexto.acorn, piezas: sesion.piezasTrabajador }),
    contexto: { nombres: (serie === 'campaign' ? mundo.unidades : [...mundo.programables, ...mundo.sensores]).map(u => u.id) } });
  const huella = crearHuella();
  const medida = instrumentarMedida(partida, anfitrion, () => performance.now(), (_fila, foto) => huella.paso(foto));
  const conductor = medida.envolverConductor(crearConductor({ reglas: e.reglas, partida, anfitrion }));
  let rssMax = rssBase, arranqueMs;
  try {
    for (const u of mundo.programables) await anfitrion.cargar(u.id, lenguaje.instrumentar(e.programas[u.id]));
    if (mundo.programables.length !== unidades) throw Error(`Solo ${mundo.programables.length}/${unidades} programables`);
    await conductor.iniciar();
    arranqueMs = performance.now() - inicio;
    for (let i = 0; i < pasos + calentamiento; i++) {
      const r = await conductor.avanzar(1);
      rssMax = Math.max(rssMax, process.memoryUsage().rss);
      if (r.pasos !== 1 || r.terminada) throw Error(JSON.stringify({ error: conductor.error, evaluacion: partida.evaluar(), paso: partida.pasoActual }));
    }
    const rssFinal = process.memoryUsage().rss;
    // Ningún reloj entra en esta huella: fotos de cada paso y huella independiente de las órdenes reales.
    const traza = huella.terminar();
    const { createHash } = await import('node:crypto');
    const ordenes = partida.serializar().ordenes;
    const huellaOrdenes = createHash('sha256').update(JSON.stringify(ordenes)).digest('hex');
    return { serie, unidades, semilla, pasos, calentamiento, arranqueMs, costes: resumirPasos(medida.muestras.slice(calentamiento)),
      memoria: { rssBase, rssFinal, rssMax }, huella: traza, huellaOrdenes, ordenes: ordenes.length,
      actividad: serie === 'war' ? { disparos: mundo.consumidos, derribos: mundo.derribos, brechas: mundo.brechas }
        : { encargos: mundo.robots.reduce((a, u) => a + u.st.encargos, 0), metros: mundo.robots.reduce((a, u) => a + u.st.metros, 0) },
      muestras: medida.muestras.slice(calentamiento) };
  } finally { conductor.cerrar(); }
}
