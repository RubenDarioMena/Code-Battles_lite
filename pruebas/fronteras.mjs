// Fase 0: barrera estática; no carga ni ejecuta el código de los paquetes.
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dependencias = {
  protocolo: [], nucleo: ['protocolo'],
  'reglas-war': ['nucleo', 'protocolo'],
  'reglas-factory': ['nucleo', 'protocolo'],
  'reglas-campaign': ['nucleo', 'protocolo'],
  lenguaje: [], anfitrion: ['nucleo', 'protocolo', 'lenguaje'],
  editor: ['lenguaje'], vfx: ['protocolo'],
  'vista-2d': ['protocolo', 'vfx'], 'vista-3d': ['protocolo', 'vfx'],
  interfaz: ['protocolo', 'editor'], app: [],
};
dependencias.app = Object.keys(dependencias).filter(nombre => nombre !== 'app');
// Especificadores exactos: no autorizan subrutas ni paquetes homónimos.
const terceros = { three: ['vista-3d'], acorn: ['lenguaje'], '@lezer/python': ['lenguaje'] };
const puros = new Set(['protocolo', 'nucleo', 'reglas-war', 'reglas-factory',
  'reglas-campaign', 'lenguaje', 'vfx']);
const identificadores = new Set(['window', 'document', 'localStorage',
  'requestAnimationFrame', 'THREE', 'setTimeout', 'setInterval']);
const metodos = new Set(['performance.now', 'Date.now', 'Math.random']);
const raizPropia = fileURLToPath(new URL('../', import.meta.url));

/** @param {string} carpeta @returns {Promise<string[]>} */
async function archivos(carpeta) {
  const encontrados = [];
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    if (entrada.name === 'node_modules') continue;
    const ruta = resolve(carpeta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...await archivos(ruta));
    else if (entrada.isFile() && /\.(?:js|mjs)$/.test(entrada.name)) encontrados.push(ruta);
  }
  return encontrados.sort();
}

/** @param {any} nodo @returns {string | undefined} */
function propiedad(nodo) {
  return nodo.computed ? (nodo.property.type === 'Literal' ? nodo.property.value : undefined)
    : nodo.property.name;
}

