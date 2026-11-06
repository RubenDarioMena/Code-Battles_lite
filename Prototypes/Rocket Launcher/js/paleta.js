/* Paleta del juego: una sola composición para todas las series y lenguajes.
 *
 *   [comentar] | [sección común del lenguaje + Esperar] | [órdenes de la serie] | [consola]
 *
 * La sección común (bucles, if, operadores, variable) sale siempre del catálogo del lenguaje
 * (CMGPlantillasJS o CMGEditorPython.plantillas), así War, Factory y el IDE no se separan.
 * Cada serie solo declara aquí su pausa y sus órdenes, escritas una vez en JS; en Python
 * pasan por aPython (nombres D1, huecos D4). pruebas/editor-contrato.cjs comprueba la paridad. */
(() => {
  "use strict";
  const SERIES = {
    war: {
      // Disparar no espera: el bucle trae su pausa para no girar sin control.
      esperar: "await esperar(0.5);", pausa: { js: "await esperar(0.5);", python: "await wait(0.5)" },
      propias: (sensor) => [
        { ico: "apuntar", t: "Apuntar", i18n: "paleta.war.apuntar", b: "const pos = autoTarget(/* tipo de enemigo */, /* sensor */);" },
        { ico: "disparo", t: "Disparo", i18n: "paleta.war.disparo", b: "regularShoot(/* lugar */);" },
        { ico: "rafaga", t: "Ráfaga", i18n: "paleta.war.rafaga", b: "burstFire(/* lugar */);" },
        { ico: "detener", t: "Detener", i18n: "paleta.war.detener", b: "stopFire();" },
        { ico: "sensor", t: "Sensor de vibración", i18n: "paleta.war.sensor_vibracion", b: () => `const pos = ${sensor()}.detect(/* tipo de enemigo */);`, si: () => !!sensor() }],
    },
    factory: {
      // Las órdenes del robot ya esperan (await): el bucle no necesita pausa extra.
      esperar: "await wait(1);", pausa: { js: "", python: "" },
      propias: () => [
        { ico: "recoger", t: "Recoger", i18n: "paleta.factory.recoger", b: "await pickUp(/* lugar */, /* material */);" },
        { ico: "entregar", t: "Entregar", i18n: "paleta.factory.entregar", b: "await deliver(/* lugar */);" },
        { ico: "sensor", t: "Cuántos", i18n: "paleta.factory.cuantos", b: "const cantidad = count(/* lugar */, /* material */);" }],
    },
  };
  const serieDe = s => SERIES[s] || SERIES.war;
  // Inserta «Esperar» antes de la variable y las órdenes (con su separador) antes de la consola.
  function componer(atajos, { esperar, propias, consola }) {
    atajos.splice(atajos.findIndex(a => a.ico === "variable"), 0, { ico: "esperar", t: "Esperar", i18n: "paleta.esperar", b: esperar });
    atajos.splice(atajos.findIndex(a => a.ico === consola), 0, ...propias, "|");
    return atajos;
  }
  function crear({ serie = "war", sensor = () => null } = {}) {
    const s = serieDe(serie), paleta = window.CMGPlantillasJS.crear({ pausa: s.pausa.js });
    componer(paleta.atajos, { esperar: s.esperar, propias: s.propias(sensor), consola: "aviso" });
    return paleta;
  }
  function crearPython({ serie = "war", sensor = () => null, aPython }) {
    const s = serieDe(serie), paleta = window.CMGEditorPython.plantillas({ pausa: s.pausa.python });
    const py = a => ({ ...a, b: typeof a.b === "function" ? () => aPython(a.b()) : aPython(a.b) });
    componer(paleta.atajos, { esperar: aPython(s.esperar), propias: s.propias(sensor).map(py), consola: "registro" });
    return paleta;
  }
  window.CMGPaleta = { crear, crearPython, series: Object.keys(SERIES) };
})();
