import { DT, crearPartida } from '../../../paquetes/nucleo/index.js';
import war, * as datosWar from '../../../paquetes/reglas-war/index.js';
import reglasFactory, * as factory from '../../../paquetes/reglas-factory/index.js';
import reglasCampaign, * as campaign from '../../../paquetes/reglas-campaign/index.js';
import { crearAnfitrion } from '../../../paquetes/anfitrion/index.js';
import { crearConductor, instalarCicloProgramas, instalarCierreIntentos, instalarBucleJuego } from '../../../paquetes/app/index.js';
import * as vista2d from '../../../paquetes/vista-2d/index.js';
import * as vista3d from '../../../paquetes/vista-3d/index.js';
import * as lenguaje from '../../../paquetes/lenguaje/index.js';
import { CMGEditor, CMGAdaptadorJS, CMGAdaptadorPython, CMGEditorPython } from '../../../paquetes/editor/index.js';
import { instalarConsola, instalarInfoReto, instalarMaquinas, instalarInspector,
  instalarPestanas, instalarRegistro, instalarAyuda } from '../../../paquetes/interfaz/index.js';

const CMGPythonJS = lenguaje.crearPython({ lezer: window.LezerPython, hueco: CMGEditorPython.nombreDe });
const CMGJSaPython = lenguaje.crearJSaPython({ acorn: window.acorn });
const piezasTrabajador = { validarFactory: factory.validar, validarCampaign: campaign.validar,
  modoCampaign: campaign.modoEnSnap, preludioPython: CMGPythonJS.preludio };

/* Code Battle Lite · juego de programación y defensa.
 * Simulación determinista, runtime del jugador en Web Workers, vista 3D/plano, inspector y editor.
 * Inspector en tres estados con signos vitales, pulsación larga en el campo y paleta de iconos.
 * El reparto de pantalla, el teclado del teléfono y los tooltips viven en layout.js. */
const localizarHTML = html => window.CMGPresentacion ? CMGPresentacion.html(html) : html;

// ---------- Constantes del mundo ----------
const SERIE = (() => { const q = new URLSearchParams(location.search).get("serie"); return q === "factory" || q === "campaign" ? q : "war"; })();
const ES_FACTORY = SERIE === "factory", ES_CAMPAIGN = SERIE === "campaign";
// Prefijo de las claves guardadas de cada serie (War conserva las suyas, sin prefijo).
const PREFIJO = ES_CAMPAIGN ? "campaign-" : ES_FACTORY ? "factory-" : "";
const ti18n = (clave, valores) => window.CMGI18n ? window.CMGI18n.t(clave, valores) : clave;
const htmlInterfaz = html => window.CMGPresentacion ? CMGPresentacion.html(html) : html;
// Python (E5): cada unidad se programa en JavaScript o en Python. Python se traduce a JS con las mismas
// líneas (paquetes/lenguaje) y corre en el mismo Worker.
const PYTHON = !!CMGAdaptadorPython && !!CMGPythonJS;
let COLS = 32, ROWS = 18;      // casillas de 1 m
const LINEA_BASE = 3;            // x de la línea roja: cruzarla es una brecha
const VIGIA_MS = 2500;           // bucle sin await
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

const RETOS = ES_CAMPAIGN ? campaign.nivel.RETOS : ES_FACTORY ? factory.retos.RETOS : RETOS_WAR;
// En Campaign las unidades se encienden por hitos: solo las encendidas se programan y se ejecutan.
const programablesDe = d => d.serie === "campaign" && mundo ? mundo.programables : d.robots || d.lanzadores;

