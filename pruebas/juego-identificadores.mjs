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
const codigos = new Set([2304, 2552, 18004, 2448, 2454]);
function revisar(mutacion = '') {
  const host = ts.createCompilerHost(opciones), leer = host.readFile;
  host.readFile = nombre => {
    const texto = leer(nombre);
    return nombre === entrada ? texto + mutacion : texto;
  };
  const programa = ts.createProgram(archivos, opciones, host);
  return archivos.flatMap(nombre => programa.getSemanticDiagnostics(programa.getSourceFile(nombre)))
    .filter(d => codigos.has(d.code));
}
const errores = revisar();
assert.equal(errores.length, 0, ts.formatDiagnosticsWithColorAndContext(errores, {
  getCurrentDirectory: () => raiz, getCanonicalFileName: f => f, getNewLine: () => '\n',
}));
// Autopruebas: detecta el tipo de accidente del 11a y una lectura lexical prematura.
assert(revisar('\nfactory_FORM.crear();').some(d => d.code === 2304 || d.code === 2552));
assert(revisar('\n{ const antes = despues; const despues = 1; }').some(d => d.code === 2448));
console.log(`Identificadores: ${archivos.length - 1} módulos/entrada con ámbitos resueltos; sin nombres libres desconocidos ni TDZ directa; 2 mutaciones rechazadas.`);
