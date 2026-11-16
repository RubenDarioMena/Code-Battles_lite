/* Campaign: pendientes por programa y registro fuera del mundo. */
export function crearControlCampaign() {
  const registro = { eventos: [], uso: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 } };
  const modos = new Map();
  let siguienteModo = 0;
  const contar = (id, fn) => { const u = registro.uso[id] ||= {}; u[fn] = (u[fn] || 0) + 1; };
  const registrar = (t, id, linea, que, resultado, clase) => {
    const evento = { t: +t.toFixed(2), maquina: id, linea: linea ?? '', que, resultado, clase };
    registro.eventos.push(evento);
    return evento;
  };
  return {
    recibir(p, m, fallar, maxOrdenes) {
      if (m.type === 'encargo') {
        p.pend.set(m.id, { tipo: 'encargo', unidad: m.unidad, linea: m.linea, texto: m.texto });
        p.estado = 'espera';
      } else if (m.type === 'espera') {
        p.pend.set(m.id, { tipo: 'espera', despertar: p.t + m.s }); p.estado = 'espera';
      } else if (m.type === 'cede') {
        if (p.estado === 'corre' && p.pend.size) p.estado = 'espera';
      } else if (m.type === 'done') { p.acabado = true; p.estado = 'fin'; p.finT = p.t; }
      else if (m.type === 'error') fallar(p, m.mensaje, m.linea);
      if (['modo', 'lectura', 'consola'].includes(m.type) && ++p.mensajes > maxOrdenes)
        fallar(p, `El programa de ${p.id} dio ${maxOrdenes} órdenes y lecturas sin esperar. ¿Falta await wait(...) dentro del bucle?`, m.linea);
    },
    registrar(p, m, paso, t, ordenes) {
      if (m.type === 'encargo' || m.type === 'modo') {
        const ref = m.type === 'encargo' ? `${p.id}#${m.id}` : `${p.id}#modo:${++siguienteModo}`;
        contar(p.id, m.verbo);
        ordenes.push({ paso, origen: 'programa', unidad: m.unidad, verbo: m.verbo, args: m.args, ref });
        if (m.type === 'modo') modos.set(ref, registrar(t, p.id, m.linea, m.texto, null, null));
      } else if (m.type === 'lectura') {
        contar(p.id, 'count'); registrar(t, p.id, m.linea, m.texto, String(m.valor), 'sensor');
      } else if (m.type === 'espera') contar(p.id, 'wait');
      else if (m.type === 'consola') {
        registro.consolas[m.nivel] = (registro.consolas[m.nivel] || 0) + 1;
        registrar(t, p.id, m.linea,
          p.lenguaje === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
          m.texto, m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor');
      }
    },
    responder(progs, r, ahora) {
      if (!r.ref) return;
      if (r.modo) {
        const evento = modos.get(r.ref);
        if (evento) { evento.resultado = r.resultado; evento.clase = r.resultado === 'ok' ? 'ok' : 'warn'; modos.delete(r.ref); }
        return;
      }
      const corte = r.ref.lastIndexOf('#'), p = progs.get(r.ref.slice(0, corte));
      const id = +r.ref.slice(corte + 1), orden = p?.pend.get(id);
      if (!orden || orden.tipo !== 'encargo') return;
      p.pend.delete(id);
      registrar(r.instantanea.t, r.unidad, orden.linea, orden.texto, r.resultado, r.resultado === 'ok' ? 'ok' : 'warn');
      if (p.acabado) return;
      p.t = r.instantanea.t; p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
      p.worker.postMessage({ type: 'despierta', id, resultado: r.resultado, snap: r.instantanea });
    },
    registro(desde = 0) { return structuredClone({ ...registro, eventos: registro.eventos.slice(desde) }); },
  };
}