// ---------- Almacenamiento local (comodidad del jugador) ----------
const guardado = {
  leer(k, def) { try { const v = localStorage.getItem(`${CLAVE}:${k}`); return v == null ? def : JSON.parse(v); } catch { return def; } },
  escribir(k, v) { try { localStorage.setItem(`${CLAVE}:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};

// ---------- Léxico (resaltado e instrumentación comparten el mismo) ----------
const { KW, FN_PROPIAS, FN_MIEMBRO, PROPS } = lenguaje.vocabulario(SERIE);
const { NOMBRES_HUECO, HUECO, RE_HUECO, lexico } = lenguaje.CMGEditorJS;
const instrumentar = src => lenguaje.instrumentar(src, { serie: SERIE, objetos: nombresVar(), acorn: window.acorn });
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
  let viejo = 0; try { viejo = JSON.parse(localStorage.getItem("cmg-banco02:reto")) || 0; } catch (_) { /* Sin selección antigua. */ }
  return guardado.leer("factory-reto", viejo);
};
let retoIdx = Math.min(IDX_PROPIO, Math.max(0, (ES_CAMPAIGN ? 0 : ES_FACTORY ? retoFactoryInicial() : guardado.leer("reto", 0)) | 0));
let propio = ES_CAMPAIGN ? null : ES_FACTORY ? factory.retos.normalizar(guardado.leer("factory-propio", (() => { try { return JSON.parse(localStorage.getItem("cmg-banco02:propio")); } catch { return null; } })())) : normalizar(guardado.leer("propio", PROPIO_BASE));
let hechos = guardado.leer("hechos", []);
let records = guardado.leer("records", {});
// D6: una tabla de récords por reto; el lenguaje del intento es solo una etiqueta (War la guarda aparte para no cambiar «records»).
let recordsLenguaje = guardado.leer("records-lenguaje", {});
const etiquetaLenguaje = l => l && l !== "js" ? ` <span class="etq-lenguaje">${l === "python" ? "Python" : "JS + Python"}</span>` : "";
let telemetria = guardado.leer(`${PREFIJO}telemetria`, []);
let partida = null, anfitrion = null, conductor = null, enVuelo = null, finActual = null;
let eventos = [], desdeRegistro = 0, unidadVigia = null;
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

// Estado compartido: los accesores conservan las variables locales y evitan capturas obsoletas.
const ctx = {
  get performance() { return performance; },
  get URL() { return URL; },
  get Blob() { return Blob; },
  get Worker() { return Worker; },
  get $() { return $; },
  get $codigo() { return $codigo; },
  get CLAVES_METRICA() { return CLAVES_METRICA; },
  get CLAVE_VIVO() { return CLAVE_VIVO; },
  get CMGAdaptadorJS() { return CMGAdaptadorJS; },
  get CMGAdaptadorPython() { return CMGAdaptadorPython; },
  get CMGEditor() { return CMGEditor; },
  get CMGEditorPython() { return CMGEditorPython; },
  get CMGJSaPython() { return CMGJSaPython; },
  get CMGPythonJS() { return CMGPythonJS; },
  get COLS() { return COLS; }, set COLS(v) { COLS = v; },
  get COSTE() { return COSTE; },
  get DT() { return DT; },
  get ES_CAMPAIGN() { return ES_CAMPAIGN; },
  get ES_FACTORY() { return ES_FACTORY; },
  get FIRMAS() { return FIRMAS; },
  get FN_MIEMBRO() { return FN_MIEMBRO; },
  get FN_PROPIAS() { return FN_PROPIAS; },
  get IDX_PROPIO() { return IDX_PROPIO; },
  get KW() { return KW; },
  get LAU() { return LAU; },
  get MISIL() { return MISIL; },
  get NIVELES() { return NIVELES; },
  get PREFIJO() { return PREFIJO; },
  get PROPS() { return PROPS; },
  get PYTHON() { return PYTHON; },
  get REP() { return REP; },
  get RE_HUECO() { return RE_HUECO; },
  get ROWS() { return ROWS; }, set ROWS(v) { ROWS = v; },
  get SENSOR() { return SENSOR; },
  get SERIE() { return SERIE; },
  get TIPOS() { return TIPOS; },
  get V3() { return V3; },
  get VIGIA_MS() { return VIGIA_MS; },
  get aPython() { return aPython; },
  get abrirHoja() { return abrirHoja; },
  get abrirInspector() { return abrirInspector; },
  get abrirPestana() { return abrirPestana; },
  get abrirPrograma() { return abrirPrograma; },
  get actualizarContenidoReto() { return actualizarContenidoReto; },
  get actualizarEtiquetasConfirmaciones() { return actualizarEtiquetasConfirmaciones; },
  get actualizarVivos() { return actualizarVivos; },
  get acum() { return acum; }, set acum(v) { acum = v; },
  get alcance() { return alcance; },
  get algunoCorre() { return algunoCorre; },
  get anfitrion() { return anfitrion; }, set anfitrion(v) { anfitrion = v; },
  get aplicarTextosInspector() { return aplicarTextosInspector; },
  get atajosPython() { return atajosPython; },
  get avanzar() { return avanzar; },
  get avisar() { return avisar; },
  get avisoSistema() { return avisoSistema; },
  get borradoresMulti() { return borradoresMulti; },
  get cadencia() { return cadencia; },
  get caducarAvisos() { return caducarAvisos; },
  get cancelarArrastre() { return cancelarArrastre; },
  get centrarEn() { return centrarEn; },
  get cerrarAvisos() { return cerrarAvisos; },
  get cerrarProgramas() { return cerrarProgramas; },
  get cicloCampaign() { return cicloCampaign; },
  get claveReto() { return claveReto; },
  get coma() { return coma; },
  get conductor() { return conductor; }, set conductor(v) { conductor = v; },
  get configurarEdicion() { return configurarEdicion; },
  get confirmarBorrado() { return confirmarBorrado; }, set confirmarBorrado(v) { confirmarBorrado = v; },
  get consola() { return consola; },
  get consolasCampaign() { return consolasCampaign; }, set consolasCampaign(v) { consolasCampaign = v; },
  get coste() { return coste; },
  get crearAnfitrion() { return crearAnfitrion; },
  get crearConductor() { return crearConductor; },
  get crearPartida() { return crearPartida; },
  get def() { return def; }, set def(v) { def = v; },
  get defActual() { return defActual; },
  get desdeRegistro() { return desdeRegistro; }, set desdeRegistro(v) { desdeRegistro = v; },
  get detener() { return detener; },
  get dibujar2D() { return dibujar2D; },
  get edicion() { return edicion; }, set edicion(v) { edicion = v; },
  get editorPrograma() { return editorPrograma; },
  get ejec() { return ejec; }, set ejec(v) { ejec = v; },
  get ejecutar() { return ejecutar; },
  get elegirReto() { return elegirReto; },
  get enRango() { return enRango; },
  get enVuelo() { return enVuelo; }, set enVuelo(v) { enVuelo = v; },
  get entregaCampaign() { return entregaCampaign; },
  get esc() { return esc; },
  get estadoCampaign() { return estadoCampaign; }, set estadoCampaign(v) { estadoCampaign = v; },
  get estadoDe() { return estadoDe; },
  get etiquetaLenguaje() { return etiquetaLenguaje; },
  get etiquetas() { return etiquetas; },
  get eventos() { return eventos; }, set eventos(v) { eventos = v; },
  get eventosSucios() { return eventosSucios; }, set eventosSucios(v) { eventosSucios = v; },
  get factory() { return factory; },
  get fila() { return fila; },
  get finActual() { return finActual; }, set finActual(v) { finActual = v; },
  get fmtLugar() { return fmtLugar; },
  get fuentes() { return fuentes; }, set fuentes(v) { fuentes = v; },
  get funcionDe() { return funcionDe; },
  get globo() { return globo; },
  get globos() { return globos; },
  get grupo() { return grupo; },
  get guardado() { return guardado; },
  get guardarCheckpoint() { return guardarCheckpoint; },
  get hechos() { return hechos; }, set hechos(v) { hechos = v; },
  get historia() { return historia; },
  get historialC() { return historialC; }, set historialC(v) { historialC = v; },
  get hitoActual() { return hitoActual; },
  get hitoDetiene() { return hitoDetiene; }, set hitoDetiene(v) { hitoDetiene = v; },
  get hitoPendiente() { return hitoPendiente; }, set hitoPendiente(v) { hitoPendiente = v; },
  get hojaInspector() { return hojaInspector; },
  get hojaReto() { return hojaReto; },
  get hojaUIReto() { return hojaUIReto; },
  get htmlFactoryAPI() { return htmlFactoryAPI; },
  get htmlInterfaz() { return htmlInterfaz; },
  get htmlMetricas() { return htmlMetricas; },
  get htmlVitales() { return htmlVitales; },
  get infoPestana() { return infoPestana; }, set infoPestana(v) { infoPestana = v; },
  get insEstado() { return insEstado; }, set insEstado(v) { insEstado = v; },
  get insercion() { return insercion; }, set insercion(v) { insercion = v; },
  get insertarRef() { return insertarRef; },
  get instrumentar() { return instrumentar; },
  get intento() { return intento; }, set intento(v) { intento = v; },
  get invalidarEscena() { return invalidarEscena; },
  get irALinea() { return irALinea; },
  get lenguaje() { return lenguaje; },
  get lenguajeDe() { return lenguajeDe; },
  get lexico() { return lexico; },
  get limpiarConsola() { return limpiarConsola; },
  get lineaCorre() { return lineaCorre; }, set lineaCorre(v) { lineaCorre = v; },
  get lineaErr() { return lineaErr; }, set lineaErr(v) { lineaErr = v; },
  get localizarHTML() { return localizarHTML; },
  get marcasSucias() { return marcasSucias; }, set marcasSucias(v) { marcasSucias = v; },
  get medirEditor() { return medirEditor; },
  get mensajePython() { return mensajePython; },
  get metaCumplida() { return metaCumplida; },
  get metasClave() { return metasClave; }, set metasClave(v) { metasClave = v; },
  get metricasDe() { return metricasDe; },
  get mostrarBanner() { return mostrarBanner; },
  get mostrarConsola() { return mostrarConsola; },
  get mundo() { return mundo; }, set mundo(v) { mundo = v; },
  get nombradas() { return nombradas; },
  get nombresPython() { return nombresPython; }, set nombresPython(v) { nombresPython = v; },
  get nombresVar() { return nombresVar; },
  get nota() { return nota; },
  get nuevoMundo() { return nuevoMundo; },
  get ocultarBanner() { return ocultarBanner; },
  get opcionesPython() { return opcionesPython; },
  get paletaRota() { return paletaRota; }, set paletaRota(v) { paletaRota = v; },
  get partesPista() { return partesPista; },
  get partida() { return partida; }, set partida(v) { partida = v; },
  get pausa() { return pausa; }, set pausa(v) { pausa = v; },
  get piezasTrabajador() { return piezasTrabajador; },
  get pintarCapa() { return pintarCapa; },
  get pintarControles() { return pintarControles; },
  get pintarEdicion() { return pintarEdicion; },
  get pintarEscenario() { return pintarEscenario; },
  get pintarEventosYa() { return pintarEventosYa; },
  get pintarHud() { return pintarHud; },
  get pintarInfoReto() { return pintarInfoReto; },
  get pintarInspector() { return pintarInspector; },
  get pintarMaquinas() { return pintarMaquinas; },
  get pintarMarcasYa() { return pintarMarcasYa; },
  get pintarPaleta() { return pintarPaleta; },
  get pintarPieIns() { return pintarPieIns; },
  get pintarProgs() { return pintarProgs; },
  get pintarResumen() { return pintarResumen; },
  get pintarRetos() { return pintarRetos; },
  get pistaDe() { return pistaDe; },
  get pistaTrasFallo() { return pistaTrasFallo; },
  get ponerInspector() { return ponerInspector; },
  get progSel() { return progSel; }, set progSel(v) { progSel = v; },
  get programablesDe() { return programablesDe; },
  get programas() { return programas; }, set programas(v) { programas = v; },
  get proveedorEditor() { return proveedorEditor; },
  get r2() { return r2; },
  get r3() { return r3; },
  get records() { return records; }, set records(v) { records = v; },
  get recordsLenguaje() { return recordsLenguaje; }, set recordsLenguaje(v) { recordsLenguaje = v; },
  get registroActual() { return registroActual; },
  get registrosPendientes() { return registrosPendientes; },
  get reglas() { return reglas; },
  get retoIdx() { return retoIdx; }, set retoIdx(v) { retoIdx = v; },
  get ruteo() { return ruteo; }, set ruteo(v) { ruteo = v; },
  get seleccion() { return seleccion; }, set seleccion(v) { seleccion = v; },
  get seleccionadas() { return seleccionadas; }, set seleccionadas(v) { seleccionadas = v; },
  get seleccionar() { return seleccionar; },
  get semilla() { return semilla; }, set semilla(v) { semilla = v; },
  get semillaFija() { return semillaFija; }, set semillaFija(v) { semillaFija = v; },
  get spanInspector() { return spanInspector; },
  get sugerencias() { return sugerencias; },
  get sugerenciasPython() { return sugerenciasPython; },
  get tFicha() { return tFicha; }, set tFicha(v) { tFicha = v; },
  get tGuardar() { return tGuardar; }, set tGuardar(v) { tGuardar = v; },
  get telemetria() { return telemetria; }, set telemetria(v) { telemetria = v; },
  get soloComentarios() { return soloComentarios; },
  get terminar() { return terminar; },
  get terminarCampaign() { return terminarCampaign; },
  get textoDe() { return textoDe; },
  get textoEstadoInspector() { return textoEstadoInspector; },
  get textoInspector() { return textoInspector; },
  get textoReto() { return textoReto; },
  get textosPython() { return textosPython; }, set textosPython(v) { textosPython = v; },
  get ti18n() { return ti18n; },
  get tk() { return tk; },
  get tkValor() { return tkValor; },
  get turbo() { return turbo; }, set turbo(v) { turbo = v; },
  get uiC() { return uiC; },
  get ultimoAviso() { return ultimoAviso; }, set ultimoAviso(v) { ultimoAviso = v; },
  get ultimoToque() { return ultimoToque; }, set ultimoToque(v) { ultimoToque = v; },
  get unidadPorId() { return unidadPorId; },
  get unidadVigia() { return unidadVigia; }, set unidadVigia(v) { unidadVigia = v; },
  get varDe() { return varDe; },
  get velocidad() { return velocidad; }, set velocidad(v) { velocidad = v; },
  get verPanel() { return verPanel; },
  get vigia() { return vigia; },
  get vista() { return vista; }, set vista(v) { vista = v; },
  get vocabularioPython() { return vocabularioPython; },
  get volverA() { return volverA; },
  get CMGI18n() { return window.CMGI18n; },
  get CMGPaleta() { return window.CMGPaleta; },
  get CMGPresentacion() { return window.CMGPresentacion; },
  get CMGPulsos() { return window.CMGPulsos; },
  get __banco() { return window.__banco; },
  get acorn() { return window.acorn; },
  get cmg() { return window.cmg; },
};

let acum = 0;
const {
  algunoCorre, soloComentarios, revisar, ejecutar, arrancarPrograma, fmtLugar, registroActual,
  avanzar, cerrarProgramas, vigia
} = instalarCicloProgramas(ctx);
const {
  terminar, detener
} = instalarCierreIntentos(ctx);

const {
  limpiarConsola, consola, globo, mostrarConsola, avisoSistema, cerrarAvisos, caducarAvisos
} = instalarConsola(ctx);

// ---------- Vista 3D ----------
const leerVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim();
// Fase 2: las vistas dibujan la escena del reglamento (datos planos), no el mundo. Una copia por fotograma:
// se invalida al empezar cada fotograma y al crear un mundo nuevo.
const escenaDe = reglas.escena;
let escenaFoto = null;
const invalidarEscena = () => { escenaFoto = null; };
const estadoVista = {
  get escena() { return mundo ? (escenaFoto ||= { ...escenaDe(mundo), ...(ES_CAMPAIGN ? { activo: !!ejec } : {}) }) : null; }, get seleccionadas() { return seleccionadas; }, get seleccion() { return seleccion; },
  get arrastreCampo() { return arrastreCampo; }, get cols() { return COLS; }, get rows() { return ROWS; },
  get col() { return col; }, get geo2() { return geo2; }, set geo2(g) { geo2 = g; },
  get def() { return def; }, get vista() { return vista; },
};
function leerTerrenoEditor() {
  let terrenoEditor = null;
  if (!ES_FACTORY && !ES_CAMPAIGN && typeof THREE !== "undefined" && new URLSearchParams(location.search).get("terreno") === "editor") {
    try {
      const api = window.CMGTerreno;
      if (!api || !api.crearGeometria) throw new Error("No se cargaron los recursos del editor de terreno.");
      const guardado = localStorage.getItem(api.CLAVE_JUEGO);
      if (!guardado) throw new Error("No hay un terreno guardado para probar.");
      terrenoEditor = api.validar(JSON.parse(guardado));
    } catch (error) {
      console.warn("Terreno del editor: se conserva el paisaje predeterminado.", error.message);
    }
  }
  return terrenoEditor;
}
const V3 = ES_CAMPAIGN
  ? vista3d.crearCampaign3D(estadoVista, { $, FUNCIONES, funcionDe, leerVar, radioDe, mapa: campaign.nivel.MAPA, crearTerreno: vista2d.crearTerreno, reglas: campaign })
  : vista3d.crear3D(estadoVista, { $, ES_FACTORY, ARCO, FR, FUNCIONES, HALO, INTENSIDAD, LINEA_BASE, LUCES, MISIL, TIPOS, alcance, direccionDe, funcionDe, leerVar, radioDe, visual, terreno: window.CMGTerreno, terrenoEditor: leerTerrenoEditor() });

// ---------- Vista de plano (2D) ----------
const $c2d = $("c2d"), ctx2 = $c2d.getContext("2d");
let col = {};
function leerColores() {
  for (const k of ["bg", "surface", "ink", "muted", "line", "grid", "grid-2", "suelo", "building", "building-top", "edge", "accent", "accent-soft", "bad", "warn", "base", "enemigo", "enemigo-frio", "misil", "explosion", "s-visual", "s-termico", "s-vibra", "sel", ...Object.keys(FUNCIONES).map(f => `rol-${f}`)]) col[k] = leerVar(k);
  if (V3) V3.aplicarColores();
}
const rgb = (hex) => { const n = parseInt(String(hex).replace("#", ""), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
const mezclaBlanco = (hex, u) => `rgb(${rgb(hex).map(v => Math.round(v + (255 - v) * u)).join(",")})`;
let geo2 = { T: 10, ox: 0, oy: 0 };
const dibujar2D = ES_CAMPAIGN ? vista2d.crearPlanoCampaign(estadoVista, { $c2d, ctx2, FUNCIONES, funcionDe, radioDe, rgba, mezclaBlanco, mapa: campaign.nivel.MAPA, reglas: campaign }) : vista2d.crearPlano(estadoVista, { $c2d, ctx2, ES_FACTORY, LINEA_BASE, TIPOS, MISIL, SENSOR, LAU, FUNCIONES, FR, HALO, INTENSIDAD, ARCO, LUCES, visual, funcionDe, radioDe, direccionDe, alcance, rgba, mezclaBlanco, r2 });
function proyectar2D(x, y) { return { x: geo2.ox + x * geo2.T, y: geo2.oy + y * geo2.T, visible: true }; }
function elegir2D(px, py) {
  const x = (px - geo2.ox) / geo2.T, y = (py - geo2.oy) / geo2.T;
  let mejor = null, dm = .9;
  for (const e of [...mundo.maquinas, ...mundo.enemigos]) { const ex = e.cx ?? e.x, ey = e.cy ?? e.y, d = Math.hypot(ex - x, ey - y); if (d < dm) { dm = d; mejor = e.id; } }
  return mejor;
}
// Ratón y tacto comparten la selección. La cámara conserva sus botones y los gestos de dos dedos.
const LARGO_MS = 480, $campo = $("campo"), $carga = $("carga");
const $cajaSeleccion = $("seleccion-caja"), punterosCampo = new Set();
let largo = null, arrastreCampo = null, ultimoToque = null, tFicha = 0;
let campoCoordenadas = null;
const unidades = () => [...mundo.maquinas, ...mundo.enemigos];
const unidadPorId = (id) => mundo.porId[id] || mundo.enemigos.find(e => e.id === id);
function puntoPantalla(e) {
  const r = $campo.getBoundingClientRect();
  const p = vista === "3d" && V3
    ? V3.proyectar(e.cx ?? e.x, e.z || 0, e.cy ?? e.y, r.width, r.height)
    : proyectar2D(e.cx ?? e.x, e.cy ?? e.y);
  return { x: p.x + r.left, y: p.y + r.top, visible: p.visible && p.x >= 0 && p.x <= r.width && p.y >= 0 && p.y <= r.height };
}
function unidadEn(cx, cy) {
  const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
  return vista === "3d" && V3 ? V3.elegir(x, y, r.width, r.height) : elegir2D(x, y);
}
function coordenadasEn(cx, cy) {
  const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
  const p = vista === "3d" && V3 ? V3.suelo(x, y, r.width, r.height) : { x: (x - geo2.ox) / geo2.T, y: (y - geo2.oy) / geo2.T, z: 0 };
  return p && p.x >= 0 && p.x <= COLS && p.y >= 0 && p.y <= ROWS ? { x: r2(p.x), y: r2(p.y), z: 0 } : null;
}
document.addEventListener("focusin", (ev) => {
  if (ev.target.matches("[data-coordenadas]")) campoCoordenadas = ev.target;
  else campoCoordenadas = null;
});
function escribirCoordenadas(x, y) {
  if (!campoCoordenadas || !campoCoordenadas.isConnected || campoCoordenadas.disabled || campoCoordenadas.readOnly) return false;
  const p = coordenadasEn(x, y);
  if (p) {
    campoCoordenadas.value = fmtLugar(p);
    campoCoordenadas.dispatchEvent(new Event("input", { bubbles: true }));
    campoCoordenadas.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}
function igualesVisibles(id) {
  const e = unidadPorId(id);
  if (!e) return;
  const tipo = (u) => u.clase || `enemigo:${u.tipo}`;
  seleccionar(unidades().filter(u => tipo(u) === tipo(e) && puntoPantalla(u).visible).map(u => u.id));
}
function dobleEnCampo(x, y) {
  clearTimeout(tFicha); ultimoToque = null;
  if (escribirCoordenadas(x, y)) return;
  const id = unidadEn(x, y);
  if (id) igualesVisibles(id);
}
$campo.addEventListener("dblclick", (ev) => {
  if (ev.button !== 0 || ev.target.tagName !== "CANVAS") return;
  ev.preventDefault();
  // El doble toque ya se procesa en pointerup, sin depender del clic sintético.
  if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return;
  dobleEnCampo(ev.clientX, ev.clientY);
});
function cancelarLargo() { if (largo) { cancelAnimationFrame(largo.raf); clearTimeout(largo.fin); } largo = null; $carga.hidden = true; }
function cancelarArrastre() {
  cancelarLargo(); arrastreCampo = null; $cajaSeleccion.hidden = true;
}
$campo.addEventListener("pointerdown", (ev) => {
  if (ev.target.tagName !== "CANVAS") return;
  cerrarHoja();
  clearTimeout(tFicha);
  punterosCampo.add(ev.pointerId);
  if (punterosCampo.size > 1) { cancelarArrastre(); ultimoToque = null; return; }
  if (ev.button !== 0) return;
  ev.target.setPointerCapture(ev.pointerId);
  // Evita que el mapa quite el foco al destino de coordenadas.
  if (campoCoordenadas) ev.preventDefault();
  const id = unidadEn(ev.clientX, ev.clientY), tactil = ev.pointerType === "touch";
  // Doble toque en el suelo y, sin soltar el segundo, arrastrar: el cuadro de selección de PC.
  const cajaTactil = tactil && !campoCoordenadas && !!ultimoToque && !ultimoToque.id
    && performance.now() - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 32;
  arrastreCampo = { puntero: ev.pointerId, tactil, cajaTactil, x: ev.clientX, y: ev.clientY, px: ev.clientX, py: ev.clientY, t0: performance.now(), id, modo: null, movido: false, base: ev.shiftKey ? [...seleccionadas] : [] };
  if (!id || campoCoordenadas || cajaTactil) return;
  const r = $campo.getBoundingClientRect();
  largo = { puntero: ev.pointerId, id, x: ev.clientX, y: ev.clientY, t0: performance.now(), raf: 0 };
  $carga.style.left = `${ev.clientX - r.left}px`; $carga.style.top = `${ev.clientY - r.top}px`; $carga.style.setProperty("--p", 0);
  // El temporizador decide; el anillo solo acompaña (sin fotogramas, la ficha se abre igual).
  largo.fin = setTimeout(() => {
    if (!arrastreCampo || !largo) return;
    const elegido = largo.id;
    arrastreCampo.ficha = true;
    cancelarLargo(); seleccionar([elegido], { inspeccionar: false });
    ponerInspector("abierto");
    if (navigator.vibrate) navigator.vibrate(12);
  }, LARGO_MS);
  const tick = (now) => {
    if (!largo) return;
    const u = (now - largo.t0 - 110) / (LARGO_MS - 110);
    if (u > 0) { $carga.hidden = false; $carga.style.setProperty("--p", Math.min(1, u).toFixed(3)); }
    largo.raf = requestAnimationFrame(tick);
  };
  largo.raf = requestAnimationFrame(tick);
}, true);
$campo.addEventListener("pointermove", (ev) => {
  const a = arrastreCampo;
  if (!a || a.puntero !== ev.pointerId) return;
  const distancia = Math.hypot(ev.clientX - a.x, ev.clientY - a.y);
  if (distancia > 8) a.movido = true;
  // Con un dedo, arrastrar mueve la cámara salvo que el doble toque haya armado el cuadro.
  if (a.tactil && !a.cajaTactil) {
    if (a.movido && a.modo !== "camara") { a.modo = "camara"; cancelarLargo(); }
  } else if (a.movido) {
    cancelarLargo(); a.modo = "caja";
    const r = $campo.getBoundingClientRect();
    $cajaSeleccion.hidden = false;
    Object.assign($cajaSeleccion.style, { left: `${Math.min(a.x, ev.clientX) - r.left}px`, top: `${Math.min(a.y, ev.clientY) - r.top}px`, width: `${Math.abs(ev.clientX - a.x)}px`, height: `${Math.abs(ev.clientY - a.y)}px` });
  }
  a.px = ev.clientX; a.py = ev.clientY;
}, true);
$campo.addEventListener("pointerup", (ev) => {
  punterosCampo.delete(ev.pointerId);
  const a = arrastreCampo;
  if (!a || a.puntero !== ev.pointerId) return;
  if (a.modo === "caja") {
    seleccionar([...a.base, ...unidades().filter(u => {
      const p = puntoPantalla(u);
      return p.visible && p.x >= Math.min(a.x, ev.clientX) && p.x <= Math.max(a.x, ev.clientX) && p.y >= Math.min(a.y, ev.clientY) && p.y <= Math.max(a.y, ev.clientY);
    }).map(u => u.id)]);
    ultimoToque = null;
  } else if (!a.movido && !a.ficha) {
    if (a.tactil) {
      const ahora = performance.now();
      if (ultimoToque && ahora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 24) dobleEnCampo(ev.clientX, ev.clientY);
      else {
        ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, id: a.id };
        if (!campoCoordenadas) {
          seleccionar(a.id, { inspeccionar: false });
          tFicha = setTimeout(() => { if (seleccion) ponerInspector(inspectorCompleto() ? "abierto" : "tira"); }, 320);
        }
      }
    } else if (!campoCoordenadas) seleccionar(a.base.length ? [...a.base, a.id].filter(Boolean) : a.id);
  }
  cancelarArrastre();
}, true);
for (const tipo of ["pointercancel", "lostpointercapture"]) $campo.addEventListener(tipo, (ev) => {
  punterosCampo.delete(ev.pointerId);
  if (arrastreCampo && arrastreCampo.puntero === ev.pointerId) cancelarArrastre();
}, true);
addEventListener("blur", () => { clearTimeout(tFicha); punterosCampo.clear(); cancelarArrastre(); });

// ---------- Variantes visuales en prueba (?poc=1) ----------
function aplicarVisual() {
  document.documentElement.dataset.paleta = visual.paleta;
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(VARIANTES)) q.set(k, visual[k]);
  history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
  leerColores();
  if (V3 && mundo) V3.construir();
}
if (new URLSearchParams(location.search).has("poc")) {
  const d = document.createElement("details"); d.className = "poc"; d.open = innerWidth > 760;
  d.innerHTML = htmlInterfaz(`<summary>Variantes</summary>` + Object.entries(VARIANTES).map(([k, ops]) =>
    `<div class="g"><b>${k}</b><div class="ops">${Object.entries(ops).map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${visual[k] === v}">${esc(t)}</button>`).join("")}</div></div>`).join(""));
  d.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-k]"); if (!b) return;
    visual[b.dataset.k] = b.dataset.v;
    d.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.setAttribute("aria-pressed", x === b));
    aplicarVisual();
  });
  $campo.append(d);
}

