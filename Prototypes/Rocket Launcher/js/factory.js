/* Catálogo de logística. Reglas de Factory b76411b con los cambios aprobados del reglamento común. */
(() => {
  "use strict";
  const VEL = 4, OP = 0.5, T_LIMITE = 300;
  const MATERIALES = ["cobre", "silicio"];
  const PRODUCTO = { cobre: ["placas de cobre", 2], silicio: ["obleas de silicio", 1] };
  const r2 = v => Math.round(v * 100) / 100;
  function crearMundo(reto, nIntento) {
    const entidades = reto.entidades.map(e => {
      const c = JSON.parse(JSON.stringify(e));
      if (c.tipo === "maquina") Object.assign(c, {
        entrada: 0, procesando: false, progreso: 0, recibido: {}, producido: 0, ciclos: 0, rechazos: 0, derrames: 0, suelo: [],
        produce: PRODUCTO[c.acepta][0], ratio: PRODUCTO[c.acepta][1], cola: [], actual: null, fichas: [], tOcupada: 0,
      });
      if (c.tipo === "bodega") { c.stock = c.stock || {}; c.recibido = {}; c.entregado = {}; }
      return c;
    });
    let stockOculto = null;
    if (reto.stockPorIntento) {
      stockOculto = reto.stockPorIntento[(Math.max(1, nIntento) - 1) % reto.stockPorIntento.length];
      const e = entidades.find(x => x.oculto);
      e.stock[Object.keys(e.stock)[0]] = stockOculto;
    }
    return {
      t: 0, activo: false, fin: null, rechazos: 0, ultimoRechazo: null, derrames: 0, vacios: 0, ultimoVacio: null, revelado: false, stockOculto,
      entidades, porId: Object.fromEntries(entidades.map(e => [e.id, e])),
      robot: { x: reto.robot.x, y: reto.robot.y, carga: null, tarea: null, cargaDesde: null, cargaOrigen: null, tCaminando: 0, viajes: 0 },
      eventos: [], verbos: {}, resultados: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 },
    };
  }

  function validar(mundo, verbo, args) {
    const ids = mundo.entidades.map(e => `"${e.id}"`).join(", ");
    const matOk = (m, ej) => m === undefined ? `Falta el material. Por ejemplo ${ej}.` : !MATERIALES.includes(m) ? `No existe el material ${JSON.stringify(m)}. Hay ${MATERIALES.map(x => `"${x}"`).join(" y ")}.` : null;
    if (verbo === "recoger") {
      const [origen, mat] = args;
      if (typeof origen !== "string") return `recoger necesita el ID de una bodega entre comillas, por ejemplo yo.recoger("ENT-1", "cobre").`;
      const e = mundo.porId[origen];
      if (!e) return `No hay ningún edificio "${origen}". En este mapa hay ${ids}.`;
      if (e.tipo !== "bodega") return `"${origen}" es una máquina: solo se recoge en bodegas.`;
      return matOk(mat, `yo.recoger("${origen}", "cobre")`);
    } else if (verbo === "entregar") {
      const [destino] = args;
      if (typeof destino !== "string") return `entregar necesita el ID del destino entre comillas, por ejemplo yo.entregar("FUN").`;
      if (!mundo.porId[destino]) return `No hay ningún edificio "${destino}". En este mapa hay ${ids}.`;
    } else if (verbo === "esperar") {
      const [s] = args;
      if (typeof s !== "number" || !(s > 0) || s > 60) return `esperar necesita un número de segundos entre 0 y 60, por ejemplo yo.esperar(2).`;
    } else if (verbo === "cuantos") {
      const [lugar, mat] = args;
      if (typeof lugar !== "string") return `cuantos necesita el ID de un edificio entre comillas, por ejemplo yo.cuantos("ENT-1", "cobre").`;
      return matOk(mat, `yo.cuantos("${lugar}", "cobre")`);
    }
    return null;
  }


  function crear(def, intento) {
    const m = crearMundo(def, intento);
    m.def = def;
    Object.assign(m.robot, { id: "R1", clase: "robot" });
    Object.defineProperties(m.robot, { cx: { get: () => m.robot.x + .5 }, cy: { get: () => m.robot.y + .5 } });
    for (const e of m.entidades) Object.assign(e, { clase: e.tipo === "bodega" ? "bodega" : "fundidora", cx: e.x + .5, cy: e.y + .5 });
    m.maquinas = [m.robot, ...m.entidades];
    m.porId.R1 = m.robot;
    // Colecciones comunes del mundo. El robot no se disfraza de lanzador.
    Object.assign(m, { programables: [m.robot], lanzadores: [], sensores: [], reparadores: [], enemigos: [], misiles: [], pendientes: [], colaReparar: [], uso: {} });
    return m;
  }
  function conectar(mundo, hooks) {
    const retoActual = () => mundo.def;
    const terminarOrden = hooks.terminarOrden, terminar = hooks.terminar;
  function ruta(dest) {
    const r = mundo.robot, wps = [];
    if (Math.abs(r.x - dest.x) > 1e-6) wps.push({ x: dest.x, y: r.y });
    if (Math.abs(r.y - dest.y) > 1e-6) wps.push({ x: dest.x, y: dest.y });
    return wps;
  }

  function paso(dt) {
    mundo.t += dt;
    for (const e of mundo.entidades) {
      if (e.tipo !== "maquina") continue;
      if (e.procesando) {
        e.progreso += dt; e.tOcupada += dt;
        if (e.progreso >= e.tProceso - 1e-9) {
          e.procesando = false; e.ciclos++; e.producido += e.ratio;
          // Ficha del producto: cuánto tardó cada tramo de la cadena que lo hizo.
          const a = e.actual;
          if (a) e.fichas.push({ n: e.ciclos, origen: a.origen, viaje: r2(a.tEntrega - a.tRecogida), espera: r2(a.tInicio - a.tEntrega), proceso: e.tProceso, total: r2(mundo.t - a.tRecogida) });
          e.actual = null;
        }
      }
      if (!e.procesando && e.entrada > 0) { e.entrada--; e.procesando = true; e.progreso = 0; e.actual = e.cola.shift() || null; if (e.actual) e.actual.tInicio = mundo.t; }
    }
    const r = mundo.robot, tarea = r.tarea;
    if (tarea) {
      let mov = VEL * dt;
      if (tarea.wps.length) r.tCaminando += dt;
      while (mov > 0 && tarea.wps.length) {
        const w = tarea.wps[0], dx = w.x - r.x, dy = w.y - r.y, d = Math.hypot(dx, dy);
        if (d <= mov) { r.x = w.x; r.y = w.y; mov -= d; tarea.wps.shift(); }
        else { r.x += dx / d * mov; r.y += dy / d * mov; mov = 0; }
      }
      if (!tarea.wps.length) {
        tarea.op -= dt;
        if (tarea.op <= 1e-9) { r.tarea = null; terminarOrden(tarea.fin()); }
      }
    }
    evaluar();
  }

  function iniciarOrden(verbo, args) {
    const r = mundo.robot;
    if (verbo === "recoger") {
      const [origen, mat] = args, e = mundo.porId[origen];
      if (r.carga) return terminarOrden("manos_llenas");
      r.tarea = { wps: ruta(e.puerta), op: OP, fin: () => {
        if ((e.stock[mat] || 0) > 0) { e.stock[mat]--; e.entregado[mat] = (e.entregado[mat] || 0) + 1; r.carga = mat; r.cargaDesde = mundo.t; r.cargaOrigen = e.id; r.viajes++; return "ok"; }
        mundo.vacios++; mundo.ultimoVacio = { id: e.id, mat };
        return "viaje_vacio";
      } };
    } else if (verbo === "entregar") {
      const e = mundo.porId[args[0]];
      if (!r.carga) return terminarOrden("manos_vacias");
      r.tarea = { wps: ruta(e.puerta), op: OP, fin: () => {
        const mat = r.carga;
        if (e.tipo === "bodega") { e.stock[mat] = (e.stock[mat] || 0) + 1; e.recibido[mat] = (e.recibido[mat] || 0) + 1; r.carga = null; return "ok"; }
        if (e.acepta !== mat || e.entrada >= e.cap) {
          const motivo = e.acepta !== mat ? "rechazado" : "lleno";
          e.rechazos++; mundo.rechazos++; mundo.ultimoRechazo = { id: e.id, mat, motivo };
          return motivo; // La carga y su procedencia permanecen en el robot.
        }
        e.entrada++; e.recibido[mat] = (e.recibido[mat] || 0) + 1; e.cola.push({ tRecogida: r.cargaDesde ?? mundo.t, tEntrega: mundo.t, origen: r.cargaOrigen }); r.carga = null; return "ok";
      } };
    } else if (verbo === "esperar") {
      r.tarea = { wps: [], op: args[0], fin: () => "ok" };
    }
    if (r.tarea) r.tarea.op0 = r.tarea.op;
  }

  function sensor(lugar, mat) {
    const e = mundo.porId[lugar];
    if (!e) return null;
    if (e.tipo === "bodega") return e.stock[mat] || 0;
    return e.acepta === mat ? e.entrada : 0;
  }

  function metaCumplida(m) {
    const e = mundo.porId[m.id];
    if (m.tipo === "vaciar") return (e.stock[m.mat] || 0) === 0 && mundo.robot.carga !== m.mat;
    return ((e.recibido && e.recibido[m.mat]) || 0) >= m.n;
  }
  function faltantes() {
    return retoActual().metas.filter(m => !metaCumplida(m)).map(m => {
      const e = mundo.porId[m.id];
      if (m.tipo === "vaciar") return `${m.id} aún tiene ${e.stock[m.mat]} de ${m.mat}`;
      return `${m.id} ${m.n - ((e.recibido[m.mat]) || 0)} de ${m.mat}`;
    });
  }

  function evaluar() {
    if (!mundo.activo || mundo.fin) return;
    const reto = retoActual();
    if (reto.maxRechazos != null && mundo.rechazos > reto.maxRechazos) {
      const r = mundo.ultimoRechazo;
      return terminar("fallo", "rechazo", `Entrega de ${r.mat} rechazada en ${r.id}: ${r.motivo === "lleno" ? "su entrada estaba llena" : "no acepta ese material"}. R1 conserva la carga. Este reto no admite entregas rechazadas.`);
    }
    if (reto.maxVacios != null && mundo.vacios > reto.maxVacios) {
      const v = mundo.ultimoVacio;
      return terminar("fallo", "vacio", `R1 hizo un viaje vacío a ${v.id}: ya no quedaba ${v.mat}. Este reto no admite viajes vacíos.`);
    }
    if (reto.tiempoMax != null && mundo.t > reto.tiempoMax + 1e-9) {
      return terminar("fallo", "tiempo", `Se acabaron los ${reto.tiempoMax} s. Faltó: ${faltantes().join(", ")}.`);
    }
    if (!faltantes().length) return terminar("victoria", null, null);
    if (mundo.t > T_LIMITE) return terminar("fallo", "limite", `El programa sigue después de ${T_LIMITE} s de juego. ¿Hay un bucle que nunca termina?`);
    // Las metas ya deciden la victoria. Si el programa se agota antes, queda incompleto.
    if (hooks.programaAcabado() && !mundo.robot.tarea && !hooks.llamadaPendiente()) {
      if (!faltantes().length) return terminar("victoria", null, null);
      return terminar("fallo", "incompleto", `El programa terminó y falta: ${faltantes().join(", ")}.`);
    }
  }


    return { paso, iniciarOrden, sensor, metaCumplida, faltantes, evaluar };
  }
  function instantanea(m) {
    return { porId: Object.fromEntries(m.entidades.map(e => [e.id, { id: e.id, tipo: e.tipo, stock: e.stock, acepta: e.acepta, entrada: e.entrada }])), entidades: m.entidades.map(e => ({ id: e.id })) };
  }
  window.FACTORY = { crear, conectar, validar, instantanea, MATERIALES };
})();
