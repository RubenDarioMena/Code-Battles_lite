/* Retos de logística procedentes del Factory original (b76411b). */
(() => {
  "use strict";
  const MATERIALES = ["cobre", "silicio"];
  const OP_JS = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "==": "===", "!=": "!==" };
  const R = (o, m) => ({ t: "recoger", origen: o, mat: m });
  const E = (d) => ({ t: "entregar", destino: d });
  const REP = (n, cuerpo) => ({ t: "repetir", n, cuerpo });
  const MIENTRAS = (cond, cuerpo) => ({ t: "mientras", cond, cuerpo });
  const BASICOS = ["recoger", "entregar", "repetir"];

  const RETOS = [
    {
      titulo: "Primer viaje",
      objetivo: "Lleva 3 de cobre de la bodega ENT-1 a la fundidora FUN.",
      leccion: "Secuencia y bucle for. await espera a que termine el viaje; las máquinas trabajan mientras tanto.",
      pista: "Cada par de bloques es un viaje. Repítelo o mételo en un «repeat».",
      ladrillos: BASICOS,
      robot: { x: 4, y: 5 },
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 3 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 3, tProceso: 3 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 3 }],
      inicial: [R("ENT-1", "cobre"), E("FUN")],
    },
    {
      titulo: "Dos materiales",
      objetivo: "ENT-1 guarda cobre y silicio. FUN necesita 3 de cobre y la ensambladora ENS, 3 de silicio.",
      leccion: "Argumentos: el segundo argumento de pickUp elige el material.",
      pista: "ENS solo acepta silicio. Si entregas algo que no acepta, R1 se queda con la carga.",
      ladrillos: BASICOS,
      robot: { x: 4, y: 3 },
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 3, silicio: 3 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 1, puerta: { x: 6, y: 1 }, acepta: "cobre", cap: 3, tProceso: 3 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 7, y: 5, puerta: { x: 6, y: 5 }, acepta: "silicio", cap: 3, tProceso: 3 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 3 }, { id: "ENS", mat: "silicio", n: 3 }],
      inicial: [REP(3, [R("ENT-1", "cobre"), E("FUN")])],
    },
    {
      titulo: "Sin entregas rechazadas",
      objetivo: "Lleva 4 de cobre a FUN y 4 de silicio a ENS sin entregas rechazadas. Cada máquina tarda 9 s por pieza y su entrada tiene un solo hueco.",
      leccion: "Orden de las instrucciones.",
      pista: "Mientras una máquina trabaja, R1 puede hacer otro viaje. También existe «wait».",
      ladrillos: [...BASICOS, "esperar"],
      robot: { x: 4, y: 3 },
      maxRechazos: 0,
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 4, silicio: 4 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 1, puerta: { x: 6, y: 1 }, acepta: "cobre", cap: 1, tProceso: 9 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 7, y: 5, puerta: { x: 6, y: 5 }, acepta: "silicio", cap: 1, tProceso: 9 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 4 }, { id: "ENS", mat: "silicio", n: 4 }],
      inicial: [REP(4, [R("ENT-1", "cobre"), E("FUN")]), REP(4, [R("ENT-1", "silicio"), E("ENS")])],
    },
    {
      titulo: "Contra reloj",
      objetivo: "Lleva 4 de cobre a FUN y 2 de silicio a ENS en 18 s de juego o menos. ENT-1 está cerca pero tiene poco cobre; ENT-2 está lejos y tiene mucho.",
      leccion: "Planificar el recorrido.",
      pista: "R1 sale desde donde terminó la orden anterior, así que el orden de los viajes importa.",
      ladrillos: [...BASICOS, "esperar"],
      robot: { x: 4, y: 4 },
      tiempoMax: 18,
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 5, y: 1, puerta: { x: 5, y: 2 }, stock: { cobre: 2, silicio: 2 } },
        { id: "ENT-2", tipo: "bodega", nombre: "Bodega", x: 1, y: 5, puerta: { x: 2, y: 5 }, stock: { cobre: 6 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 6, tProceso: 2 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 2, y: 1, puerta: { x: 2, y: 2 }, acepta: "silicio", cap: 4, tProceso: 2 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 4 }, { id: "ENS", mat: "silicio", n: 2 }],
      inicial: [REP(4, [R("ENT-2", "cobre"), E("FUN")]), REP(2, [R("ENT-1", "silicio"), E("ENS")])],
    },
    {
      titulo: "Hasta vaciar",
      nuevo: true,
      objetivo: "Llegó un camión con una cantidad de cobre que cambia en cada intento, y ENT-1 está tapada. Vacíala en FUN sin hacer ni un viaje vacío.",
      leccion: "aprendejavascript.dev · Bucles con while + Operadores de comparación. count lee al instante y no necesita await; solo pickUp, deliver y wait esperan.",
      pista: "Un «repeat» necesita saber cuántas veces. El sensor «cobre in ENT-1» lo mide antes de cada vuelta: prueba «while» con «> 0».",
      ladrillos: [...BASICOS, "mientras"],
      robot: { x: 4, y: 5 },
      maxVacios: 0,
      stockPorIntento: [7, 3, 6, 4, 5],
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 5 }, oculto: true },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 8, tProceso: 1 },
      ],
      metas: [{ tipo: "vaciar", id: "ENT-1", mat: "cobre" }],
      inicial: [REP(5, [R("ENT-1", "cobre"), E("FUN")])],
    },
    {
      titulo: "Plan B",
      nuevo: true,
      objetivo: "Vacía el MUELLE en 24 s sin entregas rechazadas. FUN tarda 6 s por pieza y solo tiene un hueco; BOD es una bodega de respaldo que acepta todo. FUN debe recibir al menos 3.",
      leccion: "aprendejavascript.dev · Condicional if/else + Operadores de comparación.",
      pista: "Antes de entregar, mira cuánto cobre espera en la entrada de FUN: si es menos de 1, entrega en FUN; si no, en BOD.",
      ladrillos: [...BASICOS, "esperar", "mientras", "si"],
      robot: { x: 4, y: 3 },
      maxRechazos: 0,
      tiempoMax: 24,
      entidades: [
        { id: "MUELLE", tipo: "bodega", nombre: "Muelle", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 6 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 2, puerta: { x: 6, y: 2 }, acepta: "cobre", cap: 1, tProceso: 6 },
        { id: "BOD", tipo: "bodega", nombre: "Respaldo", x: 7, y: 5, puerta: { x: 6, y: 5 }, stock: { cobre: 0 } },
      ],
      metas: [{ tipo: "vaciar", id: "MUELLE", mat: "cobre" }, { id: "FUN", mat: "cobre", n: 3 }],
      inicial: [MIENTRAS({ lugar: "MUELLE", mat: "cobre", op: ">", n: 0 }, [R("MUELLE", "cobre"), E("FUN")])],
    },
  ];

  // Reto propio: se edita en la pestaña Reto. Parte del mapa de «Plan B».
  const PROPIO_BASE = {
    titulo: "Tu reto",
    objetivo: "Escribe aquí tu enunciado: qué tiene que lograr el programa.",
    leccion: "Reto propio · se edita en la pestaña Reto.",
    pista: "Revisa el registro y la consola.",
    ladrillos: [...BASICOS, "esperar", "mientras", "si"],
    robot: { ...RETOS[5].robot },
    entidades: JSON.parse(JSON.stringify(RETOS[5].entidades)),
    metas: JSON.parse(JSON.stringify(RETOS[5].metas)),
    maxRechazos: 0, tiempoMax: 24, maxVacios: null,
    inicial: [],
  };
  const IDX_PROPIO = RETOS.length;
  // Valida lo que venga del formulario o de un JSON pegado.
  function normalizarReto(d) {
    const num = (v, def, min, max) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? def : Math.min(max, Math.max(min, n)); };
    const base = d && Array.isArray(d.entidades) && d.entidades.length ? d : PROPIO_BASE;
    const entidades = base.entidades.slice(0, 6).map((e, i) => {
      const c = { id: String(e.id || `E-${i + 1}`).slice(0, 8), tipo: e.tipo === "maquina" ? "maquina" : "bodega", nombre: e.nombre || (e.tipo === "maquina" ? "Máquina" : "Bodega"),
        x: num(e.x, 1, 0, 8), y: num(e.y, 1, 0, 6), puerta: { x: num(e.puerta && e.puerta.x, 2, 0, 8), y: num(e.puerta && e.puerta.y, 1, 0, 6) } };
      if (c.tipo === "bodega") {
        c.stock = {}; for (const m of MATERIALES) if (e.stock && m in e.stock) c.stock[m] = Math.round(num(e.stock[m], 0, 0, 30));
        if (!Object.keys(c.stock).length) c.stock.cobre = 0;
        if (e.oculto) c.oculto = true;
      } else Object.assign(c, { acepta: MATERIALES.includes(e.acepta) ? e.acepta : "cobre", cap: Math.round(num(e.cap, 1, 1, 8)), tProceso: num(e.tProceso, 3, 0.5, 30) });
      return c;
    });
    const ids = entidades.map(e => e.id);
    const metas = (Array.isArray(d && d.metas) ? d.metas : []).filter(m => ids.includes(m.id) && MATERIALES.includes(m.mat)).slice(0, 6)
      .map(m => m.tipo === "vaciar" ? { tipo: "vaciar", id: m.id, mat: m.mat } : { id: m.id, mat: m.mat, n: Math.round(num(m.n, 1, 1, 30)) });
    const ladrillos = ["recoger", "entregar", "repetir", "esperar", "mientras", "si"].filter(t => !d || !Array.isArray(d.ladrillos) || d.ladrillos.includes(t));
    const lim = (v) => v === "" || v == null ? null : num(v, null, 0, 300);
    return {
      titulo: String((d && d.titulo) || "Tu reto").slice(0, 50), objetivo: String((d && d.objetivo) || ""), pista: String((d && d.pista) || ""),
      leccion: "Reto propio · se edita en la pestaña Reto.",
      ladrillos: ladrillos.length ? ladrillos : BASICOS,
      robot: { x: num(base.robot && base.robot.x, 4, 0, 8), y: num(base.robot && base.robot.y, 3, 0, 6) },
      entidades, metas: metas.length ? metas : [{ id: entidades.find(e => e.tipo === "maquina")?.id || ids[0], mat: "cobre", n: 1 }],
      maxRechazos: lim(d && (d.maxRechazos ?? d.maxDerrames)), tiempoMax: lim(d && d.tiempoMax), maxVacios: lim(d && d.maxVacios),
      ...(Array.isArray(d && d.stockPorIntento) && entidades.some(e => e.oculto) ? { stockPorIntento: d.stockPorIntento.slice(0, 10).map(n => Math.round(num(n, 1, 0, 30))) } : {}),
      inicial: [],
    };
  }

  function generar(prog) {
    const lineas = [], mapa = [];
    const emit = (txt, id, nivel) => { lineas.push("  ".repeat(nivel) + txt); mapa.push(id); };
    const vars = ["i", "j", "k", "m", "n"];
    const q = (s) => JSON.stringify(s);
    const cond = (c) => `await yo.cuantos(${q(c.lugar)}, ${q(c.mat)}) ${OP_JS[c.op]} ${c.n}`;
    (function bloque(lista, nivel, prof) {
      for (const n of lista) {
        if (n.t === "recoger") emit(`await yo.recoger(${q(n.origen)}, ${q(n.mat)});`, n.id, nivel);
        else if (n.t === "entregar") emit(`await yo.entregar(${q(n.destino)});`, n.id, nivel);
        else if (n.t === "esperar") emit(`await yo.esperar(${n.s});`, n.id, nivel);
        else if (n.t === "repetir") {
          const v = vars[prof] || `i${prof}`;
          emit(`for (let ${v} = 0; ${v} < ${n.n}; ${v}++) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof + 1);
          emit("}", n.id, nivel);
        } else if (n.t === "mientras") {
          emit(`while (${cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          emit("}", n.id, nivel);
        } else if (n.t === "si") {
          emit(`if (${cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          if (n.sino.length) { emit("} else {", n.id, nivel); bloque(n.sino, nivel + 1, prof); }
          emit("}", n.id, nivel);
        }
      }
    })(prog.cuerpo, 0, 0);
    return { codigo: lineas.join("\n") + "\n", mapa };
  }


  function adaptar(reto) {
    return { ...JSON.parse(JSON.stringify(reto)), serie: "factory", mapa: { cols: 9, rows: 7 }, fin: "mundo", limite: 300, mejora: "tiempo",
      robots: [{ id: "R1", ...reto.robot }], lanzadores: [], sensores: [], reparadores: 0, oleadas: [],
      inicial: { R1: generar({ cuerpo: reto.inicial || [] }).codigo.replaceAll("await yo.recoger", "await pickUp").replaceAll("await yo.entregar", "await deliver").replaceAll("await yo.esperar", "await wait").replaceAll("await yo.cuantos", "count").trimEnd().split("\n") },
      herramientas: { programa: ["js", "pseudo", "bloques"], mapa: ["3d", "2d"] } };
  }
  window.FACTORY_RETOS = { RETOS: RETOS.map(adaptar), propio: adaptar(PROPIO_BASE), normalizar: d => adaptar(normalizarReto(d)), generar };
})();
