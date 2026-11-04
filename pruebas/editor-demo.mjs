// E2. Importable con el mismo puerto de navegador que las suites del juego.
import assert from 'node:assert/strict';
export async function probarEditorDemo(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a,b,m) => { assert.deepEqual(a,b,m); checks++; console.log('OK demo '+checks+': '+m); };
  await page.goto(origen + '/shared/editor/demo.html');
  await page.waitForFunction(() => window.demoEditores?.length === 2);
  eq(await page.evaluate(() => [typeof window.cmg, typeof window.__banco, typeof window.RUNTIME, typeof window.WAR]), ['undefined','undefined','undefined','undefined'], 'sin globals del juego');
  eq(await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map(n=>n.id)).size === document.querySelectorAll('[id]').length), true, 'IDs únicos');
  const segundo = await page.evaluate(() => demoEditores[1].documento().texto);
  await page.fill('#demo-uno textarea', 'console.log("primero");');
  eq(await page.evaluate(() => demoEditores[1].documento().texto), segundo, 'documentos aislados');
  eq(await page.evaluate(() => demoEditores[0].documento().revision > 0), true, 'revisión al editar');
  await page.evaluate(() => demoEditores[0].fachada.edicion.deshacer());
  eq(await page.evaluate(() => demoEditores[0].documento().texto.includes('const mensaje')), true, 'historial propio');
  await page.evaluate(() => demoEditores[0].fachada.edicion.rehacer());
  eq(await page.evaluate(() => demoEditores[0].documento().texto), 'console.log("primero");', 'rehacer');
  await page.evaluate(() => demoEditores[1].fachada.edicion.deshacer());
  eq(await page.evaluate(() => demoEditores[1].documento().texto), segundo, 'deshacer del segundo no toma historial ajeno');
  await page.evaluate(() => document.querySelector('[data-demo="0"] [data-documento]').value = 'borrador');
  await page.evaluate(() => document.querySelector('[data-demo="0"] [data-documento]').dispatchEvent(new Event('change')));
  await page.fill('#demo-uno textarea', 'console.log("borrador");');
  await page.evaluate(() => { const s=document.querySelector('[data-demo="0"] [data-documento]');s.value='principal';s.dispatchEvent(new Event('change')); });
  eq(await page.evaluate(() => demoEditores[0].documento().texto), 'console.log("primero");', 'volver al documento');
  await page.evaluate(() => demoEditores[0].fachada.edicion.deshacer());
  eq(await page.evaluate(() => demoEditores[0].documento().texto.includes('const mensaje')), true, 'historial por documento');
  await page.click('#demo-uno [data-editor="b-teclado"]');
  eq(await page.evaluate(() => [demoEditores[0].fachada.edicion.activo, demoEditores[1].fachada.edicion.activo]), [true,false], 'modo independiente');
  await page.click('#demo-uno [data-editor="bloques"]');
  await page.keyboard.press('Control+Alt+A');
  eq(await page.evaluate(() => [demoEditores[0].fachada.edicion.activo, demoEditores[1].fachada.edicion.activo]), [false,false], 'atajo afecta solo al editor enfocado');
  await page.click('[data-demo="0"] [data-lectura]');
  eq(await page.evaluate(() => demoEditores[0].insertar('roto')), false, 'solo lectura');
  eq(await page.evaluate(() => document.querySelector('#demo-uno [data-accion="duplicar"]').disabled), true, 'barra refleja solo lectura');
  await page.click('[data-demo="0"] [data-lectura]');
  eq(await page.evaluate(() => { const e=demoEditores[0],r=e.documento().revision;e.insertar('x');return e.marcas(r,[{linea:1,clase:'err'}]); }), false, 'descarta marcas antiguas');
  eq(await page.evaluate(() => {const e=demoEditores[0],r=e.documento().revision;e.abrir({id:'nuevo',lenguaje:'js',texto:'// nuevo',revision:0});return e.marcas(r,[{linea:1,clase:'err'}]);}), false, 'descarta marcas de otro documento');
  // Recrear varias veces no duplica edición, menús ni atajos globales.
  for(let i=0;i<3;i++) await page.click('[data-demo="0"] [data-recrear]');
  eq(await page.evaluate(() => document.querySelectorAll('#demo-uno textarea').length), 1, 'una interfaz tras recrear');
  await page.fill('#demo-uno textarea', 'console.log("reinicio");');
  await page.click('#demo-uno [data-editor="b-teclado"]');
  await page.click('#demo-uno [data-editor="bloques"]');
  await page.keyboard.press('Control+Alt+A');
  eq(await page.evaluate(() => demoEditores[0].fachada.edicion.activo), false, 'un único atajo tras recrear');
  eq(await page.evaluate(() => demoEditores[1].documento().texto), segundo, 'destruir el primero no afecta al segundo');
  await page.click('#demo-dos [data-editor="b-teclado"]');
  await page.evaluate(() => {demoEditores[1].destruir();demoEditores[1].destruir();});
  eq(await page.evaluate(() => document.querySelectorAll('#demo-dos textarea, #demo-dos .sugerencias, #demo-dos .variantes').length), 0, 'destrucción idempotente retira interfaz y auxiliares');
  // La misma instancia funciona sin proveedor, preferencias, almacenamiento ni vistas del juego.
  await page.evaluate(() => {const root=document.createElement('div');root.id='sin-proveedor';document.body.append(root);window.editorSolo=CMGEditor.crear({raiz:root,documento:{id:'solo',lenguaje:'js',texto:'let n = 1;',revision:0},adaptadores:{js:CMGAdaptadorJS}});});
  eq(await page.evaluate(() => {editorSolo.codigo.setSelectionRange(10,10);editorSolo.insertar('\n');return editorSolo.documento().texto.endsWith('\n');}), true, 'editar sin proveedor ni persistencia');
  await page.evaluate(() => {editorSolo.destruir();document.querySelector('#sin-proveedor').remove();});
  return checks;
}
