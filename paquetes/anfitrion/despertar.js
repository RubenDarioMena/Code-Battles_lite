/* Despertar del lockstep, trasladado de js/runtime.js. `ahora` solo marca el vigía de reloj real
 * del juego (performance.now en el navegador); no decide ningún paso. */

/** @typedef {import("./index.js").Ejecucion} Ejecucion */
/** @typedef {import("./index.js").MundoReloj} MundoReloj */

/** @param {Ejecucion | null | undefined} ejec */
export const algunoCorre = ejec => !!ejec && [...ejec.progs.values()].some(p => p.estado === "corre");

/** War y Factory: un programa espera como mucho una cosa (p.espera, p.despertar).
 * @param {Ejecucion | null | undefined} ejec @param {MundoReloj} mundo @param {() => unknown} instantanea
 * @param {() => number} [ahora] */
export function despertar(ejec, mundo, instantanea, ahora = () => 0) {
  if (!ejec) return false;
  const listos = [...ejec.progs.values()].filter(p => p.estado === "espera" && p.despertar <= mundo.t + 1e-9);
  if (!listos.length) return false;
  const snap = instantanea();
  for (const p of listos) { p.estado = "corre"; p.desde = ahora(); p.mensajes = 0; p.worker.postMessage({ type: "despierta", id: p.espera, snap }); }
  return true;
}

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
