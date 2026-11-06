/* Catálogo del modo revisión · qué significa cada objeto, función y propiedad del juego.
 *
 * Es la única parte que hay que ampliar cuando el juego crece: cada máquina o robot nuevo se registra con
 * CMGCatalogo.registrar({ … }) y desde ese momento sus llamadas y lecturas se explican solas.
 *
 *   registrar({
 *     clave, nombre,            identificador interno y nombre para personas («lanzador»)
 *     patron,                   RegExp del nombre en el programa (LAU_01, VIB_01, console, yo…)
 *     idDe(nombre)              nombre en el programa → id del juego (LAU_02 → LAU-02)
 *     descripcion,              una frase: qué es esta máquina
 *     propias: ['war'],         serie en la que sus funciones y propiedades se usan sin objeto (son de la máquina dueña)
 *     propiedades: { nombre: { que, frase(sujeto), valor(v), tipo, nota } },
 *     metodos:     { nombre: { clase: 'lectura'|'orden'|'espera'|'consola', rol, args: [{ que, valores }], hace,
 *                              resultado(v, args), resultados: { texto: explicación } } },
 *   })
 *
 * rol = color del papel en la interfaz: cond (amarillo), sensor (azul), otra (cian), propia (morado),
 * orden (cobre), espera (rosa), dato (azul claro), salida (verde). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CMGCatalogo = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";
  const tipos = [];
  const coma = (v, d = 2) => typeof v === "number" ? String(+v.toFixed(d)).replace(".", ",") : String(v);
  const pct = (v) => typeof v === "number" ? `${coma(v * 100, 1)} %` : String(v);

  const ENEMIGOS = { drone: "dron", stealth: "dron frío", crawler: "oruga" };
  const ARTICULO = { drone: "el", stealth: "el", crawler: "la" };
  const ENEMIGOS_DETALLE = {
    drone: "dron: vuela a 2,5 m y cae con 1 impacto",
    stealth: "dron frío: el sensor térmico no lo ve, solo la cámara",
    crawler: "oruga: va por el suelo, lenta; algunas van blindadas y necesitan 3 impactos",
  };
  const SENSORES = { visual: "cámara", thermal: "térmico" };
  const SENSORES_DETALLE = { visual: "cámara: alcance 14 casillas (5,5 con niebla)", thermal: "térmico: alcance 11 casillas (7 con niebla); no ve drones fríos" };
  const lugar = (v) => v && typeof v === "object" ? `(${coma(v.x, 1)}; ${coma(v.y, 1)})` : String(v);
  const objetivo = (v) => v == null ? "null" : v && v.id ? `${ENEMIGOS[v.tipo] || "enemigo"} ${v.id} en ${lugar(v)}` : lugar(v);

  function registrar(def) {
    const i = tipos.findIndex(t => t.clave === def.clave);
    const tipo = { propiedades: {}, metodos: {}, propias: [], idDe: (n) => n, ...def };
    if (i >= 0) tipos[i] = tipo; else tipos.push(tipo);
    return tipo;
  }

  // ---------- Lanzador (War) ----------
  const ORDEN_RESULTADOS = {
    ok: "el lanzador acepta la orden y dispara a ese lugar hasta recibir otra",
    atascado: "el lanzador está atascado: la orden queda puesta, pero no dispara hasta que lo reparen",
    sin_objetivo: "recibió null (no había objetivo): el lanzador se queda parado",
    sin_misiles: "no quedan misiles en el cargador: dispara cuando llegue el suministro",
  };
  registrar({
    clave: "lanzador", nombre: "lanzador", patron: /^LAU_\d+$/, idDe: (n) => n.replace(/_/g, "-"), propias: ["war"],
    descripcion: "Lanzador de misiles. Cada lanzador tiene su propio programa: puede leer a los demás, pero solo se da órdenes a sí mismo.",
    propiedades: {
      jammed: { tipo: "booleano", rol: "otra", que: "indica si el lanzador está atascado (true) o funciona (false)", frase: (s) => `${s} está atascado`, no: (s) => `${s} funciona`,
        valor: (v) => v ? "está atascado: no dispara hasta que el robot reparador lo arregle" : "funciona",
        nota: "Pasa a true cuando un disparo falla. El robot reparador va hasta él; la reparación tarda 1,5 s más 12 × el failureRate que tenía al fallar." },
      failureRate: { tipo: "numero", rol: "propia", que: "su probabilidad de atasco por disparo", frase: (s) => `el failureRate de ${s}`,
        valor: (v) => `${coma(v, 3)} (${pct(v)} por disparo)`,
        nota: "En ráfaga sube 0,06 por segundo. Disparando normal baja 0,1 por segundo; parado o atascado, 0,2. Nunca baja de 0,02." },
      missiles: { tipo: "numero", rol: "propia", que: "los misiles que le quedan en el cargador", frase: (s) => `los misiles de ${s}`, valor: (v) => `${v} misiles` },
      mode: { tipo: "texto", rol: "propia", que: "su modo de disparo", frase: (s) => `el modo de ${s}`,
        valor: (v) => ({ idle: "parado", regular: "disparo normal", burst: "ráfaga" }[v] || String(v)) },
      fireRate: { tipo: "numero", rol: "propia", que: "los disparos por segundo", frase: (s) => `la cadencia de ${s}`, valor: (v) => `${coma(v, 1)} por segundo` },
      target: { tipo: "lugar", rol: "propia", que: "el lugar al que dispara", frase: (s) => `el objetivo de ${s}`, valor: (v) => v ? lugar(v) : "ninguno" },
      sensors: { tipo: "lista", rol: "propia", que: "los sensores que lleva montados", frase: (s) => `los sensores de ${s}`, valor: (v) => Array.isArray(v) ? v.map(x => SENSORES[x] || x).join(" y ") : String(v) },
    },
    metodos: {
      autoTarget: { clase: "lectura", rol: "sensor", args: [{ que: "tipo de enemigo", valores: ENEMIGOS_DETALLE }, { que: "sensor", valores: SENSORES_DETALLE }],
        hace: "busca, con ese sensor, el enemigo de ese tipo más avanzado (el más cerca de la base) y predice dónde estará cuando llegue el misil. Mira solo en ese instante: no espera ni dispara",
        frase: (a) => `${ARTICULO[a[0]] || "el"} ${ENEMIGOS[a[0]] || a[0] || "enemigo"} más avanzad${ARTICULO[a[0]] === "la" ? "a" : "o"} que ve ${a[1] === "thermal" ? "el térmico" : "la cámara"}`,
        resultado: (v) => v == null ? "null: no ve ninguno" : objetivo(v),
        nota: "Ignora a los enemigos que ya tienen en el aire misiles suficientes para derribarlos." },
      regularShoot: { clase: "orden", rol: "orden", args: [{ que: "lugar" }],
        hace: "pone al lanzador a disparar a ese lugar, 1 misil por segundo, y el programa sigue sin esperar",
        frase: (a, t) => `dispara normal a ${t[0] || "ese lugar"}`, resultados: ORDEN_RESULTADOS },
      burstFire: { clase: "orden", rol: "orden", args: [{ que: "lugar" }],
        hace: "pone al lanzador en ráfaga hacia ese lugar: 2,2 misiles por segundo, pero su failureRate sube mientras dure",
        frase: (a, t) => `dispara en ráfaga a ${t[0] || "ese lugar"}`, resultados: ORDEN_RESULTADOS },
      stopFire: { clase: "orden", rol: "orden", args: [], hace: "deja de disparar; parado, el failureRate baja más rápido",
        frase: () => "deja de disparar", resultados: { ok: "el lanzador se queda parado" } },
    },
  });

  // ---------- Red de sensores (War) ----------
  registrar({
    clave: "vibracion", nombre: "sensor de vibración", patron: /^VIB_\d+$/, idDe: (n) => n.replace(/_/g, "-"),
    descripcion: "Sensor de vibración de la red: escucha el suelo desde lejos. No dispara; cualquier programa puede leerlo.",
    propiedades: {
      count: { tipo: "numero", rol: "otra", que: "cuántos enemigos de suelo oye", frase: (s) => `los enemigos que oye ${s}`, valor: (v) => `${v}` },
    },
    metodos: {
      detect: { clase: "lectura", rol: "otra", args: [{ que: "tipo de enemigo", valores: ENEMIGOS_DETALLE }],
        hace: "devuelve dónde está ahora (sin predecir) el enemigo de suelo más avanzado que oye, o null",
        frase: (a, t, s) => `la ${ENEMIGOS[a[0]] || "oruga"} más avanzada que oye ${s}`,
        resultado: (v) => v == null ? "null: no oye ninguno" : `en ${lugar(v)}` },
    },
  });

  // ---------- Tiempo y consola (comunes) ----------
  registrar({
    clave: "tiempo", nombre: "tiempo", patron: null, propias: ["war"],
    metodos: {
      esperar: { clase: "espera", rol: "espera", args: [{ que: "segundos" }],
        hace: "pausa este programa ese tiempo de juego. Mientras, el mundo avanza y la máquina sigue con su última orden",
        frase: (a) => `espera ${coma(a[0])} s`, resultados: { ok: "terminó la espera; el programa sigue" } },
    },
  });
  const CONSOLA = (nivel, que) => ({ clase: "consola", rol: "salida", args: [{ que: "mensaje" }], hace: `escribe el mensaje en la consola como ${que}`, frase: (a, t) => `escribe ${t[0] || "un mensaje"} en la consola` });
  registrar({
    clave: "consola", nombre: "consola", patron: /^console$/,
    descripcion: "La consola del programa: muestra mensajes para ti; no cambia la partida.",
    metodos: { log: CONSOLA("log", "registro"), info: CONSOLA("info", "información"), warn: CONSOLA("warn", "aviso"), error: CONSOLA("error", "error") },
  });

  // ---------- Robot de Factory (ejemplo de extensión; aún sin grabación de muestra) ----------
  registrar({
    clave: "robot", nombre: "robot R1", patron: /^yo$/, idDe: () => "R1", propias: ["factory"],
    descripcion: "El robot de la fábrica: recoge material y lo entrega. Sus órdenes tardan y hay que esperarlas con await.",
    metodos: {
      recoger: { clase: "orden", rol: "orden", args: [{ que: "lugar" }, { que: "material" }], hace: "va a ese lugar y recoge una unidad del material", frase: (a, t) => `recoge ${t[1] || "material"} en ${t[0] || "un lugar"}` },
      entregar: { clase: "orden", rol: "orden", args: [{ que: "lugar" }], hace: "lleva lo que carga a ese lugar", frase: (a, t) => `entrega en ${t[0] || "un lugar"}` },
      cuantos: { clase: "lectura", rol: "sensor", args: [{ que: "lugar" }, { que: "material" }], hace: "cuenta cuánto material hay en ese lugar", frase: (a, t) => `cuánto ${t[1] || "material"} hay en ${t[0] || "ese lugar"}` },
      esperar: { clase: "espera", rol: "espera", args: [{ que: "segundos" }], hace: "el robot espera ese tiempo de juego", frase: (a) => `espera ${coma(a[0])} s` },
    },
  });
  // Nombres en inglés de las mismas órdenes del robot (el juego acepta los dos).
  { const r = tipos.find(t => t.clave === "robot"); Object.assign(r.metodos, { pickUp: r.metodos.recoger, deliver: r.metodos.entregar, count: r.metodos.cuantos, wait: r.metodos.esperar }); }

  // ---------- Consultas ----------
  // Tipo de un objeto por su nombre en el programa (LAU_02 → lanzador).
  const tipoDeObjeto = (nombre) => tipos.find(t => t.patron && t.patron.test(nombre)) || null;
  // Función o propiedad usada sin objeto: es de la máquina dueña del programa (o común, como esperar).
  function propia(nombre, serie, clase) {
    for (const t of tipos) {
      if (t.propias && t.propias.length && !t.propias.includes(serie)) continue;
      if (clase !== "propiedad" && t.metodos[nombre]) return { tipo: t, def: t.metodos[nombre] };
      if (clase !== "metodo" && t.propiedades[nombre] && t.propias.includes(serie)) return { tipo: t, def: t.propiedades[nombre] };
    }
    return null;
  }
  const valorEnemigo = (v) => ENEMIGOS_DETALLE[v] || SENSORES_DETALLE[v] || null;

  return { registrar, tipos, tipoDeObjeto, propia, coma, pct, lugar, objetivo, ENEMIGOS, SENSORES, valorEnemigo };
});
