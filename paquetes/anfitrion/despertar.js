/* Despertar del lockstep, trasladado de js/runtime.js. `ahora` solo marca el vigía de reloj real
 * del juego (performance.now en el navegador); no decide ningún paso. */

/** @typedef {import("./index.js").Ejecucion} Ejecucion */
/** @typedef {import("./index.js").MundoReloj} MundoReloj */

/** Campaign: cada programa puede tener varias esperas y encargos a la vez (p.pend).
 * @param {Ejecucion | null | undefined} ejec @param {MundoReloj} mundo @param {() => unknown} instantanea
 * @param {() => number} [ahora] */
export function despertarCampaign(ejec, mundo, instantanea, ahora = () => 0) {
  if (!ejec) return false;
  let snap = null, alguno = false;
  for (const p of ejec.progs.values()) for (const [id, e] of p.pend) {
    if (e.tipo !== "espera" || e.despertar > mundo.t + 1e-9) continue;
    p.pend.delete(id); snap ||= instantanea();
    p.estado = "corre"; p.desde = ahora(); p.mensajes = 0; alguno = true;
    p.worker.postMessage({ type: "despierta", id, snap });
  }
  return alguno;
}
