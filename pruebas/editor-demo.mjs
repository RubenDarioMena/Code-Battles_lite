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
  eq(await page.evaluate(() => demoEditores[0].documento().texto.includes('console.info("Listo para empezar")')), true, 'historial propio');
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
  eq(await page.evaluate(() => demoEditores[0].documento().texto.includes('console.info("Listo para empezar")')), true, 'historial por documento');
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

  // E3 · lenguaje del documento. El IDE no trae Seudo: sus vistas son opcionales y la demo no carga seudo.js.
  eq(await page.evaluate(() => { const s = document.querySelector('#demo-uno [data-editor="lenguaje"]'); return [[...s.options].map(o => o.textContent), s.disabled, s.value, document.querySelector('#demo-uno').dataset.lenguaje]; }), [['JavaScript'], true, 'js', 'js'], 'un solo lenguaje: el selector lo indica sin permitir cambiarlo');
  eq(await page.evaluate(() => [typeof window.CMGSeudo, document.querySelector('#demo-uno [data-editor="modos-codigo"]').hidden, document.querySelector('#demo-uno textarea').getAttribute('aria-label')]), ['undefined', true, 'Código JavaScript'], 'sin vistas de seudocódigo en el IDE');
  // Un segundo adaptador de prueba (no es un lenguaje del proyecto): basta para cambiar el interior.
  await page.evaluate(() => {
    const root = document.createElement('div'); root.id = 'lenguajes'; document.body.append(root);
    const prueba = { ...CMGAdaptadorJS, id: 'prueba', nombre: 'Prueba', teclas: [{ t: '#' }], plantillas: [] };
    const docs = { js: { id: 'a.js', lenguaje: 'js', texto: 'let a = 1;', revision: 0 }, prueba: { id: 'a.prueba', lenguaje: 'prueba', texto: '# uno', revision: 0 } };
    window.respuesta = d => d;   // el anfitrión decide: aquí, abrir el documento guardado de ese lenguaje
    window.editorL = CMGEditor.crear({ raiz: root, documento: docs.js, adaptadores: { js: CMGAdaptadorJS, prueba }, forma: 'escritorio',
      alCambiar: d => { docs[d.lenguaje] = d; },
      alCambiarLenguaje: ({ documento, lenguaje }) => { docs[documento.lenguaje] = documento; return window.respuesta(docs[lenguaje]); } });
  });
  const lenguaje = id => page.evaluate(v => { const s = document.querySelector('#lenguajes [data-editor="lenguaje"]'); s.value = v; s.dispatchEvent(new Event('change')); }, id).then(() => page.waitForTimeout(30));
  eq(await page.evaluate(() => { const s = document.querySelector('#lenguajes [data-editor="lenguaje"]'); return [[...s.options].map(o => o.value + ':' + o.textContent), s.disabled]; }), [['js:JavaScript', 'prueba:Prueba'], false], 'el selector lista los adaptadores con el nombre del catálogo o del adaptador');
  await page.fill('#lenguajes textarea', 'let a = 2;');
  await lenguaje('prueba');
  eq(await page.evaluate(() => [editorL.documento().lenguaje, editorL.documento().texto, document.querySelector('#lenguajes').dataset.lenguaje, document.querySelector('#lenguajes textarea').getAttribute('aria-label'),
    document.querySelectorAll('#lenguajes .simbolos button').length, document.querySelectorAll('#lenguajes .paleta .atajo').length]),
    ['prueba', '# uno', 'prueba', 'Código Prueba', 1, 0], 'cambiar de lenguaje abre su documento con su adaptador, teclas y paleta');
  await page.evaluate(() => editorL.fachada.edicion.deshacer());
  eq(await page.evaluate(() => editorL.documento().texto), '# uno', 'el historial del otro documento no se mezcla');
  await lenguaje('js');
  eq(await page.evaluate(() => [editorL.documento().texto, document.querySelectorAll('#lenguajes .paleta .atajo').length > 0]), ['let a = 2;', true], 'volver al lenguaje anterior recupera texto y paleta');
  await page.evaluate(() => editorL.fachada.edicion.deshacer());
  eq(await page.evaluate(() => editorL.documento().texto), 'let a = 1;', 'cada documento conserva su historial al cambiar de lenguaje');
  await page.evaluate(() => editorL.modoSinTeclado(true));
  for (const id of ['prueba', 'js', 'prueba']) await lenguaje(id);
  eq(await page.evaluate(() => [editorL.fachada.edicion.activo, document.querySelectorAll('.sugerencias').length, document.querySelectorAll('.variantes').length]), [true, 2, 2], 'sin teclado sigue activo y no se duplican menús al rehacer el interior');
  await page.focus('#lenguajes [data-editor="bloques"]');
  await page.keyboard.press('Control+Alt+A');
  eq(await page.evaluate(() => editorL.fachada.edicion.activo), false, 'un único atajo tras cambiar de lenguaje');
  await page.evaluate(() => { window.respuesta = () => ({ motivo: 'Este programa no cabe en <JS>.' }); });
  await lenguaje('js');
  eq(await page.evaluate(() => [editorL.documento().lenguaje, document.querySelector('#lenguajes [data-editor="lenguaje"]').value, document.querySelector('#lenguajes [data-editor="aviso"]').textContent.includes('no cabe en <JS>')]), ['prueba', 'prueba', true], 'si el anfitrión explica que no puede, el documento y el selector no cambian');
  await page.evaluate(() => { window.respuesta = d => new Promise(r => setTimeout(() => r(d), 80)); });
  await lenguaje('js');
  await page.evaluate(() => editorL.insertar('x'));
  await page.waitForTimeout(150);
  eq(await page.evaluate(() => [editorL.documento().lenguaje, editorL.documento().texto.includes('x'), document.querySelector('#lenguajes [data-editor="lenguaje"]').disabled]), ['prueba', true, false], 'una respuesta que llega tras editar se descarta');
  eq(await page.evaluate(() => { try { editorL.abrir({ id: 'z', lenguaje: 'cobol', texto: '' }); return 'abierto'; } catch (e) { return editorL.documento().lenguaje; } }), 'prueba', 'abrir un lenguaje sin adaptador falla sin tocar el documento');
  await page.evaluate(() => { editorL.destruir(); document.querySelector('#lenguajes').remove(); });
  eq(await page.evaluate(() => [document.querySelectorAll('.sugerencias').length, document.querySelectorAll('.variantes').length]), [1, 1], 'destruir tras cambiar de lenguaje retira los auxiliares del interior');

  // E2.1 · paridad con el editor del juego y pantalla completa.
  const vista = page.viewportSize() || { width: 1280, height: 720 };
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(origen + '/shared/editor/demo.html');
  await page.waitForFunction(() => window.demoEditores?.length === 2);
  const raiz = n => `#demo-${n === 0 ? 'uno' : 'dos'}`;
  const visible = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; }, sel);
  eq(await page.evaluate(() => [...document.querySelectorAll('.cmg-editor')].map(r => [r.dataset.forma, r.classList.contains('cmg-anfitrion')])), [['escritorio', true], ['escritorio', true]], 'forma de escritorio y clase de anfitrión');
  eq([await visible('#demo-uno .barra-edicion'), await visible('#demo-uno .simbolos')], [false, false], 'en PC sin barra de edición ni símbolos, como el juego');
  await page.click('#demo-uno [data-editor="b-teclado"]');
  eq(await visible('#demo-uno .barra-edicion'), true, 'sin teclado muestra la barra de edición');
  await page.click('#demo-uno [data-editor="b-teclado"]');
  await page.hover('#demo-uno .paleta .atajo');
  await page.waitForFunction(() => !document.querySelector('.tip')?.hidden);
  eq(await page.evaluate(() => [document.querySelectorAll('.tip').length, document.querySelector('.tip').textContent.length > 0]), [1, true], 'un tooltip compartido con el nombre del icono');
  await page.mouse.move(2, 2);
  const letra = () => page.evaluate(() => [...document.querySelectorAll('.cmg-editor')].map(r => getComputedStyle(r).getPropertyValue('--code-size').trim()));
  await page.click('#demo-uno [data-editor="b-mas"]');
  eq(await letra(), ['16px', '14px'], 'A+ cambia la letra solo de su editor');
  await page.click('#demo-uno [data-editor="b-menos"]'); await page.click('#demo-uno [data-editor="b-menos"]');
  eq(await letra(), ['13px', '14px'], 'A− baja por los mismos tamaños que el juego');
  await page.click('[data-demo="0"] [data-recrear]');
  eq(await letra(), ['13px', '14px'], 'la letra se guarda en las preferencias del anfitrión');
  await page.click('#demo-uno [data-editor="b-ajustes"]');
  eq(await page.evaluate(() => { const d = document.querySelector('#demo-uno [data-editor="ajustes"]'); return [d.open, !!d.querySelector('[data-editor="ajustes-asa"]')]; }), [true, true], 'Ajustes del editor con el asa de líneas');
  await page.click('#demo-uno [data-editor="ajustes-cerrar"]');
  // Pantalla completa: el editor cubre la ventana; Esc y el botón lo devuelven.
  await page.click('#demo-dos [data-editor="b-pantalla"]');
  const caja = n => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round); }, raiz(n));
  eq(await caja(1), [0, 0, 1400, 900], 'pantalla completa cubre la ventana');
  eq(await page.evaluate(() => [document.querySelector('#demo-dos .editor').getBoundingClientRect().height > 600, document.documentElement.dataset.cmgPantalla !== undefined, document.querySelector('#demo-uno').dataset.pantallaCompleta]), [true, true, undefined], 'el código ocupa el alto y el otro editor no cambia');
  await page.click('#demo-dos textarea');
  await page.keyboard.press('Escape');
  eq(await page.evaluate(() => [document.querySelector('#demo-dos').dataset.pantallaCompleta, document.documentElement.dataset.cmgPantalla]), ['false', undefined], 'Esc sale de la pantalla completa');
  // Salir de la pantalla completa del navegador (su propio Esc) también devuelve el editor.
  await page.click('#demo-dos [data-editor="b-pantalla"]');
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.querySelector('#demo-dos').dataset.pantallaCompleta === 'false');
  eq(await page.evaluate(() => document.documentElement.dataset.cmgPantalla), undefined, 'salir del navegador sale del editor');
  await page.evaluate(() => demoEditores[1].pantallaCompleta(true));
  await page.evaluate(() => { demoEditores[1].fachada.edicion.activar(true); });
  await page.click('#demo-dos [data-editor="b-pantalla"]');
  eq(await page.evaluate(() => document.querySelector('#demo-dos').dataset.pantallaCompleta), 'false', 'el botón sale también en modo sin teclado');
  await page.evaluate(() => { demoEditores[1].fachada.edicion.activar(false); demoEditores[1].pantallaCompleta(true); demoEditores[1].destruir(); });
  eq(await page.evaluate(() => [document.documentElement.dataset.cmgPantalla, document.querySelector('#demo-dos').dataset.pantallaCompleta, document.querySelector('#demo-dos').classList.contains('cmg-anfitrion')]), [undefined, undefined, false], 'destruir a pantalla completa deja la página como estaba');
  // La pantalla completa del navegador, si se pidió, también se suelta.
  await page.waitForFunction(() => !document.fullscreenElement);
  // La ventana del navegador tarda un instante en volver a su tamaño tras salir de pantalla completa.
  const redimensionar = async tam => { for (let i = 0; ; i++) { try { await page.setViewportSize(tam); return; } catch (e) { if (i > 20) throw e; await page.waitForTimeout(100); } } };
  // Teléfono: la forma la decide el ancho; la barra de símbolos aparece al escribir.
  await redimensionar({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('#demo-uno').dataset.forma === 'movil');
  eq(await page.evaluate(() => [document.querySelector('#demo-uno .atajo').getBoundingClientRect().height, getComputedStyle(document.querySelector('#demo-uno .barra-edicion')).display]), [40, 'flex'], 'en el teléfono paleta compacta y barra de edición');
  eq(await visible('#demo-uno .simbolos'), false, 'sin escribir no hay barra de símbolos');
  await page.focus('#demo-uno textarea');
  eq(await visible('#demo-uno .simbolos'), true, 'al escribir aparece la barra de símbolos');
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => demoEditores[0].destruir());
  eq(await page.evaluate(() => document.querySelectorAll('.tip').length), 0, 'el último editor retira el tooltip compartido');
  await redimensionar(vista);
  return checks;
}
