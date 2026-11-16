/* Encargos y registro de Factory. No accede al mundo: recibe mensajes y respuestas del reglamento. */
export function crearControlFactory() {
  const registro = { eventos: [], verbos: {}, resultados: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 } };
  const contar = (tabla, clave) => { tabla[clave] = (tabla[clave] || 0) + 1; };
  return {
    recibir(p, m, fallar) {
      if (m.type === 'encargo') {
        if (p.encargo) {
          fallar(p, `Falta await en la línea ${p.encargo.linea}: R1 seguía con ${p.encargo.texto} cuando llegó la orden de la línea ${m.linea}.`, p.encargo.linea);
          return false;
        }
        p.encargo = { id: m.id, linea: m.linea, texto: m.texto, verbo: m.verbo };
        p.estado = 'encargo'; p.sensoresSeguidos = 0;
      } else if (m.type === 'lecturaFactory' && ++p.sensoresSeguidos > 500) {
        fallar(p, 'R1 consultó el sensor 500 veces sin hacer nada más: el bucle no avanza. ¿Falta una orden dentro del «while»?', m.linea);
        return false;
      } else if (m.type === 'done') {
        p.acabado = true; p.estado = p.encargo ? 'encargo' : 'fin'; p.finT = p.t;
      }
      return true;
    },
    registrar(p, m, paso, t, ordenes) {
      if (m.type === 'encargo') {
        ordenes.push({ paso, origen: 'programa', unidad: p.id, verbo: m.verbo, args: m.args });
        contar(registro.verbos, m.verbo);
      } else if (m.type === 'lecturaFactory') {
        contar(registro.verbos, 'cuantos');
        registro.eventos.push({ t: +t.toFixed(2), linea: m.linea, orden: m.texto, resultado: String(m.valor), sensor: true });
      } else if (m.type === 'consola') {
        contar(registro.consolas, m.nivel);
        registro.eventos.push({ t: +t.toFixed(2), maquina: p.id, linea: m.linea ?? '',
          que: p.lenguaje === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
          resultado: m.texto, clase: m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor' });
      } else if (m.type === 'done') {
        ordenes.push({ paso, origen: 'sistema', unidad: p.id, verbo: 'programa-acabado', args: [] });
      }
    },
    responder(p, { resultado, instantanea }, ahora) {
      const orden = p?.encargo;
      if (!orden) return;
      p.encargo = null;
      contar(registro.resultados, resultado);
      registro.eventos.push({ t: +instantanea.t.toFixed(2), linea: orden.linea, orden: orden.texto, resultado });
      p.t = instantanea.t;
      p.estado = p.acabado ? 'fin' : 'corre'; p.desde = ahora();
      p.worker.postMessage({ type: 'despierta', id: orden.id, resultado, snap: instantanea });
    },
    registro() { return structuredClone(registro); },
  };
}
