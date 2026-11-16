import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';

// Proceso limpio: importar no debe consultar DOM, servicios o almacenamiento globales.
const entrada = new URL('../index.js', import.meta.url).href;
const resultado = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  for (const nombre of ['window', 'document', 'localStorage', 'CMGI18n', 'LezerPython', 'acorn']) {
    Object.defineProperty(globalThis, nombre, { get() { throw Error('Lectura global: ' + nombre); } });
  }
  const editor = await import(${JSON.stringify(entrada)});
  for (const nombre of ['CMGEditor', 'CMGEdicion', 'CMGSeudo', 'CMGEditorVida', 'CMGEditorUI', 'CMGTips', 'CMGPlantillasJS'])
    assert.equal(typeof editor[nombre].crear, 'function', nombre);
  assert.equal(typeof editor.configurar, 'function');
  assert.equal(editor.CMGAdaptadorJS.id, 'js');
  assert.equal(editor.CMGAdaptadorPython.id, 'python');
  assert(editor.ICONOS.whileTrue.svg.includes('<svg'));
  assert.equal(editor.CMGEditorPython.aHueco('tipo de enemigo'), '__tipo_de_enemigo__');
  assert.equal(editor.CMGLenguajes.llamada({ nombre: 'f', firma: ['valor'] }).texto, 'f(/* valor */);');
  editor.configurar({ i18n: { t: clave => clave }, vistas: false });
`], { encoding: 'utf8' });
assert.equal(resultado.status, 0, resultado.stderr);
for (const archivo of await readdir(new URL('../', import.meta.url))) {
  if (!archivo.endsWith('.js')) continue;
  const fuente = await readFile(new URL(`../${archivo}`, import.meta.url), 'utf8');
  assert(fuente.split('\n').length <= 501, `${archivo}: máximo 500 líneas`);
  assert(!/window\.(?:CMG\w+|ICONOS|ESTRUCTURA\w*|LezerPython|acorn)\b/.test(fuente), archivo);
  for (const [, ruta] of fuente.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    assert(ruta.startsWith('./') || ruta === '../lenguaje/index.js', `${archivo}: ${ruta}`);
    assert((await stat(new URL(`../${ruta}`, import.meta.url))).isFile());
  }
}
for (const ruta of ['../../../shared/editor', '../../../shared/js/iconos.js',
  '../../../shared/js/edicion.js', '../../../shared/css/edicion.css']) {
  await assert.rejects(stat(new URL(ruta, import.meta.url)), { code: 'ENOENT' });
}
console.log('editor: API pública importable en Node sin DOM ni globales; módulos ≤500 líneas y dependencia única en lenguaje.');
