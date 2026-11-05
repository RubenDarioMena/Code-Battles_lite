// E4b/E5 · Python en el juego. Importable con el mismo puerto de navegador que las demás suites.
// Python se edita y se guarda en fuentes-<reto>; prog-<reto> sigue siendo solo JS. Desde E5 no hay flag y
// Ejecutar traduce Python (la equivalencia con JS está en python-ejecucion.mjs).
import assert from 'node:assert/strict';
export async function probarPythonJuego(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; console.log('OK python ' + checks + ': ' + m); };
  const url = q => origen + '/Prototypes/Rocket%20Launcher/index.html' + q;
  const leer = k => page.evaluate(k => JSON.parse(localStorage.getItem('cmg-banco03:' + k)), k);
  const abrir = async q => { await page.goto(url(q)); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor); await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-4'); }); };

  // Sin flag (E5): una fuente Python guardada en uso se lee al cargar.
  await abrir('');
  await page.evaluate(() => localStorage.setItem('cmg-banco03:fuentes-0', JSON.stringify({ 'LAU-01': { lenguaje: 'python', texto: 'print("sí")\n', enUso: true } })));
  await page.goto(url('')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => window.__banco.elegirReto(0));
  eq(await page.evaluate(() => [!document.querySelector('#sel-lenguaje option[value="python"]'), document.querySelector('[data-lenguaje-programa].btn').disabled, cmg.editor.documento().lenguaje, cmg.codigo.value]),
    [false, false, 'python', 'print("sí")\n'], 'sin flag, Py está a la vista y la fuente Python en uso se abre');

  // La unidad pasa a Python con su propio documento; el JS se conserva. El de partida se convierte (E7).
  await page.goto(url('')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-0'); localStorage.removeItem('cmg-banco03:prog-0'); window.__banco.elegirReto(0); window.cmg.edicion.activar(false); });
  const js = await page.evaluate(() => cmg.codigo.value);
  eq(await page.evaluate(() => [!document.querySelector('#sel-lenguaje option[value="python"]'), cmg.editor.documento().lenguaje]), [false, 'js'], 'Py a la vista y la unidad sigue en JavaScript');
  await page.selectOption('#sel-lenguaje', 'python');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value, cmg.codigo.getAttribute('aria-label'), document.querySelector('#sel-lenguaje').value, document.querySelector('#sel-lenguaje').selectedOptions[0].textContent]),
    ['python', '# Programa de LAU-01 · el código de partida está comentado.\n# Quita los # (Ctrl+/ o el botón de comentar) o escribe el tuyo.\n# pos = auto_target("crawler", "visual")\n# regular_shoot(pos)\n', 'Programa de LAU-01 en Python', 'python', 'Python'], 'Py abre el programa de partida convertido a Python');
  eq(await page.evaluate(() => [...document.querySelectorAll('#paleta .atajo')].map(a => a.dataset.tipCod).filter(t => /auto_target|regular_shoot|wait|while True/.test(t))),
    ['while True: …', 'await wait(0.5)', 'pos = auto_target(__tipo_de_enemigo__, __sensor__)', 'regular_shoot(__lugar__)'], 'la paleta del lanzador en Python (nombres D1, huecos D4)');
  eq(await page.evaluate(() => [...document.querySelectorAll('#ins-cuerpo .tk-fn')].map(t => t.textContent).slice(0, 2)), ['auto_target(tipo, sensor)', 'regular_shoot(lugar)'], 'el inspector muestra los nombres Python');
  // Escribir con la paleta y el teclado.
  await page.evaluate(() => { const c = cmg.codigo; c.setSelectionRange(c.value.length, c.value.length); });
  await page.click('#paleta .atajo[data-tip-cod="while True: …"]');
  await page.keyboard.type('regular_shoot(pos)');
  const py = await page.evaluate(() => cmg.codigo.value);
  eq(py.split('\n').slice(4), ['while True:', '    regular_shoot(pos)', '    await wait(0.5)'], 'el bucle con su pausa y el cuerpo sangrado');
  await page.waitForTimeout(450);
  eq([await leer('fuentes-0'), (await leer('prog-0'))['LAU-01'] === js], [{ 'LAU-01': { lenguaje: 'python', texto: py, enUso: true } }, true], 'Python va a fuentes-<reto>; prog-<reto> conserva el JS');
  // Ejecutar corre Python: aquí «pos» no existe y el error llega con su línea de Python y al estilo de Python.
  await page.evaluate(() => window.__banco.ejecutar());
  await page.waitForFunction(() => !document.querySelector('#banner').hidden && !window.cmg.ejecutando);
  eq(await page.evaluate(() => [document.querySelector('#banner h2').textContent, document.querySelector('#banner').textContent.includes("NameError: name 'pos' is not defined")]), ['Error en la línea 6 de LAU-01', true], 'Ejecutar corre Python y el error trae la línea de Python');
  await page.evaluate(() => document.querySelector('#banner .acciones button:last-child').click());
  // Volver a JS recupera el programa JS; volver a Python, el Python.
  await page.selectOption('#sel-lenguaje', 'js');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value]), ['js', js], 'JS vuelve al programa JavaScript');
  await page.waitForTimeout(450);
  eq((await leer('fuentes-0'))['LAU-01'].enUso, false, 'la fuente Python queda guardada, fuera de uso');
  await page.selectOption('#sel-lenguaje', 'python');
  eq(await page.evaluate(() => cmg.codigo.value), py, 'Py recupera lo escrito en Python');
  // Recargar conserva el lenguaje de la unidad.
  await page.waitForTimeout(450);
  await page.goto(url('')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => window.__banco.elegirReto(0));
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value]), ['python', py], 'al recargar, la unidad sigue en Python');
  // Seudo desde Python vuelve a JavaScript y aplica la vista.
  await page.selectOption('#sel-lenguaje', 'pseudo');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, document.querySelector('#app').dataset.modo]), ['js', 'pseudo'], 'Seudo desde Python vuelve a JS y abre el seudocódigo');
  await page.evaluate(() => cmg.seudo.aplicarModo('js'));

  // Varias unidades: lenguajes distintos no aceptan borrador; Copiar a los demás copia en su lenguaje.
  await page.evaluate(() => { const b = window.__banco; b.elegirReto(4); b.programas['LAU-01'] = '// uno'; b.programas['LAU-02'] = '// dos'; b.abrirPrograma('LAU-01'); });
  await page.selectOption('#sel-lenguaje', 'python');
  await page.evaluate(() => window.__banco.seleccionar(['LAU-01', 'LAU-02']));
  eq(await page.evaluate(() => [document.querySelector('#acciones-multi').hidden, document.querySelector('#multi-estado').textContent.includes('lenguajes distintos')]), [false, true], 'dos unidades en lenguajes distintos lo avisan');
  await page.click('#b-add');
  eq(await page.evaluate(() => [window.__banco.programas['LAU-01'], window.__banco.programas['LAU-02']]), ['// uno', '// dos'], 'y no aplican el borrador');
  await page.selectOption('#sel-lenguaje', 'python');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, document.querySelector('#multi-estado').textContent.includes('lenguajes distintos')]), ['python', false], 'Py pasa las dos a Python');
  await page.evaluate(() => { cmg.codigo.value = 'await wait(1)'; cmg.codigo.dispatchEvent(new Event('input')); window.cmg.confirmarReplace = false; });
  await page.click('#b-add');
  await page.waitForTimeout(450);
  const fuentes4 = await leer('fuentes-4');
  eq([fuentes4['LAU-01'].texto.endsWith('\nawait wait(1)'), fuentes4['LAU-02'].texto.endsWith('\nawait wait(1)'), await page.evaluate(() => window.__banco.programas['LAU-01'])], [true, true, '// uno'], 'Add añade a los programas Python sin tocar los JS');
  await page.evaluate(() => { window.cmg.confirmarReplace = true; window.__banco.elegirReto(0); });

  // Factory con Python: paleta del robot y el mismo almacenamiento.
  await page.goto(url('?serie=factory')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-factory-0'); window.__banco.elegirReto(0); });
  await page.selectOption('#sel-lenguaje', 'python');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, [...document.querySelectorAll('#paleta .atajo')].map(a => a.dataset.tipCod).slice(1)]),
    ['python', ['while True: …', 'if __condicion__: …', 'and', 'await wait(1)', 'pos =', 'await pick_up(__lugar__, __material__)', 'await deliver(__lugar__)', 'cantidad = count(__lugar__, __material__)', 'print(__mensaje__)', '( )', '.']], 'Factory: la sección común de War, las órdenes del robot y los pares y signos del teléfono en Python');
  await page.evaluate(() => { const c = cmg.codigo; c.focus(); c.setSelectionRange(c.value.length, c.value.length); });
  await page.click('#paleta .atajo[data-tip-cod="await pick_up(__lugar__, __material__)"]');
  eq(await page.evaluate(() => [cmg.codigo.value.split('\n').at(-1), cmg.codigo.value.slice(cmg.codigo.selectionStart, cmg.codigo.selectionEnd)]), ['await pick_up(__lugar__, __material__)', '__lugar__'], 'el robot recoge con su hueco elegido');
  await page.evaluate(() => { cmg.editor.modoSinTeclado(true); const c = cmg.codigo, a = c.value.lastIndexOf('__lugar__'); cmg.edicion.elegir(a, a + 9); });
  await page.waitForSelector('.sugerencias:not([hidden]) .sug[data-i]');
  eq(await page.evaluate(() => { const t = document.querySelector('.sugerencias:not([hidden])').textContent; return [t.includes('ENT_1'), /\/\*|;/.test(t)]; }), [true, false], 'las sugerencias de un hueco Python son las del robot, sin sintaxis JS');
  await page.click('.sugerencias:not([hidden]) .sug[data-i="0"]');
  await page.waitForFunction(() => document.querySelector('.sugerencias:not([hidden])')?.textContent.includes('material'));
  eq(await page.evaluate(() => [cmg.codigo.value.split('\n').at(-1), cmg.codigo.value.slice(cmg.codigo.selectionStart, cmg.codigo.selectionEnd)]), ['await pick_up(ENT_1, __material__)', '__material__'], 'elegir el lugar pasa al hueco del material');
  await page.evaluate(() => { cmg.editor.modoSinTeclado(false); cmg.seudo?.aplicarModo('js'); });
  await page.selectOption('#sel-lenguaje', 'js');
  eq(await page.evaluate(() => cmg.editor.documento().lenguaje), 'js', 'Factory vuelve a JavaScript');
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-factory-0'); localStorage.removeItem('cmg-banco03:fuentes-0'); localStorage.removeItem('cmg-banco03:fuentes-4'); });

  // Netlify (Pretty URLs) reescribe «probar.html» como «probar»: Factory debe arrancar igual (antes: pantalla negra).
  const errores = [], alError = e => errores.push(e.message);
  page.on('pageerror', alError);
  const reescribir = async r => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()).replace(/href="probar\.html"/g, 'href="probar"') }); };
  await page.route(/Rocket%20Launcher\/index\.html/, reescribir);
  await page.goto(url('?serie=factory')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  eq(await page.evaluate(() => [document.getElementById('titulo').textContent, document.getElementById('b-probar').getAttribute('href').endsWith('probar?serie=factory'), !!document.querySelector('#sel-lenguaje option[value="python"]')]).then(r => [...r, errores.length]),
    ['Primer viaje', true, true, 0], 'Factory arranca aunque el enlace a probar.html venga sin .html');
  await page.unroute(/Rocket%20Launcher\/index\.html/, reescribir); page.off('pageerror', alError);

  // Caché con versiones mezcladas: unas plantillas rotas no cortan el arranque (antes: pantalla negra
  // y paleta vacía); si falta un archivo esencial, la página lo dice en vez de quedarse en negro.
  const rotas = r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.CMGPlantillasJS = { crear() { throw Error("sin catálogo"); } };' });
  await page.route(/shared\/editor\/plantillas\.js/, rotas);
  await page.goto(url('?serie=factory')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  eq(await page.evaluate(() => [document.getElementById('titulo').textContent, document.getElementById('t-escenario').textContent, document.body.textContent.includes('La paleta no se pudo cargar')]),
    ['Primer viaje', 'Tu reto', true], 'sin plantillas, Factory arranca y avisa de recargar');
  await page.unroute(/shared\/editor\/plantillas\.js/, rotas);
  const falta = r => r.fulfill({ status: 404, body: '' });
  await page.route(/js\/juego\.js/, falta);
  await page.goto(url('?serie=factory')); await page.waitForSelector('[role=alert]');
  eq(await page.evaluate(() => document.querySelector('[role=alert]').textContent.includes('no cargó juego.js')), true, 'si falta juego.js, la página lo dice');
  await page.unroute(/js\/juego\.js/, falta);
  // __banco existe antes de crear el mundo: no sirve como señal de arranque completo.
  await page.route(/js\/factory-form\.js/, falta);
  await page.goto(url('?serie=factory')); await page.waitForSelector('[role=alert]');
  eq(await page.evaluate(() => [!!window.__banco, !!window.__banco.mundo, window.__juegoListo,
    document.querySelector('[role=alert]').textContent.includes('no cargó factory-form.js'),
    window.__erroresArranque.some(t => t.includes('crear'))]),
    [true, false, false, true, true], 'un fallo después de crear __banco también muestra el aviso y su excepción');
  await page.unroute(/js\/factory-form\.js/, falta);
  await page.goto(url('?serie=factory')); await page.waitForFunction(() => window.__juegoListo);
  eq(await page.evaluate(() => [!!window.__banco.mundo, !!document.querySelector('[role=alert]')]),
    [true, false], 'al recuperar el recurso Factory termina de arrancar sin aviso');
  return checks;
}
