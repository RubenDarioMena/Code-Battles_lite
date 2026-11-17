// Genera el segundo recorrido estático del mismo evaluador. No compila código del
// jugador: solo quita delegaciones de los métodos propios sin await/yield.
// Ediciones por offsets ESTree, nunca sustituciones parciales de identificadores.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
const raiz = new URL('../../../paquetes/interprete/', import.meta.url);
const metodos = { evaluar: 'rapido', referencia: 'refRapida', asignar: 'asigRapida',
  argumentos: 'argsRapidos', expresion: 'exprRapida', sentencia: 'sentRapida', lista: 'listaRapida', clase: 'claseRapida' };
for (const archivo of ['expresiones', 'sentencias', 'clases']) {
  const fuente = readFileSync(new URL(archivo + '.js', raiz), 'utf8'), ediciones = [];
  const ast = acorn.parse(fuente, { ecmaVersion: 2022, sourceType: 'module' });
  function visitar(n) {
    if (!n || typeof n !== 'object' || !n.type) return;
    if (n.type === 'YieldExpression') {
      if (!n.delegate) { ediciones.push([n.start, n.end, 'this.noSuspender()']); return; }
      ediciones.push([n.start, n.argument.start, '']);
    }
    if (n.type === 'Property' && n.method && n.value.generator)
      ediciones.push([n.start, n.key.start, '']);
    if (n.type === 'Identifier' && n.name === archivo) ediciones.push([n.start, n.end, 'rapido' + archivo]);
    if (n.type === 'Property' && n.method && metodos[n.key.name])
      ediciones.push([n.key.start, n.key.end, metodos[n.key.name]]);
    if (n.type === 'MemberExpression' && n.object.type === 'ThisExpression' && !n.computed && metodos[n.property.name])
      ediciones.push([n.property.start, n.property.end, metodos[n.property.name]]);
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(visitar);
      else if (v && typeof v === 'object') visitar(v);
    }
  }
  visitar(ast);
  let salida = fuente;
  for (const [a, b, texto] of ediciones.sort((a,b) => b[0] - a[0])) salida = salida.slice(0,a) + texto + salida.slice(b);
  const destino = new URL(archivo + '-rapido.js', raiz);
  salida = '// Generado por herramientas/espina-interprete/generacion/rapido.mjs; editar el original.\n' + salida;
  if (process.argv.includes('--comprobar')) assert.equal(readFileSync(destino, 'utf8'), salida, archivo + ': regenerar recorrido síncrono');
  else writeFileSync(destino, salida);
}
