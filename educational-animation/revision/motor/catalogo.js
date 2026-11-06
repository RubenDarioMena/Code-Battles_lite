/* Catálogo del modo revisión · qué objetos, funciones y propiedades tiene el juego.
 *
 * Es lo único que hay que ampliar cuando el juego crece: cada máquina o robot nuevo se registra una vez con
 * CMGCatalogo.registrar({ … }) y añade sus frases en textos.js (español e inglés). Desde ese momento sus
 * lecturas y órdenes se explican solas en el diagrama, en la narración y en la tarjeta «¿qué es?».
 *
 *   registrar({
 *     clave,                    identificador interno; sus textos van en revision.cat.<clave>.*
 *     patron,                   RegExp del nombre en el programa (LAU_01, VIB_01, console…), o null
 *     idDe(nombre)              nombre en el programa → id del juego (LAU_02 → LAU-02)
 *     propias: ['war'],         series donde sus funciones y propiedades se usan sin objeto (de la máquina dueña)
 *     propiedades: { nombre: { tipo: 'booleano'|'numero'|'texto'|'lugar'|'lista' } },
 *     metodos:     { nombre: { clase: 'lectura'|'orden'|'espera'|'consola', args: [{ grupo? }],
 *                              resultados: ['ok', …], resultadosDe?: 'lanzador', nulo?: true, textos?: 'otroNombre' } },
 *   })
 *
 * Textos de cada miembro (revision.cat.<clave>.<miembro>.<campo>):
 *   propiedad: que, nota?; si es booleana además si, no, pregunta, preguntaNo ({s} = la máquina).
 *   método:    hace, etiqueta ({0}, {1}… = argumentos), corta? (para dentro de una expresión), arg0…,
 *              resultado.<valor> (o revision.cat.<resultadosDe>.resultado.<valor>), resultado.null si nulo, nota?.
 * Los argumentos con grupo usan revision.cat.grupo.<grupo>.<valor> y su .detalle. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CMGCatalogo = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";
  const tipos = [];
  const grupos = { enemigo: ["drone", "stealth", "crawler"], sensor: ["visual", "thermal"] };

  function registrar(def) {
    const tipo = { patron: null, idDe: (n) => n, propias: [], propiedades: {}, metodos: {}, ...def };
    for (const [n, m] of Object.entries(tipo.propiedades)) m.miembro = m.miembro || n;
    for (const [n, m] of Object.entries(tipo.metodos)) { m.miembro = m.textos || m.miembro || n; m.args = m.args || []; m.resultados = m.resultados || []; }
    const i = tipos.findIndex(t => t.clave === def.clave);
    if (i >= 0) tipos[i] = tipo; else tipos.push(tipo);
    return tipo;
  }

  // Claves de texto de un miembro y de los grupos de valores.
  const clave = (tipo, miembro, campo) => `cat.${tipo.clave}.${miembro.miembro || miembro}.${campo}`;
  const claveResultado = (tipo, m, v) => m.resultadosDe ? `cat.${m.resultadosDe}.resultado.${v}` : clave(tipo, m, `resultado.${v}`);
  const claveGrupo = (grupo, v, detalle) => `cat.grupo.${grupo}.${v}${detalle ? ".detalle" : ""}`;
  // Todas las claves que un tipo necesita: las pruebas comprueban que existen en los dos idiomas.
  function clavesDe(tipo) {
    const out = [`cat.${tipo.clave}.nombre`, `cat.${tipo.clave}.descripcion`];
    for (const p of Object.values(tipo.propiedades)) {
      out.push(clave(tipo, p, "que"));
      if (p.tipo === "booleano") for (const c of ["si", "no", "pregunta", "preguntaNo"]) out.push(clave(tipo, p, c));
    }
    for (const m of Object.values(tipo.metodos)) {
      out.push(clave(tipo, m, "hace"), clave(tipo, m, "etiqueta"));
      m.args.forEach((a, k) => { out.push(clave(tipo, m, `arg${k}`)); if (a.grupo) for (const v of grupos[a.grupo]) out.push(claveGrupo(a.grupo, v), claveGrupo(a.grupo, v, true)); });
      for (const v of m.resultados) out.push(claveResultado(tipo, m, v));
      if (m.nulo) out.push(clave(tipo, m, "resultado.null"));
    }
    return [...new Set(out)];
  }

  // ---------- Lanzador (War) ----------
  const ORDEN = ["ok", "atascado", "sin_objetivo", "sin_misiles"];
  registrar({
    clave: "lanzador", patron: /^LAU_\d+$/, idDe: (n) => n.replace(/_/g, "-"), propias: ["war"],
    propiedades: {
      jammed: { tipo: "booleano" }, failureRate: { tipo: "numero" }, missiles: { tipo: "numero" }, mode: { tipo: "texto" },
      fireRate: { tipo: "numero" }, target: { tipo: "lugar" }, sensors: { tipo: "lista" },
    },
    metodos: {
      autoTarget: { clase: "lectura", args: [{ grupo: "enemigo" }, { grupo: "sensor" }], nulo: true },
      regularShoot: { clase: "orden", args: [{}], resultados: ORDEN, resultadosDe: "lanzador" },
      burstFire: { clase: "orden", args: [{}], resultados: ORDEN, resultadosDe: "lanzador" },
      stopFire: { clase: "orden", args: [], resultados: ["ok"], resultadosDe: "lanzador" },
    },
  });

  // ---------- Red de sensores (War) ----------
  registrar({
    clave: "vibracion", patron: /^VIB_\d+$/, idDe: (n) => n.replace(/_/g, "-"),
    propiedades: { count: { tipo: "numero" } },
    metodos: { detect: { clase: "lectura", args: [{ grupo: "enemigo" }], nulo: true } },
  });

  // ---------- Tiempo y consola (comunes) ----------
  registrar({ clave: "tiempo", propias: ["war", "libre"], metodos: { esperar: { clase: "espera", args: [{}], resultados: ["ok"] } } });
  registrar({
    clave: "consola", patron: /^console$/,
    metodos: { log: { clase: "consola", args: [{}] }, info: { clase: "consola", args: [{}] }, warn: { clase: "consola", args: [{}] }, error: { clase: "consola", args: [{}] } },
  });

  // ---------- Robot de Factory (aún sin grabación de muestra) ----------
  const robot = registrar({
    clave: "robot", patron: /^yo$/, idDe: () => "R1", propias: ["factory"],
    metodos: {
      recoger: { clase: "orden", args: [{}, {}] }, entregar: { clase: "orden", args: [{}] },
      cuantos: { clase: "lectura", args: [{}, {}] }, esperar: { clase: "espera", args: [{}] },
    },
  });
  // El juego acepta también los nombres en inglés: mismos textos.
  Object.assign(robot.metodos, { pickUp: robot.metodos.recoger, deliver: robot.metodos.entregar, count: robot.metodos.cuantos, wait: robot.metodos.esperar });

  // ---------- Consultas ----------
  // Tipo de un objeto por su nombre en el programa (LAU_02 → lanzador).
  const tipoDeObjeto = (nombre) => tipos.find(t => t.patron && t.patron.test(nombre)) || null;
  // Función o propiedad usada sin objeto: de la máquina dueña del programa (o común, como esperar).
  function propia(nombre, serie, clase) {
    for (const t of tipos) {
      if (t.propias.length && !t.propias.includes(serie)) continue;
      if (clase !== "propiedad" && Object.hasOwn(t.metodos, nombre)) return { tipo: t, def: t.metodos[nombre] };
      if (clase !== "metodo" && Object.hasOwn(t.propiedades, nombre) && t.propias.includes(serie)) return { tipo: t, def: t.propiedades[nombre] };
    }
    return null;
  }
  // Un valor que es un enemigo del juego ({ id, tipo, x, y }) → grupo y valor para nombrarlo.
  const esEnemigo = (v) => !!(v && typeof v === "object" && v.id && grupos.enemigo.includes(v.tipo) && "x" in v);

  return { registrar, tipos, grupos, tipoDeObjeto, propia, clave, claveResultado, claveGrupo, clavesDe, esEnemigo };
});
