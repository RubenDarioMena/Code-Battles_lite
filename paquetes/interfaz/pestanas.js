/** instalarPestanas: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarPestanas(ctx) {
  // ---------- Pestañas ----------
  const TABS = ["programa", "registro", "ayuda", "escenario"].filter(x => ctx.$("t-" + x));
  function abrirPestana(t) {
    ctx.$("zona-codigo").dataset.pestana = t;
    for (const x of TABS) { const on = x === t; ctx.$(`t-${x}`).setAttribute("aria-selected", on); ctx.$(`v-${x}`).hidden = !on; }
    if (t === "programa") ctx.medirEditor();
  }
  document.querySelector(".tabs").addEventListener("click", (ev) => { const b = /** @type {any} */ (ev.target).closest(".tab"); if (b) abrirPestana(b.id.slice(2)); });

  // Banner
  function mostrarBanner(tipo, titulo, html, stats, acciones) {
    const $b = ctx.$("banner");
    $b.className = `banner ${tipo}`;
    $b.innerHTML = ctx.htmlInterfaz(`<h2>${ctx.esc(titulo)}</h2>${html ? (html.startsWith("<p") ? html : `<p>${html}</p>`) : ""}${stats ? `<p class="stats">${ctx.esc(stats)}</p>` : ""}<div class="acciones"></div>`);
    const $a = $b.querySelector(".acciones");
    for (const [txt, cls, fn] of acciones) {
      const b = document.createElement("button"); b.type = "button"; b.className = `btn chico ${cls}`; if (ctx.CMGPresentacion) ctx.CMGPresentacion.rotular(b, txt); else b.textContent = txt; b.addEventListener("click", fn); $a.appendChild(b);
    }
    const pista = $b.querySelector('.stats');
    if (pista && stats && (stats === ctx.def.pista || stats === ctx.partesPista().join(" ") || /^Pista[ :]/.test(stats))) {
      pista.dataset.bannerPista = stats === ctx.def.pista || stats === ctx.partesPista().join(" ") ? "completa" : "parte";
      actualizarPistaBanner();
    }
    $b.hidden = false;
  }
  function actualizarPistaBanner() {
    const el = ctx.$("banner").querySelector('[data-banner-pista]'); if (!el) return;
    const partes = ctx.partesPista(), i = ctx.pistaDe().vistas;
    el.textContent = el.dataset.bannerPista === "completa" ? partes.join(" ")
      : `${ctx.ti18n("juego.info_reto.pista")}${partes.length > 1 ? ` ${i}/${partes.length}` : ""}: ${partes[Math.max(0, i - 1)] || ""}`;
  }
  function ocultarBanner() { ctx.$("banner").hidden = true; }

  return {
    abrirPestana, mostrarBanner, actualizarPistaBanner, ocultarBanner
  };
}
