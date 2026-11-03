/* Retos de War y normalización de su escenario propio. */
(() => {
  "use strict";
  const { TIPOS, LAU } = window.WAR;
  const COLS = 32, ROWS = 18;
  // ---------- Retos ----------
  // Las coordenadas son casillas; las oleadas entran por el borde derecho y avanzan hacia la izquierda.
  const RETOS_WAR = [
    {
      titulo: "Primer blanco",
      objetivo: "Seis orugas avanzan hacia la base. Que ninguna cruce la línea roja.",
      leccion: "Bucle con espera. autoTarget mira solo en el instante en que lo llamas.",
      pista: "autoTarget lee al instante y regularShoot configura el disparo sin esperar. await esperar deja avanzar el tiempo mientras el lanzador sigue disparando a ese mismo lugar. Mételos en while (true) { … await esperar(0.5); } para volver a apuntar.",
      lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
      oleadas: [{ tipo: "crawler", n: 6, t: 1, cada: 3.5, carriles: [9, 6, 12, 8, 11, 7] }],
      metas: { brechasMax: 0 },
      inicial: { "LAU-01": ['const pos = autoTarget("crawler", "visual");', "regularShoot(pos);"] },
    },
    {
      titulo: "Prioridades",
      objetivo: "Primero orugas lentas; luego drones rápidos que vuelan a 2,5 m. Defiende la base sin brechas.",
      leccion: "if / else o ?? para decidir a quién apuntar primero.",
      pista: "autoTarget devuelve null si no ve ese tipo. Pide primero «drone» y, si no hay, «crawler»: con if/else o con ??.",
      lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
      oleadas: [
        { tipo: "crawler", n: 7, t: 0, cada: 2.2, carriles: [8, 11, 6, 12, 9, 7, 10] },
        { tipo: "drone", n: 6, t: 10, cada: 1.4, carriles: [9, 7, 11, 5, 13, 9] },
      ],
      metas: { brechasMax: 0 },
      inicial: { "LAU-01": ["while (true) {", '  const pos = autoTarget("crawler", "visual");', "  regularShoot(pos);", "  await esperar(0.5);", "}"] },
    },
    {
      titulo: "Niebla",
      objetivo: "Con niebla la cámara ve 4,5 casillas y el térmico 7. Llegan orugas blindadas (3 impactos), drones y drones fríos, que el térmico no ve. VIB-01 escucha el suelo desde lejos.",
      leccion: "Elegir el sensor según el enemigo, y la red de sensores (VIB_01.detect).",
      pista: "Los drones fríos solo salen en la cámara. Las orugas blindadas necesitan 3 impactos: empieza antes con VIB_01.detect(\"crawler\"), que las oye lejos.",
      niebla: true,
      lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
      sensores: [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }],
      oleadas: [
        { tipo: "crawler", n: 6, t: 0, cada: 1.6, carriles: [9, 7, 11, 8, 10, 9], hp: 3 },
        { tipo: "stealth", n: 2, t: 15, cada: 3, carriles: [9, 10] },
        { tipo: "drone", n: 3, t: 20, cada: 1.8, carriles: [6, 12, 9] },
      ],
      metas: { brechasMax: 0 },
      inicial: { "LAU-01": ["while (true) {", '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");', "  regularShoot(pos);", "  await esperar(0.5);", "}"] },
    },
    {
      titulo: "Enjambre",
      objetivo: "Dos enjambres de 18 drones casi pegados; deja pasar como mucho 1. A 1 disparo por segundo no alcanza. La ráfaga dispara 2,2 por segundo, pero cada segundo en ráfaga sube failureRate, y cuanto más alto esté al fallar, más tarda REP-01 en reparar el atasco.",
      leccion: "Leer una propiedad de la máquina (failureRate) para cambiar de modo.",
      pista: "El programa de partida espera a 0,35 para parar: es tarde. Prueba ráfaga mientras failureRate esté bajo, y regularShoot o stopFire hasta que se enfríe. Mira el globo de console.warn y el tiempo de cada reparación.",
      lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
      reparadores: 1, cargador: 10, suministro: 2,
      oleadas: [
        { tipo: "crawler", n: 2, t: 0, cada: 6, carriles: [8, 10] },
        { tipo: "drone", n: 18, t: 6, cada: 0.5, carriles: [7, 9, 11, 8, 10, 12, 6, 9, 11], vel: 2.4 },
        { tipo: "drone", n: 18, t: 30, cada: 0.5, carriles: [10, 8, 12, 6, 9, 11, 7, 9, 8], vel: 2.4 },
      ],
      metas: { brechasMax: 1 },
      inicial: { "LAU-01": [
        "while (true) {",
        '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");',
        "  if (failureRate >= 0.25) {",
        "    console.warn(failureRate);",
        "  }",
        "  if (failureRate >= 0.35) {",
        "    stopFire();",
        "  } else {",
        "    burstFire(pos);",
        "  }",
        "  await esperar(0.4);",
        "}",
      ] },
    },
    {
      titulo: "Dos lanzadores",
      objetivo: "Dos enjambres a la vez, uno por el norte y otro por el sur; deja pasar como mucho 1. LAU-01 y LAU-02 tienen cada uno su programa y comparten un solo robot reparador. Si uno se atasca, el otro puede leerlo (LAU_01.jammed) y cubrirlo.",
      leccion: "Un programa por máquina; leer el estado de otra máquina.",
      pista: "Las órdenes solo valen para la máquina dueña del programa, pero puedes leer las demás: LAU_02.jammed, LAU_02.failureRate. «Copiar a los demás lanzadores» ahorra escribir dos veces.",
      lanzadores: [{ id: "LAU-01", x: 6, y: 5 }, { id: "LAU-02", x: 6, y: 13 }],
      sensores: [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }],
      reparadores: 1, cargador: 12, suministro: 1.5,
      oleadas: [
        { tipo: "crawler", n: 4, t: 0, cada: 2.5, carriles: [3, 15, 5, 13], hp: 3 },
        { tipo: "drone", n: 12, t: 10, cada: 0.4, carriles: [2, 4, 3, 5], vel: 2.4 },
        { tipo: "drone", n: 12, t: 10.2, cada: 0.4, carriles: [15, 13, 16, 14], vel: 2.4 },
        { tipo: "stealth", n: 3, t: 24, cada: 1.5, carriles: [8, 10, 9] },
      ],
      metas: { brechasMax: 1 },
      inicial: {
        "LAU-01": ["while (true) {", '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");', "  regularShoot(pos);", "  await esperar(0.5);", "}"],
        "LAU-02": ["while (true) {", '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");', "  regularShoot(pos);", "  await esperar(0.5);", "}"],
      },
    },
  ];
  const PROPIO_BASE = {
    titulo: "Tu escenario",
    objetivo: "Escribe aquí tu enunciado: qué tiene que lograr el programa.",
    leccion: "Escenario propio · se edita en la pestaña Escenario.",
    pista: "Cambia oleadas, sensores y metas en la pestaña Escenario.",
    lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
    sensores: [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }],
    reparadores: 1, cargador: 8, suministro: 1, niebla: false,
    oleadas: [
      { tipo: "crawler", n: 3, t: 0, cada: 4, carriles: [8, 10, 9] },
      { tipo: "drone", n: 6, t: 8, cada: 0.8, carriles: [7, 9, 11, 8, 10, 9] },
    ],
    metas: { brechasMax: 0 },
    inicial: {},
  };
  const POS_LANZADORES = { 1: [{ id: "LAU-01", x: 6, y: 9 }], 2: [{ id: "LAU-01", x: 6, y: 5 }, { id: "LAU-02", x: 6, y: 13 }] };

  function normalizar(d) {
    const num = (v, def, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
    const metas = { ...(d.metas || {}) };
    for (const k of ["brechasMax", "atascosMax", "derribosMin", "tiempoMax"]) metas[k] = metas[k] == null || metas[k] === "" ? null : num(metas[k], null, 0, 999);
    if (metas.brechasMax == null) metas.brechasMax = 0;
    return {
      titulo: String(d.titulo || "Tu escenario").slice(0, 60), objetivo: String(d.objetivo || ""), leccion: String(d.leccion || ""), pista: String(d.pista || ""),
      lanzadores: (d.lanzadores && d.lanzadores.length ? d.lanzadores : POS_LANZADORES[1]).slice(0, 2).map(l => ({ id: l.id, x: num(l.x, 6, 1, COLS - 2), y: num(l.y, 9, 0, ROWS - 1) })),
      sensores: (d.sensores || []).slice(0, 2).map(s => ({ id: s.id, x: num(s.x, 17, 4, COLS - 2), y: num(s.y, 9, 0, ROWS - 1), alcance: num(s.alcance, 8, 2, 16) })),
      reparadores: Math.round(num(d.reparadores, 1, 0, 3)),
      cargador: Math.round(num(d.cargador, LAU.cargador, 1, 40)),
      suministro: num(d.suministro, LAU.suministro, 0, 5),
      niebla: !!d.niebla,
      oleadas: (d.oleadas || []).filter(o => TIPOS[o.tipo]).slice(0, 12).map(o => ({
        tipo: o.tipo, n: Math.round(num(o.n, 1, 0, 40)), t: num(o.t, 0, 0, 300), cada: num(o.cada, 1, 0.1, 60),
        carriles: (Array.isArray(o.carriles) ? o.carriles : [9]).map(c => Math.round(num(c, 9, 0, ROWS - 1))),
        ...(o.hp ? { hp: Math.round(num(o.hp, 1, 1, 9)) } : {}), ...(o.vel ? { vel: num(o.vel, 1, 0.2, 5) } : {}),
      })),
      metas,
      inicial: d.inicial || {},
    };
  }

  window.WAR_RETOS = { RETOS: RETOS_WAR, PROPIO_BASE, POS_LANZADORES, normalizar };
})();
