import { ejecutarCiclo } from './ciclo.mjs';

/** @typedef {{ reto: number, intento?: number, semilla?: number, escenario?: any,
 * programas?: Record<string, import('./anfitrion-war.mjs').Fuente>, maxPasos?: number,
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
export function ejecutarFactory(opciones) {
  return ejecutarCiclo({ ...opciones, reglas: 'factory', conectarReglas: conectarFactory,
    capturarResultado: (m, fin, motivo, texto, linea) =>
      resultadoFactory(m, opciones.intento ?? opciones.semilla, fin, motivo, texto, linea) });
}

/** Adapta encargos y lecturas de juego.js sin duplicar su ciclo común con War.
 * @param {any} C @param {any} mundo @param {any} ejec @param {Function} terminar */
export function conectarFactory(C, mundo, ejec, terminar) {
  const reglas = C.FACTORY.conectar(mundo, {
    terminar,
    programaAcabado: () => [...ejec.progs.values()].every(p => p.acabado),
    llamadaPendiente: () => [...ejec.progs.values()].some(p => p.encargo),
    terminarOrden(resultado) {
      const p = ejec.progs.get('R1'), orden = p?.encargo;
      if (!orden) return;
      p.encargo = null;
      mundo.resultados[resultado] = (mundo.resultados[resultado] || 0) + 1;
      mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: orden.linea, orden: orden.texto, resultado });
      p.estado = p.acabado ? 'fin' : 'corre'; p.desde = 0;
      p.worker.postMessage({ type: 'despierta', id: orden.id, resultado,
        snap: { t: mundo.t, maq: {}, auto: {}, vib: {}, factory: C.FACTORY.instantanea(mundo) } });
    },
  });
  return { reglas,
    /** @param {any} p @param {any} m @param {Function} errorPrograma */
    mensaje(p, m, errorPrograma) {
      if (m.type === 'encargo') {
        if (p.encargo) {
          errorPrograma(p, `Falta await en la línea ${p.encargo.linea}: R1 seguía con ${p.encargo.texto} cuando llegó la orden de la línea ${m.linea}.`, p.encargo.linea);
          return true;
        }
        p.encargo = m; p.estado = 'encargo'; p.sensoresSeguidos = 0;
        mundo.verbos[m.verbo] = (mundo.verbos[m.verbo] || 0) + 1;
        reglas.iniciarOrden(m.verbo, m.args);
        return true;
      }
      if (m.type === 'lecturaFactory') {
        mundo.verbos.cuantos = (mundo.verbos.cuantos || 0) + 1;
        if ((p.sensoresSeguidos = (p.sensoresSeguidos || 0) + 1) > 500)
          errorPrograma(p, 'R1 consultó el sensor 500 veces sin hacer nada más: el bucle no avanza. ¿Falta una orden dentro del «while»?', m.linea);
        else mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: m.linea, orden: m.texto, resultado: String(m.valor), sensor: true });
        return true;
      }
      return false;
    },
  };
}