// ---------- Etiquetas y globos sobre el campo ----------
const $capa = $("capa"), etiquetas = new Map();
function pintarCapa(off, ahora) {
  const W = $capa.clientWidth, H = $capa.clientHeight;
  const vivos = new Set(), puestas = [];
  const cercaC = ES_CAMPAIGN && (vista === "3d" && V3 ? V3.camara().dist < 55 : geo2.T > 9);
  for (const e of mundo.maquinas) {
    const alto = ES_CAMPAIGN ? uiC.altoEtiqueta(e) : e.clase === "lanzador" ? 1.45 : e.clase === "vibracion" ? 1.7 : e.clase === "deposito" ? 1.1 : .9;
    const p = vista === "3d" && V3 ? V3.proyectar(e.cx, alto, e.cy, W, H) : proyectar2D(e.cx, e.cy - radioDe(e));
    vivos.add(e.id);
    let o = etiquetas.get(e.id);
    if (!o) {
      const etq = document.createElement("div"); etq.className = "etq";
      etq.style.setProperty("--rol", `var(--rol-${funcionDe(e).principal})`);
      const g = document.createElement("div"); g.className = "globo"; g.hidden = true;
      $capa.append(etq, g); o = { etq, g, texto: "", txtEtq: "" }; etiquetas.set(e.id, o);
    }
    const atasco = e.clase === "lanzador" && e.atascado;
    // Campaign: los contadores de tarimas y máquinas se ven de cerca sin seleccionar nada.
    const fija = ES_CAMPAIGN && !seleccionadas.has(e.id) && cercaC && uiC.siempre(e);
    const txt = ES_CAMPAIGN ? (fija ? uiC.etiqueta(e).replace(`${e.id} · `, "") : uiC.etiqueta(e)) : e.clase === "lanzador" ? `${e.id} · ${e.misiles}▮${atasco ? " ⚠" : ""}` : e.id;
    if (txt !== o.txtEtq) { o.etq.textContent = txt; o.txtEtq = txt; }
    o.etq.className = `etq${e.id === seleccion ? " principal" : ""}${atasco ? " atasco" : ""}${fija ? " fija" : ""}`;
    // Los nombres solo aparecen en las unidades seleccionadas: sin selección no tapan a nadie.
    o.etq.hidden = !p.visible || !(seleccionadas.has(e.id) || fija);
    if (!o.etq.hidden) puestas.push({ o, x: p.x, y: p.y, w: txt.length * 7.2 + 22, h: 21 });
    const gl = globos.get(e.id);
    if (gl && ahora < gl.hasta && p.visible) {
      const textoGlobo = gl.nivel === "sistema" && window.CMGPresentacion ? CMGPresentacion.texto(gl.texto) : gl.texto;
      if (o.texto !== gl.nivel + textoGlobo) { o.g.textContent = textoGlobo; o.g.className = `globo ${gl.nivel}`; o.texto = gl.nivel + textoGlobo; }
      o.g.hidden = false; o.g.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - 22px))`;
    } else o.g.hidden = true;
  }
  for (const [id, o] of etiquetas) if (!vivos.has(id)) { o.etq.remove(); o.g.remove(); etiquetas.delete(id); }
  // Si dos etiquetas se tocan, la de más arriba en pantalla sube un escalón.
  puestas.sort((a, b) => b.y - a.y);
  const hechas = [];
  for (const q of puestas) {
    for (let i = 0, choca = true; choca && i < 12; i++) {
      const h = hechas.find(h => Math.abs(h.x - q.x) < (h.w + q.w) / 2 && q.y - q.h < h.y && h.y - h.h < q.y);
      choca = !!h; if (h) q.y = h.y - h.h - 2;
    }
    hechas.push(q);
    q.o.etq.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
  }
}
function centrarEn(id) {
  const e = mundo.porId[id] || mundo.enemigos.find(x => x.id === id);
  if (e && V3 && vista === "3d") V3.centrar(e.cx ?? e.x, e.cy ?? e.y);
}

// ---------- Retos y mundo en pantalla ----------
// Solo los contenidos de los retos incluidos se localizan. El escenario propio sigue siendo datos del jugador.
const textoReto = (campo, original = def[campo], indice = retoIdx) => ES_CAMPAIGN ? ti18n(`campaign.hito.${mundo ? mundo.hito : 0}.${campo}`) : indice < IDX_PROPIO
  ? ti18n(`retos.${SERIE}.${indice}.${campo}`) : original || "";
const hojaReto = (campo, original, indice = retoIdx) => `<span data-reto-campo="${campo}" data-reto-indice="${indice}">${esc(textoReto(campo, original, indice))}</span>`;
const hojaUIReto = (clave, params = {}) => `<span data-reto-ui="${clave}" data-reto-params="${esc(JSON.stringify(params))}">${esc(ti18n(clave, params))}</span>`;
function actualizarContenidoReto() {
  for (const el of document.querySelectorAll("[data-reto-ui]")) el.textContent = ti18n(el.dataset.retoUi, JSON.parse(el.dataset.retoParams));
  for (const [id, campo] of [["titulo", "titulo"], ["objetivo-corto", "objetivo"], ["objetivo-txt", "objetivo"], ["leccion", "leccion"]])
    $(id).textContent = textoReto(campo);
  $("info-reto-titulo").textContent = `${ES_CAMPAIGN ? hitoActual().clave : retoIdx === IDX_PROPIO ? ti18n("retos.propio") : ti18n("retos.reto", { numero: retoIdx + 1 })} · ${textoReto("titulo")}`;
  for (const el of document.querySelectorAll("[data-reto-campo]")) {
    const indice = +el.dataset.retoIndice;
    if (indice < IDX_PROPIO) el.textContent = textoReto(el.dataset.retoCampo, "", indice);
  }
}
function pintarRetos() {
  if (ES_CAMPAIGN) { $("retos").innerHTML = uiC.chipsHitos(historialC); return; }
  const chips = RETOS.map((r, i) => [i, r.titulo]).concat(ES_FACTORY ? [] : [[IDX_PROPIO, `✎ ${propio.titulo}`]]);
  $("retos").innerHTML = chips.map(([i, t]) => {
    const clave = PREFIJO + (i === IDX_PROPIO ? "propio" : String(i)), hecho = hechos.includes(clave);
    return `<button type="button" class="reto-btn${hecho ? " hecho" : ""}" aria-pressed="${i === retoIdx}" data-i="${i}"><span class="n">${hecho ? "✓" : i === IDX_PROPIO ? "+" : i + 1}</span>${i < IDX_PROPIO ? hojaReto("titulo", t, i) : esc(t)}</button>`;
  }).join("");
}
$("retos").addEventListener("click", (ev) => { const b = ev.target.closest(".reto-btn"); if (!b) return; if (ES_CAMPAIGN) volverAHito(+b.dataset.i); else elegirReto(+b.dataset.i); });
function abrirHoja(si) {
  $("hoja-reto").hidden = !si;
  $("b-reto").setAttribute("aria-expanded", si);
}
const cerrarHoja = () => { if (!$("hoja-reto").hidden) abrirHoja(false); };
let infoPestana = "objetivo";
let ultimoAviso = {};
let tGuardar = 0;
let textosPython = null;
let metasClave = "";
const {
  partesPista, pistaDe, pistaTrasFallo, INFO, pintarInfoReto, textoInicial, copiaFuentes,
  guardarProgramas, lenguajeDe, textoDe, ponerTexto, textoInicialPython, convertirAPython,
  vistaPython, nuevoMundo, elegirReto, actualizarReloj, pintarHud, actualizarEtiquetasControles,
  pintarControles, aplicarVista
} = instalarInfoReto(ctx);

let insEstado = "cerrado";
const {
  pintarMaquinas, inspectorCompleto, seleccionar, ponerInspector, abrirInspector, tk, fila, nota,
  textoInspector, hojaInspector, spanInspector, aplicarTextosInspector, textoEstadoInspector,
  CLAVES_METRICA, htmlMetricas, grupo, tkValor, estadoDe, metricasDe, pintarInspector
} = instalarMaquinas(ctx);

let paletaRota = null;
const {
  variablesPrograma, varFactory, htmlFactoryAPI, pintarPieIns, historia, celdas, vital, htmlVitales,
  actualizarVivos, paletaSegura, editorPrograma, insertar, envolver, alternarComentario,
  medirEditor, pintarResaltado, seleccionarHueco, avisoEditor, pintarPaleta, $editor
} = instalarInspector(ctx);

const {
  abrirPestana, mostrarBanner, actualizarPistaBanner, ocultarBanner
} = instalarPestanas(ctx);

// ---------- Programas ----------
function actualizarEtiquetasProgs() {
  const $progs = $("progs");
  $progs.setAttribute("aria-label", ti18n(ES_CAMPAIGN ? "campaign.progs.aria" : ES_FACTORY ? "partida.progs.aria.factory" : "partida.progs.aria.war"));
  for (const b of $progs.querySelectorAll(".prog-tab")) {
    const id = b.dataset.id;
    const pre = b.querySelector(".prog-pre");
    if (pre) pre.textContent = ti18n("partida.progs.prefijo");
    b.setAttribute("aria-label", ti18n("partida.progs.unidad", { unidad: id }));
  }
}
// Campaign: las otras unidades encendidas de la misma clase (a ellas se copia un programa).
const gemelos = id => { const e = mundo && mundo.porId[id]; return e ? mundo.programables.filter(u => u.id !== id && u.clase === e.clase) : []; };
function pintarProgs() {
  const varios = programablesDe(def).length > 1;
  $("progs").innerHTML = programablesDe(def).map(l => {
    const p = ejec && ejec.progs.get(l.id);
    const est = lineaErr && lineaErr.id === l.id ? "error" : p ? (["nuevo", "corre"].includes(anfitrion.estado(l.id)) ? "corre" : anfitrion.estado(l.id) === "espera" ? "espera" : "") : "";
    return `<button type="button" class="prog-tab" data-id="${l.id}" aria-pressed="${edicion.ids.includes(l.id)}"><span class="punto ${est}"></span><span class="prog-pre"></span>${l.id}</button>`;
  }).join("");
  $("b-copiar-prog").hidden = !varios || edicion.ids.length > 1 || (ES_CAMPAIGN && !gemelos(progSel).length);
  $("b-restaurar").hidden = edicion.ids.length > 1;
  actualizarEtiquetasProgs();
}
$("progs").addEventListener("click", (ev) => { const b = ev.target.closest(".prog-tab"); if (b) abrirPrograma(b.dataset.id); });
function abrirPrograma(id) {
  if (!Object.hasOwn(programas, id)) return;
  seleccionar(id, { inspeccionar: "conservar" });
  configurarEdicion([id], true);
}
function configurarEdicion(ids, forzar = false) {
  ids = [...new Set(ids)].filter(id => Object.hasOwn(programas, id));
  if (!ids.length) return;
  if (!forzar && ids.join("|") === edicion.ids.join("|")) return;
  const textos = ids.map(textoDe), langs = ids.map(lenguajeDe);
  const variosLenguajes = langs.some(l => l !== langs[0]);
  edicion = { ids, mixto: variosLenguajes || textos.some(src => src !== textos[0]), lenguaje: variosLenguajes ? "js" : langs[0], variosLenguajes };
  progSel = ids[0];
  $codigo.value = edicion.mixto ? (borradoresMulti.get(claveEdicion(ids) + ":" + edicion.lenguaje) || "") : textos[0];
  $("acciones-multi").hidden = !edicion.mixto;
  // Cambia el documento que se edita: el historial de deshacer de edicion.js va por documento.
  editorPrograma.abrir({ id: claveDocumento(), lenguaje: edicion.lenguaje, texto: $codigo.value, revision: 0 });
  actualizarEtiquetasEdicion();
  pintarProgs(); medirEditor(); pintarEdicion(); pintarPieIns(); pintarLenguaje(); marcasSucias = true;
}
function actualizarEtiquetasEdicion() {
  const $codigoActivo = $("codigo");
  if (!$codigoActivo || !edicion.ids.length) return;
  const nombreL = ti18n(edicion.lenguaje === "python" ? "partida.lenguaje.python" : "partida.lenguaje.javascript");
  $codigoActivo.placeholder = edicion.mixto ? ti18n("partida.multi.placeholder") : "";
  $("multi-estado").textContent = edicion.variosLenguajes
    ? ti18n("partida.multi.lenguajes_distintos", { cantidad: edicion.ids.length })
    : ti18n("partida.multi.programas_distintos", { cantidad: edicion.ids.length });
  $codigoActivo.setAttribute("aria-label", edicion.ids.length > 1
    ? ti18n("partida.multi.aria", { cantidad: edicion.ids.length, lenguaje: nombreL })
    : ti18n("partida.programa.aria", { unidad: progSel, lenguaje: nombreL }));
}
const claveDocumento = () => `${retoIdx}:${claveEdicion(edicion.ids)}${edicion.mixto ? ":borrador" : ""}${edicion.lenguaje === "python" ? ":python" : ""}`;
// Lenguaje de la unidad: el desplegable de la cabecera y Python en Ajustes. JavaScript, Seudo y
// Bloques vuelven a JavaScript; el programa Python se conserva para cuando se vuelva a elegir.
const $selLenguaje = $("sel-lenguaje");
function asegurarOpcionesLenguaje() {
  if (!$selLenguaje || $selLenguaje.dataset.opcionesI18n === "1") return;
  $selLenguaje.replaceChildren();
  const varios = document.createElement("option"); varios.value = "varios"; varios.disabled = true; varios.dataset.i18n = "partida.selector.varios";
  $selLenguaje.appendChild(varios);
  const agregarOpcion = (valor, clave) => {
    const opcion = document.createElement("option"); opcion.value = valor; opcion.dataset.i18n = clave; $selLenguaje.appendChild(opcion);
  };
  agregarOpcion("js", "partida.lenguaje.javascript");
  if (PYTHON) agregarOpcion("python", "partida.lenguaje.python");
  // Campaign se programa en JavaScript o Python; todavía no tiene vistas de seudocódigo ni bloques.
  if (ES_CAMPAIGN) { $selLenguaje.dataset.opcionesI18n = "1"; return; }
  const vistas = document.createElement("optgroup"); vistas.dataset.i18nLabel = "partida.selector.vistas_js";
  const seudo = document.createElement("option"); seudo.value = "pseudo"; seudo.dataset.i18n = "partida.selector.seudocodigo"; vistas.appendChild(seudo);
  if (ES_FACTORY) { const bloques = document.createElement("option"); bloques.value = "bloques"; bloques.dataset.i18n = "partida.selector.bloques"; vistas.appendChild(bloques); }
  $selLenguaje.appendChild(vistas);
  $selLenguaje.dataset.opcionesI18n = "1";
}
function actualizarEtiquetasSelectorLenguaje() {
  if (!$selLenguaje) return;
  for (const opcion of $selLenguaje.querySelectorAll("option[data-i18n]")) opcion.textContent = ti18n(opcion.dataset.i18n);
  const vistas = $selLenguaje.querySelector("optgroup[data-i18n-label]");
  if (vistas) vistas.label = ti18n(vistas.dataset.i18nLabel);
}
function pintarSelectorLenguaje() {
  if (!$selLenguaje) return;
  asegurarOpcionesLenguaje();
  const varios = PYTHON && !!edicion.variosLenguajes, py = PYTHON && edicion.lenguaje === "python" && !varios;
  const modoVista = $("app").dataset.modo || "js";
  const opcionVarios = $selLenguaje.querySelector('option[value="varios"]');
  if (opcionVarios) opcionVarios.hidden = !varios;
  $selLenguaje.value = varios ? "varios" : py ? "python" : (modoVista === "js" ? "js" : modoVista);
  actualizarEtiquetasSelectorLenguaje();
}
function pintarLenguaje() {
  pintarSelectorLenguaje();
  if (!PYTHON) return;
  const py = edicion.lenguaje === "python" && !edicion.variosLenguajes;
  for (const b of document.querySelectorAll("[data-lenguaje-programa]")) { b.hidden = false; b.disabled = false; b.setAttribute("aria-pressed", String(py)); }
  if (py) for (const b of document.querySelectorAll("[data-modo-codigo]")) b.setAttribute("aria-pressed", "false");
  $("app").dataset.lenguaje = py ? "python" : "js";
}
if ($selLenguaje) {
  $selLenguaje.addEventListener("change", () => {
    const v = $selLenguaje.value;
    if (v === "python") cambiarLenguaje("python");
    else if (PYTHON && edicion.lenguaje === "python") { if (cambiarLenguaje("js")) editorPrograma.fachada.seudo?.aplicarModo(v); }
    else editorPrograma.fachada.seudo?.aplicarModo(v);
    pintarSelectorLenguaje();
  });
  $("app").addEventListener("cmg:modo", pintarSelectorLenguaje);
}
function cambiarLenguaje(lenguaje) {
  if (!PYTHON || !def) return false;
  if (ejec) { avisoEditor(ti18n("partida.editor.detener_para_cambiar_lenguaje")); return false; }
  if (!edicion.variosLenguajes && edicion.lenguaje === lenguaje) return false;
  const sinConvertir = [];
  for (const id of edicion.ids) {
    if (lenguaje === "python") {
      // Py recupera el último Python de la unidad; si no lo hay, convierte su JS (E7). Si no cabe, el JS se conserva.
      if (fuentes[id]) { fuentes[id] = { ...fuentes[id], enUso: true }; continue; }
      const js = programas[id] || "";
      let texto = textoInicialPython(def, id);
      if (js !== textoInicial(def, id) && js.trim()) {
        const r = convertirAPython(js);
        if (r.ok) texto = r.texto;
        else { sinConvertir.push(`<b>${esc(id)}</b>: <span>${esc(r.motivo)}</span>${r.linea ? ` <span>(línea ${r.linea} del JavaScript)</span>` : ""}`); texto = `# Programa de ${id} en Python.\n# Tu programa JavaScript no se pudo convertir; sigue guardado: vuelve con JS para verlo.\n\n`; }
      }
      fuentes[id] = { lenguaje: "python", texto, enUso: true };
    } else if (fuentes[id]) fuentes[id].enUso = false;
  }
  guardarProgramas(); configurarEdicion(edicion.ids, true); pintarInspector();
  if (sinConvertir.length) avisoEditor(`No se pudo pasar a Python: ${sinConvertir.join(" · ")}`);
  return true;
}
if (PYTHON) document.addEventListener("click", (ev) => {
  const py = ev.target.closest && ev.target.closest("[data-lenguaje-programa]");
  if (py) { cambiarLenguaje(py.dataset.lenguajePrograma); return; }
  const vista = ev.target.closest && ev.target.closest("[data-modo-codigo]");
  // Con Python no hay vistas: elegir JS, Seudo o Bloques vuelve a JavaScript y aplica esa vista.
  if (vista && edicion.lenguaje === "python" && cambiarLenguaje("js")) editorPrograma.fachada.seudo?.aplicarModo(vista.dataset.modoCodigo);
});
const CLAVE_CONFIRMAR_REPLACE = "cmg-juego-confirmar-replace";
let confirmarReplace = (() => { try { return localStorage.getItem(CLAVE_CONFIRMAR_REPLACE) !== "false"; } catch { return true; } })();
let idsReplaceAbierto = null;
function actualizarTextoReplace() {
  const texto = $("replace-texto");
  if (texto && idsReplaceAbierto) texto.textContent = ti18n("partida.replace.texto", { unidades: idsReplaceAbierto.join(", ") });
}
function preferirConfirmacionReplace(valor) {
  confirmarReplace = !!valor;
  try { localStorage.setItem(CLAVE_CONFIRMAR_REPLACE, JSON.stringify(confirmarReplace)); } catch { /* preferencia de sesión */ }
}
function confirmarReemplazo(ids) {
  if (!confirmarReplace) return Promise.resolve(true);
  const dialogo = $("confirmar-replace"), omitir = $("replace-no-preguntar");
  omitir.checked = false;
  dialogo.returnValue = "cancelar";
  idsReplaceAbierto = [...ids];
  actualizarTextoReplace();
  return new Promise(resolve => {
    dialogo.addEventListener("close", () => {
      const aceptado = dialogo.returnValue === "reemplazar";
      if (aceptado && omitir.checked) preferirConfirmacionReplace(false);
      idsReplaceAbierto = null;
      resolve(aceptado);
    }, { once: true });
    dialogo.showModal();
  });
}
const aplicarMulti = window.CMGProgramas.crearAplicador({
  estado: () => ({ ejec, edicion, programas: edicion.lenguaje === "python" ? textosPython : programas, texto: $codigo.value }),
  confirmarReemplazo,
  alAplicar(ids) {
    borradoresMulti.delete(claveEdicion(ids) + ":" + edicion.lenguaje);
    guardarProgramas(); configurarEdicion(ids, true); pintarInspector();
  },
});
const aplicarSiSeMezcla = reemplazar => edicion.variosLenguajes ? avisoEditor(ti18n("partida.multi.lenguaje_error")) : aplicarMulti(reemplazar);
$("b-add").addEventListener("click", () => aplicarSiSeMezcla(false));
$("b-replace").addEventListener("click", () => aplicarSiSeMezcla(true));
$("b-coordenadas").addEventListener("click", () => { const texto = $("coordenadas").value.trim(); if (texto) insertar(texto); });
let confirmarCopia = false;
let confirmarRestaurar = false;
function actualizarEtiquetasConfirmaciones() {
  $("b-copiar-prog").textContent = ES_CAMPAIGN ? ti18n(confirmarCopia ? "campaign.copiar.confirmar" : "campaign.copiar", { clase: ti18n(mundo && mundo.porId[progSel] && mundo.porId[progSel].clase === "obrero" ? "campaign.copiar.obrero" : "campaign.copiar.maquina") })
    : ti18n(confirmarCopia ? "partida.programa.copiar.confirmar" : "partida.programa.copiar", { unidad: progSel });
  $("b-restaurar").textContent = ti18n(confirmarRestaurar ? "partida.programa.restaurar.confirmar" : "partida.programa.restaurar");
  $("b-copiar").textContent = ti18n("partida.telemetria.copiar");
  $("b-borrar").textContent = ti18n(confirmarBorrado ? "partida.telemetria.borrar.confirmar" : "partida.telemetria.borrar");
  $("copiado").textContent = ti18n("partida.telemetria.copiada");
}
$("b-copiar-prog").addEventListener("click", (ev) => {
  if (ejec) return;
  if (!confirmarCopia) {
    confirmarCopia = true; actualizarEtiquetasConfirmaciones();
    setTimeout(() => { confirmarCopia = false; actualizarEtiquetasConfirmaciones(); }, 3000);
    return;
  }
  confirmarCopia = false; actualizarEtiquetasConfirmaciones();
  // Se copia el programa en su lenguaje: los demás pasan a ese lenguaje y conservan el otro.
  const py = lenguajeDe(progSel) === "python";
  for (const l of (ES_CAMPAIGN ? gemelos(progSel) : def.lanzadores)) if (l.id !== progSel) {
    if (py) fuentes[l.id] = { lenguaje: "python", texto: fuentes[progSel].texto.split(progSel).join(l.id), enUso: true };
    else { programas[l.id] = programas[progSel].split(progSel).join(l.id); if (fuentes[l.id]) fuentes[l.id].enUso = false; }
  }
  guardarProgramas();
});
$("b-restaurar").addEventListener("click", (ev) => {
  if (ejec) return;
  if (!confirmarRestaurar) {
    confirmarRestaurar = true; actualizarEtiquetasConfirmaciones();
    setTimeout(() => { confirmarRestaurar = false; actualizarEtiquetasConfirmaciones(); }, 3000);
    return;
  }
  confirmarRestaurar = false; actualizarEtiquetasConfirmaciones();
  ponerTexto(progSel, lenguajeDe(progSel) === "python" ? textoInicialPython(def, progSel) : textoInicial(def, progSel)); guardarProgramas(); abrirPrograma(progSel);
});
function pintarEdicion() {
  $codigo.readOnly = !!ejec;
  for (const id of ["b-add", "b-replace", "b-coordenadas", "coordenadas"]) $(id).disabled = !!ejec;
  marcasSucias = true;
  $codigo.dispatchEvent(new CustomEvent("cmg:estado"));
}

