import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { legado, retos } from '../../paquetes/reglas-war/index.js';
import { legado as factory, retos as factoryRetos } from '../../paquetes/reglas-factory/index.js';
import { legado as campaign, nivel } from '../../paquetes/reglas-campaign/index.js';
import { fuenteTrabajador } from '../../paquetes/anfitrion/index.js';

export const raiz = new URL('../../', import.meta.url);
const entrada = new URL('Prototypes/Rocket Launcher/index.html', raiz);
export const archivoJuego = new URL('js/juego.js', entrada);

/** Carga las dependencias reales sin DOM, en el orden declarado por index.html. */
export function cargar() {
  const contexto = vm.createContext({
    WAR: { ...legado }, WAR_RETOS: { ...retos },
    FACTORY: { ...factory }, FACTORY_RETOS: { ...factoryRetos },
    CAMPAIGN: { ...campaign }, CAMPAIGN_NIVEL: { ...nivel },
  });
  vm.runInContext('window = globalThis;', contexto);
  const necesarios = new Set([
    '../../shared/vendor/acorn-8.11.3.js',
    // El Worker interpola el preludio de Python del traductor real.
    '../../shared/python/traductor.js', 'js/proveedor.js',
    '../../shared/editor/javascript.js', '../../shared/vendor/lezer-python-1.1.19.js',
  ]);
  const html = readFileSync(entrada, 'utf8');
  const cargados = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g)) {
    if (!necesarios.has(m[1])) continue;
    const archivo = new URL(m[1], entrada);
    vm.runInContext(readFileSync(archivo, 'utf8'), contexto, { filename: fileURLToPath(archivo) });
    cargados.push(m[1]);
    necesarios.delete(m[1]);
  }
  if (necesarios.size) throw new Error(`Faltan scripts en index.html: ${[...necesarios].join(', ')}`);
  // El mismo texto que el juego (js/compat-paquetes.js) entrega a sus Workers.
  const fuenteWorker = fuenteTrabajador({
    validarFactory: factory.validar, validarCampaign: campaign.validar, modoCampaign: campaign.modoEnSnap,
    preludioPython: contexto.CMGPythonJS.preludio,
  });
  return { contexto, fuenteWorker, cargados };
}
