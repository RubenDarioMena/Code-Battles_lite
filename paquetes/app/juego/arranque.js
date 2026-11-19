import { FACTORY_FORM } from '../../interfaz/index.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarArranqueJuego(ctx) {
  // ---------- Arranque ----------
  ctx.leerColores();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { ctx.leerColores(); });
  new MutationObserver(() => ctx.leerColores()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  ctx.__banco = window.__banco = {
    get partida() { return ctx.partida; }, get registro() { return ctx.registroActual(); }, get eventos() { return ctx.eventos; }, get fin() { return ctx.finActual; },
    get mundo() { return ctx.mundo; }, get def() { return ctx.def; }, get programas() { return ctx.programas; }, get fuentes() { return ctx.fuentes; }, RETOS: ctx.RETOS, instrumentar: ctx.instrumentar, lexico: ctx.lexico, normalizar: ctx.normalizar,
    turbo(n) { ctx.turbo = n; }, fijarSemilla(n) { ctx.semillaFija = true; ctx.semilla = n; }, usarEscenario(d) { ctx.guardarPropio(ctx.ES_FACTORY ? ctx.factory.retos.normalizar(d) : ctx.normalizar(d), true); }, elegirReto: ctx.elegirReto, ejecutar: ctx.ejecutar, abrirPrograma: ctx.abrirPrograma, seleccionar: ctx.seleccionar, get seleccionadas() { return [...ctx.seleccionadas]; }, get telemetria() { return ctx.telemetria; },
    // QA: configurar antes de ejecutar. Sin controles de interfaz ni persistencia.
    pasoAPaso: false,
    pausas: () => ctx.conductor?.pausas() ?? [],
    avanzarLinea: unidad => ctx.conductor?.avanzarLinea(unidad),
    continuar: () => ctx.conductor?.continuar(),
    // QA: misma vía visual que alSucesos del conductor; nunca ordena ni modifica el mundo.
    sucesosVistas: lista => ctx.sucesosVistas(lista),
    medirEfectos: registrar => ctx.medirEfectos(registrar),
    // QA de carga: configuración externa y transitoria; solo actúa al invocarlo.
    medirUnidades: preparar => preparar(ctx),
    // QA terminal: se invoca dentro de alPaso; cierra el conductor antes del paso siguiente.
    congelarVista() { ctx.pausa = true; ctx.conductor?.cerrar(); ctx.pintarControles(); },
    get escenaVista() { return ctx.estadoVista.escena; },
    dibujarCaptura(escena, ahora) { ctx.vistaActual().dibujar(null, escena, 0, ahora); },
    // Campaign: la planta, sus checkpoints y la piel del mapa.
    get campana() { return { instantanea: () => ctx.campaign.instantaneaHistorica(ctx.mundo), quieto: () => ctx.campaign.quieto(ctx.mundo) }; }, get checkpoints() { return ctx.historialC; }, volverA: (i, conProgramas) => ctx.volverA(ctx.historialC[i], !!conProgramas), seguir: () => ctx.seguirCampaign(), nivelDeNuevo: () => ctx.nivelDeNuevo(),
  }; // para depurar y probar desde la consola
  const cmg = ctx.cmg = window.cmg = { editor: ctx.editorPrograma, get edicion() { return ctx.editorPrograma.fachada.edicion; }, get seudo() { return ctx.editorPrograma.fachada.seudo; }, tieneFoco: () => ctx.editorPrograma.fachada.tieneFoco(), get motorTexto() { return ctx.editorPrograma.fachada.motorTexto; }, serie: ctx.SERIE, insertar: ctx.insertar, envolver: ctx.envolver, alternarComentario: ctx.alternarComentario, medirEditor: ctx.medirEditor, get codigo() { return ctx.$codigo; }, get ejecutando() { return !!ctx.ejec; }, get confirmarReplace() { return ctx.confirmarReplace; }, set confirmarReplace(v) { ctx.preferirConfirmacionReplace(v); },
    // Para edicion.js (modo sin teclado, barra de edición y sugerencias).
    lexico: ctx.lexico, clasificar: ctx.clasificar, sugerencias: ctx.sugerencias, firma: (f) => ctx.FIRMAS[f] || null, reHueco: ctx.RE_HUECO, aviso: ctx.avisoEditor, alDesplazar: ctx.pintarBanda, alternarEjecucion: () => ctx.ejec ? ctx.detener() : ctx.ejecutar(),
    // Funciones disponibles para el menú de alternativas (clic derecho o mantener 2 s sin teclado).
    // Estado de la cámara 3D (clave de la postura, giro, inclinación, distancia y centro); lo usan las pruebas.
    camara: () => ctx.V3 && ctx.V3.camara(),
    // Retrato PNG (data URL) del modelo actual de un tipo de enemigo; sirve para regenerar img/enemigos/.
    retrato: (tipo) => ctx.V3 && ctx.TIPOS[tipo] ? ctx.V3.retrato(tipo) : null,
    proveedor: ctx.proveedorEditor,
    funciones: ctx.proveedorEditor.funciones,
    get claveDocumento() { return ctx.claveDocumento(); },
    // Para seudo.js: datos de la máquina, programa de partida y línea que se ejecuta.
    datos: () => ({
      lugares: ctx.ES_FACTORY ? ctx.mundo.entidades.map(e => ({ id: e.id, expresion: ctx.varFactory(e.id), tipo: e.tipo })) : [],
      materiales: ctx.factory.MATERIALES, ladrillos: ctx.def.ladrillos,
      tipos: Object.entries(ctx.TIPOS).map(([id, t]) => ({ id, nombre: t.nombre, enReto: ctx.def.oleadas.some(o => o.tipo === id) })),
      sensores: Object.entries(ctx.SENSOR).map(([id, x]) => ({ id, nombre: x.nombre, alcance: ctx.def.niebla ? x.niebla : x.alcance })),
      red: ctx.mundo ? ctx.mundo.sensores.map(x => ctx.varDe(x.id)) : [],
      otras: ctx.programablesDe(ctx.def).map(l => l.id).filter(id => !ctx.edicion.ids.includes(id)).map(ctx.varDe),
    }),
    inicial: () => ctx.edicion.mixto ? null : { texto: ctx.textoInicial(ctx.def, ctx.progSel), codigo: (ctx.def.inicial[ctx.progSel] || []).join("\n") + ((ctx.def.inicial[ctx.progSel] || []).length ? "\n" : "") },
    // Modo revisión (paquetes/app/juego/revision-juego.js): el código que hay ahora en el editor, sin ejecutarlo.
    revision: {
      get serie() { return ctx.SERIE; },
      get reto() { return ctx.retoIdx === ctx.IDX_PROPIO ? null : { numero: ctx.retoIdx + 1, titulo: ctx.def.titulo }; },
      get titulo() { return ctx.def.titulo; },
      get seleccionado() { return ctx.progSel; },
      programas: () => ctx.programablesDe(ctx.def).map(l => ({ id: l.id, lenguaje: ctx.lenguajeDe(l.id), texto: ctx.textoDe(l.id) || "" })),
    },
    get marcas() { return { corre: (!ctx.edicion.mixto && ctx.lineaCorre[ctx.progSel]) || null, err: !ctx.edicion.mixto && ctx.lineaErr && ctx.lineaErr.id === ctx.progSel ? ctx.lineaErr.linea : null }; } };
  // Pulsos: solo del programa (o programas con el mismo texto) que está en el editor.
  if (ctx.CMGPulsos) ctx.CMGPulsos.conectar({ visibles: () => ctx.edicion.mixto ? [] : ctx.edicion.ids });
  function actualizarEtiquetasSerie() {
    const sufijo = ctx.SERIE;
    ctx.$("c2d").setAttribute("aria-label", ctx.ti18n(ctx.ES_CAMPAIGN ? "campaign.canvas.2d" : `partida.canvas.${sufijo}.2d`));
    ctx.$("c3d").setAttribute("aria-label", ctx.ti18n(ctx.ES_CAMPAIGN ? "campaign.canvas.3d" : `partida.canvas.${sufijo}.3d`));
    ctx.$("t-escenario").textContent = ctx.ti18n(ctx.ES_CAMPAIGN ? "campaign.tab.historial" : ctx.ES_FACTORY ? "partida.escenario.tu_reto" : "partida.escenario.escenario");
    ctx.actualizarEtiquetasProgs();
  }
  if (ctx.ES_FACTORY) {
    document.title = "Code Battle Lite · Factory";
    document.documentElement.dataset.serie = "factory";
    /** @type {HTMLElement} */ (document.querySelector(".fila-sem")).hidden = true;
    /** @type {HTMLElement} */ (document.querySelector(".coordenadas-manuales")).hidden = true;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-modo-codigo="bloques"]')).forEach(b => b.hidden = false);
    ctx.$("info-t-enemigos").hidden = true;
    // Por id y no por href: Netlify (Pretty URLs) reescribe «probar.html» como «probar» y el selector fallaba,
    // cortando el arranque de Factory (pantalla negra, sin inspector ni Ejecutar).
    const probar = ctx.$("b-probar"); if (probar) { const u = new URL(probar.href, location.href); u.searchParams.set("serie", "factory"); probar.href = u.pathname + u.search; }
  }
  if (ctx.ES_CAMPAIGN) {
    document.title = ctx.ti18n("campaign.doc.titulo");
    document.documentElement.dataset.serie = "campaign";
    /** @type {HTMLElement} */ (document.querySelector(".fila-sem")).hidden = true;
    /** @type {HTMLElement} */ (document.querySelector(".coordenadas-manuales")).hidden = true;
    ctx.$("info-t-enemigos").hidden = true;
    ctx.$("b-reiniciar").removeAttribute("data-i18n");
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-modo-codigo="pseudo"], [data-modo-codigo="bloques"]'))) b.hidden = true;
    const probar = ctx.$("b-probar"); if (probar) { const u = new URL(probar.href, location.href); u.searchParams.set("serie", "campaign"); probar.href = u.pathname + u.search; }
    const $piel = ctx.$("b-piel");
    if ($piel) {
      $piel.hidden = false;
      const poner = (si) => { ctx.pielBatalla = !!si; ctx.guardado.escribir("campaign-piel", ctx.pielBatalla); $piel.setAttribute("aria-pressed", String(ctx.pielBatalla)); if (ctx.V3) ctx.V3.batalla(ctx.pielBatalla); };
      $piel.addEventListener("click", () => poner(!ctx.pielBatalla));
      ctx.ponerPiel = poner; poner(ctx.pielBatalla);
    }
  }
  for (const enlace of /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll("[data-serie]"))) {
    const url = new URL(location.href); url.searchParams.set("serie", enlace.dataset.serie);
    enlace.href = url.pathname + url.search + url.hash;
    enlace.setAttribute("aria-current", enlace.dataset.serie === (ctx.SERIE) ? "page" : "false");
  }
  const formularioFactory = ctx.ES_FACTORY ? FACTORY_FORM.crear({
    factory: ctx.factory, i18n: ctx.CMGI18n,
    retoActual: () => ctx.def, propioSel: () => ctx.retoIdx === ctx.IDX_PROPIO,
    guardar: d => ctx.guardarPropio(d, true), abrirPestana: ctx.abrirPestana,
    copiarPrograma: () => ctx.guardado.escribir("prog-factory-propio", { ...ctx.programas }),
  }) : null;
  ctx.formularioFactory = formularioFactory;
  ctx.pintarRuteo();
  ctx.def = ctx.defActual();
  ctx.pintarAyuda();
  ctx.aplicarVista(ctx.vista);
  ctx.aplicarLetra();
  ctx.elegirReto(ctx.retoIdx);
  if (ctx.paletaRota) ctx.avisoEditor("La paleta no se pudo cargar: recarga la página sin caché (Ctrl+F5 o Ctrl+Shift+R).");
  function actualizarTextosDinamicos() {
    ctx.actualizarEtiquetasControles();
    ctx.actualizarEtiquetasEdicion();
    ctx.actualizarEtiquetasSelectorLenguaje();
    actualizarEtiquetasSerie();
    if (ctx.ES_CAMPAIGN && ctx.mundo) { document.title = ctx.ti18n("campaign.doc.titulo"); ctx.pintarRetos(); ctx.pintarInspector(); ctx.pintarPieIns(); ctx.pintarAyuda(); ctx.pintarEscenario(); }
    ctx.actualizarEtiquetasRuteo();
    ctx.actualizarEtiquetasResumen();
    ctx.actualizarEtiquetaEventosVacios();
    ctx.actualizarEtiquetasConfirmaciones();
    ctx.actualizarTextoReplace();
    ctx.actualizarReloj();
    ctx.actualizarCopiaEscenario();
    ctx.actualizarPistaBanner();
    ctx.actualizarContenidoReto();
    ctx.metasClave = ""; ctx.pintarHud(false);
    // Solo las etiquetas de las metas; no se repinta la ficha ni se mueven sus portales.
    if (ctx.infoPestana === "metas" && !ctx.$("info-reto").hidden) {
      const temporal = document.createElement("div"); temporal.innerHTML = ctx.INFO.metas();
      for (const [i, el] of [...ctx.$("info-cuerpo").querySelectorAll(".info-nota, .m-nombre")].entries()) {
        const nuevo = temporal.querySelectorAll(".info-nota, .m-nombre")[i];
        if (nuevo) el.innerHTML = nuevo.innerHTML;
      }
    }
    const consolaVacia = ctx.$("consola").querySelector('[data-partida-i18n="consola.vacia"]');
    if (consolaVacia) consolaVacia.textContent = ctx.ti18n("partida.consola.vacia");
  }
  window.addEventListener("cmg:idioma", actualizarTextosDinamicos);
  actualizarTextosDinamicos();
  document.fonts && document.fonts.ready.then(() => { ctx.medirEditor(); });
  ctx.editorPrograma.iniciarVistas();
  requestAnimationFrame(ctx.bucle);

  return {
    get actualizarEtiquetasSerie() { return actualizarEtiquetasSerie; },
    get formularioFactory() { return formularioFactory; },
    get actualizarTextosDinamicos() { return actualizarTextosDinamicos; }
  };
}
