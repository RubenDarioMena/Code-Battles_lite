
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarEscenarioJuego(ctx) {
  // ---------- Escenario propio ----------
  const hojaEscenario = clave => `<span data-i18n="${clave}">${ctx.esc(ctx.ti18n(clave))}</span>`;
  let escenarioJsonCopiado = false, temporizadorCopiaEscenario;
  function actualizarCopiaEscenario() {
    const boton = ctx.$("esc-json-copiar");
    if (boton) boton.textContent = ctx.ti18n(escenarioJsonCopiado ? "escenario.json.copiado" : "escenario.json.copiar");
  }
  const filaOla = (o, i, dis) => `<div class="ola" data-i="${i}">
      <label class="campo-f">${hojaEscenario("escenario.oleada.tipo")}<select data-k="tipo" ${dis}>${Object.keys(ctx.TIPOS).map(t => `<option value="${t}"${o.tipo === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.cantidad")}<input data-k="n" type="number" min="0" max="40" value="${o.n}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.desde")}<input data-k="t" type="number" min="0" step="0.5" value="${o.t}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.cada")}<input data-k="cada" type="number" min="0.1" step="0.05" value="${o.cada}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.carriles")}<input data-k="carriles" value="${o.carriles.join(", ")}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.vida")}<input data-k="hp" type="number" min="1" max="9" placeholder="${ctx.TIPOS[o.tipo].hp}" value="${o.hp ?? ""}" ${dis}></label>
      <button type="button" class="btn chico quitar" data-quitar="${i}" ${dis}>${hojaEscenario("escenario.oleada.quitar")}</button>
    </div>`;
  // `d` es el escenario que se muestra: el del reto o un borrador que todavía no se guardó.
  function pintarEscenario(d = ctx.def) {
    if (ctx.ES_CAMPAIGN) { ctx.$("esc-aviso").hidden = true; ctx.$("esc-form").innerHTML = ctx.uiC.historial(ctx.historialC); return; }
    if (ctx.ES_FACTORY) return ctx.formularioFactory.pintar(d);
    const propioSel = ctx.retoIdx === ctx.IDX_PROPIO, dis = propioSel ? "" : "disabled";
    const me = d.metas, num = (v) => v == null ? "" : v;
    ctx.$("esc-aviso").hidden = propioSel;
    ctx.$("esc-aviso").innerHTML = propioSel ? "" : `${hojaEscenario("escenario.aviso.reto_fijo")} <button type="button" class="btn chico" id="esc-copiar-reto">${hojaEscenario("escenario.reto.copiar_base")}</button>`;
    ctx.$("esc-form").innerHTML = `
      <fieldset ${dis}><legend>${hojaEscenario("escenario.enunciado")}</legend>
        <label class="campo-f">${hojaEscenario("escenario.titulo")}<input id="esc-titulo" maxlength="60" value="${ctx.esc(d.titulo)}"></label>
        <label class="campo-f">${hojaEscenario("escenario.objetivo")}<textarea id="esc-objetivo">${ctx.esc(d.objetivo)}</textarea></label>
        <label class="campo-f">${hojaEscenario("escenario.pista")}<input id="esc-pista" value="${ctx.esc(d.pista)}"></label>
      </fieldset>
      <fieldset ${dis}><legend>${hojaEscenario("escenario.metas")}</legend>
        <div class="dos">
          <label class="campo-f">${hojaEscenario("escenario.metas.brechas")}<input id="esc-brechas" type="number" min="0" value="${num(me.brechasMax)}"></label>
          <label class="campo-f">${hojaEscenario("escenario.metas.atascos")}<input id="esc-atascos" type="number" min="0" value="${num(me.atascosMax)}"></label>
          <label class="campo-f">${hojaEscenario("escenario.metas.derribos")}<input id="esc-derribos" type="number" min="0" value="${num(me.derribosMin)}"></label>
          <label class="campo-f">${hojaEscenario("escenario.metas.tiempo")}<input id="esc-tiempo" type="number" min="1" value="${num(me.tiempoMax)}"></label>
        </div>
      </fieldset>
      <fieldset ${dis}><legend>${hojaEscenario("escenario.defensa")}</legend>
        <div class="dos">
          <label class="campo-f">${hojaEscenario("escenario.lanzadores")}<select id="esc-lanzadores"><option value="1"${d.lanzadores.length === 1 ? " selected" : ""}>1 · LAU-01</option><option value="2" data-i18n="escenario.lanzadores.dos"${d.lanzadores.length === 2 ? " selected" : ""}>${ctx.esc(ctx.ti18n("escenario.lanzadores.dos"))}</option></select></label>
          <label class="campo-f">${hojaEscenario("escenario.reparadores")}<input id="esc-rep" type="number" min="0" max="3" value="${d.reparadores}"></label>
          <label class="campo-f">${hojaEscenario("escenario.cargador")}<input id="esc-cargador" type="number" min="1" max="40" value="${d.cargador}"></label>
          <label class="campo-f">${hojaEscenario("escenario.suministro")}<input id="esc-suministro" type="number" min="0" max="5" step="0.1" value="${d.suministro}"></label>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" id="esc-vib"${d.sensores.length ? " checked" : ""}> ${hojaEscenario("escenario.vibracion")}</label>
          <label class="check"><input type="checkbox" id="esc-niebla"${d.niebla ? " checked" : ""}> ${hojaEscenario("escenario.niebla")}</label>
        </div>
      </fieldset>
      <fieldset ${dis}><legend>${hojaEscenario("escenario.oleadas")}</legend>
        <div class="oleadas" id="esc-oleadas">${d.oleadas.map((o, i) => filaOla(o, i, dis)).join("")}</div>
        <div><button type="button" class="btn chico" id="esc-mas" ${dis}>${hojaEscenario("escenario.oleada.mas")}</button></div>
      </fieldset>
      ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primario" id="esc-guardar">${hojaEscenario("escenario.guardar")}</button>
        <button type="button" class="btn" id="esc-json-copiar"></button>
      </div>
      <details class="caja"><summary>${hojaEscenario("escenario.json.pegar")}</summary><div class="dentro">
        <textarea class="json" id="esc-json" data-i18n-aria-label="escenario.json.aria" aria-label="${ctx.esc(ctx.ti18n("escenario.json.aria"))}" placeholder='{"titulo": "…", "oleadas": […]}'></textarea>
        <div><button type="button" class="btn chico" id="esc-json-aplicar">${hojaEscenario("escenario.json.aplicar")}</button> <span class="fila-bajo" id="esc-json-msg"></span></div>
      </div></details>` : ""}`;
    actualizarCopiaEscenario();
  }
  function leerEscenario() {
    const v = (id) => ctx.$(id).value.trim();
    const n = (id) => v(id) === "" ? null : Number(v(id));
    const oleadas = [...document.querySelectorAll("#esc-oleadas .ola")].map(f => {
      const g = (k) => /** @type {HTMLInputElement} */ (f.querySelector(`[data-k="${k}"]`)).value;
      return { tipo: g("tipo"), n: Number(g("n")), t: Number(g("t")), cada: Number(g("cada")), carriles: g("carriles").split(/[,\s]+/).filter(Boolean).map(Number), ...(g("hp") ? { hp: Number(g("hp")) } : {}) };
    });
    return ctx.normalizar({
      titulo: v("esc-titulo") || "Tu escenario", objetivo: v("esc-objetivo"), pista: v("esc-pista"), leccion: "Escenario propio · se edita en la pestaña Escenario.",
      metas: { brechasMax: n("esc-brechas") ?? 0, atascosMax: n("esc-atascos"), derribosMin: n("esc-derribos"), tiempoMax: n("esc-tiempo") },
      lanzadores: ctx.POS_LANZADORES[v("esc-lanzadores")] || ctx.POS_LANZADORES[1],
      reparadores: n("esc-rep"), cargador: n("esc-cargador"), suministro: n("esc-suministro"), niebla: ctx.$("esc-niebla").checked,
      sensores: ctx.$("esc-vib").checked ? [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }] : [],
      oleadas, inicial: ctx.propio.inicial,
    });
  }
  function guardarPropio(nuevo, jugar) {
    ctx.propio = nuevo; ctx.guardado.escribir(`${ctx.PREFIJO}propio`, ctx.propio);
    if (jugar || ctx.retoIdx === ctx.IDX_PROPIO) { ctx.elegirReto(ctx.IDX_PROPIO); ctx.abrirPestana("escenario"); }
    ctx.pintarRetos();
  }
  ctx.$("v-escenario").addEventListener("click", (ev) => {
    if (ctx.ES_CAMPAIGN) return ctx.clicHistorial(ev);
    if (ctx.ES_FACTORY) return;
    const boton = ev.target.closest?.("button") || ev.target, id = boton.id;
    if (boton.dataset.quitar != null) { const d = leerEscenario(); d.oleadas.splice(+boton.dataset.quitar, 1); pintarEscenario(d); return; }
    if (id === "esc-mas") { const d = leerEscenario(); d.oleadas.push({ tipo: "drone", n: 4, t: 0, cada: 1, carriles: [9] }); pintarEscenario(d); return; }
    if (id === "esc-guardar") { guardarPropio(leerEscenario(), true); ctx.abrirPestana("programa"); return; }
    if (id === "esc-copiar-reto") {
      ctx.guardado.escribir("prog-propio", ctx.programas);
      guardarPropio(ctx.normalizar({ ...ctx.def, titulo: `${ctx.def.titulo} (mío)`, leccion: "Escenario propio · se edita en la pestaña Escenario." }), true);
      return;
    }
    if (id === "esc-json-copiar") {
      const txt = JSON.stringify(leerEscenario(), null, 2);
      try { navigator.clipboard.writeText(txt).then(() => {
        escenarioJsonCopiado = true; actualizarCopiaEscenario();
        clearTimeout(temporizadorCopiaEscenario);
        temporizadorCopiaEscenario = setTimeout(() => { escenarioJsonCopiado = false; actualizarCopiaEscenario(); }, 1500);
      }, () => { ctx.$("esc-json").value = txt; ctx.$("esc-json").closest("details").open = true; ctx.$("esc-json").select(); }); }
      catch { ctx.$("esc-json").value = txt; }
      return;
    }
    if (id === "esc-json-aplicar") {
      try { guardarPropio(ctx.normalizar(JSON.parse(ctx.$("esc-json").value)), true); }
      catch (e) { ctx.$("esc-json-msg").innerHTML = `${hojaEscenario("escenario.json.error")}: <span>${ctx.esc(e.message)}</span>`; }
    }
  });


  return {
    get hojaEscenario() { return hojaEscenario; },
    get escenarioJsonCopiado() { return escenarioJsonCopiado; }, set escenarioJsonCopiado(v) { escenarioJsonCopiado = v; },
    get temporizadorCopiaEscenario() { return temporizadorCopiaEscenario; }, set temporizadorCopiaEscenario(v) { temporizadorCopiaEscenario = v; },
    get actualizarCopiaEscenario() { return actualizarCopiaEscenario; },
    get filaOla() { return filaOla; },
    get pintarEscenario() { return pintarEscenario; },
    get leerEscenario() { return leerEscenario; },
    get guardarPropio() { return guardarPropio; }
  };
}
