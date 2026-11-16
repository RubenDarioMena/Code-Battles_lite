/** @param {string} serie */
export function vocabulario(serie = "war") {
  const ES_FACTORY = serie === "factory", ES_CAMPAIGN = serie === "campaign";
  const KW = new Set("await async break case catch class const continue default delete do else false finally for function if in instanceof let new null of return switch this throw true try typeof undefined var void while".split(" "));
  const FN_PROPIAS = new Set(ES_CAMPAIGN ? ["pickUp", "deliver", "goTo", "wait", "count", "start", "stop", "light", "setRecipe", "request", "recoger", "entregar", "esperar", "cuantos", "irA", "log"] : ES_FACTORY ? ["pickUp", "deliver", "wait", "count", "recoger", "entregar", "esperar", "cuantos", "log"] : ["autoTarget", "regularShoot", "burstFire", "stopFire", "esperar", "log"]);
  const FN_MIEMBRO = new Set(["pickUp", "deliver", "wait", "count", "recoger", "entregar", "cuantos", "esperar", "autoTarget", "regularShoot", "burstFire", "stopFire", "detect", "log", "info", "warn", "error",
    ...(ES_CAMPAIGN ? ["goTo", "irA", "start", "stop", "light", "setRecipe", "request"] : [])]);
  const PROPS = new Set(ES_CAMPAIGN ? ["cargo", "busy", "input", "output", "outputFull", "state", "recipe", "made", "running", "pallet", "items", "free", "pending", "machine", "missiles", "received", "power", "budget", "milestone", "used", "max"]
    : ["failureRate", "missiles", "mode", "jammed", "fireRate", "sensors", "target", "count"]);
  return { KW, FN_PROPIAS, FN_MIEMBRO, PROPS };
}
