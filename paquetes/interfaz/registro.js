/** instalarRegistro: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarRegistro(ctx) {
  // ---------- Registro y telemetría ----------
  function pintarEventosYa() {
    ctx.eventosSucios = false;
    ctx.$("eventos").innerHTML = ctx.eventos.slice(-250).map(e => ctx.ES_FACTORY && e.orden ? { ...e, maquina: "R1", que: e.orden, clase: e.sensor ? "sensor" : e.resultado === "ok" ? "ok" : "warn" } : e).map(e =>
      `<tr><td>${e.t.toFixed(2)}</td><td>${ctx.esc(e.maquina)}</td><td>${e.linea}</td><td>${ctx.esc(e.que)}</td><td class="${e.clase}">${ctx.esc(e.resultado)}</td></tr>`).join("")
      || `<tr data-eventos-vacios><td colspan="5" style="color:var(--muted)"></td></tr>`;
    actualizarEtiquetaEventosVacios();
  }
  function actualizarEtiquetaEventosVacios() {
    const vacia = ctx.$("eventos").querySelector("[data-eventos-vacios] td");
    if (vacia) vacia.textContent = ctx.ti18n("partida.registro.vacio");
  }
  const CLAVES_RESUMEN = ["partida.resumen.intentos", "partida.resumen.cumplidos", null, "partida.resumen.hasta_cumplir", "partida.resumen.vistas", "partida.resumen.doble_clic"];
  function actualizarEtiquetasResumen() {
    for (const etiqueta of ctx.$("resumen").querySelectorAll("[data-resumen-clave]")) etiqueta.textContent = ctx.ti18n(etiqueta.dataset.resumenClave);
    const record = ctx.$("resumen").querySelector('[data-resumen-record]');
    if (record) record.textContent = ctx.ti18n(ctx.ES_FACTORY ? "partida.resumen.record_tiempo" : "partida.resumen.record_coste");
  }
  function pintarResumen() {
    const delReto = ctx.telemetria.filter(t => t.reto === ctx.retoIdx + 1);
    const victorias = delReto.filter(t => t.resultado === "victoria");
    const primera = delReto.findIndex(t => t.resultado === "victoria");
    const rec = ctx.ES_FACTORY && ctx.records[ctx.claveReto()]?.regla !== "comun-v1" ? null : ctx.records[ctx.claveReto()];
    const vistas = ["3d", "2d"].map(v => delReto.filter(t => t.vista === v).length).join(" / ");
    const dobles = delReto.reduce((a, t) => a + ((t.inserciones && t.inserciones.dobleClic) || 0), 0);
    const valores = [delReto.length, victorias.length, rec != null ? (ctx.ES_FACTORY ? rec.valor : rec).toFixed(1) : "—", primera >= 0 ? primera + 1 : "—", vistas, dobles];
    const raiz = ctx.$("resumen"); raiz.replaceChildren();
    for (let i = 0; i < valores.length; i++) {
      const dato = document.createElement("div"); dato.className = "dato";
      const etiqueta = document.createElement("span");
      if (i === 2) etiqueta.dataset.resumenRecord = ""; else etiqueta.dataset.resumenClave = CLAVES_RESUMEN[i];
      const valor = document.createElement("b"); valor.textContent = String(valores[i]);
      dato.append(etiqueta, valor); raiz.appendChild(dato);
    }
    actualizarEtiquetasResumen();
    ctx.$("json").value = JSON.stringify(ctx.telemetria, null, 2);
  }
  ctx.$("b-copiar").addEventListener("click", () => {
    const txt = JSON.stringify(ctx.telemetria, null, 2);
    const ok = () => { ctx.$("copiado").hidden = false; ctx.actualizarEtiquetasConfirmaciones(); setTimeout(() => ctx.$("copiado").hidden = true, 1600); };
    const planB = () => { const d = ctx.$("json").closest("details"); d.open = true; ctx.$("json").focus(); ctx.$("json").select(); };
    try { navigator.clipboard.writeText(txt).then(ok, planB); } catch { planB(); }
  });

  ctx.$("b-borrar").addEventListener("click", (ev) => {
    if (!ctx.confirmarBorrado) {
      ctx.confirmarBorrado = true; ctx.actualizarEtiquetasConfirmaciones();
      setTimeout(() => { ctx.confirmarBorrado = false; ctx.actualizarEtiquetasConfirmaciones(); }, 3000);
      return;
    }
    ctx.confirmarBorrado = false; ctx.actualizarEtiquetasConfirmaciones();
    ctx.telemetria = []; ctx.guardado.escribir(`${ctx.PREFIJO}telemetria`, ctx.telemetria); ctx.intento = 0; pintarResumen(); ctx.pintarControles();
  });

  return {
    pintarEventosYa, actualizarEtiquetaEventosVacios, actualizarEtiquetasResumen, pintarResumen
  };
}
