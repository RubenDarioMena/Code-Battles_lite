/* Registro de War. Solo lee mensajes e instantáneas; no escribe en el mundo. */
const r2 = v => Math.round(v * 100) / 100;
const fmtLugar = (l) => l ? `{x: ${r2(l.x)}, y: ${r2(l.y)}, z: ${r2(l.z || 0)}${l.id ? `, id: "${l.id}"` : ""}}` : "null";
const fmtValor = (v) => v == null ? "null" : typeof v === "object" ? fmtLugar(v) : String(v);

export function crearControlWar() {
  const registro = { eventos: [], uso: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 }, lecturas: {} };
  const contar = (tabla, clave) => { tabla[clave] = (tabla[clave] || 0) + 1; };
  const contarUso = (id, fn) => contar(registro.uso[id] ||= {}, fn);
  return {
    observar(instantanea) {
      for (const id of Object.keys(instantanea.vib ?? {})) registro.lecturas[id] ??= 0;
    },
    registrar(p, m, paso, t, ordenes) {
      const anotar = (que, resultado, clase) => registro.eventos.push({ t: +t.toFixed(2),
        maquina: p.id, linea: m.linea ?? '', que, resultado, clase });
      if (m.type === 'lee') {
        contarUso(p.id, m.fn);
        if (Object.hasOwn(registro.lecturas, m.maquina)) contar(registro.lecturas, m.maquina);
        anotar(m.que, fmtValor(m.valor), 'sensor');
      } else if (m.type === 'cmd') {
        contarUso(p.id, m.verbo);
        ordenes.push({ paso, origen: 'programa', unidad: p.id, verbo: m.verbo, args: [m.lugar ?? null] });
        anotar(`${m.verbo}(${m.verbo === 'stopFire' ? '' : fmtLugar(m.lugar)})`, m.res, m.res === 'ok' ? 'ok' : 'warn');
      } else if (m.type === 'consola') {
        contar(registro.consolas, m.nivel);
        anotar(p.lenguaje === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
          m.texto, m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor');
      } else if (m.type === 'espera') contarUso(p.id, 'esperar');
    },
    registro(desde = 0) { return structuredClone({ ...registro, eventos: registro.eventos.slice(desde) }); },
  };
}
