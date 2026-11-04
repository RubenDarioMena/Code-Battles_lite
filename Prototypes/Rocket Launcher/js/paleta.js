/* Plantillas específicas del juego, compuestas sobre los controles JS compartidos. */
(() => {
  "use strict";
  function crear({ sensor = () => null } = {}) {
    const paleta = window.CMGPlantillasJS.crear({ pausa: "await esperar(0.5);" }), atajos = paleta.atajos;
    atajos.splice(atajos.findIndex(a => a.ico === "variable"), 0, { ico: "esperar", t: "Esperar", b: "await esperar(0.5);" });
    atajos.splice(atajos.findIndex(a => a.ico === "aviso"), 0,
      { ico: "apuntar", t: "Apuntar", b: "const pos = autoTarget(/* tipo de enemigo */, /* sensor */);" },
      { ico: "disparo", t: "Disparo", b: "regularShoot(/* lugar */);" },
      { ico: "rafaga", t: "Ráfaga", b: "burstFire(/* lugar */);" },
      { ico: "detener", t: "Detener", b: "stopFire();" },
      { ico: "sensor", t: "Sensor de vibración", b: () => `const pos = ${sensor()}.detect(/* tipo de enemigo */);`, si: () => !!sensor() }, "|");
    return paleta;
  }
  window.CMGPaleta = { crear };
})();
