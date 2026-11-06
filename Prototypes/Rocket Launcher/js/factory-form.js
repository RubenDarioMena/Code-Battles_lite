/* Formulario de Factory trasladado del original; guarda mediante la aplicación común. */
(() => {
  "use strict";
  function crear(hooks) {
    const $ = id => document.getElementById(id), retoActual = hooks.retoActual, abrirPestana = hooks.abrirPestana;
    const RETOS = window.FACTORY_RETOS.RETOS, normalizarReto = window.FACTORY_RETOS.normalizar, MATERIALES = window.FACTORY.MATERIALES;
    const escapar = s => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
    const TEXTOS_ES = {
      "formulario.aviso.reto_fijo": "Este reto es fijo. Puedes copiarlo a «Tu reto» y cambiar el enunciado, las metas y el mapa.",
      "formulario.reto.copiar_base": "Usar como base de Tu reto", "formulario.enunciado": "Enunciado", "formulario.titulo": "Título",
      "formulario.objetivo": "Lo que pides (aparece arriba como objetivo)", "formulario.pista": "Pista cuando falle",
      "formulario.metas": "Metas: lo que tiene que salir", "formulario.meta.tipo": "Tipo",
      "formulario.meta.tipo.entregar": "llegar a", "formulario.meta.tipo.vaciar": "vaciar", "formulario.meta.edificio": "Edificio",
      "formulario.meta.material": "Material", "formulario.meta.cantidad": "Cantidad", "formulario.quitar": "Quitar", "formulario.meta.mas": "+ Meta",
      "formulario.limite.sin_limite": "(vacío = sin límite)", "formulario.limite.tiempo": "Tiempo máximo (s)",
      "formulario.limite.rechazos": "Entregas rechazadas máximas", "formulario.limite.viajes_vacios": "Viajes vacíos máximos",
      "formulario.mapa": "Mapa", "formulario.mapa.partir_de": "Partir del mapa de", "formulario.mapa.cambiar": "Cambiar mapa",
      "formulario.entidad.bodega": "Bodega", "formulario.entidad.maquina": "Máquina", "formulario.entidad.tapada": "tapada",
      "formulario.entidad.acepta": "Acepta", "formulario.entidad.huecos": "Huecos", "formulario.entidad.segundos_pieza": "s por pieza",
      "formulario.bloques": "Bloques disponibles", "formulario.guardar": "Guardar y jugar", "formulario.json.copiar": "Copiar JSON",
      "formulario.json.pegar": "Pegar un reto en JSON", "formulario.json.aria": "Reto en JSON", "formulario.json.aplicar": "Aplicar",
      "formulario.json.copiado": "Copiado", "formulario.json.error": "No es un JSON válido"
    };
    function textoFormulario(clave, parametros = {}) {
      const i18n = window.CMGI18n, traducido = i18n && typeof i18n.t === "function" ? i18n.t(clave, parametros) : null;
      const base = typeof traducido === "string" && traducido !== clave ? traducido : TEXTOS_ES[clave] || clave;
      return base.replace(/\{([^{}]+)\}/g, (m, nombre) => Object.hasOwn(parametros, nombre) ? String(parametros[nombre]) : m);
    }
    const hoja = clave => `<span data-formulario-i18n="${clave}">${escapar(textoFormulario(clave))}</span>`;
    const atributo = (nombre, clave) => `data-formulario-${nombre}="${clave}" ${nombre}="${escapar(textoFormulario(clave))}"`;
  const LIM = [["tiempoMax", "Tiempo máximo (s)"], ["maxRechazos", "Entregas rechazadas máximas"], ["maxVacios", "Viajes vacíos máximos"]];
  const CLAVES_LIM = { tiempoMax: "formulario.limite.tiempo", maxRechazos: "formulario.limite.rechazos", maxVacios: "formulario.limite.viajes_vacios" };
  const OPCIONES_FORM = { tipo: { entregar: "formulario.meta.tipo.entregar", vaciar: "formulario.meta.tipo.vaciar" } };
  let jsonCopiado = false;
  let borrador = null;  // reto que se ve en el formulario, todavía sin guardar
  function pintarFormReto(d = retoActual()) {
    borrador = JSON.parse(JSON.stringify(d));
    const propioSel = hooks.propioSel(), dis = propioSel ? "" : "disabled";
    const ids = d.entidades.map(e => e.id);
    const sel = (k, opciones, actual, extra = "") => `<select data-k="${k}" ${extra}>${opciones.map(([v, t]) => {
      const key = OPCIONES_FORM[k]?.[v];
      return `<option value="${escapar(v)}"${key ? ` data-formulario-option="${key}"` : ""}${v === actual ? " selected" : ""}>${escapar(key ? textoFormulario(key) : t)}</option>`;
    }).join("")}</select>`;
    $("esc-aviso").hidden = propioSel;
    $("esc-aviso").innerHTML = propioSel ? "" : `${hoja("formulario.aviso.reto_fijo")} <button type="button" class="btn chico" id="reto-copiar" data-formulario-i18n="formulario.reto.copiar_base">${escapar(textoFormulario("formulario.reto.copiar_base"))}</button>`;
    $("esc-form").innerHTML = `
      <fieldset ${dis}><legend>${hoja("formulario.enunciado")}</legend>
        <label class="campo-f">${hoja("formulario.titulo")}<input id="rf-titulo" maxlength="50" value="${escapar(d.titulo)}"></label>
        <label class="campo-f">${hoja("formulario.objetivo")}<textarea id="rf-objetivo">${escapar(d.objetivo)}</textarea></label>
        <label class="campo-f">${hoja("formulario.pista")}<input id="rf-pista" value="${escapar(d.pista || "")}"></label>
      </fieldset>
      <fieldset ${dis}><legend>${hoja("formulario.metas")}</legend>
        <div class="filas-f">${d.metas.map((m, i) => `<div class="fila-f" data-meta="${i}">
          <label class="campo-f">${hoja("formulario.meta.tipo")}${sel("tipo", [["entregar", "llegar a"], ["vaciar", "vaciar"]], m.tipo === "vaciar" ? "vaciar" : "entregar")}</label>
          <label class="campo-f">${hoja("formulario.meta.edificio")}${sel("id", ids.map(x => [x, x]), m.id)}</label>
          <label class="campo-f">${hoja("formulario.meta.material")}${sel("mat", MATERIALES.map(x => [x, x]), m.mat)}</label>
          <label class="campo-f">${hoja("formulario.meta.cantidad")}<input data-k="n" type="number" min="1" max="30" value="${m.n ?? ""}" ${m.tipo === "vaciar" ? "disabled" : ""}></label>
          <button type="button" class="btn chico" data-quitar-meta="${i}" data-formulario-i18n="formulario.quitar">${escapar(textoFormulario("formulario.quitar"))}</button></div>`).join("")}</div>
        <div><button type="button" class="btn chico" id="rf-mas-meta" data-formulario-i18n="formulario.meta.mas">${escapar(textoFormulario("formulario.meta.mas"))}</button></div>
        <div class="dos">${LIM.map(([k]) => `<label class="campo-f">${hoja(CLAVES_LIM[k])} ${hoja("formulario.limite.sin_limite")}<input id="rf-${k}" type="number" min="0" value="${d[k] ?? ""}"></label>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>${hoja("formulario.mapa")}</legend>
        ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label class="campo-f">${hoja("formulario.mapa.partir_de")}${sel("base", RETOS.map((r, i) => [String(i), `${i + 1} · ${r.titulo}`]), "", 'id="rf-base"')}</label><button type="button" class="btn chico" id="rf-cambiar-mapa" data-formulario-i18n="formulario.mapa.cambiar">${escapar(textoFormulario("formulario.mapa.cambiar"))}</button></div>` : ""}
        <div class="filas-f">${d.entidades.map((e, i) => `<div class="fila-f" data-ent="${i}">
          <label class="campo-f">${hoja(e.tipo === "bodega" ? "formulario.entidad.bodega" : "formulario.entidad.maquina")}<input data-k="id" maxlength="8" value="${escapar(e.id)}"></label>
          ${e.tipo === "bodega"
            ? MATERIALES.map(m => `<label class="campo-f">${m}<input data-k="stock-${m}" type="number" min="0" max="30" value="${e.stock[m] ?? ""}" placeholder="—"></label>`).join("") + `<label class="check"><input type="checkbox" data-k="oculto"${e.oculto ? " checked" : ""}> ${hoja("formulario.entidad.tapada")}</label>`
            : `<label class="campo-f">${hoja("formulario.entidad.acepta")}${sel("acepta", MATERIALES.map(x => [x, x]), e.acepta)}</label><label class="campo-f">${hoja("formulario.entidad.huecos")}<input data-k="cap" type="number" min="1" max="8" value="${e.cap}"></label><label class="campo-f">${hoja("formulario.entidad.segundos_pieza")}<input data-k="tProceso" type="number" min="0.5" max="30" step="0.5" value="${e.tProceso}"></label>`}
        </div>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>${hoja("formulario.bloques")}</legend>
        <div style="display:flex;gap:4px 14px;flex-wrap:wrap">${["recoger", "entregar", "repetir", "esperar", "mientras", "si"].map(t => `<label class="check"><input type="checkbox" data-ladrillo-f="${t}"${d.ladrillos.includes(t) ? " checked" : ""}> ${escapar(({recoger:"pickUp",entregar:"deliver",esperar:"wait",repetir:"repetir",mientras:"mientras",si:"si / si no"})[t])}</label>`).join("")}</div>
      </fieldset>
      ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primario" id="rf-guardar" data-formulario-i18n="formulario.guardar">${escapar(textoFormulario("formulario.guardar"))}</button>
        <button type="button" class="btn" id="rf-json-copiar" data-formulario-copiar-json>${escapar(textoFormulario("formulario.json.copiar"))}</button>
      </div>
      <details class="json"><summary>${hoja("formulario.json.pegar")}</summary>
        <textarea class="json" id="rf-json" ${atributo("aria-label", "formulario.json.aria")}></textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn chico" id="rf-json-aplicar" data-formulario-i18n="formulario.json.aplicar">${escapar(textoFormulario("formulario.json.aplicar"))}</button><span class="fila-bajo" id="rf-json-msg"></span></div>
      </details>` : ""}`;
    aplicarTextosFormulario();
  }
  function aplicarTextosFormulario() {
    for (const raiz of [$("esc-aviso"), $("esc-form")].filter(Boolean)) {
      for (const el of raiz.querySelectorAll("[data-formulario-i18n]")) {
        const clave = el.dataset.formularioI18n, texto = textoFormulario(clave);
        if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) el.firstChild.nodeValue = texto;
        else if (!el.childNodes.length) el.append(document.createTextNode(texto));
      }
      for (const el of raiz.querySelectorAll("[data-formulario-aria-label]"))
        el.setAttribute("aria-label", textoFormulario(el.dataset.formularioAriaLabel));
      for (const op of raiz.querySelectorAll("option[data-formulario-option]"))
        op.textContent = textoFormulario(op.dataset.formularioOption);
    }
    actualizarCopiaJSON();
  }
  function actualizarCopiaJSON() {
    const boton = $("rf-json-copiar");
    if (boton) {
      const texto = textoFormulario(jsonCopiado ? "formulario.json.copiado" : "formulario.json.copiar");
      if (boton.firstChild) boton.firstChild.nodeValue = texto;
      else boton.append(document.createTextNode(texto));
    }
  }
  window.addEventListener("cmg:idioma", aplicarTextosFormulario);
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
    const t = ev.target.closest?.("button") || ev.target, id = t.id;
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
      try { navigator.clipboard.writeText(txt).then(() => { jsonCopiado = true; actualizarCopiaJSON(); setTimeout(() => { jsonCopiado = false; actualizarCopiaJSON(); }, 1500); }, plan); } catch { plan(); }
      return;
    }
    if (id === "rf-json-aplicar") {
      try { guardarPropio(normalizarReto(JSON.parse($("rf-json").value))); }
      catch (e) { $("rf-json-msg").innerHTML = `<span data-formulario-i18n="formulario.json.error">${escapar(textoFormulario("formulario.json.error"))}</span>: <span>${escapar(e.message)}</span>`; }
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
