/* Datos del juego para editores y traductores. No depende del DOM ni del runtime. */
(() => {
  "use strict";
  const robot = [
    { nombre: "pickUp", nombres: { python: "pick_up" }, alias: ["recoger"], orden: "recoger", firma: ["lugar", "material"], await: true },
    { nombre: "deliver", alias: ["entregar"], orden: "entregar", firma: ["lugar"], await: true },
    { nombre: "wait", alias: ["esperar"], orden: "esperar", firma: ["segundos"], await: true },
    { nombre: "count", alias: ["cuantos"], orden: "cuantos", firma: ["lugar", "material"], await: false },
  ];
  const lanzador = [
    { nombre: "autoTarget", nombres: { python: "auto_target" }, firma: ["tipo de enemigo", "sensor"], nota: "→ posición" },
    { nombre: "regularShoot", nombres: { python: "regular_shoot" }, firma: ["lugar"], nota: "1 disparo/s" },
    { nombre: "burstFire", nombres: { python: "burst_fire" }, firma: ["lugar"], nota: "ráfaga · sube el fallo" },
    { nombre: "stopFire", nombres: { python: "stop_fire" }, firma: [], nota: "deja de disparar" },
  ];
  // Campaign: encargos de los robots (con await) y modos de máquinas, banda y bahía (al instante).
  const planta = [
    { nombre: "pickUp", nombres: { python: "pick_up" }, alias: ["recoger"], firma: ["lugar", "material"], await: true, nota: "recoge" },
    { nombre: "deliver", alias: ["entregar"], firma: ["lugar"], await: true, nota: "entrega" },
    { nombre: "goTo", nombres: { python: "go_to" }, alias: ["irA"], firma: ["lugar"], await: true, nota: "va a un lugar" },
    { nombre: "wait", alias: ["esperar"], firma: ["segundos"], await: true, nota: "pausa el programa" },
    { nombre: "count", alias: ["cuantos"], firma: ["lugar", "material"], await: false, nota: "cuántas hay" },
    { nombre: "start", firma: [], nota: "arranca" }, { nombre: "stop", firma: [], nota: "se detiene" },
    { nombre: "light", firma: ["color"], nota: "luz" },
    { nombre: "setRecipe", nombres: { python: "set_recipe" }, firma: ["receta"], nota: "cambia de receta" },
    { nombre: "request", firma: ["materia"], nota: "pide una tarima" },
  ];
  function crear({ serie, sensores = () => [], objetos = () => [], propiedades = () => [] }) {
    function funciones() {
      const propias = serie === "campaign" ? planta.map(f => ({ grupo: "Planta", ...f })) : serie === "factory"
        ? robot.map(f => ({ grupo: "Robot", ...f }))
        : [...lanzador.map(f => ({ grupo: "Lanzador", ...f })),
          { grupo: "Tiempo", nombre: "esperar", nombres: { python: "wait" }, firma: ["segundos"], await: true, nota: "pausa el programa" },
          ...sensores().map(objeto => ({ grupo: "Red de sensores", objeto, nombre: "detect", firma: ["tipo de enemigo"], nota: "posición actual" }))];
      return [...propias, ...[["log", "registro"], ["info", "información"], ["warn", "aviso"], ["error", "error"]]
        .map(([nombre, nota]) => ({ grupo: "Consola", objeto: "console", nombre, firma: ["mensaje"], nota }))]
        .map(f => ({ ...f, firma: [...f.firma], nombres: { ...f.nombres }, alias: [...(f.alias || [])] }));
    }
    function nombres(f, lenguaje) {
      return [...new Set([f.nombre, ...(f.alias || []), ...(lenguaje === "python" && f.nombres.python ? [f.nombres.python] : [])])];
    }
    return {
      funciones,
      vocabulario(lenguaje = "js") {
        const fs = funciones();
        return { objetos: [...new Set([...objetos(), ...fs.map(f => f.objeto).filter(Boolean)])],
          funciones: [...new Set(fs.flatMap(f => nombres(f, lenguaje)))], propiedades: [...propiedades()] };
      },
      // El traductor consulta esta tabla tras resolver el ámbito; nunca reescribe por regex.
      alias(lenguaje = "js") {
        return funciones().flatMap(f => nombres(f, lenguaje).map(nombre => ({
          objeto: f.objeto || null, nombre, destino: f.nombre, orden: f.orden || f.nombre, await: !!f.await,
        })));
      },
    };
  }
  window.CMGProveedor = { crear };
})();
