/** instalarMaquinas: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarMaquinas(ctx) {
  // ---------- Máquinas e inspector ----------
  function pintarMaquinas() {
    ctx.$("maquinas").innerHTML = ctx.localizarHTML(ctx.mundo.maquinas.map(e => `<button type="button" class="maq-chip" data-id="${e.id}" aria-pressed="${ctx.seleccionadas.has(e.id)}" style="--rol:var(--rol-${ctx.funcionDe(e).principal})">${e.id}</button>`).join("")
      + `<span class="fila-bajo" style="align-self:center">En el campo: toca para elegir, mantén presionado para abrir la ficha. Doble toque en el suelo y arrastra para seleccionar en cuadro. Con dos dedos: acerca, desplaza y gira.</span>`);
  }
  ctx.$("maquinas").addEventListener("click", (ev) => { const b = /** @type {any} */ (ev.target).closest(".maq-chip"); if (b) seleccionar(b.dataset.id); });
  // El inspector tiene tres estados: cerrado (nada elegido), tira (nombre y signos vitales) y abierto (ficha completa).
  // Empieza cerrado y solo se abre al elegir una unidad en el campo, en sus chips o en un enlace; abrir un
  // programa o corregir la selección cambia de unidad sin abrirlo (opción inspeccionar: "conservar").

  const inspectorCompleto = () => ctx.$("app").dataset.forma === "movil" && ctx.$("app").dataset.inspectorMovil !== "tira";
  function seleccionar(id, opciones = {}) {
    const ids = (Array.isArray(id) ? id : id ? [id] : []).filter(id => ctx.unidadPorId(id));
    ctx.seleccionadas = new Set(ids);
    ctx.seleccion = ids[0] || null;
    if (ctx.V3) ctx.V3.anillosDe(ctx.seleccion);
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".maq-chip")).forEach(b => b.setAttribute("aria-pressed", ctx.seleccionadas.has(b.dataset.id)));
    if (!ctx.seleccion || opciones.inspeccionar === false) ctx.insEstado = "cerrado";
    else if (opciones.inspeccionar === "conservar") { /* mismo estado, con la unidad nueva */ }
    else if (inspectorCompleto()) ctx.insEstado = "abierto";
    else if (ctx.insEstado === "cerrado") ctx.insEstado = "tira";
    const programables = ids.filter(id => Object.hasOwn(ctx.programas, id));
    ctx.configurarEdicion(programables.length ? programables : [ctx.progSel]);
    ctx.uiHito?.arbol?.();
    pintarInspector();
  }
  ctx.$("app").addEventListener("cmg:forma", () => {
    if (ctx.seleccion && inspectorCompleto() && ctx.insEstado !== "cerrado") ponerInspector("abierto");
  });
  function ponerInspector(estado) { ctx.insEstado = ctx.seleccion ? estado : "cerrado"; pintarInspector(); }
  const abrirInspector = () => ponerInspector("abierto");

  // Un token es algo que se puede insertar en el código: data-ins es el texto y data-fin el comentario de retorno.
  function tk(tipo, texto, ins, o = {}) {
    if (ctx.edicion.lenguaje === "python") { texto = ctx.aPython(String(texto)); ins = ctx.aPython(ins); if (o.fin) o = { ...o, fin: ctx.aPython(o.fin) }; }
    if (o.ajeno) return `<button type="button" class="tk tk-${tipo} ajeno" title="${ctx.esc(o.ajeno)}" data-ajeno="${ctx.esc(o.ajeno)}">${ctx.esc(texto)}</button>`;
    return `<button type="button" class="tk tk-${tipo}" draggable="true" data-ins="${ctx.esc(ins)}" data-clave="${ctx.esc(o.clave || ins)}"${o.fin ? ` data-fin="${ctx.esc(o.fin)}"` : ""}${o.vivo ? ` data-vivo="${ctx.esc(o.vivo)}"` : ""}>${ctx.esc(texto)}</button>`;
  }
  const fila = (...partes) => `<div class="fila-tk">${partes.join(" ")}</div>`;
  const nota = (t) => `<span class="nota">${t}</span>`;
  const TEXTOS_INSPECTOR = {
    "inspector.grupo.encargos": "Encargos de R1", "inspector.grupo.lecturas": "Lecturas", "inspector.grupo.lugares": "Lugares",
    "inspector.grupo.funciones": "Funciones", "inspector.grupo.propiedades": "Propiedades", "inspector.grupo.variables": "Variables y constantes",
    "inspector.grupo.red": "Red de sensores", "inspector.grupo.nombre": "Nombre", "inspector.grupo.contenido": "Contenido",
    "inspector.grupo.flujo": "Flujo", "inspector.grupo.sensores": "Sensores montados", "inspector.grupo.datos": "Datos",
    "inspector.grupo.tipo": "Tipo", "inspector.grupo.ven": "Lo ven",
    "inspector.seccion.codigo": "Para tu código", "inspector.seccion.metricas": "Métricas de este intento", "inspector.seccion.vitales": "Signos vitales",
    "inspector.leyenda.maquina": "máquina", "inspector.leyenda.funcion": "función", "inspector.leyenda.propiedad": "propiedad",
    "inspector.leyenda.numero": "número", "inspector.leyenda.texto": "texto",
    "inspector.leyenda.uso": "· doble toque: lo inserta en el programa de {unidad} · también se puede arrastrar",
    "inspector.pista.ficha": "Mantén presionada una unidad, o toca aquí, para ver su ficha completa.",
    "inspector.pista.sin_lanzador": "Elige un lanzador para ver lo que su programa puede usar.",
    "inspector.pista.sin_variables": "El programa todavía no declara ninguna (const o let).",
    "inspector.accion.centrar.aria": "Centrar la cámara en {unidad}", "inspector.accion.centrar.tip": "Centrar la cámara",
    "inspector.accion.plegar": "Plegar la ficha", "inspector.accion.abrir": "Abrir la ficha completa",
    "inspector.accion.ficha_completa": "Ficha completa", "inspector.accion.cerrar.aria": "Cerrar el inspector",
    "inspector.accion.cerrar.tip": "Cerrar", "inspector.accion.editar_programa": "Editar el programa de {unidad}",
    "inspector.seleccionadas": "{cantidad} seleccionadas",
    "inspector.vital.misiles": "Misiles", "inspector.vital.en_rango": "En rango", "inspector.vital.alcance": "Alcance",
    "inspector.vital.cola": "Cola", "inspector.vital.reparaciones": "Reparaciones", "inspector.vital.entregados": "Entregados",
    "inspector.vital.suministro": "Suministro", "inspector.vital.vida": "Vida", "inspector.vital.altura": "Altura",
    "inspector.vital.posicion": "Posición", "inspector.traza.ultimos": "últimos {segundos} s", "inspector.traza.escala": "escala",
    "inspector.traza.ahora": "ahora",
    "inspector.estado.robot.carga": "carga: {material}", "inspector.estado.robot.trabajando": "trabajando", "inspector.estado.robot.vacio": "manos vacías",
    "inspector.estado.bodega": "almacenando", "inspector.estado.fundidora.procesando": "procesando", "inspector.estado.fundidora.espera": "en espera",
    "inspector.estado.lanzador.atascado": "atascado", "inspector.estado.lanzador.sin_misiles": "sin misiles", "inspector.estado.lanzador.rafaga": "ráfaga",
    "inspector.estado.lanzador.disparando": "disparando", "inspector.estado.lanzador.inactivo": "inactivo",
    "inspector.estado.reparador.reparando": "reparando", "inspector.estado.reparador.va": "va a {objetivo}",
    "inspector.estado.reparador.vuelve": "vuelve", "inspector.estado.reparador.base": "en base",
    "inspector.estado.vibracion": "{cantidad} en rango", "inspector.estado.deposito": "suministrando",
    "inspector.estado.enemigo.vida": "vida {actual}/{maximo}",
    "inspector.clase.robot": "Robot de carga", "inspector.clase.bodega": "Bodega", "inspector.clase.fundidora": "Fundidora",
    "inspector.clase.lanzador": "Lanzamisiles", "inspector.clase.vibracion": "Sensor de vibración (red)",
    "inspector.clase.deposito": "Depósito de misiles", "inspector.clase.reparador": "Robot reparador", "inspector.clase.enemigo": "Enemigo",
    "inspector.clase.ensambladora": "Ensambladora", "inspector.clase.muelle": "Muelle",
    "inspector.enemigo.crawler": "oruga", "inspector.enemigo.drone": "dron", "inspector.enemigo.stealth": "dron frío",
    "inspector.rol.ofensiva": "Ofensiva", "inspector.rol.rastreo": "Rastreo y telemetría",
    "inspector.rol.utilitaria": "Utilitaria", "inspector.rol.fabrica": "Fábrica",
    "inspector.metrica.viajes": "viajes", "inspector.metrica.vacios": "vacíos", "inspector.metrica.rechazos": "rechazos",
    "inspector.metrica.entrada": "entrada", "inspector.metrica.producido": "producido", "inspector.metrica.lanzados": "lanzados",
    "inspector.metrica.impactos": "impactos", "inspector.metrica.precision": "precisión", "inspector.metrica.derribos": "derribos",
    "inspector.metrica.atascos": "atascos", "inspector.metrica.en_rafaga": "en ráfaga", "inspector.metrica.fallo_max": "fallo máx",
    "inspector.metrica.credito_gastado": "₵ gastado", "inspector.metrica.lecturas": "lecturas",
    "inspector.metrica.reparaciones": "reparaciones", "inspector.metrica.misiles_entregados": "misiles entregados",
    "inspector.descripcion.en_pantalla": "en pantalla {unidad}", "inspector.descripcion.en_programa_no_prefijo": "en su programa no hace falta escribirlo",
    "inspector.descripcion.solo_programa": "Solo desde el programa de {unidad}", "inspector.descripcion.posicion": "→ posición",
    "inspector.descripcion.disparo_segundo": "1 disparo/s", "inspector.descripcion.rafaga_fallo": "2,2 disparos/s · sube el fallo",
    "inspector.descripcion.dejar_disparo": "deja de disparar", "inspector.descripcion.entrada": "entrada:", "inspector.descripcion.salida": "· salida:",
    "inspector.descripcion.lanzamientos": "lanzamientos", "inspector.descripcion.suministro": "suministro:",
    "inspector.descripcion.suministro_misiles": "{cantidad} misil/s", "inspector.descripcion.disparos_segundo": "disparos/s",
    "inspector.descripcion.alcance_sensores": "alcance: cámara {visual} · térmico {thermal}{niebla}",
    "inspector.descripcion.tipos": "tipos:", "inspector.descripcion.tipo": "tipo:", "inspector.descripcion.vibracion_suelo": "vibración del suelo",
    "inspector.descripcion.alcance": "alcance:", "inspector.descripcion.casillas": "{cantidad} casillas", "inspector.descripcion.ve": "ve:",
    "inspector.descripcion.no_ve_drones": "· no ve drones",
    "inspector.descripcion.sensor_prediccion": "Da dónde está el enemigo ahora, no dónde estará: el misil llega tarde a lo que se mueve rápido.",
    "inspector.descripcion.sin_nombre": "No tiene nombre en el código en este banco.",
    "inspector.descripcion.salida_misiles": "{cantidad} misil/s a cada lanzador", "inspector.descripcion.cargador": "cargador de cada lanzador:",
    "inspector.descripcion.reparador": "Trabaja solo: atiende los atascos en orden de llegada.",
    "inspector.descripcion.velocidad": "velocidad:", "inspector.descripcion.velocidad_casillas": "{cantidad} casillas/s",
    "inspector.descripcion.reparacion": "reparación:", "inspector.descripcion.formula_reparacion": "{base} s + {fallo} s × failureRate del fallo",
    "inspector.descripcion.cola": "cola:", "inspector.descripcion.auto_apunta": "lo apunta",
    "inspector.descripcion.vida": "vida:", "inspector.descripcion.altura": "altura:", "inspector.descripcion.posicion_label": "posición:",
    "inspector.descripcion.motor_frio": "Motor frío: el térmico no lo ve.",
  };
  const textoInspector = (clave, params = {}) => {
    const i18n = ctx.CMGI18n;
    const texto = i18n && typeof i18n.t === "function" ? i18n.t(clave, params) : clave;
    return typeof texto === "string" && texto !== clave ? texto : (TEXTOS_INSPECTOR[clave] || clave).replace(/\{([a-z]+)\}/g, (_, n) => params[n] ?? `{${n}}`);
  };
  const paramsInspector = (params = {}) => Object.entries(params).map(([k, v]) => ` data-ins-i18n-param-${k}="${ctx.esc(v)}"`).join("");
  const hojaInspector = (clave, params = {}) => `data-ins-i18n-text="${clave}"${paramsInspector(params)}`;
  const spanInspector = (clave, params = {}) => `<span ${hojaInspector(clave, params)}>${ctx.esc(textoInspector(clave, params))}</span>`;
  const atributoInspector = (atributo, clave, params = {}) => `data-ins-i18n-${atributo}="${clave}"${paramsInspector(params)} ${atributo}="${ctx.esc(textoInspector(clave, params))}"`;
  const aplicarTextosInspector = (raiz) => {
    if (!raiz) return;
    const traducir = (el, clave, atributo = null) => {
      const params = {};
      for (const a of el.attributes) if (a.name.startsWith("data-ins-i18n-param-")) params[a.name.slice("data-ins-i18n-param-".length)] = a.value;
      const texto = textoInspector(clave, params);
      if (atributo) el.setAttribute(atributo, texto);
      else if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) el.firstChild.nodeValue = texto;
      else el.textContent = texto;
    };
    for (const el of raiz.querySelectorAll("[data-ins-i18n-text]")) traducir(el, el.dataset.insI18nText);
    for (const nombre of ["aria-label", "title", "data-tip"]) {
      const selector = `[data-ins-i18n-${nombre}]`;
      for (const el of raiz.querySelectorAll(selector)) traducir(el, el.getAttribute(`data-ins-i18n-${nombre}`), nombre);
    }
  };
  const textoEstadoInspector = (e) => {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.estado(e)[1];
    if (e.clase === "robot") return e.carga ? textoInspector("inspector.estado.robot.carga", { material: e.carga }) : e.tarea ? textoInspector("inspector.estado.robot.trabajando") : textoInspector("inspector.estado.robot.vacio");
    if (e.clase === "bodega") return textoInspector("inspector.estado.bodega");
    if (e.clase === "fundidora") return textoInspector(e.procesando ? "inspector.estado.fundidora.procesando" : "inspector.estado.fundidora.espera");
    if (e.clase === "lanzador") return textoInspector(e.atascado ? "inspector.estado.lanzador.atascado" : e.sinMisiles && e.modo !== "idle" ? "inspector.estado.lanzador.sin_misiles" : e.modo === "burst" ? "inspector.estado.lanzador.rafaga" : e.modo === "regular" ? "inspector.estado.lanzador.disparando" : "inspector.estado.lanzador.inactivo");
    if (e.clase === "reparador") return textoInspector(e.estado === "reparar" ? "inspector.estado.reparador.reparando" : e.estado === "ir" ? "inspector.estado.reparador.va" : e.estado === "volver" ? "inspector.estado.reparador.vuelve" : "inspector.estado.reparador.base", e.estado === "ir" ? { objetivo: e.objetivo } : {});
    if (e.clase === "vibracion") return textoInspector("inspector.estado.vibracion", { cantidad: ctx.enRango(e).length });
    if (e.clase === "deposito") return textoInspector("inspector.estado.deposito");
    return textoInspector("inspector.estado.enemigo.vida", { actual: e.hp, maximo: e.hpMax });
  };
  const claseInspector = (e) => {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.clase(e);
    if (e?.modelo) return ctx.ti18n('cv2.tipo.' + (e.clase || e.tipo));
    if (!e?.clase || e.clase === "enemigo") return `${textoInspector("inspector.clase.enemigo")} · ${textoInspector(`inspector.enemigo.${e.tipo}`)}`;
    if (e.clase === "bodega" || e.clase === "fundidora") {
      const claveNombre = { Bodega: "inspector.clase.bodega", Fundidora: "inspector.clase.fundidora", Ensambladora: "inspector.clase.ensambladora", Muelle: "inspector.clase.muelle" }[e.nombre];
      return claveNombre ? textoInspector(claveNombre) : e.nombre;
    }
    return textoInspector(`inspector.clase.${e.clase}`);
  };
  const rolInspector = (f) => f ? `${textoInspector(`inspector.rol.${f.principal}`)}${f.secundaria ? ` + ${textoInspector(`inspector.rol.${f.secundaria}`).toLowerCase()}` : ""}` : textoInspector("inspector.clase.enemigo");
  const CLAVES_METRICA = { viajes: "viajes", "vacíos": "vacios", rechazos: "rechazos", entrada: "entrada", producido: "producido", lanzados: "lanzados", impactos: "impactos", "precisión": "precision", derribos: "derribos", atascos: "atascos", "en ráfaga": "en_rafaga", "fallo máx": "fallo_max", "₵ gastado": "credito_gastado", lecturas: "lecturas", reparaciones: "reparaciones", "misiles entregados": "misiles_entregados" };
  const etiquetaMetricaInspector = (k) => CLAVES_METRICA[k] ? spanInspector(`inspector.metrica.${CLAVES_METRICA[k]}`) : ctx.esc(k);
  const htmlMetricas = (m) => m.map(([k, v]) => {
    return `<span class="m">${etiquetaMetricaInspector(k)} <b>${ctx.esc(v)}</b></span>`;
  }).join("");
  const refrescarInspectorIdioma = () => {
    aplicarTextosInspector(ctx.$("inspector"));
    aplicarTextosInspector(ctx.$("pie-ins"));
    const raiz = ctx.$("inspector");
    for (const est of raiz.querySelectorAll("[data-ins-estado]")) {
      const e = ctx.mundo.porId[est.dataset.insEstado] || ctx.mundo.enemigos.find(x => x.id === est.dataset.insEstado);
      if (e) est.textContent = textoEstadoInspector(e);
    }
    const clase = raiz.querySelector("[data-ins-clase]"); if (clase) { const e = ctx.seleccion && (ctx.mundo.porId[ctx.seleccion] || ctx.mundo.enemigos.find(x => x.id === ctx.seleccion)); if (e) clase.textContent = claseInspector(e); }
    const rol = raiz.querySelector("[data-ins-rol]"); if (rol) { const e = ctx.seleccion && (ctx.mundo.porId[ctx.seleccion] || ctx.mundo.enemigos.find(x => x.id === ctx.seleccion)); rol.textContent = rolInspector(e && ctx.funcionDe(e)); }
  };
  window.addEventListener("cmg:idioma", refrescarInspectorIdioma);
  const CLAVES_GRUPO = {
    "Encargos de R1": "inspector.grupo.encargos", "Lecturas": "inspector.grupo.lecturas", "Lugares": "inspector.grupo.lugares",
    "Funciones": "inspector.grupo.funciones", "Propiedades": "inspector.grupo.propiedades", "Variables y constantes": "inspector.grupo.variables",
    "Red de sensores": "inspector.grupo.red", "Nombre": "inspector.grupo.nombre", "Contenido": "inspector.grupo.contenido",
    "Flujo": "inspector.grupo.flujo", "Sensores montados": "inspector.grupo.sensores", "Datos": "inspector.grupo.datos",
    "Tipo": "inspector.grupo.tipo", "Lo ven": "inspector.grupo.ven",
  };
  const grupo = (titulo, ...filas) => {
    const clave = CLAVES_GRUPO[titulo];
    const encabezado = titulo ? (clave ? `<div class="g">${spanInspector(clave)}</div>` : `<div class="g">${titulo}</div>`) : "";
    return `<div class="grupo-tk">${encabezado}${filas.join("")}</div>`;
  };
  const tkValor = (v, vivo) => typeof v === "number" ? tk("num", v, String(v), { vivo, clave: vivo }) : typeof v === "boolean" ? tk("kw", v, String(v), { vivo, clave: vivo }) : tk("str", JSON.stringify(v), JSON.stringify(v), { vivo, clave: vivo });

  function estadoDe(e) {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.estado(e);
    if (e.clase === "robot") return [e.tarea ? "activo" : "", e.carga ? `carga: ${e.carga}` : e.tarea ? "trabajando" : "manos vacías"];
    if (e.clase === "bodega") return ["", "almacenando"];
    if (e.clase === "fundidora") return [e.procesando ? "activo" : "", e.procesando ? "procesando" : "en espera"];
    if (e.clase === "lanzador") {
      if (e.atascado) return ["mal", "atascado"];
      if (e.sinMisiles && e.modo !== "idle") return ["alerta", "sin misiles"];
      if (e.modo === "burst") return ["alerta", "ráfaga"];
      if (e.modo === "regular") return ["activo", "disparando"];
      return ["", "inactivo"];
    }
    if (e.clase === "reparador") return e.estado === "reparar" ? ["activo", "reparando"] : e.estado === "ir" ? ["activo", `va a ${e.objetivo}`] : e.estado === "volver" ? ["", "vuelve"] : ["", "en base"];
    if (e.clase === "vibracion") return [ctx.enRango(e).length ? "activo" : "", `${ctx.enRango(e).length} en rango`];
    if (e.clase === "deposito") return ["", "suministrando"];
    return ["mal", `vida ${e.hp}/${e.hpMax}`];
  }
  const metricasDe = (e) => {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.metricas(e);
    if (e.clase === "robot") return [["viajes", e.viajes], ["vacíos", ctx.mundo.vacios], ["rechazos", ctx.mundo.rechazos]];
    if (e.clase === "bodega") return Object.entries(e.stock).map(([mat, n]) => [mat, e.oculto && !ctx.mundo.revelado ? "?" : n]);
    if (e.clase === "fundidora") return [["entrada", `${e.entrada}/${e.cap}`], ["producido", e.producido], ["rechazos", e.rechazos]];
    if (e.clase === "lanzador") {
      const s = e.st;
      return [["lanzados", s.lanzados], ["impactos", s.impactos], ["precisión", s.lanzados ? `${Math.round(s.impactos / s.lanzados * 100)} %` : "—"], ["derribos", s.derribos], ["atascos", s.atascos], ["en ráfaga", `${s.tRafaga.toFixed(1)} s`], ["fallo máx", `${Math.round(s.fallaMax * 100)} %`], ["₵ gastado", s.consumidos * ctx.COSTE.misil]];
    }
    if (e.clase === "vibracion") return [["lecturas", ctx.registroActual().lecturas?.[e.id] ?? 0]];
    if (e.clase === "reparador") return [["reparaciones", e.st.reparaciones], ["₵ gastado", e.st.reparaciones * ctx.COSTE.reparacion]];
    if (e.clase === "deposito") return [["misiles entregados", ctx.mundo.consumidos]];
    return null;
  };

  function pintarInspector() {
    const $i = ctx.$("inspector");
    const e = ctx.seleccion && (ctx.mundo.porId[ctx.seleccion] || ctx.mundo.enemigos.find(x => x.id === ctx.seleccion));
    if (!e) ctx.insEstado = "cerrado";
    $i.dataset.estado = ctx.insEstado;
    ctx.uiHito?.ficha?.(ctx.insEstado === "abierto" ? e : null);
    if (!e) { ctx.$("ins-tira").innerHTML = ctx.htmlInterfaz(""); ctx.$("ins-cuerpo").innerHTML = ctx.htmlInterfaz(""); return; }
    const propioProg = e.id === ctx.progSel, pre = propioProg ? "" : `${ctx.varDe(e.id)}.`;
    let c1 = "", c2 = "", botones = "";
    if (ctx.ES_CAMPAIGN) ({ c1, c2, botones } = ctx.uiC.ficha(e));
    else if (["robot", "bodega", "fundidora"].includes(e.clase)) {
      c1 = ctx.htmlFactoryAPI();
      c2 = grupo("Datos", ...metricasDe(e).map(([k, v]) => fila(nota(etiquetaMetricaInspector(k)), ctx.esc(v))));
    } else if (e.clase === "lanzador") {
      const ajeno = propioProg ? null : `Solo desde el programa de ${e.id}`;
      c1 = grupo("Nombre", fila(tk("var", ctx.varDe(e.id), ctx.varDe(e.id)), nota(`en pantalla ${e.id}${propioProg ? " · en su programa no hace falta escribirlo" : ""}`)))
        + grupo("Contenido", fila(tk("prop", `${pre}missiles`, `${pre}missiles`), `<span class="sep">=</span>`, tkValor(e.misiles, `${e.id}:missiles`), nota(`/ ${ctx.def.cargador} misiles`)))
        + grupo("Funciones",
          fila(tk("fn", `${pre}autoTarget(tipo, sensor)`, `${pre}autoTarget(/* tipo de enemigo */, /* sensor */)`, { fin: "// → posición {x, y, z} o null" }), nota("→ posición")),
          fila(tk("fn", `${pre}regularShoot(lugar)`, `${pre}regularShoot(/* lugar */);`, { ajeno }), nota("1 disparo/s")),
          fila(tk("fn", `${pre}burstFire(lugar)`, `${pre}burstFire(/* lugar */);`, { ajeno }), nota("2,2 disparos/s · sube el fallo")),
          fila(tk("fn", `${pre}stopFire()`, `${pre}stopFire();`, { ajeno }), nota("deja de disparar")));
      c2 = grupo("Flujo", fila(nota("entrada:"), "misiles", nota("· salida:"), "lanzamientos"), fila(nota("suministro:"), `${ctx.def.suministro} misil/s`))
        + grupo("Propiedades",
          fila(tk("prop", `${pre}fireRate`, `${pre}fireRate`), `<span class="sep">=</span>`, tkValor(ctx.cadencia(e.modo), `${e.id}:fireRate`), nota("disparos/s")),
          fila(tk("prop", `${pre}failureRate`, `${pre}failureRate`), `<span class="sep">=</span>`, tkValor(ctx.r3(e.falla), `${e.id}:failureRate`), `<span class="barra"><i data-barra="${e.id}" style="width:${Math.round(e.falla * 100)}%"></i></span>`),
          fila(tk("prop", `${pre}mode`, `${pre}mode`), `<span class="sep">=</span>`, tkValor(e.modo, `${e.id}:mode`)),
          fila(tk("prop", `${pre}jammed`, `${pre}jammed`), `<span class="sep">=</span>`, tkValor(e.atascado, `${e.id}:jammed`)),
          fila(tk("prop", `${pre}target`, `${pre}target`), `<span class="sep">=</span>`, `<span class="nota" data-vivo="${e.id}:target">${ctx.esc(ctx.fmtLugar(e.lugar))}</span>`))
        + grupo("Sensores montados", fila(tk("prop", `${pre}sensors`, `${pre}sensors`), `<span class="sep">=</span>`, tk("str", '"visual"', '"visual"'), tk("str", '"thermal"', '"thermal"')),
          fila(nota(`alcance: cámara ${ctx.alcance("visual")} · térmico ${ctx.alcance("thermal")}${ctx.def.niebla ? " (niebla)" : ""}`)),
          fila(nota("tipos:"), ...Object.keys(ctx.TIPOS).map(t => tk("str", `"${t}"`, `"${t}"`))));
      botones = (propioProg ? "" : `<button type="button" class="btn chico" data-accion="programa" ${atributoInspector("aria-label", "inspector.accion.editar_programa", { unidad: e.id })} data-ins-i18n-text="inspector.accion.editar_programa">${ctx.esc(textoInspector("inspector.accion.editar_programa", { unidad: e.id }))}</button>`);
    } else if (e.programable && e.modelo) {
      c1 = grupo("Funciones", ...ctx.extension.verbos.map(f => fila(tk("fn", f.nombre, f.paleta), nota(ctx.ti18n(f.nota)))));
      c2 = grupo("Contenido", fila(tk("prop", "hp", pre + "hp"), tkValor(e.hp, e.id + ":hp")),
        fila(tk("prop", "missiles", pre + "missiles"), tkValor(e.misiles, e.id + ":missiles")));
    } else if (e.clase === "vibracion") {
      c1 = grupo("Nombre", fila(tk("var", ctx.varDe(e.id), ctx.varDe(e.id)), nota(`en pantalla ${e.id}`)))
        + grupo("Funciones", fila(tk("fn", `${ctx.varDe(e.id)}.detect(tipo)`, `${ctx.varDe(e.id)}.detect(/* tipo de enemigo */)`, { fin: "// → posición actual o null" }), nota("→ posición, sin predicción")))
        + grupo("Propiedades", fila(tk("prop", `${ctx.varDe(e.id)}.count`, `${ctx.varDe(e.id)}.count`), `<span class="sep">=</span>`, tkValor(ctx.enRango(e).length, `${e.id}:count`), nota("enemigos de suelo en rango")));
      c2 = grupo("", fila(nota("tipo:"), "vibración del suelo"), fila(nota("alcance:"), `${e.alcance} casillas`), fila(nota("ve:"), tk("str", '"crawler"', '"crawler"'), nota("· no ve drones")),
        fila(nota("Da dónde está el enemigo ahora, no dónde estará: el misil llega tarde a lo que se mueve rápido.")));
    } else if (e.clase === "deposito") {
      c1 = grupo("", fila(nota("No tiene nombre en el código en este banco.")));
      c2 = grupo("", fila(nota("salida:"), `${ctx.def.suministro} misil/s a cada lanzador`), fila(nota("cargador de cada lanzador:"), `${ctx.def.cargador}`));
    } else if (e.clase === "reparador") {
      c1 = grupo("", fila(nota("Trabaja solo: atiende los atascos en orden de llegada.")));
      c2 = grupo("", fila(nota("velocidad:"), `${ctx.REP.vel} casillas/s`), fila(nota("reparación:"), `${ctx.REP.tBase} s + ${ctx.REP.tPorFallo} s × failureRate del fallo`), fila(nota("cola:"), `<span class="nota" data-vivo="cola">${ctx.mundo.colaReparar.join(", ") || "vacía"}</span>`));
    } else {
      const tp = ctx.TIPOS[e.tipo];
      const ven = [...(tp.frio ? [] : ["thermal"]), "visual"].sort();
      const vib = ctx.mundo.sensores[0];
      c1 = grupo("Tipo", fila(tk("str", `"${e.tipo}"`, `"${e.tipo}"`), nota(`autoTarget("${e.tipo}", …) lo apunta`)))
        + grupo("Lo ven", fila(...ven.map(s => tk("str", `"${s}"`, `"${s}"`))), tp.suelo && vib ? fila(tk("fn", `${ctx.varDe(vib.id)}.detect("${e.tipo}")`, `${ctx.varDe(vib.id)}.detect("${e.tipo}")`)) : "");
      c2 = grupo("", fila(nota("vida:"), `<span data-vivo="${e.id}:hp">${e.hp}/${e.hpMax}</span>`), fila(nota("velocidad:"), `${-e.vx} casillas/s`), fila(nota("altura:"), `${e.z} m${tp.suelo ? " (suelo)" : ""}`),
        fila(nota("posición:"), `<span class="nota" data-vivo="${e.id}:pos">x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}</span>`), tp.frio ? fila(nota("Motor frío: el térmico no lo ve.")) : "");
    }
    const seleccionadasTexto = ctx.seleccionadas.size > 1 ? ` · <span ${hojaInspector("inspector.seleccionadas", { cantidad: ctx.seleccionadas.size })}>${ctx.esc(textoInspector("inspector.seleccionadas", { cantidad: ctx.seleccionadas.size }))}</span>` : "";
    const [cls] = estadoDe(e);
    const m = metricasDe(e);
    const abierto = ctx.insEstado === "abierto";
    const f = ctx.funcionDe(e);
    $i.style.setProperty("--rol", f ? `var(--rol-${f.principal})` : "var(--enemigo)");
    const clase = claseInspector(e);
    const rol = rolInspector(f);
    ctx.$("ins-tira").innerHTML = ctx.htmlInterfaz(`
      <div class="ins-cab"><div class="nombre"><h2>${ctx.esc(e.id)}${seleccionadasTexto}</h2><span class="estado ${cls}" data-estado data-ins-estado="${ctx.esc(e.id)}">${ctx.esc(textoEstadoInspector(e))}</span><span class="clase" data-ins-clase>${ctx.esc(clase)}</span><span class="rol" data-ins-rol>${ctx.esc(rol)}</span></div>
        <div class="ins-acc">${ctx.V3 && ctx.vista === "3d" ? `<button type="button" data-accion="centrar" ${atributoInspector("aria-label", "inspector.accion.centrar.aria", { unidad: e.id })} ${atributoInspector("data-tip", "inspector.accion.centrar.tip")}>⌖</button>` : ""}<button type="button" data-accion="${abierto ? "plegar" : "abrir"}" ${atributoInspector("aria-label", `inspector.accion.${abierto ? "plegar" : "abrir"}`)} ${atributoInspector("data-tip", `inspector.accion.${abierto ? "plegar" : "ficha_completa"}`)}>${abierto ? "▴" : "▾"}</button><button type="button" data-accion="cerrar" ${atributoInspector("aria-label", "inspector.accion.cerrar.aria")} ${atributoInspector("data-tip", "inspector.accion.cerrar.tip")}>×</button></div></div>
      ${abierto ? "" : `<div class="vitales" id="ins-vitales">${ctx.htmlVitales(e)}</div>`}
      <div class="ins-pista" ${hojaInspector("inspector.pista.ficha")}>${ctx.esc(textoInspector("inspector.pista.ficha"))}</div>`);
    ctx.$("ins-cuerpo").innerHTML = ctx.htmlInterfaz(`
      <div class="regla"></div>
      <div class="ins-cols"><div class="ins-col"><h3><span class="placa" ${hojaInspector("inspector.seccion.codigo")}>${ctx.esc(textoInspector("inspector.seccion.codigo"))}</span></h3>${c1}</div><div class="ins-col"><h3><span class="placa" ${hojaInspector("inspector.grupo.datos")}>${ctx.esc(textoInspector("inspector.grupo.datos"))}</span></h3>${c2}</div></div>
      ${botones ? `<div class="fila-botones">${botones}</div>` : ""}
      ${m ? `<div class="regla"></div><div class="grupo-tk"><h3 class="metricas-tit"><span class="placa" ${hojaInspector("inspector.seccion.metricas")}>${ctx.esc(textoInspector("inspector.seccion.metricas"))}</span></h3><div class="metricas" data-metricas>${htmlMetricas(m)}</div></div>` : ""}
      <div class="regla"></div>
      <div class="leyenda-tk"><span class="tk-var" ${hojaInspector("inspector.leyenda.maquina")}>${ctx.esc(textoInspector("inspector.leyenda.maquina"))}</span><span class="tk-fn" ${hojaInspector("inspector.leyenda.funcion")}>${ctx.esc(textoInspector("inspector.leyenda.funcion"))}</span><span class="tk-prop" ${hojaInspector("inspector.leyenda.propiedad")}>${ctx.esc(textoInspector("inspector.leyenda.propiedad"))}</span><span class="tk-num" ${hojaInspector("inspector.leyenda.numero")}>${ctx.esc(textoInspector("inspector.leyenda.numero"))}</span><span class="tk-str" ${hojaInspector("inspector.leyenda.texto")}>${ctx.esc(textoInspector("inspector.leyenda.texto"))}</span>
        <span style="font-family:var(--f-body);font-weight:400" ${hojaInspector("inspector.leyenda.uso", { unidad: ctx.progSel })}>${ctx.esc(textoInspector("inspector.leyenda.uso", { unidad: ctx.progSel }))}</span></div>
      <div class="pista-tk" id="pista-tk"></div>
      ${abierto ? `<div class="regla"></div><div class="grupo-tk ins-vitales-final"><h3><span class="placa" ${hojaInspector("inspector.seccion.vitales")}>${ctx.esc(textoInspector("inspector.seccion.vitales"))}</span></h3><div class="vitales" id="ins-vitales">${ctx.htmlVitales(e)}</div></div>` : ""}`);
    aplicarTextosInspector(ctx.$("ins-tira"));
    aplicarTextosInspector(ctx.$("ins-cuerpo"));
    ctx.uiHito?.mini?.(e, ctx.insEstado); // Campaign-V2: la tira se vuelve la minificha (interfaz/minificha.js).
  }

  return {
    pintarMaquinas, inspectorCompleto, seleccionar, ponerInspector, abrirInspector, tk, fila, nota,
    textoInspector, hojaInspector, spanInspector, aplicarTextosInspector, textoEstadoInspector,
    CLAVES_METRICA, htmlMetricas, grupo, tkValor, estadoDe, metricasDe, pintarInspector
  };
}
