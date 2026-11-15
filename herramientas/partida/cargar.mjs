import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const raiz = new URL('../../', import.meta.url);
const entrada = new URL('Prototypes/Rocket Launcher/index.html', raiz);
export const archivoJuego = new URL('js/juego.js', entrada);

/** Carga las dependencias reales sin DOM, en el orden declarado por index.html. */
export function cargar() {
  let fuenteWorker = '';
  const contexto = vm.createContext({
    // RUNTIME.despertar solo guarda este valor para el vigía: no decide el paso.
    performance: { now: () => 0 },
    Blob: class { constructor(partes) { this.texto = partes.join(''); } },
    URL: { createObjectURL(blob) { fuenteWorker = blob.texto; return 'worker:capturado'; } },
  });
  vm.runInContext('window = globalThis;', contexto);
  const necesarios = new Set([
    '../../shared/vendor/acorn-8.11.3.js',
    // runtime.js interpola validarFactory incluso en War: necesita el módulo real.
    'js/campaign-nivel.js', 'js/campaign.js', 'js/factory.js', 'js/factory-retos.js', 'js/war.js', 'js/war-retos.js',
    '../../shared/python/traductor.js', 'js/runtime.js', 'js/proveedor.js',
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
  if (!fuenteWorker || !contexto.RUNTIME) throw new Error('runtime.js no creó el Worker esperado.');
  return { contexto, fuenteWorker, cargados };
}
