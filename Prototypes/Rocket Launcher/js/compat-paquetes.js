import * as lenguaje from '../../../paquetes/lenguaje/index.js';
import { DT, crearPartida } from '../../../paquetes/nucleo/index.js';
import war, * as datosWar from '../../../paquetes/reglas-war/index.js';
import reglasFactory, * as factory from '../../../paquetes/reglas-factory/index.js';
import reglasCampaign, * as campaign from '../../../paquetes/reglas-campaign/index.js';
import { crearAnfitrion } from '../../../paquetes/anfitrion/index.js';
import { crearConductor } from '../../../paquetes/app/index.js';
import * as vista2d from '../../../paquetes/vista-2d/index.js';
import * as vista3d from '../../../paquetes/vista-3d/index.js';

// Único puente del juego para los consumidores clásicos del lenguaje.
window.LENGUAJE = lenguaje;
window.CMGEditorJS = lenguaje.CMGEditorJS;
window.ESTRUCTURA = lenguaje.ESTRUCTURA;
window.CMGPythonJS = lenguaje.crearPython({ lezer: window.LezerPython,
  hueco: nombre => window.CMGEditorPython.nombreDe(nombre) });
window.CMGJSaPython = lenguaje.crearJSaPython({ acorn: window.acorn });

// Se borra al terminar la fase 2.
window.WAR = {
  crear: datosWar.crear, aplicarOrden: datosWar.aplicarOrden, TIPOS: datosWar.TIPOS,
  SENSOR: datosWar.SENSOR, LAU: datosWar.LAU, MISIL: datosWar.MISIL, REP: datosWar.REP,
  COSTE: datosWar.COSTE, cadencia: datosWar.cadencia
};
window.WAR_RETOS = { ...datosWar.retos };
window.FACTORY = {
  crear: factory.crear, validar: factory.validar, instantanea: factory.instantaneaHistorica,
  MATERIALES: factory.MATERIALES
};
window.FACTORY_RETOS = { ...factory.retos };
window.CAMPAIGN = {
  VERSION: campaign.VERSION, crear: campaign.crear, serializar: campaign.serializar,
  indexar: campaign.indexar, instantanea: campaign.instantaneaHistorica, validar: campaign.validar,
  modoEnSnap: campaign.modoEnSnap, metas: campaign.metas, cuantos: campaign.cuantos,
  enLotes: campaign.enLotes, estadoMaquina: campaign.estadoMaquina, totalEntrada: campaign.totalEntrada,
  esMaquina: campaign.esMaquina, esRobot: campaign.esRobot, PIEZAS: campaign.PIEZAS,
  RECETAS: campaign.RECETAS, MAQUINAS: campaign.MAQUINAS, ROBOT: campaign.ROBOT, BANDA: campaign.BANDA,
  COSTE: campaign.COSTE, PEDIDO: campaign.PEDIDO, ARSENAL: campaign.ARSENAL, TORRETA: campaign.TORRETA,
  LUCES: campaign.LUCES, TARIMA_CAP: campaign.TARIMA_CAP, HITO_MAESTRO: campaign.HITO_MAESTRO
};
window.CAMPAIGN_NIVEL = { ...campaign.nivel };
// Lo que dibujan las vistas (fase 2): escena(mundo) de cada reglamento.
window.ESCENAS = { war: war.escena, factory: reglasFactory.escena, campaign: reglasCampaign.escena };
// Vistas 2D y 3D: la app inyecta el relieve de Campaign de una vista en la otra.
window.VISTA_2D = vista2d;
window.VISTA_3D = vista3d;
window.FACTORY_3D = vista3d.factory3d;
// Antes, js/runtime.js. El preludio autónomo sale del paquete lenguaje.
const piezasTrabajador = {
  validarFactory: factory.validar, validarCampaign: campaign.validar, modoCampaign: campaign.modoEnSnap,
  preludioPython: window.CMGPythonJS ? window.CMGPythonJS.preludio : null,
};
window.APP = { DT, crearPartida, crearAnfitrion, crearConductor,
  reglas: { war, factory: reglasFactory, campaign: reglasCampaign }, quietoCampaign: campaign.quieto, piezasTrabajador };
