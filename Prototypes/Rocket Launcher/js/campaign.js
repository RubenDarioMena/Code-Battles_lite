/* Campaign · reglas del nivel: una fábrica continua que avanza por hitos.
 * Sin DOM ni reloj real: paso fijo y estado en datos planos (se guarda tal cual en los checkpoints).
 * Lo cargan el juego y las pruebas de node (pruebas/campaign-reglas.cjs).
 *
 * Tres clases de órdenes, como en el resto del juego:
 *   encargos (tardan y se esperan): pickUp, deliver, goTo · modos (al instante): start, stop,
 *   setRecipe, light, request · lecturas (no avanzan el reloj): count y las propiedades. */
(() => {
  "use strict";
  const VERSION = 1;
  const TARIMA_CAP = 12;
  const ROBOT = { obrero: { vel: 4, op: 0.5 }, montacargas: { vel: 3, op: 1.2, cargaMax: 2 } };
  // Tamaño de cada pieza: las ranuras de la ensambladora van por clase (S, M, L).
  const PIEZAS = {
    steel: { nombre: "acero", clase: "M", crudo: true },
    polymer: { nombre: "polímero", clase: "M", crudo: true },
    nose: { nombre: "ojiva", clase: "M" },
    base: { nombre: "base con aletas", clase: "L" },
    charge: { nombre: "carga química", clase: "S" },
    motor: { nombre: "motor", clase: "L" },
    missile: { nombre: "misil", clase: "L" },
  };
  const RECETAS = {
    nose: { entra: { steel: 1 }, sale: "nose", t: 2 },
    base: { entra: { polymer: 1 }, sale: "base", t: 6 },
    charge: { entra: { polymer: 1 }, sale: "charge", t: 4.5 },
    motor: { entra: { base: 1, charge: 1 }, sale: "motor", t: 4 },
    missile: { entra: { nose: 1, motor: 1 }, sale: "missile", t: 5 },
  };
  // Máquinas especializadas: entrada por cantidad. Ensambladora: ranuras por clase de tamaño.
  const MAQUINAS = {
    prensa: { nombre: "Prensa", recetas: ["nose"], entrada: 4, salida: 3, kw: 2, peso: 1.6 },
    moldeadora: { nombre: "Moldeadora", recetas: ["base"], entrada: 3, salida: 3, kw: 3, peso: 1.8 },
    mezcladora: { nombre: "Mezcladora", recetas: ["charge"], entrada: 3, salida: 3, kw: 3, peso: 1.2 },
    ensambladora: { nombre: "Ensambladora", recetas: ["motor", "missile"], ranuras: { S: 4, M: 2, L: 2 }, salida: 2, kw: 5, peso: 4.5, cambio: 6 },
  };
  const BANDA = { vel: 1.2, paso: 1, kw: 1 };
  const COSTE = { steel: 40, polymer: 60 };
  const PEDIDO = { n: TARIMA_CAP, espera: 8, programada: 3, cola: 2 };
  const ARSENAL = { cap: 40, pago: 35, suministro: 1.5 };
  const TORRETA = { cap: 4, cadencia: 0.7, vel: 14, alto: 1.7 };
  const LUCES = ["green", "amber", "red", "off"];
  const HITO_MAESTRO = 4;
  const r2 = v => Math.round(v * 100) / 100;
  const esMaquina = e => !!e && Object.hasOwn(MAQUINAS, e.clase);
  const esRobot = e => !!e && Object.hasOwn(ROBOT, e.clase);

  // ---------- Estado ----------
  function estadoInicial(def) {
    const unidades = def.unidades.map(d => {
      const u = JSON.parse(JSON.stringify(d));
      if (esRobot(u)) Object.assign(u, { carga: null, tarea: null, rumbo: 0, st: { encargos: 0, metros: 0 } });
      if (esMaquina(u)) Object.assign(u, {
        receta: MAQUINAS[u.clase].recetas[0], marcha: true, entrada: {}, salida: [], proceso: null, cambio: null, enVilo: false,
        luz: null, hechos: 0, st: { ciclos: 0, tTrabajo: 0, tBloqueo: 0, tSinMaterial: 0 },
      });
      if (u.clase === "banda") Object.assign(u, { cx: (u.x0 + u.x1) / 2, cy: (u.y0 + u.y1) / 2, largo: Math.hypot(u.x1 - u.x0, u.y1 - u.y0), marcha: false, piezas: [], st: { movidos: 0 } });
      if (u.clase === "lugar" || u.clase === "bahia") u.tarima = null;
      if (u.clase === "bahia") u.pedidos = [];
      if (u.clase === "pad") u.maquina = null;
      if (u.clase === "arsenal") Object.assign(u, { misiles: 0, porBanda: 0, aMano: 0 });
      if (u.clase === "torreta") Object.assign(u, { misiles: 0, yaw: 0, lanzados: 0 });
      return u;
    });
    const e = {
      version: VERSION, nivel: def.clave, rev: def.revision, t: 0, hito: 0, completado: false, hitosT: [],
      presupuesto: def.presupuesto, gastado: 0, ingresado: 0,
      unidades, tarimas: [], sigTarima: 1, sigMisil: 1, tSuministro: 0, salva: null,
      misiles: [], explosiones: [], producidos: {}, pedidos: 0,
    };
    const porId = Object.fromEntries(unidades.map(u => [u.id, u]));
    for (const u of unidades) {
      if (esMaquina(u) && u.pad) { const p = porId[u.pad]; p.maquina = u.id; u.cx = p.cx; u.cy = p.cy; }
      if (u.tarimaInicial) { const t = { id: `T${e.sigTarima++}`, piezas: [], en: u.id }; e.tarimas.push(t); u.tarima = t.id; }
    }
    for (const g of (def.hitos[0].alEmpezar || {}).entregas || []) {
      const l = porId[g.lugar], t = { id: `T${e.sigTarima++}`, piezas: Array(g.n).fill(g.pieza), en: l.id };
      e.tarimas.push(t); l.tarima = t.id;
    }
    return e;
  }
  // Lo que se guarda: el estado tal cual, sin tareas a medias (al volver no hay programas esperándolas).
  const CAMPOS = ["version", "nivel", "rev", "t", "hito", "completado", "hitosT", "presupuesto", "gastado", "ingresado", "unidades", "tarimas", "sigTarima", "sigMisil", "tSuministro", "producidos", "pedidos"];
  function serializar(m) {
    const e = JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS.map(k => [k, m[k]]))));
    for (const u of e.unidades) if (esRobot(u)) u.tarea = null;
    return e;
  }

  function crear(def, guardado) {
    const valido = !!guardado && guardado.version === VERSION && guardado.nivel === def.clave && guardado.rev === def.revision && Array.isArray(guardado.unidades);
    const m = valido ? { ...serializar(guardado), salva: null, misiles: [], explosiones: [] } : estadoInicial(def);
    Object.assign(m, {
      serie: "campaign", def, activo: false, fin: null, energia: { max: def.energia, uso: 0, factor: 1 },
      // Colecciones que la aplicación común espera de cualquier mundo.
      lanzadores: [], sensores: [], reparadores: [], enemigos: [], pendientes: [], colaReparar: [], derribados: [],
      eventos: [], uso: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 },
    });
    indexar(m);
    return m;
  }
  // Presencia y encendido salen del hito: las estaciones existen apagadas y se encienden al llegar su hito.
  function indexar(m) {
    const def = m.def, con = new Set(Object.keys(def.inicial));
    m.porId = {};
    for (const u of m.unidades) {
      const desde = u.desde ?? 0;
      u.presente = !(u.clase === "obrero" || u.clase === "banda") || m.hito >= desde;
      u.encendida = m.hito >= desde;
      m.porId[u.id] = u;
    }
    m.maquinas = m.unidades.filter(u => u.presente);
    m.programables = m.maquinas.filter(u => con.has(u.id) && u.encendida);
    m.robots = m.maquinas.filter(esRobot);
    m.estaciones = m.maquinas.filter(esMaquina);
    m.lotes = m.unidades.filter(u => u.clase === "lugar" && u.tipo === "lot");
    m.banda = m.unidades.find(u => u.clase === "banda");
    m.bahia = m.unidades.find(u => u.clase === "bahia");
    m.arsenal = m.unidades.find(u => u.clase === "arsenal");
    m.torretas = m.unidades.filter(u => u.clase === "torreta");
    m.tarimaPorId = Object.fromEntries(m.tarimas.map(t => [t.id, t]));
  }

  // ---------- Lecturas comunes ----------
  const contar = (lista, pieza) => { let n = 0; for (const p of lista) if (p === pieza) n++; return n; };
  const tarimaDe = (m, l) => l && l.tarima ? m.tarimaPorId[l.tarima] : null;
  const totalEntrada = q => Object.values(q.entrada).reduce((a, n) => a + n, 0);
  function capSalida(q) { return MAQUINAS[q.clase].salida; }
  function estadoMaquina(q) {
    if (!q.encendida) return "off";
    if (q.enVilo) return "moving";
    if (q.cambio) return "changeover";
    if (q.proceso) return "working";
    if (!q.marcha) return "stopped";
    if (q.salida.length >= capSalida(q)) return "blocked";
    return "idle";
  }
  // Cuántas piezas de ese tipo hay en un lugar. null: el lugar no existe (0: existe y no tiene).
  function cuantos(m, id, pieza) {
    const e = m.porId[id];
    if (!e || !e.presente) return null;
    if (e.clase === "lugar" || e.clase === "bahia") { const t = tarimaDe(m, e); return t ? contar(t.piezas, pieza) : 0; }
    if (esMaquina(e)) return contar(e.salida, pieza) + (e.entrada[pieza] || 0);
    if (e.clase === "banda") return contar(e.piezas.map(x => x.pieza), pieza);
    if (e.clase === "arsenal" || e.clase === "torreta") return pieza === "missile" ? e.misiles : 0;
    if (esRobot(e)) return e.carga === pieza ? 1 : 0;
    return 0;
  }
  const enLotes = (m, pieza) => m.lotes.reduce((a, l) => a + (cuantos(m, l.id, pieza) || 0), 0);
  function valorMeta(m, meta) {
    if (meta.tipo === "en") return cuantos(m, meta.lugar, meta.pieza) || 0;
    if (meta.tipo === "lotes") return enLotes(m, meta.pieza);
    if (meta.tipo === "banda") return m.arsenal.porBanda;
    return 0;
  }
  // Las metas del hito en curso (o del último, ya cumplido, al terminar el nivel).
  function metas(m) {
    const h = m.def.hitos[m.hito];
    return h.metas.map(meta => { const valor = valorMeta(m, meta); return { ...meta, valor, cumplida: m.completado || valor >= meta.n }; });
  }

  // Lo que ven los programas al despertar. Datos planos: viaja a los workers.
  function instantanea(m) {
    const u = {};
    for (const e of m.maquinas) {
      let d;
      if (e.clase === "obrero") d = { k: "robot", cargo: e.carga, busy: !!e.tarea };
      else if (e.clase === "montacargas") d = { k: "carretilla", cargo: e.carga ? (e.carga.tipo === "tarima" ? "pallet" : e.carga.id) : null, busy: !!e.tarea };
      else if (esMaquina(e)) {
        const c = MAQUINAS[e.clase];
        d = { k: "maquina", on: e.encendida, input: totalEntrada(e), output: e.salida.length, outputFull: e.salida.length >= c.salida, state: estadoMaquina(e),
          recipe: e.cambio ? e.cambio.a : e.receta, made: e.hechos, running: e.marcha, recetas: c.recetas, tiene: { ...e.entrada }, sale: [...e.salida] };
      } else if (e.clase === "lugar" || e.clase === "bahia") {
        const t = tarimaDe(m, e);
        d = { k: e.clase, pallet: !!t, items: t ? t.piezas.length : 0, free: t ? TARIMA_CAP - t.piezas.length : 0, tiene: t ? [...t.piezas] : [] };
        if (e.clase === "bahia") d.pending = e.pedidos.length;
      } else if (e.clase === "pad") d = { k: "pad", free: !e.maquina, machine: e.maquina };
      else if (e.clase === "pila") d = { k: "pila" };
      else if (e.clase === "banda") d = { k: "banda", on: e.encendida, items: e.piezas.length, running: e.marcha, state: !e.encendida ? "off" : e.marcha ? "running" : "stopped" };
      else if (e.clase === "arsenal") d = { k: "arsenal", missiles: e.misiles, received: e.porBanda + e.aMano };
      else if (e.clase === "torreta") d = { k: "torreta", missiles: e.misiles };
      else if (e.clase === "control") d = { k: "control", on: e.encendida, power: { used: m.energia.uso, max: m.energia.max }, budget: m.presupuesto, milestone: m.def.hitos[m.hito].clave };
      if (d) { if (Object.hasOwn(m.def.inicial, e.id)) d.prog = true; u[e.id] = d; }
    }
    return { t: r2(m.t), u, maestro: m.hito >= HITO_MAESTRO ? "CTL-01" : null, presupuesto: m.presupuesto, coste: COSTE, piezas: Object.keys(PIEZAS), luces: LUCES };
  }

  // ---------- Validación (también corre dentro del worker: no usa nada de fuera) ----------
  // Devuelve el texto del error o null. `snap` es instantanea(m).campaign; `propia`, la unidad del programa.
  function validar(snap, propia, unidad, verbo, args) {
    const u = snap.u, v = id => String(id).replace(/-/g, "_");
    const lista = a => a.map(x => '"' + x + '"').join(", ");
    const d = u[unidad];
    if (!d) return `No existe ninguna unidad ${v(unidad)} en la planta.`;
    const ordenes = { robot: ["pickUp", "deliver", "goTo"], carretilla: ["pickUp", "deliver", "goTo"], maquina: ["start", "stop", "light", ...(d.recetas && d.recetas.length > 1 ? ["setRecipe"] : [])], banda: ["start", "stop"], bahia: ["request"] }[d.k] || [];
    if (verbo === "count") {
      const [lugar, pieza] = args;
      if (typeof lugar !== "string") return `count necesita un lugar, por ejemplo count(LOT_1, "nose").`;
      if (pieza === undefined) return `count necesita la pieza, por ejemplo count(${v(lugar)}, "nose").`;
      if (!snap.piezas.includes(pieza)) return `No existe la pieza ${JSON.stringify(pieza)}. Hay ${lista(snap.piezas)}.`;
      return null;
    }
    if (!ordenes.includes(verbo)) return `${v(unidad)} no tiene la orden ${verbo}. ${ordenes.length ? `Sus órdenes son ${ordenes.join(", ")}.` : "No recibe órdenes: solo se lee."}`;
    // Solo las unidades con programa propio reservan sus órdenes; la bahía atiende a cualquiera.
    if (d.prog && unidad !== propia && snap.maestro !== propia) {
      return `Las órdenes de ${unidad} van en su propio programa${snap.maestro ? " o en el de CTL-01, el control maestro" : ""}. Desde aquí puedes leer sus datos, como ${v(unidad)}.${d.k === "maquina" ? "output" : d.k === "bahia" ? "pallet" : d.k === "banda" ? "items" : "busy"}.`;
    }
    if (d.on === false) return `${unidad} está apagada: se enciende al llegar su hito.`;
    if (verbo === "pickUp" || verbo === "deliver" || verbo === "goTo") {
      const [lugar, pieza] = args;
      if (typeof lugar !== "string") return `${verbo} necesita un lugar de la planta, por ejemplo ${verbo}(${verbo === "pickUp" ? 'SUP_1, "steel"' : "LOT_1"}).`;
      if (!u[lugar]) return `No hay ningún lugar ${JSON.stringify(lugar)} en la planta. Elige uno del inspector.`;
      if (verbo === "pickUp" && pieza !== undefined && d.k === "robot" && !snap.piezas.includes(pieza)) return `No existe la pieza ${JSON.stringify(pieza)}. Hay ${lista(snap.piezas)}.`;
    } else if (verbo === "setRecipe") {
      if (!d.recetas.includes(args[0])) return `${v(unidad)} no conoce la receta ${JSON.stringify(args[0])}. Sus recetas son ${lista(d.recetas)}.`;
    } else if (verbo === "light") {
      if (!snap.luces.includes(args[0])) return `light necesita un color: ${lista(snap.luces)}. Recibió ${JSON.stringify(args[0])}.`;
    } else if (verbo === "request") {
      if (!Object.hasOwn(snap.coste, args[0])) return `request necesita una materia prima: ${lista(Object.keys(snap.coste))}. Recibió ${JSON.stringify(args[0])}.`;
    }
    return null;
  }
  // Resultado de un modo, calculado sobre la instantánea para devolverlo al programa sin esperar.
  // El mundo aplica la misma regla (aplicarModo); aquí la instantánea se actualiza para las lecturas siguientes.
  function modoEnSnap(snap, unidad, verbo, args) {
    const d = snap.u[unidad];
    if (verbo === "start" || verbo === "stop") { d.running = verbo === "start"; return "ok"; }
    if (verbo === "light") return "ok";
    if (verbo === "setRecipe") {
      if (d.recipe === args[0]) return "ok";
      if (d.state === "working" || d.state === "changeover") return "ocupado";
      d.recipe = args[0]; d.state = "changeover"; return "ok";
    }
    if (verbo === "request") {
      if (d.pending >= 2) return "ocupado";
      if (snap.presupuesto < snap.coste[args[0]]) return "sin_fondos";
      snap.presupuesto -= snap.coste[args[0]]; d.pending++; return "ok";
    }
    return "ok";
  }

  // ---------- Simulación ----------
  function conectar(m, hooks = {}) {
    const def = m.def;
    const registrar = hooks.registrar || (() => {}), terminarOrden = hooks.terminarOrden || (() => {});
    const puntoDe = l => {
      if (!l || !l.presente) return null;
      if (esMaquina(l)) { if (l.enVilo) return null; const p = l.pad ? m.porId[l.pad] : l; return { x: p.ax, y: p.ay }; }
      return l.ax == null ? null : { x: l.ax, y: l.ay };
    };

    // --- Encargos de los robots ---
    function iniciarOrden(id, encargo) {
      const r = m.porId[id], [lugarId, pieza] = encargo.args, l = m.porId[lugarId];
      const ya = res => { terminarOrden(id, encargo.id, res); return res; };
      if (!esRobot(r) || !r.presente) return ya("no_disponible");
      if (r.tarea) return ya("ocupado");
      r.st.encargos++;
      if (encargo.verbo === "pickUp" && r.carga) return ya("manos_llenas");
      if (encargo.verbo === "deliver" && !r.carga) return ya("manos_vacias");
      const p = puntoDe(l);
      if (!p) return ya(esMaquina(l) && l.enVilo ? "no_disponible" : "rechazado");
      const op = encargo.verbo === "goTo" ? 0 : ROBOT[r.clase].op;
      r.tarea = { id: encargo.id, verbo: encargo.verbo, lugar: lugarId, pieza: pieza ?? null, x: p.x, y: p.y, x0: r.cx, y0: r.cy, fase: "ir", op, op0: op };
      return null;
    }
    function cancelarTareas() { for (const r of m.robots) r.tarea = null; }

    function resolver(r, t) {
      const l = m.porId[t.lugar];
      if (t.verbo === "goTo") return "ok";
      if (!l || !l.presente || (esMaquina(l) && l.enVilo)) return "no_disponible";
      return r.clase === "obrero" ? (t.verbo === "pickUp" ? obreroRecoge(r, l, t.pieza) : obreroEntrega(r, l))
        : (t.verbo === "pickUp" ? montacargasRecoge(r, l) : montacargasEntrega(r, l));
    }
    function obreroRecoge(r, l, pieza) {
      if (l.clase === "lugar" || l.clase === "bahia") {
        const t = tarimaDe(m, l);
        if (!t) return "sin_tarima";
        const i = pieza ? t.piezas.lastIndexOf(pieza) : t.piezas.length - 1;
        if (i < 0) return "viaje_vacio";
        r.carga = t.piezas.splice(i, 1)[0]; return "ok";
      }
      if (esMaquina(l)) {
        const i = pieza ? l.salida.lastIndexOf(pieza) : l.salida.length - 1;
        if (i >= 0) { r.carga = l.salida.splice(i, 1)[0]; return "ok"; }
        // Una pieza que quedó en la entrada (por ejemplo, tras cambiar de receta) también se puede retirar.
        if (pieza && l.entrada[pieza] > 0 && !l.proceso) { l.entrada[pieza]--; r.carga = pieza; return "ok"; }
        return "viaje_vacio";
      }
      return "rechazado";
    }
    function cabeEnMaquina(q, pieza) {
      const c = MAQUINAS[q.clase], R = RECETAS[q.receta];
      if (!R.entra[pieza]) return "rechazado";
      if (c.ranuras) {
        const clase = PIEZAS[pieza].clase;
        let usadas = 0; for (const [p, n] of Object.entries(q.entrada)) if (PIEZAS[p].clase === clase) usadas += n;
        return usadas < c.ranuras[clase] ? "ok" : "lleno";
      }
      return totalEntrada(q) < c.entrada ? "ok" : "lleno";
    }
    function obreroEntrega(r, l) {
      const pieza = r.carga;
      if (l.clase === "lugar" || l.clase === "bahia") {
        const t = tarimaDe(m, l);
        if (!t) return "sin_tarima";
        if (t.piezas.length >= TARIMA_CAP) return "lleno";
        t.piezas.push(pieza); r.carga = null; return "ok";
      }
      if (esMaquina(l)) {
        if (!l.encendida) return "no_disponible";
        const res = cabeEnMaquina(l, pieza);
        if (res !== "ok") return res;
        l.entrada[pieza] = (l.entrada[pieza] || 0) + 1; r.carga = null; return "ok";
      }
      if (l.clase === "banda") {
        if (pieza !== "missile" || !l.encendida) return "rechazado";
        const ultimo = l.piezas[l.piezas.length - 1];
        if (ultimo && ultimo.s < BANDA.paso) return "lleno";
        l.piezas.push({ pieza, s: 0 }); r.carga = null; return "ok";
      }
      if (l.clase === "arsenal") {
        if (pieza !== "missile") return "rechazado";
        if (l.misiles >= ARSENAL.cap) return "lleno";
        l.misiles++; l.aMano++; cobrar(); r.carga = null; return "ok";
      }
      return "rechazado";
    }
    function montacargasRecoge(r, l) {
      if (l.clase === "lugar" || l.clase === "bahia") {
        const t = tarimaDe(m, l);
        if (!t) return "viaje_vacio";
        l.tarima = null; t.en = r.id; r.carga = { tipo: "tarima", id: t.id }; return "ok";
      }
      if (l.clase === "pila") {
        const t = { id: `T${m.sigTarima++}`, piezas: [], en: r.id };
        m.tarimas.push(t); m.tarimaPorId[t.id] = t; r.carga = { tipo: "tarima", id: t.id }; return "ok";
      }
      if (esMaquina(l)) {
        if (MAQUINAS[l.clase].peso > ROBOT.montacargas.cargaMax) return "muy_pesado";
        if (l.proceso || l.cambio) return "ocupado";
        if (l.pad) m.porId[l.pad].maquina = null;
        l.pad = null; l.enVilo = true; r.carga = { tipo: "maquina", id: l.id }; return "ok";
      }
      return "rechazado";
    }
    function montacargasEntrega(r, l) {
      const c = r.carga;
      if (c.tipo === "tarima") {
        const t = m.tarimaPorId[c.id];
        if (l.clase === "lugar" || l.clase === "bahia") {
          if (l.tarima) return "ocupado";
          l.tarima = t.id; t.en = l.id; r.carga = null; return "ok";
        }
        if (l.clase === "pila") {
          if (t.piezas.length) return "rechazado";
          m.tarimas.splice(m.tarimas.indexOf(t), 1); delete m.tarimaPorId[t.id]; r.carga = null; return "ok";
        }
        return "rechazado";
      }
      if (l.clase !== "pad") return "rechazado";
      if (l.maquina) return "ocupado";
      const q = m.porId[c.id];
      l.maquina = q.id; q.pad = l.id; q.cx = l.cx; q.cy = l.cy; q.enVilo = false; r.carga = null; return "ok";
    }

    // --- Modos: se aplican al instante ---
    function aplicarModo(id, verbo, args) {
      const e = m.porId[id];
      if (!e || !e.presente) return "no_disponible";
      if ((esMaquina(e) || e.clase === "banda") && !e.encendida) return "apagada";
      if (verbo === "start" || verbo === "stop") { e.marcha = verbo === "start"; return "ok"; }
      if (verbo === "light") { e.luz = args[0] === "off" ? "off" : args[0]; return "ok"; }
      if (verbo === "setRecipe") {
        const destino = e.cambio ? e.cambio.a : e.receta;
        if (destino === args[0]) return "ok";
        if (e.proceso || e.cambio) return "ocupado";
        e.cambio = { a: args[0], falta: MAQUINAS[e.clase].cambio, total: MAQUINAS[e.clase].cambio };
        return "ok";
      }
      if (verbo === "request") {
        const pieza = args[0], coste = COSTE[pieza];
        if (e.pedidos.length >= PEDIDO.cola) return "ocupado";
        if (m.presupuesto < coste) return "sin_fondos";
        m.presupuesto -= coste; m.gastado += coste; m.pedidos++;
        const antes = e.pedidos[e.pedidos.length - 1];
        e.pedidos.push({ pieza, n: PEDIDO.n, pide: m.t, llega: r2(Math.max(m.t, antes ? antes.llega : 0) + PEDIDO.espera) });
        return "ok";
      }
      return "rechazado";
    }
    // Los programas dejaron de correr: las luces vuelven a su cableado (el sensor de salida).
    function soltarLuces() { for (const q of m.estaciones) q.luz = null; }

    // --- Paso fijo ---
    function cobrar() { m.presupuesto += ARSENAL.pago; m.ingresado += ARSENAL.pago; }
    function pasoRobot(r, dt) {
      const t = r.tarea;
      if (!t) return;
      if (t.fase === "ir") {
        const dx = t.x - r.cx, dy = t.y - r.cy, d = Math.hypot(dx, dy), mov = ROBOT[r.clase].vel * dt;
        if (d > mov + 1e-9) { r.cx += dx / d * mov; r.cy += dy / d * mov; r.rumbo = Math.atan2(dy, dx); r.st.metros += mov; return; }
        r.cx = t.x; r.cy = t.y; r.st.metros += d; t.fase = "op";
        if (t.op > 1e-9) return;  // la operación empieza en el paso siguiente
      } else t.op -= dt;
      if (t.op <= 1e-9) { r.tarea = null; terminarOrden(r.id, t.id, resolver(r, t)); }
    }
    function tiene(q, R) { for (const [p, n] of Object.entries(R.entra)) if ((q.entrada[p] || 0) < n) return false; return true; }
    function pasoMaquina(q, dt, factor) {
      if (!q.encendida || q.enVilo) return;
      if (q.cambio) {
        q.cambio.falta -= dt;
        if (q.cambio.falta <= 1e-9) { q.receta = q.cambio.a; q.cambio = null; }
        return;
      }
      if (q.proceso) {
        q.proceso.prog += dt * factor; q.st.tTrabajo += dt;
        const R = RECETAS[q.proceso.receta];
        if (q.proceso.prog >= R.t - 1e-9) {
          q.salida.push(R.sale); q.hechos++; q.st.ciclos++; q.proceso = null;
          m.producidos[R.sale] = (m.producidos[R.sale] || 0) + 1;
        }
      }
      if (!q.proceso && q.marcha) {
        const R = RECETAS[q.receta];
        if (q.salida.length >= capSalida(q)) q.st.tBloqueo += dt;
        else if (!tiene(q, R)) q.st.tSinMaterial += dt;
        else {
          for (const [p, n] of Object.entries(R.entra)) q.entrada[p] -= n;
          q.proceso = { receta: q.receta, prog: 0 };
        }
      }
    }
    function pasoBanda(b, dt, factor) {
      if (!b || !b.presente || !b.marcha) return;
      const avance = BANDA.vel * dt * factor, ars = m.arsenal;
      for (let i = 0; i < b.piezas.length; i++) {
        const lim = i === 0 ? b.largo : b.piezas[i - 1].s - BANDA.paso;
        b.piezas[i].s = Math.max(b.piezas[i].s, Math.min(lim, b.piezas[i].s + avance));
      }
      if (b.piezas.length && b.piezas[0].s >= b.largo - 1e-9 && ars.misiles < ARSENAL.cap) {
        b.piezas.shift(); ars.misiles++; ars.porBanda++; b.st.movidos++; cobrar();
      }
      // La banda toma sola los misiles terminados de la ensambladora.
      const asm = m.porId["ASM-01"], ultimo = b.piezas[b.piezas.length - 1];
      if (asm && asm.encendida && (!ultimo || ultimo.s >= BANDA.paso)) {
        const k = asm.salida.indexOf("missile");
        if (k >= 0) { asm.salida.splice(k, 1); b.piezas.push({ pieza: "missile", s: 0 }); }
      }
    }
    function pasoBahia(b) {
      const p = b.pedidos[0];
      if (!p || m.t < p.llega - 1e-9 || b.tarima) return;
      b.pedidos.shift();
      const t = { id: `T${m.sigTarima++}`, piezas: Array(p.n).fill(p.pieza), en: b.id };
      m.tarimas.push(t); m.tarimaPorId[t.id] = t; b.tarima = t.id;
      registrar(b.id, null, `entrega: ${p.n} × ${p.pieza}`, "ok", "sensor");
      if (hooks.entrega) hooks.entrega(b, p);
    }
    // La bodega abastece a las torretas de la muralla: el consumidor militar de la fábrica.
    function pasoArsenal(dt) {
      const ars = m.arsenal;
      if (m.hito < 5 || !ars.misiles || (m.salva && !m.salva.hecha)) return;
      m.tSuministro += dt;
      if (m.tSuministro < ARSENAL.suministro) return;
      const t = [...m.torretas].sort((a, b) => a.misiles - b.misiles)[0];
      if (t && t.misiles < TORRETA.cap) { t.misiles++; ars.misiles--; m.tSuministro = 0; }
    }
    function pasoSalva() {
      const s = m.salva;
      for (const mi of m.misiles) if (!mi.hecho && m.t >= mi.t0 + mi.dur - 1e-9) { mi.hecho = true; m.explosiones.push({ t0: m.t, x: mi.x1, y: mi.y1, z: mi.z1 }); }
      if (m.misiles.some(mi => mi.hecho)) m.misiles = m.misiles.filter(mi => !mi.hecho);
      if (m.explosiones.length) m.explosiones = m.explosiones.filter(x => m.t - x.t0 < 0.8);
      if (!s || s.hecha || m.t < s.sig - 1e-9) return;
      const con = m.torretas.filter(t => t.misiles > 0);
      if (!con.length) { s.hecha = true; if (hooks.salva) hooks.salva(s); return; }
      const t = con[s.n % con.length], d = def.mapa.dianas[s.n % def.mapa.dianas.length];
      t.misiles--; t.lanzados++; t.yaw = Math.atan2(d.y - t.cy, d.x - t.cx);
      const dist = Math.hypot(d.x - t.cx, d.y - t.cy);
      m.misiles.push({ id: m.sigMisil++, x0: t.cx, y0: t.cy, z0: TORRETA.alto, x1: d.x, y1: d.y, z1: 0, t0: m.t, dur: dist / TORRETA.vel, arco: 2.5 });
      s.n++; s.sig = m.t + TORRETA.cadencia;
    }
    // Salva de prueba: las torretas disparan a las dianas lo que les dio la bodega.
    function salva() {
      if (m.salva && !m.salva.hecha) return false;
      if (!m.torretas.some(t => t.misiles > 0)) return false;
      m.salva = { sig: m.t + 1, n: 0, hecha: false };
      return true;
    }

    function paso(dt) {
      m.t += dt;
      for (const r of m.robots) pasoRobot(r, dt);
      for (const r of m.robots) if (r.carga && r.carga.tipo === "maquina") { const q = m.porId[r.carga.id]; q.cx = r.cx; q.cy = r.cy; }
      let uso = 0;
      for (const q of m.estaciones) if (q.proceso) uso += MAQUINAS[q.clase].kw;
      const b = m.banda;
      if (b && b.presente && b.marcha && b.piezas.length) uso += BANDA.kw;
      const factor = uso > m.energia.max ? m.energia.max / uso : 1;
      m.energia.uso = uso; m.energia.factor = factor;
      for (const q of m.estaciones) pasoMaquina(q, dt, factor);
      pasoBanda(b, dt, factor);
      pasoBahia(m.bahia);
      pasoArsenal(dt);
      pasoSalva();
      evaluar();
    }

    // --- Hitos ---
    function empezarHito(n) {
      indexar(m);
      const al = def.hitos[n].alEmpezar || {};
      for (const g of al.entregas || []) {
        const b = m.porId[g.lugar], antes = b.pedidos[b.pedidos.length - 1];
        b.pedidos.push({ pieza: g.pieza, n: g.n, pide: m.t, llega: r2(Math.max(m.t, antes ? antes.llega : 0) + PEDIDO.programada), programada: true });
      }
    }
    function evaluar() {
      if (m.completado || !metas(m).every(x => x.cumplida)) return;
      const hecho = m.hito;
      m.hitosT[hecho] = r2(m.t);
      m.presupuesto += def.premioHito; m.ingresado += def.premioHito;
      if (hecho + 1 < def.hitos.length) { m.hito = hecho + 1; empezarHito(m.hito); }
      else { m.completado = true; salva(); }
      if (hooks.hito) hooks.hito({ hecho, siguiente: m.completado ? null : m.hito, completado: m.completado });
    }
    // Nada puede cambiar ya: sin tareas, procesos, cambios, pedidos, banda en marcha ni salva.
    function quieto() {
      if (m.robots.some(r => r.tarea) || m.misiles.length || (m.salva && !m.salva.hecha) || m.bahia.pedidos.length) return false;
      for (const q of m.estaciones) {
        if (q.proceso || q.cambio) return false;
        if (q.encendida && !q.enVilo && q.marcha && q.salida.length < capSalida(q) && tiene(q, RECETAS[q.receta])) return false;
      }
      const b = m.banda;
      if (b && b.presente && b.marcha) {
        if (b.piezas.some((x, i) => x.s < (i === 0 ? b.largo : b.piezas[i - 1].s - BANDA.paso) - 1e-6)) return false;
        if (b.piezas.length && m.arsenal.misiles < ARSENAL.cap) return false;
        const asm = m.porId["ASM-01"]; if (asm && asm.salida.includes("missile")) return false;
      }
      if (m.hito >= 5 && m.arsenal.misiles && m.torretas.some(t => t.misiles < TORRETA.cap)) return false;
      return true;
    }
    return { paso, iniciarOrden, cancelarTareas, aplicarModo, soltarLuces, evaluar, salva, quieto,
      instantanea: () => instantanea(m), metas: () => metas(m), cuantos: (id, pieza) => cuantos(m, id, pieza) };
  }

  window.CAMPAIGN = {
    VERSION, crear, conectar, serializar, indexar, instantanea, validar, modoEnSnap, metas, cuantos, enLotes, estadoMaquina, totalEntrada,
    esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS, ROBOT, BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO,
  };
})();
