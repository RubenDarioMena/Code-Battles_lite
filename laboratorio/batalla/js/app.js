/* Laboratorio de batalla · página: editor por unidad, clics del jugador, HUD y consola.
 * El editor es la instancia compartida de shared/editor (la misma del juego), con un proveedor propio. */
(() => {
  "use strict";
  const M = window.LAB_MUNDO, RT = window.LAB_RUNTIME, { ESCENARIOS } = window.LAB_ESCENARIOS;
  const { TIPOS, CLASES, DT } = M;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const varDe = (id) => id.replace(/-/g, "_");
  const CLAVE = "cbl-lab-batalla:";
  const guardado = {
    leer(k, d) { try { const v = localStorage.getItem(CLAVE + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    escribir(k, v) { try { localStorage.setItem(CLAVE + k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento: dura la sesión */ } },
  };
  const ARTICULOS = { torreta: "una torreta", vehiculo: "un vehículo", rueda: "una rueda kamikaze", radar: "un radar" };
  const conf = () => ({ velMisil: M.MISIL.vel, tipos: Object.keys(TIPOS), articulos: ARTICULOS });
  const URL_TRABAJADOR = URL.createObjectURL(new Blob([RT.fuente], { type: "text/javascript" }));

  // ---------- Estado ----------
  const q = new URLSearchParams(location.search);
  let idx = Math.min(ESCENARIOS.length - 1, Math.max(0, q.has("prueba") ? (+q.get("prueba") || 1) - 1 : guardado.leer("prueba", 0)));
  let def = null, mundo = null, sim = null, rt = null, programas = {}, abierta = null, velocidad = 1, pausa = false, acum = 0;
  let repeticion = null, ultimas = null, intento = 0, errores = {};
  const seleccion = new Set(), efectos = [], globos = new Map();
  let oyen = new Set();
  const programables = () => def.unidades.filter(u => u.clase !== "radar");
  const corriendo = () => !!rt && mundo.activo && !mundo.fin;

  // ---------- Mundo y programas ----------
  function nuevoMundo() {
    mundo = M.crear(def, 1);
    sim = M.conectar(mundo, {
      registrar: (id, texto, clase) => linea("sim " + (clase || ""), id, texto),
      alLlegar: (id, res) => rt && rt.alLlegar(id, res), alDano: (id, info) => rt && rt.alDano(id, info),
      alDestruir: (id) => rt && rt.alDestruir(id), alReponer: (id) => rt && rt.alReponer(id),
      terminar,
    });
    acum = 0;
  }
  function ejecutar(entradas) {
    if (rt) rt.cerrar();
    limpiarConsola(); errores = {}; efectos.length = 0; globos.clear(); ocultarBanner();
    nuevoMundo(); intento++;
    repeticion = entradas ? entradas.map(e => ({ ...e })) : null;
    rt = RT.crear({
      mundo, sim, codigos: { ...programas }, conf: conf(), crearTrabajador: () => new Worker(URL_TRABAJADOR), ahora: () => performance.now(),
      alConsola: (id, nivel, texto) => { linea(nivel, id, texto); globos.set(id, { nivel, texto, hasta: performance.now() + 2600 }); },
      alError: (id, mensaje, nLinea) => { errores[id] = { mensaje, linea: nLinea }; linea("error", id, mensaje, nLinea); marcarError(); },
      alCambio: () => { sucio = true; },
    });
    rt.alAsentar = bombear;
    mundo.activo = true; pausa = false;
    rt.iniciar();
    if (repeticion) linea("sim info", "—", `Repetición: ${repeticion.length} entradas grabadas (clics y reprogramaciones).`);
    aviso(repeticion ? "Repitiendo tus clics con el código de ahora." : oyentesEsperados() ? "Toca el terreno o un enemigo para mandar una orden." : "Esta prueba corre sola. Puedes cambiar el programa y volver a ejecutar.");
    estadoUI(); $("lab").dataset.panel = "batalla"; pintarPaneles();
  }
  const oyentesEsperados = () => Object.values(programas).some(p => /onClick\s*\(/.test(p));
  function detener() {
    if (!rt) return;
    rt.cerrar(); rt = null; ultimas = mundo.entradas.length ? mundo.entradas : ultimas;
    nuevoMundo(); pausa = false; ocultarBanner(); estadoUI();
  }
  function terminar(resultado, motivo, texto) {
    mundo.fin = { resultado, motivo, texto };
    ultimas = mundo.entradas;
    if (rt) rt.cerrar();
    const u = mundo.unidades, suma = (k) => u.reduce((s, x) => s + x.st[k], 0);
    mostrarBanner(resultado, resultado === "victoria" ? "Muro en pie" : "Derrota", texto || `Quedó ${mundo.muro} de ${mundo.muroMax} de integridad.`, [
      ["Tiempo", fmtTiempo(mundo.t)], ["Muro", `${mundo.muro}/${mundo.muroMax}`], ["Derribos", `${mundo.derribos}/${mundo.total}`],
      ["Misiles", mundo.consumidos], ["Bajas propias", suma("bajas") - suma("detonaciones")], ["Detonaciones", suma("detonaciones")], ["Clics", mundo.nClics],
    ]);
    linea("sim " + (resultado === "victoria" ? "ok" : "bad"), "—", resultado === "victoria" ? `Victoria en ${fmtTiempo(mundo.t)}: muro ${mundo.muro}/${mundo.muroMax}.` : `Derrota: ${texto}`);
    estadoUI();
  }

  // Lockstep: avanza los pasos que quepan en el tiempo acumulado; vuelve a intentarlo cuando los programas se asientan.
  function inyectar(paso) {
    while (repeticion && repeticion.length && repeticion[0].paso <= paso) {
      const e = repeticion.shift();
      if (e.programa) rt.reprogramar(e.programa.id, e.programa.codigo);
      else { rt.clic(e.clic.x, e.clic.y, e.clic.enemigo, e.clic.ids); efectos.push({ x: e.clic.x, y: e.clic.y, t0: performance.now(), enemigo: !!e.clic.enemigo }); }
    }
  }
  function bombear() {
    if (!corriendo() || pausa) return;
    const n = RT.bombear(mundo, sim, rt, Math.floor(acum / DT + 1e-9), repeticion ? inyectar : null);
    acum -= n * DT;
  }

  // ---------- Clics en el campo ----------
  function unidadEn(x, y, radio) {
    let mejor = null, d0 = Math.min(1.3, radio);
    for (const u of mundo.unidades) { const ux = u.viva ? u.cx : u.hx, uy = u.viva ? u.cy : u.hy, d = Math.hypot(ux - x, uy - y); if (d <= d0) { mejor = u; d0 = d; } }
    return mejor;
  }
  function alToque({ x, y, radio }) {
    if (x < 0 || y < 0 || x > M.COLS || y > M.ROWS) return;
    const u = unidadEn(x, y, radio);
    if (u) {
      // Tocar una unidad propia la elige como destinataria (y abre su programa); no es una orden.
      if (u.clase === "radar") return aviso("RAD-01 es el radar: no tiene programa. Los demás lo leen con RAD_01.detect(), .locate() y .list().");
      if (seleccion.has(u.id)) seleccion.delete(u.id); else seleccion.add(u.id);
      abrirPrograma(u.id); pintarDestinatarios();
      return;
    }
    if (!corriendo()) return aviso("Pulsa ▶ Ejecutar: los clics son órdenes durante la batalla.");
    const e = sim.enemigoEn(x, y, radio), ids = seleccion.size ? [...seleccion] : null;
    const escuchan = rt.oyen("click").filter(id => !ids || ids.includes(id));
    rt.clic(x, y, e ? e.id : null, ids);
    efectos.push({ x: e ? e.x : x, y: e ? e.y : y, t0: performance.now(), enemigo: !!e, sordo: !escuchan.length });
    if (!escuchan.length) aviso(ids ? "Las unidades elegidas no escuchan clics: añade terrain.onClick(…) o enemies.onClick(…) a su programa." : "Ningún programa escucha clics todavía: añade terrain.onClick(…) o enemies.onClick(…).");
    bombear();
  }

  // ---------- Editor (instancia compartida) ----------
  const svg = (cuerpo) => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
  const cursor = `<path class="t1" d="M9 4l14 12.4-6.3.9 3.6 7.6-3 1.4-3.6-7.6L9 23z"/>`;
  const ICONOS = { ...(window.ICONOS || {}),
    mover: { c1: "#B7C2CC", c2: "#FF5DB8", svg: svg(`<circle class="s1" stroke-width="2.4" cx="9" cy="22" r="5"/><path class="s2" stroke-width="2.6" stroke-linecap="round" d="M14 17l11-11"/><path class="t2" d="M27.5 3.5l-.8 8.4-7.6-7.6z"/>`) },
    llegar: { c1: "#B7C2CC", c2: "#5FC28A", svg: svg(`<path class="s1" stroke-width="2.6" stroke-linecap="round" d="M8 4v25"/><path class="t2" d="M10 5h15l-4 5.5 4 5.5H10z"/>`) },
    parar: { c1: "#F07A70", svg: svg(`<rect class="t1" x="8" y="8" width="16" height="16" rx="3"/>`) },
    detonar: { c1: "#F7B94A", c2: "#F0645A", svg: svg(`<path class="t1" d="M16 2l3.2 7.6 7.8-2.8-3.6 7.2 6.6 4.4-8 1.2 1 8-6.2-5.2-5 6-.4-8.2-8-1.6 6.8-4.2L6.6 7l7.6 3z"/><circle class="t2" cx="16" cy="16" r="3.4"/>`) },
    seguir: { c1: "#B7C2CC", c2: "#7FA3FF", svg: svg(`<circle class="s1" stroke-width="2.2" cx="16" cy="16" r="9"/><path class="s1" stroke-width="2.2" stroke-linecap="round" d="M16 3v6M16 23v6M3 16h6M23 16h6"/><circle class="t2" cx="16" cy="16" r="3"/>`) },
    clicTerreno: { c1: "#7FA3FF", c2: "#5C6B75", svg: svg(`<path class="s2" stroke-width="1.8" d="M3 27h26M3 21h8M21 21h8M6 15h4M22 15h4"/>${cursor}`) },
    clicEnemigo: { c1: "#F2F6F8", c2: "#E0644F", svg: svg(`<path class="s2" stroke-width="2.4" stroke-linecap="round" d="M4 9V4h5M23 4h5v5M28 23v5h-5M9 28H4v-5"/>${cursor}`) },
    alDano: { c1: "#E0AE4A", c2: "#F07A70", svg: svg(`<path class="s1" stroke-width="2.4" stroke-linejoin="round" d="M16 3l11 4v8c0 7-4.6 11.6-11 14C9.6 26.600 5 22 5 15V7z"/><path class="s2" stroke-width="2.6" stroke-linecap="round" d="M17.500 8l-4 8h5l-4 8"/>`) },
  };
  const FUNCIONES = [
    { grupo: "Sensores", nombre: "autoTarget", firma: ["tipo de enemigo"], nota: "→ dónde disparar (o null)" },
    { grupo: "Sensores", nombre: "track", firma: ["enemigo"], nota: "sigue a un enemigo por su id" },
    { grupo: "Arma", nombre: "regularShoot", firma: ["lugar"], nota: "1 disparo/s a ese lugar" },
    { grupo: "Arma", nombre: "stopFire", firma: [], nota: "deja de disparar" },
    { grupo: "Movimiento", nombre: "moveTo", firma: ["lugar"], nota: "pone rumbo a ese lugar" },
    { grupo: "Movimiento", nombre: "stop", firma: [], nota: "se queda donde está" },
    { grupo: "Movimiento", nombre: "arrive", firma: [], await: true, nota: "espera a llegar" },
    { grupo: "Carga", nombre: "detonate", firma: [], nota: "explota aquí" },
    { grupo: "Tiempo", nombre: "wait", firma: ["segundos"], await: true, nota: "pausa este hilo" },
    { grupo: "Eventos", nombre: "onClick", firma: ["función"], nota: "cualquier clic" },
    { grupo: "Eventos", objeto: "terrain", nombre: "onClick", firma: ["función"], nota: "clic en el terreno" },
    { grupo: "Eventos", objeto: "enemies", nombre: "onClick", firma: ["función"], nota: "clic en un enemigo" },
    { grupo: "Eventos", nombre: "onDamage", firma: ["función"], nota: "esta unidad recibió un impacto" },
    { grupo: "Cálculo", nombre: "distance", firma: ["lugar", "lugar"], nota: "casillas entre dos lugares" },
    ...["detect", "locate", "list"].map(nombre => ({ grupo: "Radar", objeto: "RAD_01", nombre, firma: [nombre === "locate" ? "enemigo" : "tipo de enemigo"] })),
    ...[["log", "registro"], ["info", "información"], ["warn", "aviso"], ["error", "error"]].map(([nombre, nota]) => ({ grupo: "Consola", objeto: "console", nombre, firma: ["mensaje"], nota })),
  ];
  const PROPIEDADES = ["position", "hp", "missiles", "mode", "moving", "home", "alive", "target", "destination", "time", "wall", "x", "y", "z", "id", "type", "count", "vx", "vy", "enemy", "kind"];
  function atajos() {
    const lista = window.CMGPlantillasJS.crear({ pausa: "await wait(0.5);" }).atajos;
    const radar = () => def.unidades.some(u => u.clase === "radar");
    const propias = [
      { ico: "apuntar", t: "Apuntar", b: "const pos = autoTarget(/* tipo de enemigo */);", variantes: [{ ico: "seguir", t: "Seguir a un enemigo", b: "const pos = track(/* valor */);" }] },
      { ico: "disparo", t: "Disparo", b: "regularShoot(/* lugar */);", variantes: [{ ico: "detener", t: "Detener el fuego", b: "stopFire();" }] },
      { ico: "mover", t: "Ir a un lugar", b: "moveTo(/* lugar */);", variantes: [{ ico: "llegar", t: "Esperar a llegar", b: "await arrive();" }, { ico: "parar", t: "Parar", b: "stop();" }] },
      { ico: "detonar", t: "Detonar", b: "detonate();" },
      { ico: "sensor", t: "Radar", b: "const visto = RAD_01.detect(/* tipo de enemigo */);", si: radar },
      "|",
      { ico: "clicTerreno", t: "Al hacer clic en el terreno", b: "terrain.onClick((lugar) => {\n  \n});" },
      { ico: "clicEnemigo", t: "Al hacer clic en un enemigo", b: "enemies.onClick((enemigo) => {\n  \n});" },
      { ico: "alDano", t: "Al recibir un impacto", b: "onDamage(() => {\n  \n});" },
    ];
    lista.splice(lista.findIndex(a => a.ico === "variable"), 0, { ico: "esperar", t: "Esperar", b: "await wait(0.5);" });
    lista.splice(lista.findIndex(a => a.ico === "aviso"), 0, ...propias, "|");
    return lista;
  }
  function sugerencias(c) {
    const firma = c.funcion ? (FUNCIONES.find(f => f.nombre === c.funcion && (!c.objeto || !f.objeto || f.objeto === c.objeto)) || {}).firma : null;
    const clase = c.hueco ? (c.hueco === "tipo" ? "tipo de enemigo" : c.hueco) : c.tipo === "argumento" ? (firma || [])[c.indice] : c.tipo === "valor" ? "valor" : null;
    const it = (ins, cls, nota) => ({ ins, cls, nota });
    const vars = (c.variables || []).map(v => it(v, "var", "variable del programa"));
    const enPrueba = new Set(def.oleadas.map(o => o.tipo));
    if (clase === "tipo de enemigo") {
      const tipos = Object.keys(TIPOS).sort((a, b) => enPrueba.has(b) - enPrueba.has(a));
      return { titulo: "Tipo de enemigo", grupos: [{ items: tipos.map(t => it(`"${t}"`, "str", TIPOS[t].nombre + (enPrueba.has(t) ? " · en esta prueba" : ""))) }] };
    }
    if (clase === "lugar") return { titulo: "Lugar", grupos: [
      { titulo: "Del programa", items: vars },
      { titulo: "Sensores", items: [it("autoTarget()", "fn", "lo que ve mi sensor"), ...(def.unidades.some(u => u.clase === "radar") ? [it('RAD_01.detect("gunner")', "fn", "posición actual"), it('RAD_01.detect("siege")', "fn", "posición actual")] : [])] },
      { titulo: "Otros", items: [it("home", "prop", "mi sitio en la base"), it("position", "prop", "donde estoy"), it("{ x: 20, y: 13 }", "num", "un punto del mapa")] },
    ] };
    if (clase === "segundos") return { titulo: "Segundos", grupos: [{ items: ["0.1", "0.3", "0.5", "1", "2"].map(s => it(s, "num")) }] };
    if (clase === "valor" || clase === "enemigo") return { titulo: "Valor", grupos: [{ titulo: "Del programa", items: vars }, { titulo: "De la unidad", items: ["position", "hp", "missiles", "moving", "home", "time"].map(p => it(p, "prop")) }] };
    return null;
  }
  const proveedor = {
    funciones: () => FUNCIONES.map(f => ({ ...f, firma: [...f.firma] })),
    vocabulario: () => ({
      objetos: ["console", "terrain", "enemies", "Math", ...(def ? def.unidades.map(u => varDe(u.id)) : [])],
      funciones: [...new Set([...FUNCIONES.map(f => f.nombre), "esperar", "log", "hypot", "min", "max", "abs", "round", "floor", "sqrt", "atan2", "cos", "sin"])],
      propiedades: PROPIEDADES,
    }),
    atajos, sugerencias,
  };
  const prefs = { leer: (k, d) => guardado.leer("editor:" + k, d), escribir: (k, v) => guardado.escribir("editor:" + k, v) };
  let editor = null;
  const docDe = (id) => ({ id: `${def.clave}:${id}`, lenguaje: "js", texto: programas[id] || "" });
  function crearEditor() {
    editor = window.CMGEditor.crear({
      raiz: $("editor-raiz"), documento: docDe(abierta), adaptadores: { js: window.CMGAdaptadorJS }, lenguajes: ["js"], proveedor, iconos: ICONOS,
      preferencias: prefs, pantallaNavegador: false,
      alCambiar(doc) { const id = doc.id.split(":")[1]; programas[id] = doc.texto; guardarProgramas(); delete errores[id]; sucio = true; },
      alEjecutar: () => (corriendo() ? detener() : ejecutar()),
      alAviso(html) { const t = document.createElement("div"); t.innerHTML = html; aviso(t.textContent); },
    });
  }
  function abrirPrograma(id) {
    if (!programables().some(u => u.id === id)) return;
    abierta = id; guardado.escribir("abierta:" + def.clave, id);
    if (editor) editor.abrir(docDe(id));
    marcarError(); pintarPestanas();
  }
  function marcarError() {
    if (!editor) return;
    const e = errores[abierta], d = editor.documento();
    editor.marcas(d.revision, e && e.linea ? [{ clase: "err", linea: e.linea }] : []);
  }
  function guardarProgramas() { guardado.escribir("prog:" + def.clave, programas); }

  // ---------- Pruebas ----------
  function elegir(i) {
    if (rt) { rt.cerrar(); rt = null; }
    idx = i; def = ESCENARIOS[i]; guardado.escribir("prueba", i);
    const guardados = guardado.leer("prog:" + def.clave, null);
    programas = {};
    for (const u of programables()) programas[u.id] = guardados && typeof guardados[u.id] === "string" ? guardados[u.id] : def.inicial[u.id] || "";
    seleccion.clear(); errores = {}; ultimas = null; repeticion = null; pausa = false; efectos.length = 0; globos.clear();
    nuevoMundo(); ocultarBanner(); limpiarConsola();
    const antes = guardado.leer("abierta:" + def.clave, null);
    abierta = programables().some(u => u.id === antes) ? antes : (programables().find(u => u.clase !== "torreta") || programables()[0]).id;
    if (editor) editor.abrir(docDe(abierta)); else crearEditor();
    $("escenario").value = String(i);
    $("p-etiqueta").textContent = def.etiqueta; $("p-titulo").textContent = def.titulo;
    $("p-objetivo").textContent = def.objetivo; $("p-pregunta").textContent = def.pregunta; $("p-pista").textContent = def.pista;
    if (vista) vista.reiniciar();
    pintarGuia(); estadoUI();
  }

  // ---------- Interfaz ----------
  let sucio = true, tAviso = 0;
  const fmtTiempo = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  function aviso(texto) { const a = $("aviso-campo"); a.textContent = texto; a.hidden = false; tAviso = performance.now() + 4200; }
  function estadoUI() {
    const lab = $("lab"), corre = corriendo();
    lab.dataset.estado = corre ? (pausa ? "pausa" : "corre") : "listo";
    $("b-ejecutar").textContent = corre ? "■ Detener" : "▶ Ejecutar";
    $("b-pausa").setAttribute("aria-pressed", String(pausa)); $("b-pausa").disabled = !corre; $("b-pausa").textContent = pausa ? "▶" : "⏸";
    $("b-repetir").hidden = !(ultimas && ultimas.length) || corre;
    $("b-aplicar").hidden = !corre;
    sucio = true;
  }
  function estadoDe(id) {
    if (errores[id]) return "error";
    const p = rt && rt.progs.get(id), u = mundo.porId[id];
    if (u && !u.viva) return "destruida";
    return p && p.estado === "vivo" && corriendo() ? "vivo" : "quieto";
  }
  function pintarDestinatarios() {
    const todas = `<button type="button" class="chip" data-id="" aria-pressed="${!seleccion.size}">Todas</button>`;
    $("destinatarios").innerHTML = `<span class="rotulo">El clic llega a</span>` + todas + programables().map(u =>
      `<button type="button" class="chip" data-id="${u.id}" aria-pressed="${seleccion.has(u.id)}" data-oye="${oyen.has(u.id)}" data-estado="${estadoDe(u.id)}" title="${oyen.has(u.id) ? "Escucha clics" : "Su programa no escucha clics"}"><i class="oye"></i>${u.id}</button>`).join("");
  }
  function pintarPestanas() {
    $("pestanas").innerHTML = programables().map(u =>
      `<button type="button" class="pestana" role="tab" data-id="${u.id}" aria-selected="${u.id === abierta}" data-estado="${estadoDe(u.id)}"><i class="punto"></i>${u.id}</button>`).join("");
    const u = def.unidades.find(x => x.id === abierta), e = errores[abierta];
    $("prog-de").textContent = e ? `Error${e.linea ? " en la línea " + e.linea : ""}: ${e.mensaje}` : `${abierta} · ${CLASES[u.clase].nombre}`;
    $("prog-de").style.color = e ? "var(--bad)" : "";
    const iguales = programables().filter(x => x.clase === u.clase && x.id !== u.id);
    $("b-copiar").disabled = !iguales.length; $("b-copiar").textContent = iguales.length ? `Copiar a ${iguales.map(x => x.id).join(", ")}` : "Copiar a las de su clase";
  }
  function pintarPaneles() { for (const b of document.querySelectorAll(".paneles [data-panel]")) b.setAttribute("aria-pressed", String(b.dataset.panel === $("lab").dataset.panel)); }
  let hudAntes = "";
  function pintarHud() {
    const vivos = mundo.enemigos.length, quedan = vivos + mundo.pendientes.length;
    const texto = `${fmtTiempo(mundo.t)}|${mundo.muro}|${vivos}|${quedan}|${mundo.nClics}`;
    if (texto === hudAntes) return;
    hudAntes = texto;
    $("h-tiempo").textContent = fmtTiempo(mundo.t);
    $("h-muro").textContent = `${mundo.muro}/${mundo.muroMax}`;
    const k = mundo.muro / mundo.muroMax, barra = $("h-muro-barra");
    barra.style.width = Math.round(k * 100) + "%"; barra.dataset.nivel = k > .5 ? "alto" : k > .25 ? "medio" : "bajo";
    $("h-enemigos").textContent = `${vivos} · faltan ${quedan}`;
    $("h-clics").textContent = String(mundo.nClics);
  }
  function mostrarBanner(tipo, titulo, texto, cifras) {
    const b = $("banner"), sig = idx < ESCENARIOS.length - 1;
    b.dataset.tipo = tipo;
    b.innerHTML = `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p><div class="cifras">${cifras.map(([k, v]) => `<span><i>${esc(k)}</i>${esc(v)}</span>`).join("")}</div>
      <div class="botones"><button class="principal" type="button" data-accion="otra">▶ Otra vez</button>${ultimas && ultimas.length ? `<button class="mini" type="button" data-accion="repetir">↻ Repetir mis clics</button>` : ""}${sig ? `<button class="mini" type="button" data-accion="siguiente">Siguiente prueba →</button>` : ""}<button class="mini" type="button" data-accion="cerrar">Ver el campo</button></div>`;
    b.hidden = false;
  }
  function ocultarBanner() { $("banner").hidden = true; }

  // ---------- Consola ----------
  const $consola = $("consola");
  function limpiarConsola() { $consola.innerHTML = `<div class="vacia">Aquí salen console.log / warn / error y lo que pasa en el campo.</div>`; }
  function linea(clase, id, texto, nLinea) {
    const vacia = $consola.querySelector(".vacia"); if (vacia) vacia.remove();
    const abajo = $consola.scrollTop + $consola.clientHeight >= $consola.scrollHeight - 8;
    const d = document.createElement("div");
    d.className = "linea " + clase;
    d.innerHTML = `<time>${mundo ? mundo.t.toFixed(1) : "0.0"}</time><span class="quien">${esc(id)}</span><span class="texto">${esc(texto)}${nLinea ? ` <button type="button" class="ir" data-id="${esc(id)}" data-linea="${nLinea}">línea ${nLinea}</button>` : ""}</span>`;
    $consola.append(d);
    while ($consola.children.length > 400) $consola.firstChild.remove();
    if (abajo) $consola.scrollTop = $consola.scrollHeight;
  }

  // ---------- Guía de órdenes ----------
  function pintarGuia() {
    const f = (codigo, texto, quien = "") => `<tr><td><code>${esc(codigo)}</code></td><td>${texto}</td><td class="quien">${quien}</td></tr>`;
    const tabla = (filas) => `<div class="guia-tabla"><table>${filas.join("")}</table></div>`;
    const enemigos = Object.entries(TIPOS).map(([k, t]) => f(`"${k}"`, `${t.nombre} · ${t.hp} de vida · ${t.vel} casillas/s${t.para ? ` · se aposta en x ${t.para}` : ""}${t.alcance ? ` · dispara a ${t.alcance} casillas` : ""}`, `−${t.muro} muro`));
    $("guia-cuerpo").innerHTML = `
      <p>Órdenes de esta maqueta. Los modos se configuran al instante y siguen funcionando; <code>await</code> deja pasar el tiempo; las lecturas no lo avanzan.</p>
      <h3>Eventos · lo nuevo</h3>${tabla([
        f("terrain.onClick((lugar) => { … })", "Corre cuando haces clic en el terreno. <code>lugar</code> es <code>{ x, y }</code>.", "todas"),
        f("enemies.onClick((enemigo) => { … })", "Corre cuando haces clic en un enemigo. Recibe <code>{ id, type, x, y, hp, vx, vy }</code> y el enemigo queda marcado " + M.MARCA + " s.", "todas"),
        f("onClick((ev) => { … })", "Cualquier clic: <code>ev.target</code> es <code>\"terrain\"</code> o <code>\"enemy\"</code>; <code>ev.x</code>, <code>ev.y</code>, <code>ev.enemy</code>.", "todas"),
        f("onDamage((ev) => { … })", "Evento del mundo: esta unidad recibió un impacto. <code>ev.hp</code>, <code>ev.by</code>.", "VEH · WHL"),
      ])}
      <p>Un oyente puede cambiar una variable que lee el bucle principal, dar una orden o esperar con <code>await</code>. El clic llega a las unidades elegidas en la fila «El clic llega a»; sin elegir, a todas las que escuchan.</p>
      <h3>Sensores</h3>${tabla([
        f("autoTarget(tipo?)", "Dónde disparar al enemigo que ve mi sensor (con predicción), o <code>null</code>. Torreta: el más avanzado. Vehículo: el más cercano.", "todas"),
        f("track(id)", "Lo mismo para un enemigo concreto. Funciona si mi sensor lo ve o si está marcado con un clic.", "todas"),
        f("RAD_01.detect(tipo?)", "Posición actual del más avanzado en todo el campo (sin predicción).", "radar"),
        f("RAD_01.locate(id) · .list(tipo?) · .count", "Un enemigo por su id, la lista ordenada por avance y cuántos hay.", "radar"),
      ])}
      <h3>Órdenes</h3>${tabla([
        f("regularShoot(lugar) · stopFire()", "Dispara a ese lugar, 1 por segundo, mientras esté en alcance. Devuelve <code>\"ok\"</code>, <code>\"fuera_de_alcance\"</code>, <code>\"sin_misiles\"</code> o <code>\"sin_objetivo\"</code>.", "TUR · VEH"),
        f("moveTo(lugar) · stop()", "Pone rumbo a ese lugar; el muro se cruza por las puertas. Una orden nueva sustituye a la anterior.", "VEH · WHL"),
        f("await arrive()", "Espera a llegar. Devuelve <code>\"ok\"</code>, <code>\"redirigida\"</code> o <code>\"detenida\"</code>.", "VEH · WHL"),
        f("detonate()", "Explota donde está: " + CLASES.rueda.dano + " de daño en " + String(CLASES.rueda.radio).replace(".", ",") + " casillas. También daña a tus vehículos.", "WHL"),
        f("await wait(segundos)", "Pausa este hilo (el bucle o un oyente) y deja avanzar el mundo.", "todas"),
      ])}
      <h3>Lecturas de la unidad</h3>${tabla([
        f("position · home · hp · missiles · moving · mode", "Estado propio. <code>home</code> es su sitio en la base: dentro del muro los vehículos se reparan y recargan.", "todas"),
        f("VEH_01.position · TUR_01.missiles · WHL_02.alive", "Estado de otra unidad (solo lectura).", "todas"),
        f("time · wall · distance(a, b)", "Segundos de batalla, integridad del muro y casillas entre dos lugares.", "todas"),
      ])}
      <h3>Enemigos</h3>${tabla(enemigos)}
      <h3>Unidades</h3>${tabla(["torreta", "vehiculo", "rueda"].map(k => { const c = CLASES[k]; return f(k === "torreta" ? "TUR" : k === "vehiculo" ? "VEH" : "WHL", `${c.nombre} · ve ${c.sensor} casillas (${c.niebla} con niebla)${c.alcance ? ` · arma a ${c.alcance}` : ""}${c.vel ? ` · ${c.vel} casillas/s` : ""}${c.hp ? ` · ${c.hp} de vida` : ""}${c.cargador ? ` · ${c.cargador} misiles` : ""}`); }))}`;
  }

  // ---------- Eventos de la interfaz ----------
  $("escenario").innerHTML = ESCENARIOS.map((e, i) => `<option value="${i}">${esc(e.titulo)} · ${esc(e.etiqueta)}</option>`).join("");
  $("escenario").addEventListener("change", (ev) => elegir(+ev.target.value));
  $("b-ejecutar").addEventListener("click", () => (corriendo() ? detener() : ejecutar()));
  $("b-pausa").addEventListener("click", () => { if (!corriendo()) return; pausa = !pausa; aviso(pausa ? "En pausa. Puedes cambiar un programa y aplicarlo; los clics llegan al reanudar." : "Sigue la batalla."); estadoUI(); });
  $("b-repetir").addEventListener("click", () => ejecutar(ultimas));
  for (const b of document.querySelectorAll("[data-vel]")) b.addEventListener("click", () => {
    velocidad = +b.dataset.vel;
    for (const o of document.querySelectorAll("[data-vel]")) o.setAttribute("aria-pressed", String(o === b));
  });
  for (const b of document.querySelectorAll(".paneles [data-panel]")) b.addEventListener("click", () => { $("lab").dataset.panel = b.dataset.panel; pintarPaneles(); if (vista) vista.ajustar(); if (editor) editor.refrescar(); });
  $("destinatarios").addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip"); if (!b) return;
    if (!b.dataset.id) seleccion.clear(); else if (seleccion.has(b.dataset.id)) seleccion.delete(b.dataset.id); else seleccion.add(b.dataset.id);
    pintarDestinatarios();
  });
  $("pestanas").addEventListener("click", (ev) => { const b = ev.target.closest(".pestana"); if (b) abrirPrograma(b.dataset.id); });
  $("b-restaurar").addEventListener("click", () => { programas[abierta] = def.inicial[abierta] || ""; guardarProgramas(); delete errores[abierta]; editor.abrir(docDe(abierta)); marcarError(); pintarPestanas(); aviso(`${abierta}: programa de partida restaurado.`); });
  $("b-copiar").addEventListener("click", () => {
    const u = def.unidades.find(x => x.id === abierta), otras = programables().filter(x => x.clase === u.clase && x.id !== u.id);
    for (const o of otras) { programas[o.id] = programas[abierta]; delete errores[o.id]; }
    guardarProgramas(); pintarPestanas(); aviso(`Copiado a ${otras.map(o => o.id).join(", ")}.`);
  });
  $("b-aplicar").addEventListener("click", () => {
    if (!corriendo()) return;
    delete errores[abierta]; rt.reprogramar(abierta, programas[abierta]);
    linea("sim info", abierta, "Reprogramada en caliente: su programa empieza de nuevo."); aviso(`${abierta} reprogramada sin parar la batalla.`);
    marcarError(); bombear();
  });
  $("b-limpiar").addEventListener("click", limpiarConsola);
  $consola.addEventListener("click", (ev) => { const b = ev.target.closest(".ir"); if (!b) return; $("lab").dataset.panel = "codigo"; pintarPaneles(); abrirPrograma(b.dataset.id); editor.irALinea(+b.dataset.linea); });
  $("banner").addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-accion]"); if (!a) return;
    if (a.dataset.accion === "otra") ejecutar();
    else if (a.dataset.accion === "repetir") ejecutar(ultimas);
    else if (a.dataset.accion === "siguiente") elegir(idx + 1);
    else ocultarBanner();
  });
  $("b-guia").addEventListener("click", () => $("guia").showModal());
  $("guia-cerrar").addEventListener("click", () => $("guia").close());
  $("b-zoom-mas").addEventListener("click", () => vista.zoom(1.35));
  $("b-zoom-menos").addEventListener("click", () => vista.zoom(1 / 1.35));
  window.addEventListener("keydown", (ev) => {
    if (ev.target.closest("textarea, input, select, dialog, [contenteditable]")) return;
    if (ev.key === " ") { ev.preventDefault(); $("b-pausa").click(); }
  });

  // ---------- Bucle ----------
  let vista = null, ultimo = performance.now(), ultPintura = 0;
  function bucle(now) {
    const real = Math.min(0.25, (now - ultimo) / 1000);
    ultimo = now;
    if (corriendo() && !pausa) {
      if (rt.quieto()) acum = Math.min(acum + real * velocidad, 0.6);
      bombear(); rt.vigia();
    }
    const off = corriendo() && !pausa && rt.quieto() ? Math.min(acum, DT) : 0;
    vista.dibujar(off, now);
    pintarHud();
    if (tAviso && now > tAviso) { $("aviso-campo").hidden = true; tAviso = 0; }
    for (let i = efectos.length - 1; i >= 0; i--) if (now - efectos[i].t0 > 800) efectos.splice(i, 1);
    if (sucio || now - ultPintura > 500) {
      sucio = false; ultPintura = now;
      oyen = new Set(rt && corriendo() ? rt.oyen("click") : programables().filter(u => /onClick\s*\(/.test(programas[u.id] || "")).map(u => u.id));
      pintarDestinatarios(); pintarPestanas();
    }
    requestAnimationFrame(bucle);
  }

  elegir(idx);
  vista = window.LAB_VISTA.crear({ lienzo: $("lienzo"), alToque, estado: () => ({ mundo, sim, seleccion, abierta, oyen, efectos, globos }) });
  requestAnimationFrame(bucle);
  // Para pruebas y depuración.
  window.__lab = {
    get mundo() { return mundo; }, get sim() { return sim; }, get rt() { return rt; }, get programas() { return programas; }, get vista() { return vista; },
    ejecutar, detener, elegir, clic: (x, y) => alToque({ x, y, radio: 1.1 }), velocidad: (v) => { velocidad = v; }, seleccion,
  };
  window.__labListo = true;
})();
