import { createRequire } from 'node:module';
import { CMGEditorJS, ESTRUCTURA, crearPython, crearJSaPython } from '../../paquetes/lenguaje/index.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as datosWar from '../../paquetes/reglas-war/index.js';
import * as factory from '../../paquetes/reglas-factory/index.js';
import * as campaign from '../../paquetes/reglas-campaign/index.js';
import { fuenteTrabajador } from '../../paquetes/anfitrion/index.js';

export const raiz = new URL('../../', import.meta.url);
const entrada = new URL('Prototypes/Rocket Launcher/index.html', raiz);
export const archivoJuego = new URL('js/juego.js', entrada);

/** Carga las dependencias reales sin DOM, en el orden declarado por index.html. */
export function cargar() {
  const contexto = vm.createContext({
    WAR: {
      crear: datosWar.crear, aplicarOrden: datosWar.aplicarOrden, TIPOS: datosWar.TIPOS,
      SENSOR: datosWar.SENSOR, LAU: datosWar.LAU, MISIL: datosWar.MISIL, REP: datosWar.REP,
      COSTE: datosWar.COSTE, cadencia: datosWar.cadencia
    }, WAR_RETOS: { ...datosWar.retos },
    FACTORY: {
      crear: factory.crear, validar: factory.validar, instantanea: factory.instantaneaHistorica,
      MATERIALES: factory.MATERIALES
    }, FACTORY_RETOS: { ...factory.retos },
    CAMPAIGN: {
      VERSION: campaign.VERSION, crear: campaign.crear, serializar: campaign.serializar,
      indexar: campaign.indexar, instantanea: campaign.instantaneaHistorica, validar: campaign.validar,
      modoEnSnap: campaign.modoEnSnap, metas: campaign.metas, cuantos: campaign.cuantos,
      enLotes: campaign.enLotes, estadoMaquina: campaign.estadoMaquina, totalEntrada: campaign.totalEntrada,
      esMaquina: campaign.esMaquina, esRobot: campaign.esRobot, PIEZAS: campaign.PIEZAS,
      RECETAS: campaign.RECETAS, MAQUINAS: campaign.MAQUINAS, ROBOT: campaign.ROBOT, BANDA: campaign.BANDA,
      COSTE: campaign.COSTE, PEDIDO: campaign.PEDIDO, ARSENAL: campaign.ARSENAL, TORRETA: campaign.TORRETA,
      LUCES: campaign.LUCES, TARIMA_CAP: campaign.TARIMA_CAP, HITO_MAESTRO: campaign.HITO_MAESTRO
    }, CAMPAIGN_NIVEL: { ...campaign.nivel },
  });
  contexto.window = contexto;
  const necesarios = new Set([
    '../../shared/vendor/lezer-python-1.1.19.js',
  ]);
  const html = readFileSync(entrada, 'utf8');
  const cargados = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g)) {
    if (!necesarios.has(m[1])) continue;
    const archivo = new URL(m[1], entrada);
    // Lezer se distribuye como script clásico; los proveedores del juego son módulos ES.
    // Ninguna fuente del paquete lenguaje se evalúa como texto.
    const fuente = readFileSync(archivo, 'utf8');
    if (m[1].includes('lezer-python')) contexto.LezerPython = new Function(fuente + ';return LezerPython;')();
    else new Function('window', fuente)(contexto);
    cargados.push(m[1]);
    necesarios.delete(m[1]);
  }
  if (necesarios.size) throw new Error(`Faltan scripts en index.html: ${[...necesarios].join(', ')}`);
  contexto.acorn = createRequire(import.meta.url)('../../shared/vendor/acorn-8.11.3.js');
  Object.assign(contexto, { CMGEditorJS, ESTRUCTURA,
    CMGPythonJS: crearPython({ lezer: contexto.LezerPython }),
    CMGJSaPython: crearJSaPython({ acorn: contexto.acorn }) });
  // El mismo texto que el juego (paquetes/anfitrion) entrega a sus Workers.
  const fuenteWorker = fuenteTrabajador({
    validarFactory: factory.validar, validarCampaign: campaign.validar, modoCampaign: campaign.modoEnSnap,
    preludioPython: contexto.CMGPythonJS.preludio,
  });
  return { contexto, fuenteWorker, cargados };
}
