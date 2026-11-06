/* plantillas.js · catálogo único de la paleta común: una entrada por botón, con el texto de cada lenguaje.
 *
 * - Un grupo es un botón con variantes: el primer elemento que existe en el lenguaje es el botón
 *   y el resto, sus variantes (mantener pulsado). Lo que un lenguaje no declara no aparece en él
 *   (do … while y ?? solo en JS; is None solo en Python).
 * - `ico` y `t` pueden ser un texto común o { js, python }. Lo demás (hueco, prefijo…) es común;
 *   `js` y `python` llevan lo propio del lenguaje (b, envolvente, operador, enLinea, cod).
 * - `pausa: true`: el bucle recibe la pausa que pida el anfitrión (War: esperar 0.5 s).
 * Añadir un lenguaje es añadir su clave en cada entrada y su forma de poner la pausa.
 *
 * Vive en este archivo (no en uno aparte) a propósito: todas las páginas ya cargan plantillas.js antes
 * que python.js, así que una caché que mezcle versiones de index.html no deja la paleta sin catálogo
 * (eso cortaba el arranque del juego: pantalla negra y paleta vacía). */
(() => {
  "use strict";
  const U = "    "; // sangría de Python
  const CATALOGO = [
    { ico: "comentar", t: "Comentar", i18n: "paleta.comentar", comentar: true, js: { cod: "// …  (Ctrl+/)" }, python: { cod: "# …  (Ctrl+/)" } },
    "|",
    { grupo: [
      { ico: "whileTrue", t: { js: "While true", python: "While True" }, i18n: "paleta.bucle.siempre", pausa: true,
        js: { b: "while (true) {\n  \n}", envolvente: ["while (true) {\n", "\n}"] },
        python: { b: "while True:\n" + U, envolvente: ["while True:\n", ""] } },
      { ico: "mientras", t: "While", i18n: "paleta.bucle.mientras", pausa: true,
        js: { b: "while (/* condición */) {\n  \n}", envolvente: ["while (/* condición */) {\n", "\n}"] },
        python: { b: "while __condicion__:\n" + U, envolvente: ["while __condicion__:\n", ""] } },
      { ico: "para", t: "For", i18n: "paleta.bucle.para",
        js: { b: "for (let i = 0; i < 3; i++) {\n  \n}", envolvente: ["for (let i = 0; i < 3; i++) {\n", "\n}"] },
        python: { b: "for i in range(3):\n" + U, envolvente: ["for i in range(3):\n", ""] } },
      { ico: "hacer", t: "Do … while", i18n: "paleta.bucle.hacer_mientras", pausa: true,
        js: { b: "do {\n  \n} while (/* condición */);", envolvente: ["do {\n", "\n} while (/* condición */);"] } },
      { ico: "salir", t: "Salir del bucle", i18n: "paleta.bucle.salir", js: { b: "break;" }, python: { b: "break" } },
    ] },
    { grupo: [
      { ico: "siNo", t: "If / else", i18n: "paleta.condicion.si_sino",
        js: { b: "if (/* condición */) {\n  \n} else {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n} else {\n  \n}"] },
        python: { b: `if __condicion__:\n${U}\nelse:\n${U}pass`, envolvente: ["if __condicion__:\n", `\nelse:\n${U}pass`] } },
      { ico: "si", t: "If", i18n: "paleta.condicion.si",
        js: { b: "if (/* condición */) {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n}"] },
        python: { b: "if __condicion__:\n" + U, envolvente: ["if __condicion__:\n", ""] } },
      { ico: "siSino", t: { js: "If / else if", python: "If / elif" }, i18n: "paleta.condicion.si_sino_si",
        js: { b: "if (/* condición */) {\n  \n} else if (/* condición */) {\n  \n} else {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n} else if (/* condición */) {\n  \n} else {\n  \n}"] },
        python: { b: `if __condicion__:\n${U}\nelif __condicion__:\n${U}pass\nelse:\n${U}pass`, envolvente: ["if __condicion__:\n", `\nelif __condicion__:\n${U}pass\nelse:\n${U}pass`] } },
    ] },
    { grupo: [
      { ico: "plan", t: "Si no hay (??)", i18n: "paleta.operador.si_no_hay", js: { operador: "??" } },
      { ico: { js: "y", python: "yPy" }, t: { js: "Y (&&)", python: "Y (and)" }, i18n: "paleta.operador.y", hueco: "condición", js: { operador: "&&" }, python: { operador: "and" } },
      { ico: { js: "o", python: "oPy" }, t: { js: "O (||)", python: "O (or)" }, i18n: "paleta.operador.o", hueco: "condición", js: { operador: "||" }, python: { operador: "or" } },
      { ico: { js: "no", python: "noPy" }, t: { js: "No (!)", python: "No (not)" }, i18n: "paleta.operador.no", prefijo: true, js: { operador: "!" }, python: { operador: "not " } },
      { ico: { js: "igual", python: "igualPy" }, t: { js: "Igual (===)", python: "Igual (==)" }, i18n: "paleta.operador.igual", js: { operador: "===" }, python: { operador: "==" } },
      { ico: { js: "distinto", python: "distintoPy" }, t: { js: "Distinto (!==)", python: "Distinto (!=)" }, i18n: "paleta.operador.distinto", js: { operador: "!==" }, python: { operador: "!=" } },
      { ico: "mayor", t: "Mayor (>)", i18n: "paleta.operador.mayor", js: { operador: ">" }, python: { operador: ">" } },
      { ico: "menor", t: "Menor (<)", i18n: "paleta.operador.menor", js: { operador: "<" }, python: { operador: "<" } },
      { ico: "esNone", t: "Es None (is None)", i18n: "paleta.operador.es_none", python: { sufijo: " is None" } },
    ] },
    { grupo: [
      { ico: "variable", t: "Variable", i18n: "paleta.variable", js: { enLinea: "const pos = " }, python: { enLinea: "pos = " } },
      { ico: "variableLet", t: "Variable que cambia (let)", i18n: "paleta.variable_cambia", js: { enLinea: "let valor = " } },
      { ico: "asignar", t: "Asignar (=)", i18n: "paleta.asignar", js: { operador: "=" }, python: { operador: "=" } },
    ] },
    "|",
    { grupo: [
      { ico: "aviso", t: "Aviso", i18n: "paleta.consola.aviso", js: { b: "console.warn(/* mensaje */);" } },
      { ico: "registro", t: { js: "Registro (console.log)", python: "Mostrar (print)" }, i18n: "paleta.consola.registro", js: { b: "console.log(/* mensaje */);" }, python: { b: "print(__mensaje__)" } },
      { ico: "info", t: "Info (console.info)", i18n: "paleta.consola.info", js: { b: "console.info(/* mensaje */);" } },
      { ico: "errorCons", t: "Error (console.error)", i18n: "paleta.consola.error", js: { b: "console.error(/* mensaje */);" } },
    ] },
    // Teléfono (movil: true): edición y signos que el teclado del móvil esconde o que sin teclado no existen. Van al
    // final de la lista para no mover los demás botones; en el teléfono la paleta los pone delante (con el modo sin
    // teclado, detrás de los bloques). `accion` es una acción de la barra de edición (edicion.js): línea nueva bajo la
    // línea actual esté donde esté el cursor, sangría (Tab) y borrar sin pasar por el portapapeles.
    { ico: "lineaNueva", t: "Línea nueva debajo", i18n: "paleta.edicion.linea_nueva", movil: true, accion: "linea", cod: "↵", js: {}, python: {} },
    { grupo: [
      { ico: "tabular", t: "Sangrar (Tab)", i18n: "paleta.edicion.sangrar", movil: true, accion: "sangrar", cod: "Tab", js: {}, python: {} },
      { ico: "desangrar", t: "Quitar sangría (Mayús+Tab)", i18n: "paleta.edicion.quitar_sangria", movil: true, accion: "desangrar", cod: "Mayús+Tab", js: {}, python: {} },
    ] },
    { ico: "borrar", t: "Borrar (sin copiar)", i18n: "paleta.edicion.borrar", movil: true, accion: "borrar", cod: "⌫", js: {}, python: {} },
    // Pares y signos. Los pares rodean lo elegido.
    { grupo: [
      { ico: "parentesis", t: "Paréntesis", i18n: "paleta.simbolo.parentesis", movil: true, simbolo: { ins: "()", sel: 1 }, cod: "( )", js: {}, python: {} },
      { ico: "corchetes", t: "Corchetes", i18n: "paleta.simbolo.corchetes", movil: true, simbolo: { ins: "[]", sel: 1 }, cod: "[ ]", js: {}, python: {} },
      { ico: "llaves", t: "Llaves", i18n: "paleta.simbolo.llaves", movil: true, simbolo: { ins: "{}", sel: 1 }, cod: "{ }", js: {}, python: {} },
      { ico: "comillas", t: "Comillas", i18n: "paleta.simbolo.comillas", movil: true, simbolo: { ins: '""', sel: 1 }, cod: '" "', js: {}, python: {} },
    ] },
    { grupo: [
      { ico: "punto", t: "Punto", i18n: "paleta.simbolo.punto", movil: true, simbolo: { ins: "." }, cod: ".", js: {}, python: {} },
      { ico: "coma", t: "Coma", i18n: "paleta.simbolo.coma", movil: true, simbolo: { ins: "," }, cod: ",", js: {}, python: {} },
      { ico: "puntoComa", t: "Punto y coma", i18n: "paleta.simbolo.punto_y_coma", movil: true, simbolo: { ins: ";" }, cod: ";", js: {}, python: {} },
      { ico: "dosPuntos", t: "Dos puntos", i18n: "paleta.simbolo.dos_puntos", movil: true, simbolo: { ins: ":" }, cod: ":", js: {}, python: {} },
    ] },
  ];
  // Cómo entra la pausa en el cuerpo de un bucle, por lenguaje.
  const PAUSA = {
    js: (b, p) => b.replace("\n}", "\n  " + p + "\n}"),
    python: (b, p) => b + "\n" + U + p,
  };
  const deLenguaje = (v, l) => v && typeof v === "object" && !Array.isArray(v) ? v[l] : v;
  function elemento(e, l, pausa) {
    const propio = e[l];
    if (!propio) return null;
    const a = { ico: deLenguaje(e.ico, l), t: deLenguaje(e.t, l) };
    for (const [k, v] of Object.entries(e)) if (!["ico", "t", "js", "python", "pausa", "grupo"].includes(k)) a[k] = v;
    Object.assign(a, JSON.parse(JSON.stringify(propio)));
    if (e.pausa && pausa && a.b) a.b = PAUSA[l](a.b, pausa);
    return a;
  }
  // Lista nueva e independiente en cada llamada, con la misma forma que esperaba la paleta.
  function atajos(lenguaje = "js", { pausa = "" } = {}) {
    if (!PAUSA[lenguaje]) throw Error("Lenguaje sin catálogo: " + lenguaje);
    const lista = [];
    for (const e of CATALOGO) {
      if (e === "|") { lista.push("|"); continue; }
      const items = (e.grupo || [e]).map(x => elemento(x, lenguaje, pausa)).filter(Boolean);
      if (!items.length) continue;
      const [principal, ...variantes] = items;
      if (variantes.length) principal.variantes = variantes;
      lista.push(principal);
    }
    return lista;
  }
  const textoAtajo = a => typeof a.b === "function" ? a.b() : a.b;
  window.CMGCatalogo = { atajos, textoAtajo, lenguajes: Object.keys(PAUSA), entradas: CATALOGO };
})();

/* Atajos JavaScript de la paleta común, desde el catálogo. Cada llamada crea una lista independiente. */
(() => {
  "use strict";
  function crear({ pausa = "" } = {}) {
    return { atajos: window.CMGCatalogo.atajos("js", { pausa }), textoAtajo: window.CMGCatalogo.textoAtajo };
  }
  window.CMGPlantillasJS = { crear };
})();
