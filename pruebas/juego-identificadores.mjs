// Identificadores resueltos por ámbito y TDZ directa: también revisa cuerpos diferidos.
// La carga en VM de juego-arranque.mjs comprueba además las llamadas durante el arranque.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const entrada = raiz + 'Prototypes/Rocket Launcher/js/juego.js';
const archivos = [entrada, raiz + 'paquetes/app/juego/entorno.d.ts',
  ...['paquetes/app/juego/', 'paquetes/interfaz/'].flatMap(dir =>
    readdirSync(raiz + dir).filter(f => f.endsWith('.js')).map(f => raiz + dir + f))];
const opciones = { allowJs: true, checkJs: true, noEmit: true, strict: false,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ['node'] };
const codigos = new Set([2304, 2552, 18004, 2339, 2448, 2454]);
const globalesConocidos = new Set(`Array Blob Boolean CustomEvent Date Error Event JSON Map Math
  MutationObserver Node Number Object Promise Proxy ResizeObserver Set String URL URLSearchParams
  Uint8Array Worker addEventListener cancelAnimationFrame clearTimeout console crypto document fetch
  getComputedStyle history innerHeight innerWidth localStorage location matchMedia navigator parseFloat
  parseInt performance requestAnimationFrame setTimeout visualViewport window`.split(/\s+/));
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
            assert(globalesConocidos.has(nodo.text), `${nodo.getSourceFile().fileName}: global ${nodo.text} sin declarar en la lista del navegador`);
            globalesUsados.add(nodo.text);
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    }
    for (const nombre of archivos.filter(n => n.endsWith('.js'))) visitar(programa.getSourceFile(nombre));
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