// ---------- Editor de texto ----------
const $codigo = $("codigo"), $gutter = $("gutter"), $banda = $("banda"), $espejo = $("espejo"), $resaltado = $("resaltado"), $bloques = $("bloques");
function pintarBanda() {
  const corre = !edicion.mixto && lineaCorre[progSel], err = !edicion.mixto && lineaErr && lineaErr.id === progSel ? lineaErr.linea : null;
  editorPrograma.marcas(editorPrograma.documento().revision, [{ linea: corre, clase: "corre" }, { linea: err, clase: "err" }]);
}
function pintarMarcasYa() { marcasSucias = false; pintarBanda(); pintarProgs(); }
// En modo pantalla completa, layout.js pone a pantalla completa el panel pedido.
const verPanel = (panel) => $("app").dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
function irALinea(l) { verPanel("codigo"); abrirPestana("programa"); editorPrograma.irALinea(l); }
$codigo.addEventListener("input", () => {
  if (!edicion.mixto) for (const id of edicion.ids) ponerTexto(id, $codigo.value);
  else borradoresMulti.set(claveEdicion(edicion.ids) + ":" + edicion.lenguaje, $codigo.value);
  if (lineaErr && lineaErr.id === progSel) { lineaErr = null; marcasSucias = true; }
  medirEditor();
  if (!edicion.mixto) guardarProgramas();
});
function insertarRef(ins, fin) {
  abrirPestana("programa");
  if (ejec) { avisoEditor("Detén el programa para editarlo."); return; }
  if ($("app").dataset.modo === "pseudo") { avisoEditor("En seudocódigo toca un valor del programa para cambiarlo, o usa los ladrillos."); return; }
  const v = $codigo.value, a = $codigo.selectionStart, b = $codigo.selectionEnd;
  const finLinea = v.indexOf("\n", b) < 0 ? v.length : v.indexOf("\n", b);
  const py = edicion.lenguaje === "python", RE = py ? CMGAdaptadorPython.hueco.re : RE_HUECO;
  let texto = py ? aPython(ins) : ins;
  if (/^".*"$/.test(texto) && v[a - 1] === '"' && v[b] === '"') texto = texto.slice(1, -1);
  if (fin && !v.slice(b, finLinea).trim()) texto += " " + (py ? aPython(fin) : fin);
  const h = texto.search(RE);
  if (h >= 0 && envolver(texto.slice(0, h), texto.slice(h + texto.slice(h).match(RE)[0].length))) return;
  if (h >= 0) { const m = texto.slice(h).match(RE)[0]; insertar(texto, h, h + m.length); }
  else { insertar(texto); seleccionarHueco(); }
}
// ---------- Sugerencias para huecos, argumentos y condiciones ----------
// Salen de los datos de la máquina cuyo programa se edita, como los del inspector:
// sus sensores, los enemigos del reto, sus propiedades y la red de sensores.
const FIRMAS = {
  autoTarget: ["tipo de enemigo", "sensor"], detect: ["tipo de enemigo"], regularShoot: ["lugar"], burstFire: ["lugar"], stopFire: [],
  pickUp: ["lugar", "material"], deliver: ["lugar"], wait: ["segundos"], count: ["lugar", "material"],
  goTo: ["lugar"], irA: ["lugar"], setRecipe: ["receta"], light: ["color"], request: ["materia"], start: [], stop: [],
  recoger: ["lugar", "material"], entregar: ["lugar"], cuantos: ["lugar", "material"],
  esperar: ["segundos"], log: ["mensaje"], info: ["mensaje"], warn: ["mensaje"], error: ["mensaje"],
};
// ---------- Python (E4b) ----------
// Los fragmentos del juego (inspector, sugerencias, paleta) están escritos en JS y son cortos:
// llamadas, valores, huecos y operadores. Con un documento Python se pasan, ficha a ficha, a su forma
// Python (nombres del proveedor por D1, huecos __x__ por D4, sin «;»). Los bloques usan las plantillas Python.
let nombresPython = null;
const NOMBRES_LIT = { true: "True", false: "False", null: "None", undefined: "None" };
function aPython(t) {
  if (t == null) return t;
  nombresPython ||= new Map(proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
  const toks = lexico(String(t));
  let out = "";
  for (let i = 0; i < toks.length; i++) {
    const [k, v] = toks[i];
    if (k === "com") { const m = v.match(/^\/\*\s*([\s\S]*?)\s*\*\/$/); out += m ? CMGEditorPython.aHueco(m[1]) : v.startsWith("//") ? "#" + v.slice(2) : v; continue; }
    if (k === "id") {
      if (["const", "let", "var"].includes(v) && toks[i + 1] && toks[i + 1][0] === "esp") { i++; continue; }
      out += nombresPython.get(v) || NOMBRES_LIT[v] || v; continue;
    }
    if (k === "p") {
      const tres = toks.slice(i, i + 3).map(x => x[1]).join(""), dos = tres.slice(0, 2);
      if (tres === "===" || tres === "!==") { out += tres === "===" ? "==" : "!="; i += 2; continue; }
      if (dos === "&&" || dos === "||") { out += dos === "&&" ? "and" : "or"; i += 1; continue; }
      if (dos === "??") { out += "or"; i += 1; continue; }
      if (v === "!" && toks[i + 1]?.[1] !== "=") { out += "not "; continue; }
      if (v === ";") continue;
    }
    out += v;
  }
  return out;
}
// E5: lo que el traductor necesita del juego. Tabla de alias del proveedor (D1), objetos y propiedades.
let opcionesPy = null, clavePy = "";
function opcionesPython() {
  const objetos = ["yo", ...nombresVar()], clave = objetos.join("|");
  if (!opcionesPy || clavePy !== clave) { clavePy = clave; opcionesPy = lenguaje.opcionesPython(nombresVar(), proveedorEditor.alias("python"), PROPS); }
  return opcionesPy;
}
// Los mensajes del runtime nombran la API en JS; para una unidad en Python, con sus nombres y literales.
function mensajePython(m) {
  nombresPython ||= new Map(proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
  return lenguaje.mensajePython(m, nombresPython);
}
const jsDePython = n => { const f = proveedorEditor.funciones().find(x => x.nombres && x.nombres.python === n); return f ? f.nombre : n; };
// Las sugerencias del juego, con el nombre JS de la función y el resultado en Python.
function sugerenciasPython(c) {
  const r = sugerencias({ ...c, funcion: c.funcion ? jsDePython(c.funcion) : c.funcion });
  if (!r) return r;
  return { ...r, grupos: r.grupos.map(g => ({ ...g, items: g.items.map(x => ({ ...x, ins: aPython(x.ins), ver: x.ver && aPython(x.ver) })) })) };
}
function vocabularioPython() {
  const v = proveedorEditor.vocabulario("python"), py = proveedorEditor.funciones().map(f => (f.nombres && f.nombres.python) || f.nombre);
  return { objetos: ["yo", ...nombresVar()], funciones: v.funciones, miembros: [...new Set([...py, ...FN_MIEMBRO])], propiedades: [...PROPS] };
}
let atajosPy = null, atajosPySensor = undefined;
function atajosPython() {
  const sensor = mundo && mundo.sensores[0] ? varDe(mundo.sensores[0].id) : null;
  if (atajosPy && atajosPySensor === sensor) return atajosPy;
  atajosPySensor = sensor;
  atajosPy = paletaSegura(() => window.CMGPaleta.crearPython({ serie: SERIE, sensor: () => sensor, aPython })).atajos;
  return atajosPy;
}
const OPERADORES_COND = [["&&", "y · se cumplen las dos", "condición"], ["||", "o · basta una", "condición"], ["!", "no · lo contrario", "condición"],
  ["===", "igual", "valor"], ["!==", "distinto", "valor"], [">", "mayor", "valor"], ["<", "menor", "valor"], [">=", "mayor o igual", "valor"], ["<=", "menor o igual", "valor"]];
function sugerencias(c) {
  const clase = c.hueco ? (c.hueco === "tipo" ? "tipo de enemigo" : c.hueco)
    : c.tipo === "argumento" ? (FIRMAS[c.funcion] || [])[c.indice]
    : c.tipo === "condicion" ? "condición" : c.tipo === "valor" ? "valor" : null;
  if (ES_CAMPAIGN) return def && mundo ? uiC.sugerencias(c, clase) : null;
  if (!clase || !def) return null;
  if (ES_FACTORY && ["lugar", "material", "valor", "condición"].includes(clase)) {
    const items = clase === "lugar" ? mundo.entidades.map(e => ({ ins: varFactory(e.id), cls: "var", nota: e.nombre }))
      : clase === "material" ? factory.MATERIALES.map(m => ({ ins: JSON.stringify(m), cls: "str" }))
      : mundo.entidades.flatMap(e => factory.MATERIALES.map(mat => ({ ins: `count(${varFactory(e.id)}, ${JSON.stringify(mat)})${clase === "condición" ? " > 0" : ""}`, cls: "fn" })));
    return { titulo: clase, grupos: [{ items }, { titulo: "Del programa", items: (c.variables || []).map(v => ({ ins: v, cls: "var" })) }] };
  }
  const it = (ins, cls, nota, ver) => ({ ins, cls, nota, ver });
  const enReto = new Set(def.oleadas.map(o => o.tipo));
  const vars = (c.variables || []).map(v => it(v, "var", "variable del programa"));
  const red = mundo ? mundo.sensores : [];
  const donde = c.funcion ? `${c.objeto ? c.objeto + "." : ""}${c.funcion}(…) · ${c.indice + 1}.º valor` : "";
  switch (clase) {
    case "tipo de enemigo": {
      const oye = c.funcion === "detect";
      const tipos = Object.keys(TIPOS).sort((x, y) => enReto.has(y) - enReto.has(x));
      return { titulo: "Tipo de enemigo", donde, grupos: [{ items: tipos.map(t => it(`"${t}"`, "str", `${TIPOS[t].nombre}${enReto.has(t) ? " · en este reto" : ""}${oye && !TIPOS[t].suelo ? " · no se oye" : ""}`)) }] };
    }
    case "sensor":
      return { titulo: "Sensor", donde, grupos: [{ items: Object.keys(SENSOR).map(s => it(`"${s}"`, "str", `${SENSOR[s].nombre} · alcance ${def.niebla ? SENSOR[s].niebla : SENSOR[s].alcance}`)) }] };
    case "lugar": {
      const manual = $("coordenadas").value.trim();
      return { titulo: "Lugar", donde, grupos: [
        { titulo: "Del programa", items: vars },
        { titulo: "Apuntar ahora", items: [...enReto].map(t => it(`autoTarget("${t}", "visual")`, "fn", TIPOS[t].nombre)) },
        { titulo: "Red de sensores", items: red.map(s => it(`${varDe(s.id)}.detect("crawler")`, "fn", "posición actual")) },
        { titulo: "Otros", items: [it("target", "prop", "a donde apunta ahora"), it("null", "kw", "deja de disparar"), ...(manual ? [it(manual, "num", "lugar manual")] : [])] },
      ] };
    }
    case "condición":
      return { titulo: "Condición", donde, grupos: [
        { titulo: "Comprobar", items: [
          ...(c.variables || []).flatMap(v => [it(v, "var", "existe (no es null)"), it(`${v} === null`, "var", "no hay")]),
          it("!jammed", "prop", "no está atascado"), it("jammed", "prop", "está atascado"), it("missiles > 0", "prop", "quedan misiles"),
          it("failureRate < 0.25", "prop", "fallo bajo"), it("failureRate >= 0.35", "prop", "fallo alto"), it('mode === "burst"', "prop", "en ráfaga"),
          ...red.map(s => it(`${varDe(s.id)}.count > 0`, "fn", "oye enemigos")),
          it("true", "kw", "siempre"),
        ] },
        { titulo: "Combinar o comparar", items: OPERADORES_COND.map(([op, nota, h]) => it(op === "!" ? `!/* ${h} */` : `/* ${h} */ ${op} /* ${h} */`, "op", nota, op)) },
      ] };
    case "valor":
      return { titulo: "Valor", donde, grupos: [
        { titulo: "Propiedades", items: [it("failureRate", "prop", "0 a 1"), it("missiles", "prop", `0 a ${def.cargador}`), it("fireRate", "prop", "disparos/s"), it("mode", "prop", '"idle", "regular" o "burst"'), ...red.map(s => it(`${varDe(s.id)}.count`, "fn", "enemigos oídos"))] },
        { titulo: "Del programa", items: vars },
        { titulo: "Números y textos", items: [it("0", "num"), it("0.25", "num"), it("0.35", "num"), it("1", "num"), it('"idle"', "str"), it('"regular"', "str"), it('"burst"', "str"), it("null", "kw")] },
      ] };
    case "segundos":
      return { titulo: "Segundos de espera", donde, grupos: [{ items: [["0.1", "muy rápido"], ["0.25", ""], ["0.4", ""], ["0.5", "lo habitual"], ["1", ""], ["2", "lento"]].map(([n, nota]) => it(n, "num", nota)) }] };
    case "mensaje":
      return { titulo: "Mensaje", donde, grupos: [
        { titulo: "Datos de la máquina", items: [it("failureRate", "prop"), it("missiles", "prop"), it("mode", "prop"), it("target", "prop")] },
        { titulo: "Del programa", items: vars },
        { titulo: "Textos", items: [it('"Atascado"', "str"), it('"Sin misiles"', "str"), it('"Fallo alto"', "str")] },
      ] };
  }
  return null;
}
// Colores y letra: botones de la cabecera en PC y, en todas las formas, Ajustes → Editor
// (en el teléfono solo allí, para dejar la barra del código mínima).
function ponerColores(si) {
  colores = !!si; guardado.escribir("colores", colores);
  $("b-colores").setAttribute("aria-pressed", colores);
  $("ajustes-colores").checked = colores;
  $editor.classList.toggle("colores", colores); pintarResaltado();
}
$("b-colores").setAttribute("aria-pressed", colores);
$("ajustes-colores").checked = colores;
$editor.classList.toggle("colores", colores);
$("b-colores").addEventListener("click", () => ponerColores(!colores));
$("ajustes-colores").addEventListener("change", (ev) => ponerColores(ev.target.checked));
const TAMANOS = [12, 13, 14, 16, 18];
function aplicarLetra() {
  document.querySelector(".app").style.setProperty("--code-size", `${tamLetra}px`); guardado.escribir("letra", tamLetra); medirEditor();
  for (const b of document.querySelectorAll("#ajustes-letra [data-letra]")) b.setAttribute("aria-pressed", String(+b.dataset.letra === tamLetra));
}
$("b-menos").addEventListener("click", () => { const i = TAMANOS.indexOf(tamLetra); tamLetra = TAMANOS[Math.max(0, (i < 0 ? 2 : i) - 1)]; aplicarLetra(); });
$("b-mas").addEventListener("click", () => { const i = TAMANOS.indexOf(tamLetra); tamLetra = TAMANOS[Math.min(TAMANOS.length - 1, (i < 0 ? 2 : i) + 1)]; aplicarLetra(); });
$("ajustes-letra").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-letra]");
  if (b && TAMANOS.includes(+b.dataset.letra)) { tamLetra = +b.dataset.letra; aplicarLetra(); }
});

