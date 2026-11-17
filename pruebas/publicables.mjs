import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { entradasPublicables, copiarPublicables } from '../scripts/archivos-publicables.mjs';
import { prepararApp, plataformas } from '../scripts/empaquetar-escritorio.mjs';
const raiz = fileURLToPath(new URL('../', import.meta.url));
// Lista exacta anterior a la extracción (incluido el filtro de pruebas de paquetes).
assert.deepEqual([...entradasPublicables], [
  'index.html', '404.html', 'css', 'campaign', 'shared', 'paquetes', 'cascaras/web',
  'herramientas/terreno', 'Prototypes/Tres vistas', 'Prototypes/Rocket Launcher',
  'Prototypes/02_tres_vistas.html', ...['trazador.js', 'flujo.js', 'python.js'].map(a => `educational-animation/revision/motor/${a}`),
]);
async function inventario(dir, base = dir) {
  const resultado = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const archivo = path.join(dir, e.name), relativo = path.relative(base, archivo).split(path.sep).join('/');
    if (e.isDirectory()) resultado.push(...await inventario(archivo, base));
    else resultado.push([relativo, createHash('sha256').update(await readFile(archivo)).digest('hex')]);
  }
  return resultado.sort((a, b) => a[0].localeCompare(b[0]));
}
const temporal = await mkdtemp(path.join(tmpdir(), 'cbl-publicables-'));
try {
  const web = path.join(temporal, 'web'), escritorio = path.join(temporal, 'escritorio');
  await copiarPublicables(raiz, web); await prepararApp(escritorio);
  const listaWeb = await inventario(web);
  assert.deepEqual((await inventario(escritorio)).filter(([n]) => n !== 'package.json'
    && !n.startsWith('cascaras/escritorio/') && !n.startsWith('node_modules/steamworks.js/')), listaWeb);
  assert(!listaWeb.some(([n]) => /^(?:cascaras\/escritorio|pruebas)\//.test(n) || /^paquetes\/[^/]+\/pruebas\//.test(n)));
  const paquete = JSON.parse(await readFile(path.join(escritorio, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(paquete).sort(), ['dependencies', 'main', 'name', 'productName', 'version']);
  assert.deepEqual(paquete.dependencies, { 'steamworks.js': '0.4.0' });
  assert.equal(paquete.version, JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8')).version);
  assert.equal(paquete.productName, 'Code Battle Lite'); assert((await stat(path.join(escritorio, paquete.main))).isFile());
  assert.deepEqual(plataformas([]), ['win32', 'linux']);
  for (const p of ['win32', 'linux', 'darwin']) assert.deepEqual(plataformas([`--plataforma=${p}`]), [p]);
  assert.throws(() => plataformas(['--plataforma=otro']));
  console.log(`Publicables: lista histórica y filtro intactos; ${listaWeb.length} archivos idénticos en web/escritorio; manifiesto y opciones verificados sin empaquetar.`);
} finally { await rm(temporal, { recursive: true, force: true }); }
