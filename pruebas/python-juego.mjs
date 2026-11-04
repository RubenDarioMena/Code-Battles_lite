// E4b · Python en el juego detrás de ?python=1. Importable con el mismo puerto de navegador que las demás suites.
// Python se edita y se guarda en fuentes-<reto>; prog-<reto> sigue siendo solo JS; Ejecutar explica que aún no corre.
import assert from 'node:assert/strict';
export async function probarPythonJuego(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; console.log('OK python ' + checks + ': ' + m); };
  const url = q => origen + '/Prototypes/Rocket%20Launcher/index.html' + q;
  const leer = k => page.evaluate(k => JSON.parse(localStorage.getItem('cmg-banco03:' + k)), k);
  const abrir = async q => { await page.goto(url(q)); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor); await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-4'); }); };

  // Sin el flag, nada cambia: ni botón ni lectura de fuentes Python.
  await abrir('');
  await page.evaluate(() => localStorage.setItem('cmg-banco03:fuentes-0', JSON.stringify({ 'LAU-01': { lenguaje: 'python', texto: 'print("no")\n', enUso: true } })));
  await page.goto(url('')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => window.__banco.elegirReto(0));
  eq(await page.evaluate(() => [document.querySelector('.herramientas [data-lenguaje-programa]').hidden, document.querySelector('.hoja [data-lenguaje-programa], [data-lenguaje-programa].btn').disabled, cmg.editor.documento().lenguaje, typeof window.CMGAdaptadorPython]),
    [true, true, 'js', 'object'], 'sin ?python=1 el juego no ofrece ni lee Python');

  // Con el flag: la unidad pasa a Python con su propio documento; el JS se conserva.
  await page.goto(url('?python=1')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-0'); window.__banco.elegirReto(0); window.cmg.edicion.activar(false); });
  const js = await page.evaluate(() => cmg.codigo.value);
  eq(await page.evaluate(() => [document.querySelector('.herramientas [data-lenguaje-programa]').hidden, cmg.editor.documento().lenguaje]), [false, 'js'], 'con ?python=1 aparece Py y la unidad sigue en JavaScript');
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value.startsWith('# Programa de LAU-01 en Python.'), cmg.codigo.getAttribute('aria-label'), document.querySelector('.herramientas [data-lenguaje-programa]').getAttribute('aria-pressed'), document.querySelector('.herramientas [data-modo-codigo="js"]').getAttribute('aria-pressed')]),
    ['python', true, 'Programa de LAU-01 en Python', 'true', 'false'], 'Py abre el programa Python de la unidad');
  eq(await page.evaluate(() => [...document.querySelectorAll('#paleta .atajo')].map(a => a.dataset.tipCod).filter(t => /auto_target|regular_shoot|wait|while True/.test(t))),
    ['while True: …', 'await wait(0.5)', 'pos = auto_target(__tipo_de_enemigo__, __sensor__)', 'regular_shoot(__lugar__)'], 'la paleta del lanzador en Python (nombres D1, huecos D4)');
  eq(await page.evaluate(() => [...document.querySelectorAll('#ins-cuerpo .tk-fn')].map(t => t.textContent).slice(0, 2)), ['auto_target(tipo, sensor)', 'regular_shoot(lugar)'], 'el inspector muestra los nombres Python');
  // Escribir con la paleta y el teclado.
  await page.evaluate(() => { const c = cmg.codigo; c.setSelectionRange(c.value.length, c.value.length); });
  await page.click('#paleta .atajo[data-tip-cod="while True: …"]');
  await page.keyboard.type('regular_shoot(pos)');
  const py = await page.evaluate(() => cmg.codigo.value);
  eq(py.split('\n').slice(3), ['while True:', '    regular_shoot(pos)', '    await wait(0.5)'], 'el bucle con su pausa y el cuerpo sangrado');
  await page.waitForTimeout(450);
  eq([await leer('fuentes-0'), (await leer('prog-0'))['LAU-01'] === js], [{ 'LAU-01': { lenguaje: 'python', texto: py, enUso: true } }, true], 'Python va a fuentes-<reto>; prog-<reto> conserva el JS');
  // Ejecutar no corre Python todavía.
  await page.evaluate(() => window.__banco.ejecutar());
  eq(await page.evaluate(() => [document.querySelector('#banner').hidden, document.querySelector('#banner h2').textContent, window.cmg.ejecutando]), [false, 'Python todavía no se ejecuta', false], 'Ejecutar explica que Python aún no se ejecuta');
  await page.evaluate(() => document.querySelector('#banner .acciones button:last-child').click());
  // Volver a JS recupera el programa JS; volver a Python, el Python.
  await page.click('.herramientas [data-modo-codigo="js"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value]), ['js', js], 'JS vuelve al programa JavaScript');
  await page.waitForTimeout(450);
  eq((await leer('fuentes-0'))['LAU-01'].enUso, false, 'la fuente Python queda guardada, fuera de uso');
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => cmg.codigo.value), py, 'Py recupera lo escrito en Python');
  // Recargar conserva el lenguaje de la unidad.
  await page.waitForTimeout(450);
  await page.goto(url('?python=1')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => window.__banco.elegirReto(0));
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value]), ['python', py], 'al recargar, la unidad sigue en Python');
  // Seudo desde Python vuelve a JavaScript y aplica la vista.
  await page.click('.herramientas [data-modo-codigo="pseudo"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, document.querySelector('#app').dataset.modo]), ['js', 'pseudo'], 'Seudo desde Python vuelve a JS y abre el seudocódigo');
  await page.evaluate(() => cmg.seudo.aplicarModo('js'));

  // Varias unidades: lenguajes distintos no aceptan borrador; Copiar a los demás copia en su lenguaje.
  await page.evaluate(() => { const b = window.__banco; b.elegirReto(4); b.programas['LAU-01'] = '// uno'; b.programas['LAU-02'] = '// dos'; b.abrirPrograma('LAU-01'); });
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  await page.evaluate(() => window.__banco.seleccionar(['LAU-01', 'LAU-02']));
  eq(await page.evaluate(() => [document.querySelector('#acciones-multi').hidden, document.querySelector('#multi-estado').textContent.includes('lenguajes distintos')]), [false, true], 'dos unidades en lenguajes distintos lo avisan');
  await page.click('#b-add');
  eq(await page.evaluate(() => [window.__banco.programas['LAU-01'], window.__banco.programas['LAU-02']]), ['// uno', '// dos'], 'y no aplican el borrador');
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, document.querySelector('#multi-estado').textContent.includes('lenguajes distintos')]), ['python', false], 'Py pasa las dos a Python');
  await page.evaluate(() => { cmg.codigo.value = 'await wait(1)'; cmg.codigo.dispatchEvent(new Event('input')); window.cmg.confirmarReplace = false; });
  await page.click('#b-add');
  await page.waitForTimeout(450);
  const fuentes4 = await leer('fuentes-4');
  eq([fuentes4['LAU-01'].texto.endsWith('\nawait wait(1)'), fuentes4['LAU-02'].texto.endsWith('\nawait wait(1)'), await page.evaluate(() => window.__banco.programas['LAU-01'])], [true, true, '// uno'], 'Add añade a los programas Python sin tocar los JS');
  await page.evaluate(() => { window.cmg.confirmarReplace = true; window.__banco.elegirReto(0); });

  // Factory con Python: paleta del robot y el mismo almacenamiento.
  await page.goto(url('?python=1&serie=factory')); await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-factory-0'); window.__banco.elegirReto(0); });
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, [...document.querySelectorAll('#paleta .atajo')].map(a => a.dataset.tipCod).slice(1)]),
    ['python', ['for i in range(3): …', 'while __condicion__: …', 'await pick_up(__lugar__, __material__)', 'await deliver(__lugar__)', 'cantidad = count(__lugar__, __material__)', 'await wait(1)']], 'Factory: la paleta del robot en Python');
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
  await page.click('.herramientas [data-modo-codigo="js"]');
  eq(await page.evaluate(() => cmg.editor.documento().lenguaje), 'js', 'Factory vuelve a JavaScript');
  await page.evaluate(() => { localStorage.removeItem('cmg-banco03:fuentes-factory-0'); localStorage.removeItem('cmg-banco03:fuentes-0'); localStorage.removeItem('cmg-banco03:fuentes-4'); });
  return checks;
}
