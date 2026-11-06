// Contrato de catálogos: sin claves duplicadas, traducciones ausentes ni variables perdidas.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('../shared/vendor/acorn-8.11.3.js');
const raiz = path.resolve(__dirname, '..');
const leer = archivo => readFileSync(path.join(raiz, archivo), 'utf8');
const mapas = { es: Object.create(null), en: Object.create(null) };
let checks = 0;
const comprobar = (valor, mensaje) => { assert.ok(valor, mensaje); checks++; };
function recorrer(nodo) {
  if (!nodo || typeof nodo !== 'object') return;
  if (nodo.type === 'ObjectExpression') {
    const vistas = new Set();
    for (const propiedad of nodo.properties) {
      comprobar(propiedad.type === 'Property' && !propiedad.computed, 'catálogos declarativos, sin propiedades calculadas ni spreads');
      const clave = propiedad.key.name ?? propiedad.key.value;
      comprobar(!vistas.has(clave), `clave duplicada: ${clave}`);
      vistas.add(clave);
    }
  }
  for (const valor of Object.values(nodo)) {
    if (Array.isArray(valor)) valor.forEach(recorrer);
    else if (valor && typeof valor === 'object') recorrer(valor);
  }
}
const modulos = [
  ['inicio', 'inicio'], ['ajustes', 'ajustes'],
  ['juego-estatico', 'juego'], ['disposicion', 'disposicion'], ['juego-dinamico', 'partida'],
  ['editor', 'editor'],
];
for (const [modulo, prefijo] of modulos) {
  const archivo = `shared/i18n/${modulo}.js`;
  const fuente = leer(archivo);
  recorrer(acorn.parse(fuente, { ecmaVersion: 'latest' }));
  const registrar = (idioma, mensajes) => {
    comprobar(Object.hasOwn(mapas, idioma), `${archivo}: idioma reconocido`);
    for (const [clave, texto] of Object.entries(mensajes)) {
      comprobar(clave.startsWith(`${prefijo}.`), `${archivo}: clave fuera de su módulo: ${clave}`);
      comprobar(!Object.hasOwn(mapas[idioma], clave), `${archivo}: clave ya registrada: ${clave}`);
      comprobar(typeof texto === 'string' && texto.trim().length > 0, `${clave}: texto vacío o no declarativo`);
      mapas[idioma][clave] = texto;
    }
  };
  const api = { registrar };
  vm.runInNewContext(fuente, { CMGI18n: api, window: { CMGI18n: api } }, { filename: archivo });
}
assert.deepEqual(Object.keys(mapas.en).sort(), Object.keys(mapas.es).sort(), 'mismas claves en español e inglés');
const variables = texto => [...texto.matchAll(/\{([A-Za-z_][\w]*)\}/g)].map(m => m[1]).sort();
for (const clave of Object.keys(mapas.es)) assert.deepEqual(variables(mapas.en[clave]), variables(mapas.es[clave]), `${clave}: interpolaciones idénticas`);
const htmlInicio = leer('index.html');
const htmlJuego = leer('Prototypes/Rocket Launcher/index.html');
for (const [archivo, html] of [['index.html', htmlInicio], ['juego', htmlJuego]]) {
  for (const [, clave] of html.matchAll(/\bdata-i18n(?:-[a-z-]+)?="([^"]+)"/g)) comprobar(Object.hasOwn(mapas.es, clave), `${archivo}: clave sin catálogo: ${clave}`);
}
// Las claves dinámicas con nombre literal también deben existir en ambos idiomas.
for (const archivo of ['layout', 'juego']) {
  for (const [, clave] of leer(`Prototypes/Rocket Launcher/js/${archivo}.js`).matchAll(/["']((?:ajustes|disposicion|partida)\.[\w.]+)["']/g)) comprobar(Object.hasOwn(mapas.es, clave), `${archivo}: clave sin catálogo: ${clave}`);
}
for (const [modulo] of modulos.filter(([m]) => m !== 'inicio')) comprobar(htmlJuego.includes(`shared/i18n/${modulo}.js?v=`), `el juego carga el catálogo ${modulo}`);
console.log(`${Object.keys(mapas.es).length} claves ES/EN: paridad, variables, duplicados y referencias correctos (${checks} comprobaciones).`);
