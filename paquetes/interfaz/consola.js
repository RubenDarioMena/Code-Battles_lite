/** instalarConsola: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarConsola(ctx) {
  // ---------- Consola, globos y avisos a pantalla ----------
  const $consola = ctx.$("consola");
  function limpiarConsola() {
    const vacia = document.createElement("div");
    vacia.className = "vacia"; vacia.dataset.partidaI18n = "consola.vacia"; vacia.textContent = ctx.ti18n("partida.consola.vacia");
    $consola.replaceChildren(vacia);
  }
  function consola(cls, id, linea, html) {
    const v = $consola.querySelector(".vacia"); if (v) v.remove();
    const d = /** @type {any} */ (document.createElement("div"));
    d.className = `c ${cls}`;
    const ref = id ? `<button type="button" class="ref" data-ref="${ctx.esc(id)}">${ctx.esc(id)}</button>` : "";
    d.innerHTML = `<span class="l">${ref}${linea ? ` L${linea}` : ""}</span><span class="t">${html}</span>`;
    $consola.appendChild(d);
    while ($consola.children.length > 150) $consola.firstChild.remove();
    $consola.scrollTop = $consola.scrollHeight;
  }
  function globo(id, nivel, texto) { ctx.globos.set(id, { nivel, texto: String(texto).slice(0, 140), hasta: performance.now() + (nivel === "sistema" ? 2200 : 3000) }); }
  function mostrarConsola(id, linea, nivel, texto) {
    consola(nivel, id, linea, `${nivel === "log" ? "" : `<b>${nivel}</b> `}${ctx.esc(texto)}`);
    if (ctx.ruteo[nivel] === "globo") globo(id, nivel, texto);
    else if (ctx.ruteo[nivel] === "pantalla") aviso(nivel, id, linea, texto);
  }
  function avisoSistema(texto) { consola("bad", null, null, ctx.htmlInterfaz(ctx.esc(texto))); aviso("error", null, null, texto, true); }

  const $avisos = ctx.$("avisos");
  function aviso(nivel, id, linea, texto, delSistema = false) {
    const ult = $avisos.lastElementChild;
    const clave = `${nivel}|${id}|${texto}`;
    if (ult && ult.dataset.clave === clave) {
      ult.dataset.n = +ult.dataset.n + 1; ult.querySelector(".veces").textContent = `×${ult.dataset.n}`; ult.dataset.hasta = performance.now() + 4500; return;
    }
    const d = /** @type {any} */ (document.createElement("div"));
    d.className = `toast ${nivel}`; d.dataset.clave = clave; d.dataset.n = 1; d.dataset.hasta = performance.now() + 4500;
    d.innerHTML = `<span class="nivel">${ctx.esc(nivel)}</span>${id ? `<button type="button" class="ref" data-ref="${ctx.esc(id)}">${ctx.esc(id)}</button>` : ""}${linea ? `<span class="veces">L${linea}</span>` : ""}<span class="txt">${ctx.esc(texto)}</span><span class="veces"></span>`;
    if (delSistema) d.innerHTML = ctx.htmlInterfaz(d.innerHTML);
    $avisos.appendChild(d);
    while ($avisos.children.length > 3) $avisos.firstChild.remove();
  }
  function cerrarAvisos() { $avisos.innerHTML = ""; ctx.globos.clear(); }
  function caducarAvisos(now) { for (const d of [...$avisos.children]) if (now > +d.dataset.hasta) d.remove(); }
  // Un enlace a una máquina la selecciona y centra la cámara en ella.
  document.addEventListener("click", (ev) => {
    const r = /** @type {any} */ (ev.target).closest(".ref[data-ref]"); if (!r) return;
    ctx.seleccionar(r.dataset.ref); ctx.centrarEn(r.dataset.ref);
  });

  return {
    limpiarConsola, consola, globo, mostrarConsola, avisoSistema, cerrarAvisos, caducarAvisos
  };
}
