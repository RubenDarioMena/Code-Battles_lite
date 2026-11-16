// Ejecuta el adaptador real extraído de juego.js en VM, sin DOM ni Chromium.
// Los Workers se emulan con el texto real: esto complementa, no sustituye, el contraste de navegador.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { crearPartida, DT } from '../paquetes/nucleo/index.js';
import { crearAnfitrion } from '../paquetes/anfitrion/index.js';
import { crearConductor } from '../paquetes/app/index.js';
import war, { retos } from '../paquetes/reglas-war/index.js';
import factory, { retos as retosFactory, validar as validarFactory } from '../paquetes/reglas-factory/index.js';
import campaign, { nivel, quieto, validar as validarCampaign, modoEnSnap } from '../paquetes/reglas-campaign/index.js';
import { cargar, archivoJuego } from '../herramientas/partida/cargar.mjs';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { extraerFuncion } from './extraer-juego.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { resultadoWar } from '../herramientas/partida/anfitrion-war.mjs';
import { resultadoFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { resultadoCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';

const texto = readFileSync(archivoJuego, 'utf8');
const funciones = ['ejecutar', 'crearTrabajador', 'arrancarPrograma', 'registroActual', 'recogerRegistro',
  'alTurno', 'alSucesos', 'avanzar', 'cerrarProgramas', 'errorPrograma', 'vigia', 'nuevoMundo',
  'cicloCampaign', 'arrancarNuevos', 'seguirCampaign'];

export function adaptar(caso) {
  const { contexto: C } = cargar();
  const serie = caso.reglas, reglas = { war, factory, campaign }[serie];
  const def = serie === 'campaign' ? nivel.NIVEL : serie === 'war' ? retos.normalizar(retos.RETOS[caso.reto - 1])
    : caso.reto === 7 ? retosFactory.normalizar(caso.escenario) : retosFactory.RETOS[caso.reto - 1];
  const muestra = crearPartida({ reglas, escenario: { reto: def }, semilla: 1 });
  const huella = crearHuella(), pantallas = [], hitos = [], finales = [];
  Object.assign(C, { APP: { crearPartida, crearAnfitrion, crearConductor, quietoCampaign: quieto,
    piezasTrabajador: { validarFactory: validarFactory, validarCampaign: validarCampaign,
      modoCampaign: modoEnSnap, preludioPython: C.CMGPythonJS.preludio } },
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
  return vm.runInContext(`(() => {
    const SERIE = __caso.reglas, ES_FACTORY = SERIE === 'factory', ES_CAMPAIGN = SERIE === 'campaign';
    const reglas = { war: __reglasWar, factory: __reglasFactory, campaign: __reglasCampaign }[SERIE];
    const { TIPOS, SENSOR, LAU } = WAR, DT = APP.DT || .05, VIGIA_MS = 2500;
    const NIVELES = ['log', 'info', 'warn', 'error'], PYTHON = true;
    const { instrumentar, revisar, opcionesPython, mensajePython } = __instrumento;
    let def = __def, programas = {}, fuentes = {}, mundo = null, partida = null, anfitrion = null, conductor = null;
    let ejec = null, enVuelo = null, finActual = null, pausa = false, estadoCampaign = null, hitoPendiente = null;
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
    const algunoCorre = () => !!ejec && anfitrion.algunoCorre();
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

