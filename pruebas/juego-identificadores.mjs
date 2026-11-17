// Identificadores resueltos por ámbito y TDZ directa: también revisa cuerpos diferidos.
// La carga en VM de juego-arranque.mjs comprueba además las llamadas durante el arranque.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const entrada = raiz + 'Prototypes/Rocket Launcher/js/juego.js';
const archivos = [entrada, raiz + 'herramientas/capturas-vista.mjs', raiz + 'herramientas/partida/jugar.mjs', raiz + 'herramientas/partida/diagnosticos.mjs', raiz + 'herramientas/capturas-combate.mjs', raiz + 'herramientas/vfx-hojas.mjs', raiz + 'herramientas/medir-carga.mjs',
  ...readdirSync(raiz + 'herramientas/medir-carga/').filter(f => f.endsWith('.mjs')).map(f => raiz + 'herramientas/medir-carga/' + f), raiz + 'paquetes/editor/demo/demo.js', raiz + 'Prototypes/Rocket Launcher/js/servicios.js', raiz + 'paquetes/app/juego/entorno.d.ts', raiz + 'cascaras/escritorio/entorno.d.ts', raiz + 'paquetes/app/vista-nula.js', raiz + 'paquetes/app/plataforma.js', raiz + 'cascaras/web/plataforma.js',
  ...readdirSync(raiz + 'cascaras/escritorio/').filter(f => f.endsWith('.cjs')).map(f => raiz + 'cascaras/escritorio/' + f),
  ...['archivos-publicables', 'empaquetar-escritorio', 'steam-vdf', 'preparar-netlify'].map(f => raiz + 'scripts/' + f + '.mjs'),
  raiz + 'paquetes/editor/dependencias.js', raiz + 'paquetes/editor/edicion-acciones.js',
  ...['paquetes/anfitrion/', 'paquetes/app/juego/', 'paquetes/interfaz/', 'paquetes/vista-2d/', 'paquetes/vista-3d/', 'paquetes/vfx/', 'paquetes/vfx/recetas/', 'herramientas/laboratorio-vfx/'].flatMap(dir =>
    readdirSync(raiz + dir).filter(f => f.endsWith('.js')).map(f => raiz + dir + f))];
const opciones = { allowJs: true, checkJs: true, noEmit: true, strict: false,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ['node'] };
const codigos = new Set([2304, 2552, 18004, 2339, 2448, 2454]);
const globalesConocidos = new Set(`Array BigInt TypeError structuredClone Blob Boolean Infinity CustomEvent Date Error Event Float32Array JSON Map Math
  MutationObserver Node Number Object Option Promise Proxy RegExp ResizeObserver Set String URL URLSearchParams
  Uint8Array devicePixelRatio setInterval clearInterval Worker addEventListener cancelAnimationFrame clearTimeout console crypto document fetch
  getComputedStyle history innerHeight innerWidth location matchMedia navigator parseFloat
  parseInt performance requestAnimationFrame sessionStorage setTimeout visualViewport window
  globalThis Response decodeURIComponent`.split(/\s+/));
const globalesNode = new Set([...globalesConocidos, 'require', 'module', '__dirname', 'process', 'Buffer']);
const globalesCapturas = new Set([...globalesNode, 'localStorage', 'eval', 'Image', 'OffscreenCanvas']);
const globalesUsados = new Set();
function revisar(mutacion = '', auditar = false) {
  const host = ts.createCompilerHost(opciones), leer = host.readFile;
  host.readFile = nombre => {
    const texto = leer(nombre);
    return nombre === entrada ? texto + mutacion : texto;
  };
  const programa = ts.createProgram(archivos, opciones, host);
  if (auditar) {
    const checker = programa.getTypeChecker();
    function visitar(nodo) {
      if (ts.isIdentifier(nodo)) {
        const padre = nodo.parent;
        const propiedad = (ts.isPropertyAccessExpression(padre) && padre.name === nodo)
          || ((ts.isPropertyAssignment(padre) || ts.isMethodDeclaration(padre)
            || ts.isGetAccessor(padre) || ts.isSetAccessor(padre) || ts.isBindingElement(padre))
            && (padre.name === nodo || padre.propertyName === nodo));
        if (!propiedad) {
          const simbolo = ts.isShorthandPropertyAssignment(padre)
            ? checker.getShorthandAssignmentValueSymbol(padre) : checker.getSymbolAtLocation(nodo);
          const ambiente = simbolo?.declarations?.some(d =>
            /\/node_modules\/(?:typescript\/lib\/lib\.|@types\/node\/)/.test(d.getSourceFile().fileName));
          if (ambiente) {
            const nombre = nodo.getSourceFile().fileName;
            const permitidos = nombre === raiz + 'herramientas/capturas-vista.mjs' ? globalesCapturas : /\/(?:cascaras\/escritorio|scripts)\/|\/herramientas\/(?:vfx-hojas\.mjs$|medir-carga)/.test(nombre) ? globalesNode : globalesConocidos;
            assert(permitidos.has(nodo.text), `${nombre}: global ${nodo.text} sin declarar en la lista de su entorno`);
            globalesUsados.add(nodo.text);
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    }
    for (const nombre of archivos.filter(n => /\.(?:cjs|mjs|js)$/.test(n))) visitar(programa.getSourceFile(nombre));
  }
  return archivos.flatMap(nombre => programa.getSemanticDiagnostics(programa.getSourceFile(nombre)))
    .filter(d => codigos.has(d.code));
}
const errores = revisar('', true);
assert.equal(errores.length, 0, ts.formatDiagnosticsWithColorAndContext(errores, {
  getCurrentDirectory: () => raiz, getCanonicalFileName: f => f, getNewLine: () => '\n',
}));
// Autopruebas: detecta el tipo de accidente del 11a y una lectura lexical prematura.
assert(revisar('\nfactory_FORM.crear();').some(d => d.code === 2304 || d.code === 2552));
assert(revisar('\nwindow.factory_FORM.crear();').some(d => d.code === 2339));
assert(revisar('\n{ const antes = despues; const despues = 1; }').some(d => d.code === 2448));
console.log(`Identificadores: ${archivos.length - 1} módulos/entrada con ámbitos resueltos; ${globalesUsados.size} globales estándar permitidos; sin nombres libres desconocidos ni TDZ directa; 3 mutaciones rechazadas (nombre libre, global inexistente y TDZ).`);
