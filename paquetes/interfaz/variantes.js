
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarVariantes(ctx) {
  // ---------- Variantes visuales en prueba (?poc=1) ----------
  function aplicarVisual() {
    document.documentElement.dataset.paleta = ctx.visual.paleta;
    const q = new URLSearchParams(location.search);
    for (const k of Object.keys(ctx.VARIANTES)) q.set(k, ctx.visual[k]);
    history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
    ctx.leerColores();
    if (ctx.V3 && ctx.mundo) ctx.V3.construir();
  }
  if (new URLSearchParams(location.search).has("poc")) {
    const d = document.createElement("details"); d.className = "poc"; d.open = innerWidth > 760;
    d.innerHTML = ctx.htmlInterfaz(`<summary>Variantes</summary>` + Object.entries(ctx.VARIANTES).map(([k, ops]) =>
      `<div class="g"><b>${k}</b><div class="ops">${Object.entries(ops).map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${ctx.visual[k] === v}">${ctx.esc(t)}</button>`).join("")}</div></div>`).join(""));
    d.addEventListener("click", (ev) => {
      const b = /** @type {Element} */ (ev.target).closest("button[data-k]"); if (!b) return;
      ctx.visual[/** @type {HTMLElement} */ (b).dataset.k] = /** @type {HTMLElement} */ (b).dataset.v;
      d.querySelectorAll(`[data-k="${/** @type {HTMLElement} */ (b).dataset.k}"]`).forEach(x => x.setAttribute("aria-pressed", /** @type {any} */ (x === b)));
      aplicarVisual();
    });
    ctx.$campo.append(d);
  }


  return {
    get aplicarVisual() { return aplicarVisual; }
  };
}