// Cómo se muestra cada console
const DESTINOS = [["globo", "partida.ruteo.globo"], ["pantalla", "partida.ruteo.pantalla"], ["consola", "partida.ruteo.solo_consola"]];
function actualizarEtiquetasRuteo() {
  for (const boton of $("ruteo").querySelectorAll("[data-dest]")) {
    const destino = DESTINOS.find(([valor]) => valor === boton.dataset.dest);
    if (destino) boton.textContent = ti18n(destino[1]);
  }
}
function pintarRuteo() {
  const raiz = $("ruteo"); raiz.replaceChildren();
  for (const nivel of NIVELES) {
    const codigo = document.createElement("code"); codigo.className = "tk-fn"; codigo.textContent = `console.${nivel}`;
    const grupo = document.createElement("span"); grupo.className = "seg"; grupo.setAttribute("role", "group"); grupo.setAttribute("aria-label", `console.${nivel}`);
    for (const [valor] of DESTINOS) {
      const boton = document.createElement("button"); boton.type = "button"; boton.dataset.nivel = nivel; boton.dataset.dest = valor;
      boton.setAttribute("aria-pressed", String(ruteo[nivel] === valor)); grupo.appendChild(boton);
    }
    raiz.append(codigo, grupo);
  }
  actualizarEtiquetasRuteo();
}
$("ruteo").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-dest]"); if (!b) return;
  ruteo[b.dataset.nivel] = b.dataset.dest; guardado.escribir("ruteo", ruteo); pintarRuteo();
});

