#!/usr/bin/env node
// Registra un bug con ID estable después de buscar posibles duplicados.
// Uso:
//   node harness/scripts/nuevo-bug.mjs "Editor: deshacer pierde la selección" --pantalla editor --claves deshacer,seleccion
//   (si aparecen posibles duplicados, revisa y repite con --crear para registrarlo igualmente)
//   node harness/scripts/nuevo-bug.mjs --buscar deshacer,seleccion   → solo busca
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CARPETA = join(RAIZ, 'docs/bugs');
const INDICE = join(CARPETA, 'INDICE.md');
const PLANTILLA = join(RAIZ, 'harness/plantillas/bug.md');

const argv = process.argv.slice(2);
const opcion = n => { const i = argv.indexOf('--' + n); return i < 0 ? null : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const titulo = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--crear'));
const normal = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const indice = await readFile(INDICE, 'utf8');
const filas = indice.split('\n').filter(l => /^\| \[BUG-\d{4}\]/.test(l));

const buscar = opcion('buscar');
const claves = String(buscar && buscar !== true ? buscar : opcion('claves') || '').split(',').map(s => s.trim()).filter(Boolean);
const palabras = [...claves, ...(titulo ? normal(titulo).split(/[^a-z0-9ñ]+/).filter(p => p.length > 3) : [])].map(normal);
const posibles = filas.filter(f => palabras.some(p => normal(f).includes(p)));

if (buscar) {
  console.log(posibles.length ? posibles.join('\n') : 'Sin coincidencias en el índice.');
  process.exit(0);
}
if (!titulo) { console.error('Falta el título. Ejemplo: node harness/scripts/nuevo-bug.mjs "Editor: … falla al …" --pantalla editor --claves a,b'); process.exit(2); }
if (posibles.length && !opcion('crear')) {
  console.log('Posibles duplicados. Si es el mismo bug, añade una fila en «Recurrencias» de ese archivo:\n' + posibles.join('\n'));
  console.log('\nSi es un bug distinto, repite el comando con --crear.');
  process.exit(1);
}

const usados = (await readdir(CARPETA)).map(f => /^BUG-(\d{4})/.exec(f)?.[1]).filter(Boolean).map(Number);
const id = 'BUG-' + String((usados.length ? Math.max(...usados) : 0) + 1).padStart(4, '0');
const slug = normal(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const archivo = `${id}-${slug}.md`;
let commit = 'desconocido';
try { commit = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim(); } catch {}
const pantalla = opcion('pantalla') && opcion('pantalla') !== true ? opcion('pantalla') : 'por definir';
const fecha = new Date().toISOString().slice(0, 10);

const texto = (await readFile(PLANTILLA, 'utf8'))
  .replaceAll('{{ID}}', id).replaceAll('{{TITULO}}', titulo).replaceAll('{{PANTALLA}}', pantalla)
  .replaceAll('{{CLAVES}}', claves.join(', ') || '—').replaceAll('{{FECHA}}', fecha).replaceAll('{{COMMIT}}', commit);
await mkdir(CARPETA, { recursive: true });
await writeFile(join(CARPETA, archivo), texto);

const fila = `| [${id}](${archivo}) | ${titulo.replaceAll('|', '/')} | ${pantalla} | ${claves.join(', ') || '—'} | abierto | ${fecha} |`;
const marcador = '<!-- nuevas filas encima de esta línea -->';
await writeFile(INDICE, indice.includes(marcador) ? indice.replace(marcador, fila + '\n' + marcador) : indice.trimEnd() + '\n' + fila + '\n');
console.log(`Creado docs/bugs/${archivo}`);
