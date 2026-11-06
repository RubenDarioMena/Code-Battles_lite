// Carga el motor del modo revisión en Node como en la página: i18n, textos, trazador, catálogo, flujo,
// frases y ejecución suelta. Todo queda en globalThis (window = globalThis).
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const RAIZ = path.resolve(__dirname, '../../..');
globalThis.window = globalThis;
globalThis.acorn = require(path.join(RAIZ, 'shared/vendor/acorn-8.11.3.js'));
for (const f of ['shared/i18n/i18n.js', 'educational-animation/revision/motor/textos.js', 'educational-animation/revision/motor/trazador.js',
  'educational-animation/revision/motor/catalogo.js', 'educational-animation/revision/motor/flujo.js', 'educational-animation/revision/motor/explicar.js', 'educational-animation/revision/motor/documentacion.js',
  'educational-animation/revision/motor/ejecutar.js'])
  vm.runInThisContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), { filename: f });
// Una grabación de ejemplos/<id>/grabacion.js.
function grabacion(id) {
  vm.runInThisContext(fs.readFileSync(path.join(RAIZ, 'educational-animation/revision/ejemplos', id, 'grabacion.js'), 'utf8'));
  return globalThis.GRABACIONES_REVISION[id];
}
// Segmentos → texto plano: [código], «valor», (número de fila).
function plano(P, F, segs) {
  const E = globalThis.CMGExplicar;
  return segs.flat(9).map(s => typeof s === 'string' || typeof s === 'number' ? String(s) : s == null ? '' : s.c != null ? `[${P.txt(s.c).replace(/\s+/g, ' ')}]`
    : s.k != null ? s.k : 'v' in s ? `«${E.valor(s.v).texto}»` : s.f != null ? `(${F.filas[s.f].num})` : s.br ? ' | ' : s.lista ? s.lista.join(' / ') : JSON.stringify(s)).join('');
}
module.exports = { RAIZ, grabacion, plano };
