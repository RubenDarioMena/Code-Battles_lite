// Campaign-V2 · textos en ES y EN (shared/i18n/campaign-v2/nivel-1.js):
// - los dos idiomas tienen las mismas claves, ninguna vacía, con los mismos parámetros {nombre};
// - toda clave «cv2.…» escrita literalmente en el código de paquetes/ y de la página existe en el catálogo.
// Las claves que se arman al vuelo ('cv2.mando.' + k) no se ven aquí: las cubren las pruebas de cada pieza.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';

const raiz = new URL('../', import.meta.url);
const es = Object.keys(catalogo.es), en = Object.keys(catalogo.en);
assert.deepEqual(es.filter(k => !Object.hasOwn(catalogo.en, k)), [], 'claves sin inglés');
assert.deepEqual(en.filter(k => !Object.hasOwn(catalogo.es, k)), [], 'claves sin español');
assert.deepEqual([...es.filter(k => !catalogo.es[k]), ...en.filter(k => !catalogo.en[k])], [], 'textos vacíos');
const parametros = texto => [...String(texto).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
assert.deepEqual(es.filter(k => parametros(catalogo.es[k]) !== parametros(catalogo.en[k])), [], 'parámetros distintos');

const archivos = execFileSync('git', ['ls-files', 'paquetes', 'Prototypes/Campaign-V2/js'], { cwd: raiz, encoding: 'utf8' })
  .split('\n').filter(f => /\.m?js$/.test(f) && !f.includes('/pruebas/'));
const usadas = new Map();
for (const f of archivos)
  for (const m of readFileSync(new URL(f, raiz), 'utf8').matchAll(/['"`](cv2\.[\w.]*\w)['"`]/g)) usadas.set(m[1], f);
assert.ok(usadas.size > 50, 'el barrido encuentra las claves del código');
assert.deepEqual([...usadas].filter(([k]) => !Object.hasOwn(catalogo.es, k)), [], 'claves usadas sin texto');
console.log(`i18n Campaign-V2: ${es.length} claves en ES y EN con los mismos parámetros; ${usadas.size} claves del código, todas con texto.`);
