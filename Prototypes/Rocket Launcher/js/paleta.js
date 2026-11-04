/* Plantillas específicas del juego, compuestas sobre los controles JS compartidos. */
(() => {
  "use strict";
  // Las órdenes del lanzador, escritas en JS; en Python pasan por aPython (nombres D1, huecos D4).
  const propias = (sensor) => [
    { ico: "apuntar", t: "Apuntar", b: "const pos = autoTarget(/* tipo de enemigo */, /* sensor */);" },
    { ico: "disparo", t: "Disparo", b: "regularShoot(/* lugar */);" },
    { ico: "rafaga", t: "Ráfaga", b: "burstFire(/* lugar */);" },
    { ico: "detener", t: "Detener", b: "stopFire();" },
    { ico: "sensor", t: "Sensor de vibración", b: () => `const pos = ${sensor()}.detect(/* tipo de enemigo */);`, si: () => !!sensor() }, "|"];
  function crear({ sensor = () => null } = {}) {
    const paleta = window.CMGPlantillasJS.crear({ pausa: "await esperar(0.5);" }), atajos = paleta.atajos;
    atajos.splice(atajos.findIndex(a => a.ico === "variable"), 0, { ico: "esperar", t: "Esperar", b: "await esperar(0.5);" });
    atajos.splice(atajos.findIndex(a => a.ico === "aviso"), 0, ...propias(sensor));
    return paleta;
  }
  // La misma paleta sobre las plantillas Python. En Python, esperar es wait (D1).
  function crearPython({ sensor = () => null, aPython }) {
    const paleta = window.CMGEditorPython.plantillas({ pausa: "await wait(0.5)" }), atajos = paleta.atajos;
    const py = a => a === "|" ? a : { ...a, b: typeof a.b === "function" ? () => aPython(a.b()) : aPython(a.b) };
    atajos.splice(atajos.findIndex(a => a.ico === "variable"), 0, { ico: "esperar", t: "Esperar", b: "await wait(0.5)" });
    atajos.splice(atajos.findIndex(a => a.ico === "registro"), 0, ...propias(sensor).map(py));
    return paleta;
  }
  window.CMGPaleta = { crear, crearPython };
})();
