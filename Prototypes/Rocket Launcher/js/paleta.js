/* Catálogo de atajos del juego; cada llamada crea una lista independiente. */
(() => {
  "use strict";
  function crear({ sensor = () => null } = {}) {
    const ATAJOS = [
      { ico: "comentar", t: "Comentar", cod: "// …  (Ctrl+/)", comentar: true },
      "|",
      { ico: "whileTrue", t: "While true", b: "while (true) {\n  \n  await esperar(0.5);\n}", envolvente: ["while (true) {\n", "\n}"], variantes: [
        { ico: "mientras", t: "While", b: "while (/* condición */) {\n  \n  await esperar(0.5);\n}", envolvente: ["while (/* condición */) {\n", "\n}"] },
        { ico: "para", t: "For", b: "for (let i = 0; i < 3; i++) {\n  \n}", envolvente: ["for (let i = 0; i < 3; i++) {\n", "\n}"] },
        { ico: "hacer", t: "Do … while", b: "do {\n  \n  await esperar(0.5);\n} while (/* condición */);", envolvente: ["do {\n", "\n} while (/* condición */);"] },
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
      { ico: "esperar", t: "Esperar", b: "await esperar(0.5);" },
      { ico: "variable", t: "Variable", enLinea: "const pos = ", variantes: [
        { ico: "variableLet", t: "Variable que cambia (let)", enLinea: "let valor = " },
        { ico: "asignar", t: "Asignar (=)", operador: "=" },
      ] },
      "|",
      { ico: "apuntar", t: "Apuntar", b: "const pos = autoTarget(/* tipo de enemigo */, /* sensor */);" },
      { ico: "disparo", t: "Disparo", b: "regularShoot(/* lugar */);" },
      { ico: "rafaga", t: "Ráfaga", b: "burstFire(/* lugar */);" },
      { ico: "detener", t: "Detener", b: "stopFire();" },
      { ico: "sensor", t: "Sensor de vibración", b: () => `const pos = ${sensor()}.detect(/* tipo de enemigo */);`, si: () => !!sensor() },
      "|",
      { ico: "aviso", t: "Aviso", b: "console.warn(/* mensaje */);", variantes: [
        { ico: "registro", t: "Registro (console.log)", b: "console.log(/* mensaje */);" },
        { ico: "info", t: "Info (console.info)", b: "console.info(/* mensaje */);" },
        { ico: "errorCons", t: "Error (console.error)", b: "console.error(/* mensaje */);" },
      ] },
    ];
    const textoAtajo = (a) => typeof a.b === "function" ? a.b() : a.b;
    return { atajos: ATAJOS, textoAtajo };
  }
  window.CMGPaleta = { crear };
})();
