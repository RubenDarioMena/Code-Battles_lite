// Ejecutar después de node scripts/preparar-netlify.mjs.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('../dist/', import.meta.url));
let enlaces = 0, paginas = 0;
async function recorrer(carpeta) {
  for (const e of await readdir(carpeta, { withFileTypes: true })) {
    const archivo = path.join(carpeta, e.name);
    if (e.isDirectory()) { await recorrer(archivo); continue; }
    if (!e.name.endsWith('.html')) continue;
    paginas++;
    const html = await readFile(archivo, 'utf8');
    for (const [, referencia] of html.matchAll(/(?:src|href)="([^"\n]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(referencia)) continue;
      const url = new URL(referencia, `https://qa.invalid/${path.relative(raiz, archivo).split(path.sep).join('/')}`);
      let local = path.join(raiz, decodeURIComponent(url.pathname));
      let info;
      try { info = await stat(local); } catch { assert.fail(`Recurso ausente: ${referencia} en ${path.relative(raiz, archivo)}`); }
      if (info.isDirectory()) { local = path.join(local, 'index.html'); assert.equal((await stat(local)).isFile(), true); }
      enlaces++;
    }
  }
}
await recorrer(raiz);
for (const excluido of ['pruebas', 'docs', '.git', '.env', 'README.md']) {
  await assert.rejects(stat(path.join(raiz, excluido)), { code: 'ENOENT' });
}
// Única excepción del laboratorio: los tres módulos que el juego carga directamente.
const laboratorio = path.join(raiz, 'educational-animation');
assert.deepEqual((await readdir(laboratorio)).sort(), ['revision']);
assert.deepEqual((await readdir(path.join(laboratorio, 'revision'))).sort(), ['motor']);
const motor = path.join(laboratorio, 'revision', 'motor');
const modulos = ['flujo.js', 'python.js', 'trazador.js'];
assert.deepEqual((await readdir(motor)).sort(), modulos);
for (const archivo of modulos) assert.equal((await stat(path.join(motor, archivo))).isFile(), true);
const inicio = await readFile(path.join(raiz, 'index.html'), 'utf8');
assert.equal((inicio.match(/class="cuadro /g) || []).length, 3);
console.log(`${paginas} páginas y ${enlaces} referencias locales verificadas; paquete sin archivos de desarrollo.`);
