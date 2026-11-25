
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarRetosPantalla(ctx) {
  // ---------- Retos y mundo en pantalla ----------
  // Solo los contenidos de los retos incluidos se localizan. El escenario propio sigue siendo datos del jugador.
  function textoReto(campo, original = ctx.def[campo], indice = ctx.retoIdx) {
    const clave = ctx.batallasV2 && ctx.RETOS[indice]?.[campo.replace(/\.\d+$/, '')];
    if (typeof clave === 'string' && clave.startsWith('cv2.')) return ctx.ti18n(clave);
    if (ctx.ES_CAMPAIGN) return ctx.ti18n(`campaign.hito.${ctx.mundo ? ctx.mundo.hito : 0}.${campo}`);
    return indice < ctx.IDX_PROPIO ? ctx.ti18n(`retos.${ctx.SERIE}.${indice}.${campo}`) : original || "";
  }
  const hojaReto = (campo, original, indice = ctx.retoIdx) => `<span data-reto-campo="${campo}" data-reto-indice="${indice}">${ctx.esc(textoReto(campo, original, indice))}</span>`;
  const hojaUIReto = (clave, params = {}) => `<span data-reto-ui="${clave}" data-reto-params="${ctx.esc(JSON.stringify(params))}">${ctx.esc(ctx.ti18n(clave, params))}</span>`;
  function actualizarContenidoReto() {
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-reto-ui]"))) el.textContent = ctx.ti18n(el.dataset.retoUi, JSON.parse(el.dataset.retoParams));
    for (const [id, campo] of [["titulo", "titulo"], ["objetivo-corto", "objetivo"], ["objetivo-txt", "objetivo"], ["leccion", "leccion"]])
      if (ctx.$(id)) ctx.$(id).textContent = textoReto(campo);
    ctx.$("info-reto-titulo").textContent = `${ctx.ES_CAMPAIGN ? ctx.hitoActual().clave : ctx.retoIdx === ctx.IDX_PROPIO ? ctx.ti18n("retos.propio") : ctx.ti18n("retos.reto", { numero: ctx.retoIdx + 1 })} · ${textoReto("titulo")}`;
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-reto-campo]"))) {
      const indice = +el.dataset.retoIndice;
      if (indice < ctx.IDX_PROPIO) el.textContent = textoReto(el.dataset.retoCampo, "", indice);
    }
  }
  function pintarRetos() {
    if (ctx.batallasV2) return;
    if (ctx.ES_CAMPAIGN) { ctx.$("retos").innerHTML = ctx.uiC.chipsHitos(ctx.historialC); return; }
    const chips = ctx.RETOS.map((r, i) => [i, r.titulo]).concat(ctx.ES_FACTORY ? [] : [[ctx.IDX_PROPIO, `✎ ${ctx.propio.titulo}`]]);
    ctx.$("retos").innerHTML = chips.filter(([i]) => !ctx.checkpointsV2 || i === ctx.IDX_PROPIO || ctx.checkpointsV2.lista.some(c => c.hito === ctx.batallasV2.batallas[i])).map(([i, t]) => {
      const clave = ctx.PREFIJO + (i === ctx.IDX_PROPIO ? "propio" : String(i)), hecho = ctx.hechos.includes(clave);
      return `<button type="button" class="reto-btn${hecho ? " hecho" : ""}" aria-pressed="${i === ctx.retoIdx}" data-i="${i}"><span class="n">${hecho ? "✓" : i === ctx.IDX_PROPIO ? "+" : i + 1}</span>${i < ctx.IDX_PROPIO ? hojaReto("titulo", t, i) : ctx.esc(t)}</button>`;
    }).join("");
  }
  ctx.$("retos")?.addEventListener("click", (ev) => { const b = ev.target.closest(".reto-btn"); if (!b) return; if (ctx.ES_CAMPAIGN) ctx.volverAHito(+b.dataset.i); else ctx.elegirReto(+b.dataset.i); });
  function abrirHoja(si) {
    ctx.$("hoja-reto").hidden = !si;
    ctx.$("b-reto").setAttribute("aria-expanded", si);
  }
  const cerrarHoja = () => { if (ctx.$("hoja-reto")?.hidden === false) abrirHoja(false); };

  return {
    get textoReto() { return textoReto; },
    get hojaReto() { return hojaReto; },
    get hojaUIReto() { return hojaUIReto; },
    get actualizarContenidoReto() { return actualizarContenidoReto; },
    get pintarRetos() { return pintarRetos; },
    get abrirHoja() { return abrirHoja; },
    get cerrarHoja() { return cerrarHoja; }
  };
}
