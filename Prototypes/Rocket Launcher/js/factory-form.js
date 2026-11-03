/* Formulario de Factory trasladado del original; guarda mediante la aplicación común. */
(() => {
  "use strict";
  function crear(hooks) {
    const $ = id => document.getElementById(id), retoActual = hooks.retoActual, abrirPestana = hooks.abrirPestana;
    const RETOS = window.FACTORY_RETOS.RETOS, normalizarReto = window.FACTORY_RETOS.normalizar, MATERIALES = window.FACTORY.MATERIALES;
    const escapar = s => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const LIM = [["tiempoMax", "Tiempo máximo (s)"], ["maxRechazos", "Entregas rechazadas máximas"], ["maxVacios", "Viajes vacíos máximos"]];
  let borrador = null;  // reto que se ve en el formulario, todavía sin guardar
  function pintarFormReto(d = retoActual()) {
    borrador = JSON.parse(JSON.stringify(d));
    const propioSel = hooks.propioSel(), dis = propioSel ? "" : "disabled";
    const ids = d.entidades.map(e => e.id);
    const sel = (k, opciones, actual, extra = "") => `<select data-k="${k}" ${extra}>${opciones.map(([v, t]) => `<option value="${escapar(v)}"${v === actual ? " selected" : ""}>${escapar(t)}</option>`).join("")}</select>`;
    $("esc-aviso").hidden = propioSel;
    $("esc-aviso").innerHTML = propioSel ? "" : `Este reto es fijo. Puedes copiarlo a «Tu reto» y cambiar el enunciado, las metas y el mapa. <button type="button" class="btn chico" id="reto-copiar">Usar como base de Tu reto</button>`;
    $("esc-form").innerHTML = `
      <fieldset ${dis}><legend>Enunciado</legend>
        <label class="campo-f">Título<input id="rf-titulo" maxlength="50" value="${escapar(d.titulo)}"></label>
        <label class="campo-f">Lo que pides (aparece arriba como objetivo)<textarea id="rf-objetivo">${escapar(d.objetivo)}</textarea></label>
        <label class="campo-f">Pista cuando falle<input id="rf-pista" value="${escapar(d.pista || "")}"></label>
      </fieldset>
      <fieldset ${dis}><legend>Metas: lo que tiene que salir</legend>
        <div class="filas-f">${d.metas.map((m, i) => `<div class="fila-f" data-meta="${i}">
          <label class="campo-f">Tipo${sel("tipo", [["entregar", "llegar a"], ["vaciar", "vaciar"]], m.tipo === "vaciar" ? "vaciar" : "entregar")}</label>
          <label class="campo-f">Edificio${sel("id", ids.map(x => [x, x]), m.id)}</label>
          <label class="campo-f">Material${sel("mat", MATERIALES.map(x => [x, x]), m.mat)}</label>
          <label class="campo-f">Cantidad<input data-k="n" type="number" min="1" max="30" value="${m.n ?? ""}" ${m.tipo === "vaciar" ? "disabled" : ""}></label>
          <button type="button" class="btn chico" data-quitar-meta="${i}">Quitar</button></div>`).join("")}</div>
        <div><button type="button" class="btn chico" id="rf-mas-meta">+ Meta</button></div>
        <div class="dos">${LIM.map(([k, t]) => `<label class="campo-f">${t} (vacío = sin límite)<input id="rf-${k}" type="number" min="0" value="${d[k] ?? ""}"></label>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>Mapa</legend>
        ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label class="campo-f">Partir del mapa de${sel("base", RETOS.map((r, i) => [String(i), `${i + 1} · ${r.titulo}`]), "", 'id="rf-base"')}</label><button type="button" class="btn chico" id="rf-cambiar-mapa">Cambiar mapa</button></div>` : ""}
        <div class="filas-f">${d.entidades.map((e, i) => `<div class="fila-f" data-ent="${i}">
          <label class="campo-f">${e.tipo === "bodega" ? "Bodega" : "Máquina"}<input data-k="id" maxlength="8" value="${escapar(e.id)}"></label>
          ${e.tipo === "bodega"
            ? MATERIALES.map(m => `<label class="campo-f">${m}<input data-k="stock-${m}" type="number" min="0" max="30" value="${e.stock[m] ?? ""}" placeholder="—"></label>`).join("") + `<label class="check"><input type="checkbox" data-k="oculto"${e.oculto ? " checked" : ""}> tapada</label>`
            : `<label class="campo-f">Acepta${sel("acepta", MATERIALES.map(x => [x, x]), e.acepta)}</label><label class="campo-f">Huecos<input data-k="cap" type="number" min="1" max="8" value="${e.cap}"></label><label class="campo-f">s por pieza<input data-k="tProceso" type="number" min="0.5" max="30" step="0.5" value="${e.tProceso}"></label>`}
        </div>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>Bloques disponibles</legend>
        <div style="display:flex;gap:4px 14px;flex-wrap:wrap">${["recoger", "entregar", "repetir", "esperar", "mientras", "si"].map(t => `<label class="check"><input type="checkbox" data-ladrillo-f="${t}"${d.ladrillos.includes(t) ? " checked" : ""}> ${escapar(({recoger:"pickUp",entregar:"deliver",esperar:"wait",repetir:"repetir",mientras:"mientras",si:"si / si no"})[t])}</label>`).join("")}</div>
      </fieldset>
      ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primario" id="rf-guardar">Guardar y jugar</button>
        <button type="button" class="btn" id="rf-json-copiar">Copiar JSON</button>
      </div>
      <details class="json"><summary>Pegar un reto en JSON</summary>
        <textarea class="json" id="rf-json" aria-label="Reto en JSON"></textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn chico" id="rf-json-aplicar">Aplicar</button><span class="fila-bajo" id="rf-json-msg"></span></div>
      </details>` : ""}`;
  }
  function leerFormReto() {
    const d = borrador, v = (id) => $(id).value;
    d.titulo = v("rf-titulo").trim() || "Tu reto"; d.objetivo = v("rf-objetivo").trim(); d.pista = v("rf-pista").trim();
    for (const [k] of LIM) d[k] = v(`rf-${k}`) === "" ? null : Number(v(`rf-${k}`));
    d.metas = [...document.querySelectorAll("#esc-form [data-meta]")].map(f => {
      const g = (k) => f.querySelector(`[data-k="${k}"]`).value;
      return g("tipo") === "vaciar" ? { tipo: "vaciar", id: g("id"), mat: g("mat") } : { id: g("id"), mat: g("mat"), n: Number(g("n")) || 1 };
    });
    document.querySelectorAll("#esc-form [data-ent]").forEach(f => {
      const e = d.entidades[+f.dataset.ent], g = (k) => f.querySelector(`[data-k="${k}"]`);
      const viejo = e.id, nuevo = g("id").value.trim().toUpperCase() || viejo;
      e.id = nuevo;
      for (const m of d.metas) if (m.id === viejo) m.id = nuevo;
      if (e.tipo === "bodega") {
        e.stock = {}; for (const m of MATERIALES) { const x = g(`stock-${m}`).value; if (x !== "") e.stock[m] = Number(x); }
        e.oculto = g("oculto").checked || undefined;
      } else { e.acepta = g("acepta").value; e.cap = Number(g("cap").value); e.tProceso = Number(g("tProceso").value); }
    });
    d.ladrillos = [...document.querySelectorAll("#esc-form [data-ladrillo-f]")].filter(x => x.checked).map(x => x.dataset.ladrilloF);
    return normalizarReto(d);
  }
  const guardarPropio = hooks.guardar;
  $("v-escenario").addEventListener("click", (ev) => {
    const t = ev.target, id = t.id;
    if (t.dataset.quitarMeta != null) { const d = leerFormReto(); d.metas.splice(+t.dataset.quitarMeta, 1); pintarFormReto(d); return; }
    if (id === "rf-mas-meta") { const d = leerFormReto(); d.metas.push({ id: d.entidades.find(e => e.tipo === "maquina")?.id || d.entidades[0].id, mat: "cobre", n: 2 }); pintarFormReto(d); return; }
    if (id === "rf-cambiar-mapa") {
      const r = RETOS[+$("rf-base").value], d = leerFormReto();
      pintarFormReto(normalizarReto({ ...d, entidades: JSON.parse(JSON.stringify(r.entidades)), robot: r.robot, metas: JSON.parse(JSON.stringify(r.metas)) }));
      return;
    }
    if (id === "rf-guardar") { guardarPropio(leerFormReto()); abrirPestana("programa"); return; }
    if (id === "reto-copiar") {
      const r = retoActual();
      hooks.copiarPrograma();
      guardarPropio(normalizarReto({ ...JSON.parse(JSON.stringify(r)), titulo: `${r.titulo} (mío)` }));
      return;
    }
    if (id === "rf-json-copiar") {
      const txt = JSON.stringify(leerFormReto(), null, 2);
      const plan = () => { $("rf-json").value = txt; $("rf-json").closest("details").open = true; $("rf-json").select(); };
      try { navigator.clipboard.writeText(txt).then(() => { t.textContent = "Copiado"; setTimeout(() => t.textContent = "Copiar JSON", 1500); }, plan); } catch { plan(); }
      return;
    }
    if (id === "rf-json-aplicar") {
      try { guardarPropio(normalizarReto(JSON.parse($("rf-json").value))); }
      catch (e) { $("rf-json-msg").textContent = `No es un JSON válido: ${e.message}`; }
    }
  });
  $("v-escenario").addEventListener("change", (ev) => {
    // «Vaciar» no lleva cantidad.
    if (ev.target.dataset.k === "tipo") { const n = ev.target.closest("[data-meta]").querySelector('[data-k="n"]'); n.disabled = ev.target.value === "vaciar"; }
  });

    return { pintar: pintarFormReto };
  }
  window.FACTORY_FORM = { crear };
})();
