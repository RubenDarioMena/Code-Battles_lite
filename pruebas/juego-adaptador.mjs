// Ejecuta el ciclo importado de app con ctx falso, sin DOM ni Chromium.
// Los Workers se emulan con el texto real: esto complementa, no sustituye, el contraste de navegador.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { crearPartida, DT } from '../paquetes/nucleo/index.js';
import { crearAnfitrion } from '../paquetes/anfitrion/index.js';
import { instalarCicloProgramas, crearConductor } from '../paquetes/app/index.js';
import war, { retos } from '../paquetes/reglas-war/index.js';
import factory, { retos as retosFactory, validar as validarFactory } from '../paquetes/reglas-factory/index.js';
import campaign, { nivel, quieto, validar as validarCampaign, modoEnSnap } from '../paquetes/reglas-campaign/index.js';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { extraerFuncion } from './extraer-juego.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import * as lenguaje from '../paquetes/lenguaje/index.js';
import { resultadoWar } from '../herramientas/partida/anfitrion-war.mjs';
import { resultadoFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { resultadoCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';

const texto = readFileSync(new URL('../paquetes/app/juego/campaign.js', import.meta.url), 'utf8');
const funciones = ['cicloCampaign', 'arrancarNuevos', 'seguirCampaign'];
const infoReto = readFileSync(new URL('../paquetes/interfaz/info-reto.js', import.meta.url), 'utf8');

export function adaptar(caso, presentacion = {}) {
  const { contexto: C } = cargar();
  const serie = caso.reglas, reglas = { war, factory, campaign }[serie];
  const def = serie === 'campaign' ? nivel.NIVEL : serie === 'war' ? retos.normalizar(retos.RETOS[caso.reto - 1])
    : caso.reto === 7 ? retosFactory.normalizar(caso.escenario) : retosFactory.RETOS[caso.reto - 1];
  const muestra = crearPartida({ reglas, escenario: { reto: def }, semilla: 1 });
  const huella = crearHuella(), pantallas = [], hitos = [], finales = [];
  Object.assign(C, { __instalarCicloProgramas: instalarCicloProgramas, __lenguaje: lenguaje, APP: { crearPartida, crearAnfitrion, crearConductor, quietoCampaign: quieto,
    piezasTrabajador: { validarFactory: validarFactory, validarCampaign: validarCampaign,
      modoCampaign: modoEnSnap, preludioPython: C.CMGPythonJS.preludio } },
    __presentacion: presentacion,
    __instrumento: crearInstrumentador(C, muestra.mundo, serie), __def: def, __caso: caso,
    performance: { now: () => 0 }, __huella: huella, __pantallas: pantallas, __hitos: hitos, __finales: finales,
    __resultadoWar: resultadoWar, __resultadoFactory: resultadoFactory, __resultadoCampaign: resultadoCampaign,
    URL: { createObjectURL: b => b.fuente }, Blob: class { constructor(partes) { this.fuente = partes.join(''); } },
    Worker: class {
      constructor(fuente) {
        const w = { onmessage: null, onerror: null };
        return Object.assign(w, crearPrograma(fuente, 'juego', m => w.onmessage?.({ data: m }), 4000));
      }
    },
  });
  const extraidas = funciones.map(n => extraerFuncion(texto, n, C.acorn).texto).join('\n');
  const crearMundo = extraerFuncion(infoReto, 'nuevoMundo', C.acorn).texto;
  return vm.runInContext(`(() => {
    const SERIE = __caso.reglas, ES_FACTORY = SERIE === 'factory', ES_CAMPAIGN = SERIE === 'campaign';
    const reglas = { war: __reglasWar, factory: __reglasFactory, campaign: __reglasCampaign }[SERIE];
    const { TIPOS, SENSOR, LAU } = WAR, DT = APP.DT || .05, VIGIA_MS = 2500;
    const NIVELES = ['log', 'info', 'warn', 'error'], PYTHON = true;
    const { instrumentar, opcionesPython, mensajePython } = __instrumento;
    const { crearPartida, crearAnfitrion, crearConductor, piezasTrabajador } = APP;
    const CMGPythonJS = window.CMGPythonJS, campaign = { ...CAMPAIGN, quieto: APP.quietoCampaign };
    const lenguaje = __lenguaje;
    let def = __def, programas = {}, fuentes = {}, mundo = null, partida = null, anfitrion = null, conductor = null;
    let ejec = null, enVuelo = null, finActual = null, pausa = false, hitoDetiene = false, estadoCampaign = null, hitoPendiente = null;
    let eventos = [], desdeRegistro = 0, unidadVigia = null, acum = 0, lineaCorre = {}, lineaErr = null;
    let eventosSucios = false, marcasSucias = false, progSel = def.robots?.[0]?.id || def.lanzadores?.[0]?.id;
    let intento = (__caso.intento ?? __caso.semilla ?? 1) - 1, semilla = __caso.semilla ?? 1, semillaFija = true;
    let consolasCampaign = { log: 0, info: 0, warn: 0, error: 0 }, resultado = null, tVivo = 0;
    let COLS, ROWS, seleccion = null, seleccionadas = new Set();
    const registrosPendientes = new Map(), urlsTrabajador = new Map(), etiquetas = new Map(), globos = new Map();
    const historia = new Map(), V3 = null, edicion = { mixto: false }, $codigo = { value: '' };
    const programablesDe = () => ES_CAMPAIGN ? mundo.programables : def.robots || def.lanzadores;
    const nombradas = () => ES_CAMPAIGN ? mundo.unidades : ES_FACTORY ? mundo.maquinas : [...mundo.programables, ...mundo.sensores];
    const lenguajeDe = id => fuentes[id]?.enUso ? 'python' : 'js';
    const textoDe = id => lenguajeDe(id) === 'python' ? fuentes[id].texto : programas[id];
    const unidadPorId = id => mundo.porId[id], esc = String, htmlInterfaz = String, escapeMsg = String;
    const ti18n = clave => clave, $ = () => ({ value: '', hidden: true });
    const consola = (...args) => __pantallas.push(args), mostrarConsola = consola, globo = consola, avisoSistema = consola, entregaCampaign = consola;
    const pintarControles = () => {}, pintarProgs = () => {}, pintarEdicion = () => {}, invalidarEscena = () => {};
    const pintarMaquinas = () => {}, pintarInspector = () => {}, pintarPieIns = () => {}, configurarEdicion = () => {};
    const limpiarConsola = () => {}, ocultarBanner = () => {}, cerrarAvisos = () => {}, guardarVivo = () => {};
    let metasClave = '';
    const alCumplirHito = h => { pausa = true; __hitos.push(h); };
    window.__banco = { alPaso(m) {
      const snap = ES_FACTORY ? { t: m.t, maq: {}, auto: {}, vib: {}, factory: FACTORY.instantanea(m) }
        : ES_CAMPAIGN ? { t: m.t, maq: {}, auto: {}, vib: {}, campaign: CAMPAIGN.instantanea(m) } : reglas.instantanea(m);
      __huella.paso(snap);
    } };
    function terminar(...args) {
      finActual = args[0]; cerrarProgramas(); __finales.push(args);
      const m = { ...mundo, ...registroActual() };
      resultado = ES_CAMPAIGN ? __resultadoCampaign(m, ...args) : ES_FACTORY ? __resultadoFactory(m, intento, ...args) : __resultadoWar(m, ...args);
    }
    const ctx = {
      sucesosVistas: __presentacion.sucesosVistas, vaciarEfectos: __presentacion.vaciarEfectos,
      get SERIE() { return SERIE; },
      get ES_FACTORY() { return ES_FACTORY; },
      get ES_CAMPAIGN() { return ES_CAMPAIGN; },
      get reglas() { return reglas; },
      get TIPOS() { return TIPOS; },
      get SENSOR() { return SENSOR; },
      get LAU() { return LAU; },
      get DT() { return DT; },
      get VIGIA_MS() { return VIGIA_MS; },
      get NIVELES() { return NIVELES; },
      get PYTHON() { return PYTHON; },
      get def() { return def; }, set def(v) { def = v; },
      get programas() { return programas; }, set programas(v) { programas = v; },
      get fuentes() { return fuentes; }, set fuentes(v) { fuentes = v; },
      get mundo() { return mundo; }, set mundo(v) { mundo = v; },
      get alCumplirHito() { return alCumplirHito; },
      get guardarVivo() { return guardarVivo; },
      get campaign() { return campaign; },
      get ocultarBanner() { return ocultarBanner; },
      get partida() { return partida; }, set partida(v) { partida = v; },
      get anfitrion() { return anfitrion; }, set anfitrion(v) { anfitrion = v; },
      get conductor() { return conductor; }, set conductor(v) { conductor = v; },
      get ejec() { return ejec; }, set ejec(v) { ejec = v; },
      get enVuelo() { return enVuelo; }, set enVuelo(v) { enVuelo = v; },
      get finActual() { return finActual; }, set finActual(v) { finActual = v; },
      get pausa() { return pausa; }, set pausa(v) { pausa = v; },
      get estadoCampaign() { return estadoCampaign; }, set estadoCampaign(v) { estadoCampaign = v; },
      get hitoPendiente() { return hitoPendiente; }, set hitoPendiente(v) { hitoPendiente = v; },
      get hitoDetiene() { return hitoDetiene; }, set hitoDetiene(v) { hitoDetiene = v; },
      get eventos() { return eventos; }, set eventos(v) { eventos = v; },
      get desdeRegistro() { return desdeRegistro; }, set desdeRegistro(v) { desdeRegistro = v; },
      get unidadVigia() { return unidadVigia; }, set unidadVigia(v) { unidadVigia = v; },
      get acum() { return acum; }, set acum(v) { acum = v; },
      get lineaCorre() { return lineaCorre; }, set lineaCorre(v) { lineaCorre = v; },
      get lineaErr() { return lineaErr; }, set lineaErr(v) { lineaErr = v; },
      get eventosSucios() { return eventosSucios; }, set eventosSucios(v) { eventosSucios = v; },
      get marcasSucias() { return marcasSucias; }, set marcasSucias(v) { marcasSucias = v; },
      get progSel() { return progSel; }, set progSel(v) { progSel = v; },
      get intento() { return intento; }, set intento(v) { intento = v; },
      get semilla() { return semilla; }, set semilla(v) { semilla = v; },
      get semillaFija() { return semillaFija; }, set semillaFija(v) { semillaFija = v; },
      get consolasCampaign() { return consolasCampaign; }, set consolasCampaign(v) { consolasCampaign = v; },
      get COLS() { return COLS; }, set COLS(v) { COLS = v; },
      get ROWS() { return ROWS; }, set ROWS(v) { ROWS = v; },
      get seleccion() { return seleccion; }, set seleccion(v) { seleccion = v; },
      get seleccionadas() { return seleccionadas; }, set seleccionadas(v) { seleccionadas = v; },
      get registrosPendientes() { return registrosPendientes; },
      get etiquetas() { return etiquetas; },
      get globos() { return globos; },
      get historia() { return historia; },
      get V3() { return V3; },
      get edicion() { return edicion; },
      get $codigo() { return $codigo; },
      get programablesDe() { return programablesDe; },
      get nombradas() { return nombradas; },
      get lenguajeDe() { return lenguajeDe; },
      get textoDe() { return textoDe; },
      get unidadPorId() { return unidadPorId; },
      get esc() { return esc; },
      get htmlInterfaz() { return htmlInterfaz; },
      get ti18n() { return ti18n; },
      get $() { return $; },
      get consola() { return consola; },
      get mostrarConsola() { return mostrarConsola; },
      get globo() { return globo; },
      get avisoSistema() { return avisoSistema; },
      get entregaCampaign() { return entregaCampaign; },
      get pintarControles() { return pintarControles; },
      get pintarProgs() { return pintarProgs; },
      get pintarEdicion() { return pintarEdicion; },
      get invalidarEscena() { return invalidarEscena; },
      get pintarMaquinas() { return pintarMaquinas; },
      get pintarInspector() { return pintarInspector; },
      get pintarPieIns() { return pintarPieIns; },
      get configurarEdicion() { return configurarEdicion; },
      get limpiarConsola() { return limpiarConsola; },
      get ocultarBanner() { return ocultarBanner; },
      get cerrarAvisos() { return cerrarAvisos; },
      get guardarVivo() { return guardarVivo; },
      get metasClave() { return metasClave; }, set metasClave(v) { metasClave = v; },
      get instrumentar() { return instrumentar; },
      get opcionesPython() { return opcionesPython; },
      get mensajePython() { return mensajePython; },
      get crearPartida() { return crearPartida; },
      get crearAnfitrion() { return crearAnfitrion; },
      get crearConductor() { return crearConductor; },
      get piezasTrabajador() { return piezasTrabajador; },
      get lenguaje() { return lenguaje; },
      get CMGPythonJS() { return CMGPythonJS; },
      get terminar() { return terminar; },
      get revisar() { return revisar; },
      get arrancarPrograma() { return arrancarPrograma; },
      get nuevoMundo() { return nuevoMundo; },
      get __banco() { return window.__banco; },
      performance, URL, Blob, Worker, acorn: window.acorn,
    };
    const { ejecutar, revisar, arrancarPrograma, registroActual, avanzar, cerrarProgramas } = __instalarCicloProgramas(ctx);
    ${crearMundo}
    ${extraidas}
    nuevoMundo();
    return {
      cargar(fuentesNuevas) {
        programas = {}; fuentes = {}; resultado = null;
        for (const l of mundo.programables) {
          const f = fuentesNuevas?.[l.id] ?? (fuentesNuevas ? '' : (def.inicial[l.id] || []).join('\\n'));
          programas[l.id] = typeof f === 'string' ? f : f.lenguaje === 'python' ? '' : f.codigo;
          if (f.lenguaje === 'python') fuentes[l.id] = { lenguaje: 'python', texto: f.codigo, enUso: true };
        }
        ejecutar();
      },
      async avanzar(n = 1) {
        acum += n * DT; avanzar();
        while (enVuelo) await enVuelo.then(() => {}).then(() => {}).then(() => {});
        if (ES_CAMPAIGN) cicloCampaign(0);
      },
      terminarHuella: () => __huella.terminar(),
      detener: () => terminar('detenido', 'detenido', null), seguir: seguirCampaign,
      get resultado() { return resultado; }, get partida() { return partida; }, get ejecutando() { return !!ejec; },
      get registro() { return registroActual(); }, get eventos() { return eventos; }, get hito() { return hitoPendiente; },
      get pausa() { return pausa; }, get cargados() { return [...ejec.progs.keys()]; }
    };
  })()`, Object.assign(C, { __reglasWar: war, __reglasFactory: factory, __reglasCampaign: campaign }));
}