let confirmarBorrado = false;
const {
  pintarEventosYa, actualizarEtiquetaEventosVacios, actualizarEtiquetasResumen, pintarResumen
} = instalarRegistro(ctx);

const {
  pintarAyuda
} = instalarAyuda(ctx);

// ---------- Escenario propio ----------
const hojaEscenario = clave => `<span data-i18n="${clave}">${esc(ti18n(clave))}</span>`;
let escenarioJsonCopiado = false, temporizadorCopiaEscenario;
function actualizarCopiaEscenario() {
  const boton = $("esc-json-copiar");
  if (boton) boton.textContent = ti18n(escenarioJsonCopiado ? "escenario.json.copiado" : "escenario.json.copiar");
}
const filaOla = (o, i, dis) => `<div class="ola" data-i="${i}">
      <label class="campo-f">${hojaEscenario("escenario.oleada.tipo")}<select data-k="tipo" ${dis}>${Object.keys(TIPOS).map(t => `<option value="${t}"${o.tipo === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.cantidad")}<input data-k="n" type="number" min="0" max="40" value="${o.n}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.desde")}<input data-k="t" type="number" min="0" step="0.5" value="${o.t}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.cada")}<input data-k="cada" type="number" min="0.1" step="0.05" value="${o.cada}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.carriles")}<input data-k="carriles" value="${o.carriles.join(", ")}" ${dis}></label>
      <label class="campo-f">${hojaEscenario("escenario.oleada.vida")}<input data-k="hp" type="number" min="1" max="9" placeholder="${TIPOS[o.tipo].hp}" value="${o.hp ?? ""}" ${dis}></label>
      <button type="button" class="btn chico quitar" data-quitar="${i}" ${dis}>${hojaEscenario("escenario.oleada.quitar")}</button>
    </div>`;
// `d` es el escenario que se muestra: el del reto o un borrador que todavía no se guardó.
function pintarEscenario(d = def) {
  if (ES_CAMPAIGN) { $("esc-aviso").hidden = true; $("esc-form").innerHTML = uiC.historial(historialC); return; }
  if (ES_FACTORY) return formularioFactory.pintar(d);
  const propioSel = retoIdx === IDX_PROPIO, dis = propioSel ? "" : "disabled";
  const me = d.metas, num = (v) => v == null ? "" : v;
  $("esc-aviso").hidden = propioSel;
  $("esc-aviso").innerHTML = propioSel ? "" : `${hojaEscenario("escenario.aviso.reto_fijo")} <button type="button" class="btn chico" id="esc-copiar-reto">${hojaEscenario("escenario.reto.copiar_base")}</button>`;
  $("esc-form").innerHTML = `
      <fieldset ${dis}><legend>${hojaEscenario("escenario.enunciado")}</legend>
        <label class="campo-f">${hojaEscenario("escenario.titulo")}<input id="esc-titulo" maxlength="60" value="${esc(d.titulo)}"></label>
        <label class="campo-f">${hojaEscenario("escenario.objetivo")}<textarea id="esc-objetivo">${esc(d.objetivo)}</textarea></label>
        <label class="campo-f">${hojaEscenario("escenario.pista")}<input id="esc-pista" value="${esc(d.pista)}"></label>
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
          <label class="campo-f">${hojaEscenario("escenario.lanzadores")}<select id="esc-lanzadores"><option value="1"${d.lanzadores.length === 1 ? " selected" : ""}>1 · LAU-01</option><option value="2" data-i18n="escenario.lanzadores.dos"${d.lanzadores.length === 2 ? " selected" : ""}>${esc(ti18n("escenario.lanzadores.dos"))}</option></select></label>
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
        <textarea class="json" id="esc-json" data-i18n-aria-label="escenario.json.aria" aria-label="${esc(ti18n("escenario.json.aria"))}" placeholder='{"titulo": "…", "oleadas": […]}'></textarea>
        <div><button type="button" class="btn chico" id="esc-json-aplicar">${hojaEscenario("escenario.json.aplicar")}</button> <span class="fila-bajo" id="esc-json-msg"></span></div>
      </div></details>` : ""}`;
  actualizarCopiaEscenario();
}
function leerEscenario() {
  const v = (id) => $(id).value.trim();
  const n = (id) => v(id) === "" ? null : Number(v(id));
  const oleadas = [...document.querySelectorAll("#esc-oleadas .ola")].map(f => {
    const g = (k) => f.querySelector(`[data-k="${k}"]`).value;
    return { tipo: g("tipo"), n: Number(g("n")), t: Number(g("t")), cada: Number(g("cada")), carriles: g("carriles").split(/[,\s]+/).filter(Boolean).map(Number), ...(g("hp") ? { hp: Number(g("hp")) } : {}) };
  });
  return normalizar({
    titulo: v("esc-titulo") || "Tu escenario", objetivo: v("esc-objetivo"), pista: v("esc-pista"), leccion: "Escenario propio · se edita en la pestaña Escenario.",
    metas: { brechasMax: n("esc-brechas") ?? 0, atascosMax: n("esc-atascos"), derribosMin: n("esc-derribos"), tiempoMax: n("esc-tiempo") },
    lanzadores: POS_LANZADORES[v("esc-lanzadores")] || POS_LANZADORES[1],
    reparadores: n("esc-rep"), cargador: n("esc-cargador"), suministro: n("esc-suministro"), niebla: $("esc-niebla").checked,
    sensores: $("esc-vib").checked ? [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }] : [],
    oleadas, inicial: propio.inicial,
  });
}
function guardarPropio(nuevo, jugar) {
  propio = nuevo; guardado.escribir(`${PREFIJO}propio`, propio);
  if (jugar || retoIdx === IDX_PROPIO) { elegirReto(IDX_PROPIO); abrirPestana("escenario"); }
  pintarRetos();
}
$("v-escenario").addEventListener("click", (ev) => {
  if (ES_CAMPAIGN) return clicHistorial(ev);
  if (ES_FACTORY) return;
  const boton = ev.target.closest?.("button") || ev.target, id = boton.id;
  if (boton.dataset.quitar != null) { const d = leerEscenario(); d.oleadas.splice(+boton.dataset.quitar, 1); pintarEscenario(d); return; }
  if (id === "esc-mas") { const d = leerEscenario(); d.oleadas.push({ tipo: "drone", n: 4, t: 0, cada: 1, carriles: [9] }); pintarEscenario(d); return; }
  if (id === "esc-guardar") { guardarPropio(leerEscenario(), true); abrirPestana("programa"); return; }
  if (id === "esc-copiar-reto") {
    guardado.escribir("prog-propio", programas);
    guardarPropio(normalizar({ ...def, titulo: `${def.titulo} (mío)`, leccion: "Escenario propio · se edita en la pestaña Escenario." }), true);
    return;
  }
  if (id === "esc-json-copiar") {
    const txt = JSON.stringify(leerEscenario(), null, 2);
    try { navigator.clipboard.writeText(txt).then(() => {
      escenarioJsonCopiado = true; actualizarCopiaEscenario();
      clearTimeout(temporizadorCopiaEscenario);
      temporizadorCopiaEscenario = setTimeout(() => { escenarioJsonCopiado = false; actualizarCopiaEscenario(); }, 1500);
    }, () => { $("esc-json").value = txt; $("esc-json").closest("details").open = true; $("esc-json").select(); }); }
    catch { $("esc-json").value = txt; }
    return;
  }
  if (id === "esc-json-aplicar") {
    try { guardarPropio(normalizar(JSON.parse($("esc-json").value)), true); }
    catch (e) { $("esc-json-msg").innerHTML = `${hojaEscenario("escenario.json.error")}: <span>${esc(e.message)}</span>`; }
  }
});

