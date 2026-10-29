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
for (const excluido of ['educational-animation', 'pruebas', 'docs', '.git', '.env', 'README.md']) {
  await assert.rejects(stat(path.join(raiz, excluido)), { code: 'ENOENT' });
}
const inicio = await readFile(path.join(raiz, 'index.html'), 'utf8');
assert.equal((inicio.match(/class="cuadro /g) || []).length, 3);
console.log(`${paginas} páginas y ${enlaces} referencias locales verificadas; paquete sin archivos de desarrollo.`);
