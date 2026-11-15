// El árbol vive fuera de paquetes/ para no entrar en checkJs ni en la revisión real.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const comprobador = fileURLToPath(new URL('./fronteras.mjs', import.meta.url));
const casos = fileURLToPath(new URL('./fronteras-casos/', import.meta.url));
const esperadas = [
  ['protocolo/entorno.js', 'entorno', 15],
  ['nucleo/temporizadores.js', 'entorno', 2],
  ['reglas-war/temporizadores.js', 'entorno', 2],
  ['reglas-factory/entorno.js', 'entorno', 1],
  ['reglas-campaign/entorno.js', 'entorno', 1],
  ['lenguaje/entorno.js', 'entorno', 1],
  ['vfx/entorno.js', 'entorno', 1],
  ['nucleo/rutas.js', 'import-ruta', 4],
  ['reglas-war/pruebas/rutas.mjs', 'import-ruta', 2],
  ['nucleo/rutas.js', 'import-desnudo', 3],
  ['protocolo/dependencias.js', 'import-dependencia', 4],
  ['lenguaje/desnudos.js', 'import-desnudo', 5],
  ['vista-2d/terceros.js', 'import-desnudo', 3],
  ['app/dinamicos.mjs', 'import-dinamico', 4],
  ['editor/pruebas/desnudo.js', 'import-desnudo', 1],
  ['app/sintaxis.js', 'sintaxis', 1],
].flatMap(([archivo, regla, cantidad]) => Array.from({ length: Number(cantidad) },
  () => `paquetes/${archivo} · ${regla}`)).sort();

// Solo el temporal contiene sintaxis inválida y node_modules: todos los archivos
// fuente del árbol guardado admiten node --check, y Git no omite casos necesarios.
const raiz = await mkdtemp(join(tmpdir(), 'cbl-fronteras-'));
let resultado;
try {
  await cp(casos, raiz, { recursive: true });
  await writeFile(join(raiz, 'paquetes/app/sintaxis.js'), 'export const = ;\n');
  await mkdir(join(raiz, 'paquetes/app/node_modules'), { recursive: true });
  await writeFile(join(raiz, 'paquetes/app/node_modules/ignorado.js'), 'esto no es JavaScript;\n');
  resultado = spawnSync(process.execPath, [comprobador, '--raiz', raiz], { encoding: 'utf8' });
} finally {
  await rm(raiz, { recursive: true, force: true });
}
assert.ifError(resultado.error);
assert.equal(resultado.signal, null, 'La comprobación debe terminar normalmente');
assert.equal(resultado.status, 1, 'El árbol incorrecto debe salir con 1');
assert.equal(resultado.stdout, '', 'No debe anunciar éxito');
const detectadas = resultado.stderr.trim().split(/\r?\n/).map(linea => {
  const partes = /^(paquetes\/[^:]+):([1-9]\d*) · ([^·]+) · (.+)$/.exec(linea);
  assert.ok(partes, `Diagnóstico sin archivo, línea, regla o detalle: ${linea}`);
  return `${partes[1]} · ${partes[3]}`;
}).sort();
assert.deepEqual(detectadas, esperadas, 'Infracciones exactas por archivo y regla, ninguna en los correctos');
console.log(`Fronteras autoprueba: ${detectadas.length} infracciones esperadas; archivos correctos e ignorados sin avisos.`);