// ---------- Campaign: planta en vivo, hitos, checkpoints e historial ----------
// El mundo no se reinicia al ejecutar. Cada hito cumplido guarda un checkpoint (mundo y programas);
// además se guarda el estado en vivo para seguir tras recargar la página.
const CLAVE_VIVO = "campaign-1-vivo", CLAVE_HIST = "campaign-1-historial", MAX_CHECKPOINTS = 30;
let historialC = ES_CAMPAIGN ? guardado.leer(CLAVE_HIST, []).filter(c => c && c.mundo && c.mundo.rev === RETOS[0].revision) : [];
let pielBatalla = ES_CAMPAIGN && !!guardado.leer("campaign-piel", false), ponerPiel = () => {};
let tVivo = 0;
const uiC = ES_CAMPAIGN ? window.CAMPAIGN_UI.crear({
  esc, coma, varDe, t: ti18n,
  tk: (...a) => tk(...a), fila: (...a) => fila(...a), nota: (...a) => nota(...a), grupo: (...a) => grupo(...a), tkValor: (...a) => tkValor(...a),
  vital: (...a) => vital(...a), celdas: (...a) => celdas(...a), variables: () => variablesPrograma(),
  get mundo() { return mundo; }, get def() { return def; }, get progSel() { return progSel; },
}) : null;
const hitoActual = () => def.hitos[mundo.hito];
const guardarVivo = () => guardado.escribir(CLAVE_VIVO, { cuando: Date.now(), mundo: campaign.serializar(mundo) });
addEventListener("pagehide", () => { if (ES_CAMPAIGN && mundo) { guardarVivo(); clearTimeout(tGuardar); guardado.escribir(`prog-${claveReto()}`, { ...programas }); if (PYTHON) guardado.escribir(`fuentes-${claveReto()}`, copiaFuentes()); } });
function guardarCheckpoint() {
  historialC.push({ id: Date.now() + historialC.length, hito: mundo.hito, t: r2(mundo.t), cuando: Date.now(), mundo: campaign.serializar(mundo), programas: { ...programas }, fuentes: PYTHON ? copiaFuentes() : {} });
  // Se conservan el inicio del nivel y los más recientes.
  if (historialC.length > MAX_CHECKPOINTS) historialC.splice(1, historialC.length - MAX_CHECKPOINTS);
  guardado.escribir(CLAVE_HIST, historialC);
}
// Lo que cambia en pantalla al pasar de hito o al volver a un checkpoint.
function refrescarHito() {
  $("reto-n").textContent = mundo.hito;
  actualizarContenidoReto();
  $("objetivo-corto").textContent = textoReto("objetivo");
  pintarRetos(); pintarProgs(); pintarMaquinas(); pintarInspector(); pintarPieIns(); pintarEscenario(); pintarControles();
  metasClave = "";
  if (!$("info-reto").hidden) pintarInfoReto();
}
function volverA(cp, conProgramas) {
  if (!cp) return;
  cerrarProgramas();
  estadoCampaign = cp.mundo; hitoPendiente = null;
  if (conProgramas) {
    programas = { ...programas, ...cp.programas };
    if (PYTHON) { fuentes = JSON.parse(JSON.stringify(cp.fuentes || {})); textosPython = vistaPython(); }
    guardarProgramas(); borradoresMulti.clear();
  }
  lineaCorre = {}; lineaErr = null; marcasSucias = true;
  nuevoMundo();
  if (conProgramas) configurarEdicion([progSel], true);
  refrescarHito(); guardarVivo();
  ocultarBanner(); cerrarAvisos();
  consola("sistema", null, null, esc(ti18n(conProgramas ? "campaign.historial.vuelto_programas" : "campaign.historial.vuelto", { hito: hitoActual().clave, t: coma(mundo.t) })));
}
function volverAHito(n) {
  const cp = [...historialC].reverse().find(c => c.hito === n);
  if (!cp) return;
  abrirHoja(false);
  mostrarBanner("fallo", `${def.hitos[n].clave} · ${uiC.tituloHito(n)}`, esc(ti18n("campaign.historial.intro")), ti18n("campaign.historial.detalle", { t: coma(cp.t), presupuesto: cp.mundo.presupuesto, cuando: new Date(cp.cuando).toLocaleString() }),
    [[ti18n("campaign.historial.volver"), "primario", () => volverA(cp, false)], [ti18n("campaign.historial.volver_programas"), "", () => volverA(cp, true)], ["×", "", ocultarBanner]]);
}
function nivelDeNuevo() {
  cerrarProgramas();
  estadoCampaign = null; hitoPendiente = null; historialC = [];
  nuevoMundo(); guardarCheckpoint(); refrescarHito(); guardarVivo(); ocultarBanner(); cerrarAvisos(); limpiarConsola();
}
let cpConfirmar = null;
function clicHistorial(ev) {
  const b = ev.target.closest("button"); if (!b) return;
  const clave = b.dataset.cpNuevo ? "nuevo" : b.dataset.cpVolver ? `${b.dataset.cpVolver}:${b.dataset.cpProgramas || ""}` : null;
  if (!clave) return;
  // Segundo toque para confirmar: volver pierde el avance posterior.
  if (cpConfirmar !== clave) {
    cpConfirmar = clave; const antes = b.textContent; b.textContent = ti18n("campaign.historial.confirmar");
    setTimeout(() => { if (cpConfirmar === clave) cpConfirmar = null; if (b.isConnected) b.textContent = antes; }, 3000);
    return;
  }
  cpConfirmar = null;
  if (clave === "nuevo") nivelDeNuevo();
  else volverA(historialC.find(c => String(c.id) === b.dataset.cpVolver), !!b.dataset.cpProgramas);
}

function entregaCampaign(bahia, pedido) {
  consola("sistema", bahia.id, null, esc(ti18n("campaign.aviso.entrega", { n: pedido.n, pieza: pedido.pieza })));
  globo(bahia.id, "info", `${pedido.n} × ${pedido.pieza}`);
}
function terminarCampaign(resultado, motivo, texto, linea, idProg) {
  if (!mundo || !ejec) return;
  const codigos = ejec.codigos, inicio = ejec.inicio, lenguajes = { ...ejec.lenguajes };
  finActual = resultado;
  cerrarProgramas();
  window.__banco.alTerminar?.(resultado, motivo, texto, linea, idProg);
  if (resultado !== "error") { lineaCorre = {}; marcasSucias = true; }
  telemetria.push({ sandbox: "campaign", reto: 1, clave: claveReto(), titulo: def.titulo, hito: hitoActual().clave, intento, inicio, resultado, motivo, mensaje: texto ?? null, linea: linea ?? null, programa: idProg ?? null,
    tiempoJuego: r2(mundo.t), presupuesto: mundo.presupuesto, producidos: { ...mundo.producidos }, uso: registroActual().uso, consolas: registroActual().consolas, codigos, lenguajes });
  if (telemetria.length > 200) telemetria.splice(0, telemetria.length - 200);
  guardado.escribir(`${PREFIJO}telemetria`, telemetria);
  guardarVivo();
  if (resultado === "error") {
    pistaTrasFallo();
    ultimoAviso[claveReto()] = { resultado, motivo, texto, linea, id: idProg, intento, t: r2(mundo.t), cuando: Date.now() };
    mostrarBanner("fallo", linea ? ti18n("campaign.banner.error_linea", { linea, unidad: idProg }) : ti18n("campaign.banner.error", { unidad: idProg }), esc(texto), null,
      [[ti18n("campaign.banner.ir"), "primario", () => { ocultarBanner(); abrirPrograma(idProg); if (linea) irALinea(linea); }]]);
  } else if (motivo === "quieto") consola("sistema", null, null, esc(ti18n("campaign.aviso.quieto")));
  pintarControles(); pintarProgs(); pintarResumen(); pintarEdicion(); pintarInspector(); metasClave = "";
  if (!$("info-reto").hidden) pintarInfoReto();
}
// Programas de las unidades recién encendidas: arrancan al seguir tras un hito.
function arrancarNuevos() {
  if (!ejec) return;
  for (const l of mundo.programables) {
    if (ejec.progs.has(l.id)) continue;
    const lenguaje = lenguajeDe(l.id), texto = textoDe(l.id) || "";
    let codigo = texto, err = null;
    if (lenguaje === "python") { const r = CMGPythonJS.traducirCache(texto, opcionesPython()); if (r.ok) codigo = r.js; else err = r.diagnosticos[0]; }
    else err = revisar(texto);
    if (err) { consola("warn", l.id, err.linea, esc(ti18n("campaign.aviso.sin_programa", { unidad: l.id, motivo: err.mensaje }))); continue; }
    ejec.lenguajes[l.id] = lenguaje;
    arrancarPrograma(l.id, codigo, texto);
  }
  pintarProgs();
}
function seguirCampaign() { ocultarBanner(); hitoDetiene = false; pausa = false; arrancarNuevos(); conductor?.reanudar(); pintarControles(); }
function alCumplirHito(h) {
  window.__banco.alHito?.(h);
  const corriendo = !!ejec;
  pausa = corriendo;
  // Hay unidades nuevas o recién encendidas: se rehace el escenario 3D y se repinta la interfaz.
  if (V3) { V3.construir(); V3.anillosDe(seleccion); }
  for (const o of etiquetas.values()) { o.etq.remove(); o.g.remove(); }
  etiquetas.clear();
  guardarCheckpoint(); guardarVivo();
  refrescarHito();
  const stats = ti18n("campaign.banner.stats", { t: coma(mundo.t), presupuesto: mundo.presupuesto });
  const premio = `<p>${esc(ti18n("campaign.banner.premio", { n: def.premioHito }))}</p>`;
  const editar = [ti18n("campaign.banner.editar"), "", () => { ocultarBanner(); if (ejec) detener(); verPanel("codigo"); abrirPestana("programa"); }];
  if (h.completado) {
    mostrarBanner("victoria", ti18n("campaign.banner.fin"), premio + `<p>${esc(ti18n("campaign.banner.fin_texto", { misiles: mundo.arsenal.porBanda + mundo.arsenal.aMano, t: coma(mundo.t), presupuesto: mundo.presupuesto }))}</p>`, stats,
      [[ti18n("campaign.banner.ver_salva"), "primario", () => { ponerPiel(true); if (V3 && vista === "3d") V3.verCampo(); seguirCampaign(); }], [ti18n("campaign.banner.quedarse"), "", seguirCampaign]]);
  } else {
    const sig = h.siguiente, nuevas = mundo.maquinas.filter(u => (u.desde ?? 0) === sig).map(u => u.id);
    mostrarBanner("victoria", ti18n("campaign.banner.hito", { hito: def.hitos[h.hecho].clave, titulo: uiC.tituloHito(h.hecho) }),
      premio + `<p><b>${esc(ti18n("campaign.banner.siguiente", { hito: def.hitos[sig].clave, titulo: uiC.tituloHito(sig) }))}</b> · ${esc(ti18n(`campaign.hito.${sig}.objetivo`))}</p>`
      + (nuevas.length ? `<p>${esc(ti18n("campaign.aviso.nuevas", { unidades: nuevas.join(", ") }))}</p>` : ""), stats,
      corriendo ? [[ti18n("campaign.banner.seguir"), "primario", seguirCampaign], editar] : [editar]);
  }
  if (!hechos.includes(`campaign-h${h.hecho}`)) { hechos.push(`campaign-h${h.hecho}`); guardado.escribir("hechos", hechos); }
  telemetria.push({ sandbox: "campaign", reto: 1, clave: claveReto(), titulo: def.titulo, hito: def.hitos[h.hecho].clave, intento, inicio: new Date().toISOString(), resultado: "victoria", motivo: "hito", tiempoJuego: r2(mundo.t), presupuesto: mundo.presupuesto });
  guardado.escribir(`${PREFIJO}telemetria`, telemetria);
  pintarResumen();
}
// Cada fotograma: hitos recién cumplidos, guardado en vivo y parada cuando ya no queda nada en marcha.
function cicloCampaign(now) {
  if (hitoPendiente && !enVuelo) { const h = hitoPendiente; hitoPendiente = null; alCumplirHito(h); }
  if (!ejec || pausa || enVuelo) return;
  if (now - tVivo > 5000) { tVivo = now; guardarVivo(); }
  if ([...ejec.progs.values()].every(p => anfitrion.estado(p.id) === "fin") && campaign.quieto(mundo)) terminar("detenido", "quieto", null);
}

