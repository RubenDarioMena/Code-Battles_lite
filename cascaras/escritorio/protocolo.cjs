// Resolución pura de URLs y lectura local: no importa Electron.
const path = require('node:path');
const fs = require('node:fs/promises');
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8',
});

function esInterna(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'cbl:' && u.host === 'app' && !u.username && !u.password;
  } catch { return false; }
}

function peticionPermitida(url) {
  return esInterna(url) || /^(?:blob:|data:)/.test(url);
}

function dentro(raiz, archivo) {
  const relativo = path.relative(raiz, archivo);
  return relativo !== '' && !path.isAbsolute(relativo)
    && relativo !== '..' && !relativo.startsWith('..' + path.sep);
}

/** No usar URL.pathname: WHATWG elimina los segmentos .. antes de examinarlos. */
function resolverRuta(raiz, url) {
  if (!esInterna(url)) return null;
  const partes = /^cbl:\/\/app(\/[^?#]*)?(?:[?#].*)?$/.exec(url);
  if (!partes) return null;
  let ruta;
  try { ruta = decodeURIComponent(partes[1] || '/'); } catch { return null; }
  if (/[\\\x00-\x1f:%]/.test(ruta) || ruta.startsWith('//')) return null;
  const segmentos = ruta.slice(1).split('/');
  if (segmentos.some(s => s === '..' || s === '.' || s.startsWith('.'))) return null;
  // No se sirve configuración/Node ni fuentes de la cáscara. También cubre
  // /../package.json cuando Chromium ya ha normalizado esa URL a /package.json.
  if (segmentos.includes('node_modules') || segmentos.includes('package.json')
    || ruta.startsWith('/cascaras/escritorio/')) return null;
  if (ruta.endsWith('/')) ruta += 'index.html';
  const tipo = MIME[path.extname(ruta).toLowerCase()];
  const archivo = path.resolve(raiz, '.' + ruta);
  return tipo && dentro(path.resolve(raiz), archivo) ? { archivo, tipo } : null;
}

async function servir(raiz, request) {
  const encontrado = resolverRuta(raiz, request.url);
  if (!encontrado || !['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 404 });
  try {
    // realpath evita escapes mediante enlaces simbólicos (también en desarrollo).
    const [realRaiz, realArchivo] = await Promise.all([
      fs.realpath(raiz), fs.realpath(encontrado.archivo),
    ]);
    if (!dentro(realRaiz, realArchivo) || !(await fs.stat(realArchivo)).isFile())
      return new Response(null, { status: 404 });
    const contenido = request.method === 'HEAD' ? null : await fs.readFile(realArchivo);
    return new Response(contenido, { headers: {
      'Content-Type': encontrado.tipo, 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return new Response(null, { status: 404 }); }
}

module.exports = { MIME, resolverRuta, servir, esInterna, peticionPermitida };