/** @param {any} nodo @param {any} padre @param {string} clave */
function esNombreDePropiedad(nodo, padre, clave) {
  return padre && ((padre.type === 'MemberExpression' && clave === 'property' && !padre.computed)
    || (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(padre.type)
      && clave === 'key' && !padre.computed)
    || (['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(padre.type) && clave === 'label')
    || (padre.type === 'ImportSpecifier' && clave === 'imported')
    || (padre.type === 'ExportSpecifier' && clave === 'exported'));
}

async function principal() {
  const opciones = process.argv.slice(2);
  if (opciones.length && (opciones.length !== 2 || opciones[0] !== '--raiz')) {
    throw new Error('Uso: node pruebas/fronteras.mjs [--raiz <dir>]');
  }
  const raiz = resolve(opciones[1] || raizPropia);
  const carpeta = resolve(raiz, 'paquetes');
  const paquetes = (await readdir(carpeta, { withFileTypes: true }))
    .filter(entrada => entrada.isDirectory() && entrada.name !== 'node_modules');
  const contexto = vm.createContext({});
  vm.runInContext(await readFile(resolve(raizPropia, 'shared/vendor/acorn-8.11.3.js'), 'utf8'), contexto);
  const acorn = contexto.acorn;
  const web = resolve(raiz, 'cascaras/web');
  const rutasWeb = await archivos(web).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const rutas = [...await archivos(carpeta), ...rutasWeb];
  let infracciones = 0;
  for (const ruta of rutas) {
    const esWeb = ruta.startsWith(web + sep);
    const local = relative(esWeb ? raiz : carpeta, ruta).split(sep).join('/');
    const [paquete, ...resto] = local.split('/');
    const prueba = resto[0] === 'pruebas';
    const puro = puros.has(paquete) && !prueba;
    const nombre = esWeb ? local : `paquetes/${local}`;
    const informar = (nodo, regla, detalle) => {
      console.error(`${nombre}:${nodo.loc.start.line} · ${regla} · ${detalle}`);
      infracciones++;
    };
    const revisarImport = (nodo, fuente) => {
      if (typeof fuente !== 'string') {
        informar(nodo, 'import-dinamico', 'import() requiere una cadena literal');
        return;
      }
      if (fuente.startsWith('./') || fuente.startsWith('../')) {
        const destino = posix.normalize(posix.join(posix.dirname(local), fuente));
        if (esWeb) {
          if (destino.startsWith('cascaras/web/')) return;
          const profundidad = posix.dirname(local).split('/').length;
          if (fuente !== '../'.repeat(profundidad) + 'paquetes/app/index.js')
            informar(nodo, 'import-ruta', `web solo puede importar la entrada pública de app: ${fuente}`);
          return;
        }
        if (destino.startsWith(`${paquete}/`)) return;
        // Ruta relativa exacta a la entrada pública, también desde subcarpetas (p. ej. pruebas/).
        const profundidad = posix.dirname(local).split('/').length;
        const entrada = new RegExp(`^(?:\\.\\./){${profundidad}}([^/]+)/index\\.js$`).exec(fuente);
        if (!entrada) informar(nodo, 'import-ruta', `entrada pública requerida: ${fuente}`);
        else if (!dependencias[paquete]?.includes(entrada[1])) {
          informar(nodo, 'import-dependencia', `${paquete} no puede importar ${entrada[1]}`);
        }
      } else if (!(prueba && /^node:.+/.test(fuente)) && !terceros[fuente]?.includes(paquete)) {
        informar(nodo, 'import-desnudo', `especificador no autorizado: ${fuente}`);
      }
    };
    let arbol;
    try {
      arbol = acorn.parse(await readFile(ruta, 'utf8'), {
        ecmaVersion: 'latest', sourceType: 'module', locations: true,
      });
    } catch (error) {
      informar({ loc: { start: { line: error.loc?.line || 1 } } }, 'sintaxis', error.message);
      continue;
    }
    /** @param {any} nodo @param {any} [padre] @param {string} [clave] */
    function visitar(nodo, padre, clave = '') {
      if (!nodo || typeof nodo !== 'object') return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(nodo.type)
        && nodo.source) revisarImport(nodo, nodo.source.value);
      if (nodo.type === 'ImportExpression') {
        revisarImport(nodo, nodo.source.type === 'Literal' ? nodo.source.value : undefined);
      }
      if (puro) {
        if (nodo.type === 'Identifier' && identificadores.has(nodo.name)
          && !esNombreDePropiedad(nodo, padre, clave)) informar(nodo, 'entorno', nodo.name);
        if (nodo.type === 'MemberExpression' && nodo.object.type === 'Identifier') {
          const acceso = `${nodo.object.name}.${propiedad(nodo)}`;
          if (metodos.has(acceso)) informar(nodo, 'entorno', acceso);
        }
        if (nodo.type === 'NewExpression' && nodo.callee.type === 'Identifier'
          && nodo.callee.name === 'Date') informar(nodo, 'entorno', 'new Date');
      }
      for (const [campo, valor] of Object.entries(nodo)) {
        if (campo === 'loc') continue;
        if (Array.isArray(valor)) valor.forEach(hijo => visitar(hijo, nodo, campo));
        else if (valor && typeof valor === 'object') visitar(valor, nodo, campo);
      }
    }
    visitar(arbol);
  }
  if (infracciones) process.exitCode = 1;
  else console.log(`Fronteras: ${rutas.length} archivos y ${paquetes.length} paquetes revisados; sin infracciones.`);
}

principal().catch(error => { console.error(error.message); process.exitCode = 1; });
