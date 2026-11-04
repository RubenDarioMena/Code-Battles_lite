/* Catálogo de atajos del juego; cada llamada crea una lista independiente. */
(() => {
  "use strict";
  function crear({ pausa = "" } = {}) {
    const ATAJOS = [
      { ico: "comentar", t: "Comentar", cod: "// …  (Ctrl+/)", comentar: true },
      "|",
      { ico: "whileTrue", t: "While true", b: "while (true) {\n  \n}", envolvente: ["while (true) {\n", "\n}"], variantes: [
        { ico: "mientras", t: "While", b: "while (/* condición */) {\n  \n}", envolvente: ["while (/* condición */) {\n", "\n}"] },
        { ico: "para", t: "For", b: "for (let i = 0; i < 3; i++) {\n  \n}", envolvente: ["for (let i = 0; i < 3; i++) {\n", "\n}"] },
        { ico: "hacer", t: "Do … while", b: "do {\n  \n} while (/* condición */);", envolvente: ["do {\n", "\n} while (/* condición */);"] },
        { ico: "salir", t: "Salir del bucle", b: "break;" },
      ] },
      { ico: "siNo", t: "If / else", b: "if (/* condición */) {\n  \n} else {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n} else {\n  \n}"], variantes: [
        { ico: "si", t: "If", b: "if (/* condición */) {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n}"] },
        { ico: "siSino", t: "If / else if", b: "if (/* condición */) {\n  \n} else if (/* condición */) {\n  \n} else {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n} else if (/* condición */) {\n  \n} else {\n  \n}"] },
      ] },
      { ico: "plan", t: "Si no hay (??)", operador: "??", variantes: [
        { ico: "y", t: "Y (&&)", operador: "&&", hueco: "condición" },
        { ico: "o", t: "O (||)", operador: "||", hueco: "condición" },
        { ico: "no", t: "No (!)", operador: "!", prefijo: true },
        { ico: "igual", t: "Igual (===)", operador: "===" },
        { ico: "distinto", t: "Distinto (!==)", operador: "!==" },
        { ico: "mayor", t: "Mayor (>)", operador: ">" },
        { ico: "menor", t: "Menor (<)", operador: "<" },
      ] },
      { ico: "variable", t: "Variable", enLinea: "const pos = ", variantes: [
        { ico: "variableLet", t: "Variable que cambia (let)", enLinea: "let valor = " },
        { ico: "asignar", t: "Asignar (=)", operador: "=" },
      ] },
      "|",
      { ico: "aviso", t: "Aviso", b: "console.warn(/* mensaje */);", variantes: [
        { ico: "registro", t: "Registro (console.log)", b: "console.log(/* mensaje */);" },
        { ico: "info", t: "Info (console.info)", b: "console.info(/* mensaje */);" },
        { ico: "errorCons", t: "Error (console.error)", b: "console.error(/* mensaje */);" },
      ] },
    ];
    const textoAtajo = (a) => typeof a.b === "function" ? a.b() : a.b;
    if (pausa) for (const a of ATAJOS.flatMap(a => a === "|" ? [] : [a, ...(a.variantes || [])])) {
      if (["whileTrue", "mientras", "hacer"].includes(a.ico)) a.b = a.b.replace("\n}", "\n  " + pausa + "\n}");
    }
    return { atajos: ATAJOS, textoAtajo };
  }
  window.CMGPlantillasJS = { crear };
})();
