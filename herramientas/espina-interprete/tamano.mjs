import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { guardarMedidas } from './medidas.mjs';
const raiz = new URL('../../', import.meta.url).pathname;
function medir(archivos) {
  const datos = archivos.map(ruta => { const b = readFileSync(ruta); return {
    archivo: ruta.startsWith(raiz) ? relative(raiz, ruta) : relative(process.env.CBL_QUICKJS, ruta),
    bytes: b.length, gzipBytes: gzipSync(b).length }; });
  return { bytes: datos.reduce((s, a) => s + a.bytes, 0), gzipBytes: datos.reduce((s, a) => s + a.gzipBytes, 0), archivos: datos };
}
const base = resolve(raiz, 'herramientas/espina-interprete');
const P = medir([resolve(base, 'canal.mjs'), ...readdirSync(resolve(base, 'propio')).filter(f => f.endsWith('.mjs')).map(f => resolve(base, 'propio', f))]);
const datos = { juegoActualBytes: 0, P, Q: { omitido: 'Falta CBL_QUICKJS' } };
if (process.env.CBL_QUICKJS) {
  const externo = process.env.CBL_QUICKJS;
  const core = resolve(externo, 'quickjs-emscripten-core/dist');
  const variante = resolve(externo, '@jitl/quickjs-wasmfile-release-sync/dist');
  const tipos = resolve(externo, '@jitl/quickjs-ffi-types/dist');
  const paths = [
    ...readdirSync(core).filter(f => f.endsWith('.mjs')).map(f => resolve(core, f)),
    ...readdirSync(tipos).filter(f => f.endsWith('.mjs')).map(f => resolve(tipos, f)),
    ...['index.mjs', 'ffi.mjs', 'emscripten-module.browser.mjs', 'emscripten-module.wasm'].map(f => resolve(variante, f)),
  ];
  datos.Q = medir(paths);
  datos.Q.puentePrototipo = medir(['quickjs.mjs', 'canal.mjs', 'clon.mjs'].map(f => resolve(base, f)));
}
guardarMedidas('tamano', datos);
console.log(JSON.stringify(datos, null, 2));
