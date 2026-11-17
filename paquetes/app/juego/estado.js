import { CMGPaleta } from './paleta.js';
import { crearPulsos } from './pulsos.js';
import { DT, crearPartida } from '../../nucleo/index.js';
import war, * as datosWar from '../../reglas-war/index.js';
import reglasFactory, * as factory from '../../reglas-factory/index.js';
import reglasCampaign, * as campaign from '../../reglas-campaign/index.js';
import { crearAnfitrion } from '../../anfitrion/index.js';
import * as lenguaje from '../../lenguaje/index.js';
import { CMGEditor, CMGAdaptadorJS, CMGAdaptadorPython, CMGEditorPython } from '../../editor/index.js';

import { crearPlataformaMemoria } from '../plataforma.js';
import { crearConductor } from '../conductor.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} opciones */
export function crearEstadoJuego(opciones = {}) {
  /** @type {any} */
  const ctx = { plataforma: opciones.plataforma || crearPlataformaMemoria() };
  const servicios = opciones.servicios || {};
  let banco = null, cmg = null;
  const pulsos = crearPulsos({ trazador: servicios.CMGTrazador, flujo: servicios.CMGFlujo, python: servicios.CMGPythonRevision, acorn: servicios.acorn });
  const CMGPythonJS = lenguaje.crearPython({ lezer: servicios.LezerPython, hueco: CMGEditorPython.nombreDe });
  const CMGJSaPython = lenguaje.crearJSaPython({ acorn: servicios.acorn });
  const piezasTrabajador = { validarFactory: factory.validar, validarCampaign: campaign.validar,
    modoCampaign: campaign.modoEnSnap, preludioPython: CMGPythonJS.preludio };

  /* Code Battle Lite · juego de programación y defensa.
   * Simulación determinista, runtime del jugador en el intérprete, vista 3D/plano, inspector y editor.
   * Inspector en tres estados con signos vitales, pulsación larga en el campo y paleta de iconos.
   * El reparto de pantalla, el teclado del teléfono y los tooltips viven en layout.js. */
  const localizarHTML = html => servicios.CMGPresentacion ? servicios.CMGPresentacion.html(html) : html;

  // ---------- Constantes del mundo ----------
  const SERIE = (() => { const q = new URLSearchParams(location.search).get("serie"); return q === "factory" || q === "campaign" ? q : "war"; })();
  const ES_FACTORY = SERIE === "factory", ES_CAMPAIGN = SERIE === "campaign";
  // Prefijo de las claves guardadas de cada serie (War conserva las suyas, sin prefijo).
  const PREFIJO = ES_CAMPAIGN ? "campaign-" : ES_FACTORY ? "factory-" : "";
  const ti18n = (clave, valores) => servicios.CMGI18n ? servicios.CMGI18n.t(clave, valores) : clave;
  const htmlInterfaz = html => servicios.CMGPresentacion ? servicios.CMGPresentacion.html(html) : html;
  // Python (E5): cada unidad se programa en JavaScript o en Python. Python se traduce a JS con las mismas
  // líneas (paquetes/lenguaje) y corre en la misma unidad.
  const PYTHON = !!CMGAdaptadorPython && !!CMGPythonJS;
  let COLS = 32, ROWS = 18;      // casillas de 1 m
  const LINEA_BASE = 3;            // x de la línea roja: cruzarla es una brecha
  const T_LIMITE = 400;            // tiempo de juego máximo de un intento
  const CLAVE = "cmg-banco03";
  const { TIPOS, SENSOR, LAU, MISIL, REP, COSTE } = datosWar;
  const NIVELES = ["log", "info", "warn", "error"];

  // ---------- Funciones de los robots (provisionales) ----------
  // El color lo decide la función principal; la secundaria solo se insinúa con un arco del halo.
  // Clases y nombres son marcadores hasta fijar la taxonomía definitiva: basta con cambiar estas tablas.
  const FUNCIONES = { ofensiva: "Ofensiva", rastreo: "Rastreo y telemetría", utilitaria: "Utilitaria", fabrica: "Fábrica" };
  const FUNCION_DE = {
    lanzador: { principal: "ofensiva", secundaria: "rastreo" },
    vibracion: { principal: "rastreo" },
    reparador: { principal: "utilitaria" },
    deposito: { principal: "fabrica" },
    robot: { principal: "utilitaria" }, bodega: { principal: "fabrica" }, fundidora: { principal: "fabrica" },
    // Campaign
    obrero: { principal: "utilitaria" }, montacargas: { principal: "utilitaria" }, prensa: { principal: "fabrica" }, moldeadora: { principal: "fabrica" },
    mezcladora: { principal: "fabrica" }, ensambladora: { principal: "fabrica" }, banda: { principal: "fabrica" }, bahia: { principal: "fabrica" },
    lugar: { principal: "fabrica" }, pad: { principal: "fabrica" }, pila: { principal: "fabrica" }, arsenal: { principal: "fabrica" },
    torreta: { principal: "ofensiva" }, control: { principal: "rastreo" },
  };
  const funcionDe = (e) => FUNCION_DE[e.clase] || null;
  const RADIO_DE = { lanzador: .9, vibracion: .6, deposito: 1.2, reparador: .5,
    obrero: .8, montacargas: 1.3, prensa: 1.7, moldeadora: 1.7, mezcladora: 1.7, ensambladora: 2.4, banda: 1.2, bahia: 1.9, lugar: 1, pad: 1.4, pila: 1, arsenal: 1.9, torreta: 1.1, control: 1.2 };
  const radioDe = (e) => RADIO_DE[e.clase] || .6;
  // Luces de cada clase en coordenadas locales (x, altura, y del mapa). El frente mira a la derecha.
  const LUCES = { lanzador: [[.56, .32, .3], [.56, .32, -.3]], vibracion: [[0, 1.4, 0]], deposito: [[.71, .52, .55], [.71, .52, -.55]], reparador: [[.12, .7, .12]] };
  // Halo: anillo difuso en la textura, a FR del radio. Cada parada es [desplazamiento, opacidad].
  const FR = .62;
  const HALO = {
    medio: [[-.12, 0], [0, .9], [.18, 0]],
    suave: [[-.2, 0], [0, .6], [.3, 0]],
    neon: [[-.16, 0], [-.03, .35], [-.008, 1], [.008, 1], [.04, .35], [.2, 0]],
  };
  const ARCO = [2, 2.9];  // ángulos del arco de la función secundaria (arriba a la izquierda)
  const INTENSIDAD = { media: 1, baja: .55, alta: 1.6 };
  // Variantes en prueba: ?poc=1 muestra el selector y la URL conserva la elección.
  const VARIANTES = {
    paleta: { a: "A · Neón", b: "B · Contraste", c: "C · Sobria" },
    halo: { medio: "Medio", suave: "Suave", neon: "Neón", no: "Sin halo" },
    brillo: { pilotos: "Pilotos", faros: "Faros", aura: "Aura", no: "Sin brillo" },
    intensidad: { media: "Media", baja: "Baja", alta: "Alta" },
  };
  const visual = (() => {
    const q = new URLSearchParams(location.search), v = {};
    for (const [k, ops] of Object.entries(VARIANTES)) v[k] = Object.hasOwn(ops, q.get(k)) ? q.get(k) : Object.keys(ops)[0];
    return v;
  })();
  document.documentElement.dataset.paleta = visual.paleta;
  // Dirección del brillo de faros: la torre, el avance del reparador o un barrido del sensor (solo dibujo).
  const rumbos = new Map();
  function direccionDe(e, ahora) {
    if (e.clase === "lanzador") return e.yaw;
    if (e.clase === "vibracion") return ahora / 900;
    if (e.clase !== "reparador") return 0;
    const p = rumbos.get(e.id) || { x: e.cx, y: e.cy, a: 0 };
    if (Math.hypot(e.cx - p.x, e.cy - p.y) > 1e-3) p.a = Math.atan2(e.cy - p.y, e.cx - p.x);
    p.x = e.cx; p.y = e.cy; rumbos.set(e.id, p);
    return p.a;
  }

  const { RETOS: RETOS_WAR, PROPIO_BASE, POS_LANZADORES, normalizar } = datosWar.retos;

  // Avisos para quien escuche fuera del juego (telemetría remota): nunca interrumpen la partida.
  const avisar = (tipo, detalle) => { try { window.dispatchEvent(new CustomEvent(tipo, { detail: detalle })); } catch { /* sin oyentes */ } };

  /** @type {any[]} */
  const RETOS = ES_CAMPAIGN ? campaign.nivel.RETOS : ES_FACTORY ? factory.retos.RETOS : RETOS_WAR;
  // En Campaign las unidades se encienden por hitos: solo las encendidas se programan y se ejecutan.
  const programablesDe = d => d.serie === "campaign" && mundo ? mundo.programables : d.robots || d.lanzadores;

  // ---------- Almacenamiento local (comodidad del jugador) ----------
  const guardado = {
    leer(k, def) { try { const v = ctx.plataforma.almacen.leer(`${CLAVE}:${k}`); return v == null ? def : JSON.parse(v); } catch { return def; } },
    escribir(k, v) { try { ctx.plataforma.almacen.escribir(`${CLAVE}:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  // ---------- Léxico (resaltado e instrumentación comparten el mismo) ----------
  const { KW, FN_PROPIAS, FN_MIEMBRO, PROPS } = lenguaje.vocabulario(SERIE);
  const { NOMBRES_HUECO, HUECO, RE_HUECO, lexico } = lenguaje.CMGEditorJS;
  const instrumentar = src => lenguaje.instrumentar(src, { serie: SERIE, objetos: nombresVar(), acorn: servicios.acorn });
  const clasificar = (toks, i) => CMGAdaptadorJS.clasificar(toks, i, {
    objetos: ["console", "yo", ...nombresVar()], funciones: [...FN_PROPIAS], miembros: [...FN_MIEMBRO], propiedades: [...PROPS],
  });

  // ---------- Simulación (determinista: paso fijo y una semilla para los fallos) ----------
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const coma = (v, d = 1) => v.toFixed(d).replace(".", ",");
  const cadencia = datosWar.cadencia;
  const reglas = ({ war, factory: reglasFactory, campaign: reglasCampaign })[SERIE];
  const alcance = sensor => def.niebla ? SENSOR[sensor].niebla : SENSOR[sensor].alcance;
  const enRango = s => mundo.enemigos.filter(e => TIPOS[e.tipo].suelo && Math.hypot(e.x - s.cx, e.y - s.cy) <= s.alcance + 1e-9);
  const coste = () => mundo.consumidos * COSTE.misil + mundo.reparaciones * COSTE.reparacion;
  const metaCumplida = meta => {
    const e = mundo.porId[meta.id];
    return meta.tipo === "vaciar" ? (e.stock[meta.mat] || 0) === 0 && mundo.robot.carga !== meta.mat : ((e.recibido && e.recibido[meta.mat]) || 0) >= meta.n;
  };

  // ---------- Estado ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const varDe = (id) => id.replace(/-/g, "_");
  const nombradas = () => ES_CAMPAIGN ? mundo.unidades : ES_FACTORY ? mundo.maquinas : [...mundo.programables, ...mundo.sensores];
  const nombresVar = () => mundo ? nombradas().map(e => varDe(e.id)) : [];
  const RUTEO_DEF = { log: "globo", info: "globo", warn: "globo", error: "pantalla" };
  const IDX_PROPIO = RETOS.length;

  const retoFactoryInicial = () => {
    const q = new URLSearchParams(location.search).get("reto");
    if (q === "propio") return IDX_PROPIO;
    if (q != null && /^\d+$/.test(q)) return Number(q);
    let viejo = 0; try { viejo = JSON.parse(ctx.plataforma.almacen.leer("cmg-banco02:reto")) || 0; } catch (_) { /* Sin selección antigua. */ }
    return guardado.leer("factory-reto", viejo);
  };
  let retoIdx = Math.min(IDX_PROPIO, Math.max(0, (ES_CAMPAIGN ? 0 : ES_FACTORY ? retoFactoryInicial() : guardado.leer("reto", 0)) | 0));
  let propio = ES_CAMPAIGN ? null : ES_FACTORY ? factory.retos.normalizar(guardado.leer("factory-propio", (() => { try { return JSON.parse(ctx.plataforma.almacen.leer("cmg-banco02:propio")); } catch { return null; } })())) : normalizar(guardado.leer("propio", PROPIO_BASE));
  let hechos = guardado.leer("hechos", []);
  let records = guardado.leer("records", {});
  // D6: una tabla de récords por reto; el lenguaje del intento es solo una etiqueta (War la guarda aparte para no cambiar «records»).
  let recordsLenguaje = guardado.leer("records-lenguaje", {});
  const etiquetaLenguaje = l => l && l !== "js" ? ` <span class="etq-lenguaje">${l === "python" ? "Python" : "JS + Python"}</span>` : "";
  let telemetria = guardado.leer(`${PREFIJO}telemetria`, []);
  let partida = null, anfitrion = null, conductor = null, enVuelo = null, finActual = null;
  let eventos = [], desdeRegistro = 0;
  const registrosPendientes = new Map();
  let consolasCampaign = { log: 0, info: 0, warn: 0, error: 0 };
  // Campaign: estado con el que se monta el mundo (el guardado en vivo o un checkpoint) e hito recién cumplido.
  let estadoCampaign = null, hitoPendiente = null;
  // El hito detiene al conductor en su paso hasta «Seguir» (o hasta parar); hitoPendiente solo espera al banner.
  let hitoDetiene = false;
  let ruteo = { ...RUTEO_DEF, ...guardado.leer("ruteo", {}) };
  let vista = guardado.leer(`${PREFIJO}vista`, "3d");
  let colores = guardado.leer("colores", true);
  let tamLetra = guardado.leer("letra", 14);
  let semillaFija = !!guardado.leer("semillaFija", false);
  let def = null, programas = {}, progSel = "LAU-01";
  // Programas en Python (fuentes-<reto>): { id: { lenguaje: "python", texto, enUso } }. «programas» y
  // prog-<reto> siguen siendo solo JS; una unidad con su fuente Python en uso se edita en Python y su JS se conserva.
  let fuentes = {};
  let mundo = null, ejec = null, pausa = false, velocidad = 1, turbo = 1, intento = 0, semilla = 1;
  let seleccion = null;
  let seleccionadas = new Set();
  let edicion = { ids: [], mixto: false, lenguaje: "js" };
  const borradoresMulti = new Map();
  const claveEdicion = (ids) => [...ids].sort().join("|");
  let lineaCorre = {}, lineaErr = null;
  let insercion = { dobleClic: 0, arrastre: 0, atajo: 0 };
  let eventosSucios = false, marcasSucias = false;
  const globos = new Map();   // id de máquina → { nivel, texto, hasta }

  const defActual = () => ES_CAMPAIGN ? RETOS[0] : retoIdx === IDX_PROPIO ? propio : ES_FACTORY ? RETOS[retoIdx] : normalizar(RETOS[retoIdx]);
  const claveReto = () => PREFIJO + (retoIdx === IDX_PROPIO ? "propio" : String(retoIdx));

  let acum = 0;

  let infoPestana = "objetivo";
  let ultimoAviso = {};
  let tGuardar = 0;
  let textosPython = null;
  let metasClave = "";

  let insEstado = "cerrado";

  let paletaRota = null;

  let confirmarBorrado = false;

  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors({
    get DT() { return DT; },
    get crearPartida() { return crearPartida; },
    get war() { return war; },
    get datosWar() { return datosWar; },
    get reglasFactory() { return reglasFactory; },
    get factory() { return factory; },
    get reglasCampaign() { return reglasCampaign; },
    get campaign() { return campaign; },
    get crearAnfitrion() { return crearAnfitrion; },
    get crearConductor() { return crearConductor; },
    get lenguaje() { return lenguaje; },
    get CMGEditor() { return CMGEditor; },
    get CMGAdaptadorJS() { return CMGAdaptadorJS; },
    get CMGAdaptadorPython() { return CMGAdaptadorPython; },
    get CMGEditorPython() { return CMGEditorPython; },
    get CMGPythonJS() { return CMGPythonJS; },
    get CMGJSaPython() { return CMGJSaPython; },
    get piezasTrabajador() { return piezasTrabajador; },
    get localizarHTML() { return localizarHTML; },
    get SERIE() { return SERIE; },
    get ES_FACTORY() { return ES_FACTORY; },
    get ES_CAMPAIGN() { return ES_CAMPAIGN; },
    get PREFIJO() { return PREFIJO; },
    get ti18n() { return ti18n; },
    get htmlInterfaz() { return htmlInterfaz; },
    get PYTHON() { return PYTHON; },
    get COLS() { return COLS; }, set COLS(v) { COLS = v; },
    get ROWS() { return ROWS; }, set ROWS(v) { ROWS = v; },
    get LINEA_BASE() { return LINEA_BASE; },
    get T_LIMITE() { return T_LIMITE; },
    get CLAVE() { return CLAVE; },
    get TIPOS() { return TIPOS; },
    get SENSOR() { return SENSOR; },
    get LAU() { return LAU; },
    get MISIL() { return MISIL; },
    get REP() { return REP; },
    get COSTE() { return COSTE; },
    get NIVELES() { return NIVELES; },
    get FUNCIONES() { return FUNCIONES; },
    get FUNCION_DE() { return FUNCION_DE; },
    get funcionDe() { return funcionDe; },
    get RADIO_DE() { return RADIO_DE; },
    get radioDe() { return radioDe; },
    get LUCES() { return LUCES; },
    get FR() { return FR; },
    get HALO() { return HALO; },
    get ARCO() { return ARCO; },
    get INTENSIDAD() { return INTENSIDAD; },
    get VARIANTES() { return VARIANTES; },
    get visual() { return visual; },
    get rumbos() { return rumbos; },
    get direccionDe() { return direccionDe; },
    get RETOS_WAR() { return RETOS_WAR; },
    get PROPIO_BASE() { return PROPIO_BASE; },
    get POS_LANZADORES() { return POS_LANZADORES; },
    get normalizar() { return normalizar; },
    get avisar() { return avisar; },
    get RETOS() { return RETOS; },
    get programablesDe() { return programablesDe; },
    get guardado() { return guardado; },
    get KW() { return KW; },
    get FN_PROPIAS() { return FN_PROPIAS; },
    get FN_MIEMBRO() { return FN_MIEMBRO; },
    get PROPS() { return PROPS; },
    get NOMBRES_HUECO() { return NOMBRES_HUECO; },
    get HUECO() { return HUECO; },
    get RE_HUECO() { return RE_HUECO; },
    get lexico() { return lexico; },
    get instrumentar() { return instrumentar; },
    get clasificar() { return clasificar; },
    get r2() { return r2; },
    get r3() { return r3; },
    get coma() { return coma; },
    get cadencia() { return cadencia; },
    get reglas() { return reglas; },
    get alcance() { return alcance; },
    get enRango() { return enRango; },
    get coste() { return coste; },
    get metaCumplida() { return metaCumplida; },
    get $() { return $; },
    get esc() { return esc; },
    get varDe() { return varDe; },
    get nombradas() { return nombradas; },
    get nombresVar() { return nombresVar; },
    get RUTEO_DEF() { return RUTEO_DEF; },
    get IDX_PROPIO() { return IDX_PROPIO; },
    get retoFactoryInicial() { return retoFactoryInicial; },
    get retoIdx() { return retoIdx; }, set retoIdx(v) { retoIdx = v; },
    get propio() { return propio; }, set propio(v) { propio = v; },
    get hechos() { return hechos; }, set hechos(v) { hechos = v; },
    get records() { return records; }, set records(v) { records = v; },
    get recordsLenguaje() { return recordsLenguaje; }, set recordsLenguaje(v) { recordsLenguaje = v; },
    get etiquetaLenguaje() { return etiquetaLenguaje; },
    get telemetria() { return telemetria; }, set telemetria(v) { telemetria = v; },
    get partida() { return partida; }, set partida(v) { partida = v; },
    get anfitrion() { return anfitrion; }, set anfitrion(v) { anfitrion = v; },
    get conductor() { return conductor; }, set conductor(v) { conductor = v; },
    get enVuelo() { return enVuelo; }, set enVuelo(v) { enVuelo = v; },
    get finActual() { return finActual; }, set finActual(v) { finActual = v; },
    get eventos() { return eventos; }, set eventos(v) { eventos = v; },
    get desdeRegistro() { return desdeRegistro; }, set desdeRegistro(v) { desdeRegistro = v; },
    get registrosPendientes() { return registrosPendientes; },
    get consolasCampaign() { return consolasCampaign; }, set consolasCampaign(v) { consolasCampaign = v; },
    get estadoCampaign() { return estadoCampaign; }, set estadoCampaign(v) { estadoCampaign = v; },
    get hitoPendiente() { return hitoPendiente; }, set hitoPendiente(v) { hitoPendiente = v; },
    get hitoDetiene() { return hitoDetiene; }, set hitoDetiene(v) { hitoDetiene = v; },
    get ruteo() { return ruteo; }, set ruteo(v) { ruteo = v; },
    get vista() { return vista; }, set vista(v) { vista = v; },
    get colores() { return colores; }, set colores(v) { colores = v; },
    get tamLetra() { return tamLetra; }, set tamLetra(v) { tamLetra = v; },
    get semillaFija() { return semillaFija; }, set semillaFija(v) { semillaFija = v; },
    get def() { return def; }, set def(v) { def = v; },
    get programas() { return programas; }, set programas(v) { programas = v; },
    get progSel() { return progSel; }, set progSel(v) { progSel = v; },
    get fuentes() { return fuentes; }, set fuentes(v) { fuentes = v; },
    get mundo() { return mundo; }, set mundo(v) { mundo = v; },
    get ejec() { return ejec; }, set ejec(v) { ejec = v; },
    get pausa() { return pausa; }, set pausa(v) { pausa = v; },
    get velocidad() { return velocidad; }, set velocidad(v) { velocidad = v; },
    get turbo() { return turbo; }, set turbo(v) { turbo = v; },
    get intento() { return intento; }, set intento(v) { intento = v; },
    get semilla() { return semilla; }, set semilla(v) { semilla = v; },
    get seleccion() { return seleccion; }, set seleccion(v) { seleccion = v; },
    get seleccionadas() { return seleccionadas; }, set seleccionadas(v) { seleccionadas = v; },
    get edicion() { return edicion; }, set edicion(v) { edicion = v; },
    get borradoresMulti() { return borradoresMulti; },
    get claveEdicion() { return claveEdicion; },
    get lineaCorre() { return lineaCorre; }, set lineaCorre(v) { lineaCorre = v; },
    get lineaErr() { return lineaErr; }, set lineaErr(v) { lineaErr = v; },
    get insercion() { return insercion; }, set insercion(v) { insercion = v; },
    get eventosSucios() { return eventosSucios; }, set eventosSucios(v) { eventosSucios = v; },
    get marcasSucias() { return marcasSucias; }, set marcasSucias(v) { marcasSucias = v; },
    get globos() { return globos; },
    get defActual() { return defActual; },
    get claveReto() { return claveReto; },
    get acum() { return acum; }, set acum(v) { acum = v; },
    get infoPestana() { return infoPestana; }, set infoPestana(v) { infoPestana = v; },
    get ultimoAviso() { return ultimoAviso; }, set ultimoAviso(v) { ultimoAviso = v; },
    get tGuardar() { return tGuardar; }, set tGuardar(v) { tGuardar = v; },
    get textosPython() { return textosPython; }, set textosPython(v) { textosPython = v; },
    get metasClave() { return metasClave; }, set metasClave(v) { metasClave = v; },
    get insEstado() { return insEstado; }, set insEstado(v) { insEstado = v; },
    get paletaRota() { return paletaRota; }, set paletaRota(v) { paletaRota = v; },
    get confirmarBorrado() { return confirmarBorrado; }, set confirmarBorrado(v) { confirmarBorrado = v; },
    get performance() { return performance; },
    get servicios() { return servicios; },
    get CMGI18n() { return servicios.CMGI18n; },
    get CMGPaleta() { return CMGPaleta; },
    get CMGPresentacion() { return servicios.CMGPresentacion; },
    get CMGPulsos() { return pulsos; },
    get __banco() { return banco; }, set __banco(v) { banco = v; },
    // window.cmg se crea en el arranque; el editor lo lee ya durante iniciarVistas (Factory).
    get cmg() { return cmg; }, set cmg(v) { cmg = v; },
    get acorn() { return servicios.acorn; },
    get THREE() { return servicios.THREE; }
  }));
  return ctx;
}