const {
  bucle
} = instalarBucleJuego(ctx);

const proveedorEditor = window.CMGProveedor.crear({
  serie: SERIE,
  sensores: () => mundo ? mundo.sensores.map(s => varDe(s.id)) : [],
  objetos: () => ["yo", ...(mundo ? (ES_CAMPAIGN ? mundo.unidades : ES_FACTORY ? mundo.entidades : mundo.maquinas).map(e => varDe(e.id)) : [])],
  propiedades: () => [...PROPS],
});

// ---------- Arranque ----------
leerColores();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { leerColores(); });
new MutationObserver(() => leerColores()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
window.__banco = {
  get partida() { return partida; }, get registro() { return registroActual(); }, get eventos() { return eventos; }, get fin() { return finActual; },
  get mundo() { return mundo; }, get def() { return def; }, get programas() { return programas; }, get fuentes() { return fuentes; }, RETOS, instrumentar, lexico, normalizar,
  turbo(n) { turbo = n; }, fijarSemilla(n) { semillaFija = true; semilla = n; }, usarEscenario(d) { guardarPropio(ES_FACTORY ? factory.retos.normalizar(d) : normalizar(d), true); }, elegirReto, ejecutar, abrirPrograma, seleccionar, get seleccionadas() { return [...seleccionadas]; }, get telemetria() { return telemetria; },
  // Campaign: la planta, sus checkpoints y la piel del mapa.
  get campana() { return { instantanea: () => campaign.instantaneaHistorica(mundo), quieto: () => campaign.quieto(mundo) }; }, get checkpoints() { return historialC; }, volverA: (i, conProgramas) => volverA(historialC[i], !!conProgramas), seguir: () => seguirCampaign(), nivelDeNuevo: () => nivelDeNuevo(),
}; // para depurar y probar desde la consola
window.cmg = { editor: editorPrograma, get edicion() { return editorPrograma.fachada.edicion; }, get seudo() { return editorPrograma.fachada.seudo; }, serie: SERIE, insertar, envolver, alternarComentario, medirEditor, get codigo() { return $codigo; }, get ejecutando() { return !!ejec; }, get confirmarReplace() { return confirmarReplace; }, set confirmarReplace(v) { preferirConfirmacionReplace(v); },
  // Para edicion.js (modo sin teclado, barra de edición y sugerencias).
  lexico, clasificar, sugerencias, firma: (f) => FIRMAS[f] || null, reHueco: RE_HUECO, aviso: avisoEditor, alDesplazar: pintarBanda, alternarEjecucion: () => ejec ? detener() : ejecutar(),
  // Funciones disponibles para el menú de alternativas (clic derecho o mantener 2 s sin teclado).
  // Estado de la cámara 3D (clave de la postura, giro, inclinación, distancia y centro); lo usan las pruebas.
  camara: () => V3 && V3.camara(),
  // Retrato PNG (data URL) del modelo actual de un tipo de enemigo; sirve para regenerar img/enemigos/.
  retrato: (tipo) => V3 && TIPOS[tipo] ? V3.retrato(tipo) : null,
  proveedor: proveedorEditor,
  funciones: proveedorEditor.funciones,
  get claveDocumento() { return claveDocumento(); },
  // Para seudo.js: datos de la máquina, programa de partida y línea que se ejecuta.
  datos: () => ({
    lugares: ES_FACTORY ? mundo.entidades.map(e => ({ id: e.id, expresion: varFactory(e.id), tipo: e.tipo })) : [],
    materiales: factory.MATERIALES, ladrillos: def.ladrillos,
    tipos: Object.entries(TIPOS).map(([id, t]) => ({ id, nombre: t.nombre, enReto: def.oleadas.some(o => o.tipo === id) })),
    sensores: Object.entries(SENSOR).map(([id, x]) => ({ id, nombre: x.nombre, alcance: def.niebla ? x.niebla : x.alcance })),
    red: mundo ? mundo.sensores.map(x => varDe(x.id)) : [],
    otras: programablesDe(def).map(l => l.id).filter(id => !edicion.ids.includes(id)).map(varDe),
  }),
  inicial: () => edicion.mixto ? null : { texto: textoInicial(def, progSel), codigo: (def.inicial[progSel] || []).join("\n") + ((def.inicial[progSel] || []).length ? "\n" : "") },
  // Modo revisión (js/revision-juego.js): el código que hay ahora en el editor, sin ejecutarlo.
  revision: {
    get serie() { return SERIE; },
    get reto() { return retoIdx === IDX_PROPIO ? null : { numero: retoIdx + 1, titulo: def.titulo }; },
    get titulo() { return def.titulo; },
    get seleccionado() { return progSel; },
    programas: () => programablesDe(def).map(l => ({ id: l.id, lenguaje: lenguajeDe(l.id), texto: textoDe(l.id) || "" })),
  },
  get marcas() { return { corre: (!edicion.mixto && lineaCorre[progSel]) || null, err: !edicion.mixto && lineaErr && lineaErr.id === progSel ? lineaErr.linea : null }; } };
// Pulsos: solo del programa (o programas con el mismo texto) que está en el editor.
if (window.CMGPulsos) window.CMGPulsos.conectar({ visibles: () => edicion.mixto ? [] : edicion.ids });
function actualizarEtiquetasSerie() {
  const sufijo = SERIE;
  $("c2d").setAttribute("aria-label", ti18n(ES_CAMPAIGN ? "campaign.canvas.2d" : `partida.canvas.${sufijo}.2d`));
  $("c3d").setAttribute("aria-label", ti18n(ES_CAMPAIGN ? "campaign.canvas.3d" : `partida.canvas.${sufijo}.3d`));
  $("t-escenario").textContent = ti18n(ES_CAMPAIGN ? "campaign.tab.historial" : ES_FACTORY ? "partida.escenario.tu_reto" : "partida.escenario.escenario");
  actualizarEtiquetasProgs();
}
if (ES_FACTORY) {
  document.title = "Code Battle Lite · Factory";
  document.documentElement.dataset.serie = "factory";
  document.querySelector(".fila-sem").hidden = true;
  document.querySelector(".coordenadas-manuales").hidden = true;
  document.querySelectorAll('[data-modo-codigo="bloques"]').forEach(b => b.hidden = false);
  $("info-t-enemigos").hidden = true;
  // Por id y no por href: Netlify (Pretty URLs) reescribe «probar.html» como «probar» y el selector fallaba,
  // cortando el arranque de Factory (pantalla negra, sin inspector ni Ejecutar).
  const probar = $("b-probar"); if (probar) { const u = new URL(probar.href, location.href); u.searchParams.set("serie", "factory"); probar.href = u.pathname + u.search; }
}
if (ES_CAMPAIGN) {
  document.title = ti18n("campaign.doc.titulo");
  document.documentElement.dataset.serie = "campaign";
  document.querySelector(".fila-sem").hidden = true;
  document.querySelector(".coordenadas-manuales").hidden = true;
  $("info-t-enemigos").hidden = true;
  $("b-reiniciar").removeAttribute("data-i18n");
  for (const b of document.querySelectorAll('[data-modo-codigo="pseudo"], [data-modo-codigo="bloques"]')) b.hidden = true;
  const probar = $("b-probar"); if (probar) { const u = new URL(probar.href, location.href); u.searchParams.set("serie", "campaign"); probar.href = u.pathname + u.search; }
  const $piel = $("b-piel");
  if ($piel) {
    $piel.hidden = false;
    const poner = (si) => { pielBatalla = !!si; guardado.escribir("campaign-piel", pielBatalla); $piel.setAttribute("aria-pressed", String(pielBatalla)); if (V3) V3.batalla(pielBatalla); };
    $piel.addEventListener("click", () => poner(!pielBatalla));
    ponerPiel = poner; poner(pielBatalla);
  }
}
for (const enlace of document.querySelectorAll("[data-serie]")) {
  const url = new URL(location.href); url.searchParams.set("serie", enlace.dataset.serie);
  enlace.href = url.pathname + url.search + url.hash;
  enlace.setAttribute("aria-current", enlace.dataset.serie === (SERIE) ? "page" : "false");
}
const formularioFactory = ES_FACTORY ? window.FACTORY_FORM.crear({
  retoActual: () => def, propioSel: () => retoIdx === IDX_PROPIO,
  guardar: d => guardarPropio(d, true), abrirPestana,
  copiarPrograma: () => guardado.escribir("prog-factory-propio", { ...programas }),
}) : null;
pintarRuteo();
def = defActual();
pintarAyuda();
aplicarVista(vista);
aplicarLetra();
elegirReto(retoIdx);
if (paletaRota) avisoEditor("La paleta no se pudo cargar: recarga la página sin caché (Ctrl+F5 o Ctrl+Shift+R).");
function actualizarTextosDinamicos() {
  actualizarEtiquetasControles();
  actualizarEtiquetasEdicion();
  actualizarEtiquetasSelectorLenguaje();
  actualizarEtiquetasSerie();
  if (ES_CAMPAIGN && mundo) { document.title = ti18n("campaign.doc.titulo"); pintarRetos(); pintarInspector(); pintarPieIns(); pintarAyuda(); pintarEscenario(); }
  actualizarEtiquetasRuteo();
  actualizarEtiquetasResumen();
  actualizarEtiquetaEventosVacios();
  actualizarEtiquetasConfirmaciones();
  actualizarTextoReplace();
  actualizarReloj();
  actualizarCopiaEscenario();
  actualizarPistaBanner();
  actualizarContenidoReto();
  metasClave = ""; pintarHud(false);
  // Solo las etiquetas de las metas; no se repinta la ficha ni se mueven sus portales.
  if (infoPestana === "metas" && !$("info-reto").hidden) {
    const temporal = document.createElement("div"); temporal.innerHTML = INFO.metas();
    for (const [i, el] of [...$("info-cuerpo").querySelectorAll(".info-nota, .m-nombre")].entries()) {
      const nuevo = temporal.querySelectorAll(".info-nota, .m-nombre")[i];
      if (nuevo) el.innerHTML = nuevo.innerHTML;
    }
  }
  const consolaVacia = $("consola").querySelector('[data-partida-i18n="consola.vacia"]');
  if (consolaVacia) consolaVacia.textContent = ti18n("partida.consola.vacia");
}
window.addEventListener("cmg:idioma", actualizarTextosDinamicos);
actualizarTextosDinamicos();
document.fonts && document.fonts.ready.then(() => { medirEditor(); });
editorPrograma.iniciarVistas();
requestAnimationFrame(bucle);
window.__juegoListo = true;
