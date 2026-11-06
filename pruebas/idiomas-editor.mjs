// Regresiones de idioma de la barra compartida del editor. Importable con page.cdp.
import assert from 'node:assert/strict';

export async function probarIdiomasEditor(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK idiomas editor ${++checks}: ${mensaje}`);
  };
  const base = `${origen}/Prototypes/Rocket%20Launcher/`;
  const texto = 'let idiomaEditor = 1;\nconsole.log(idiomaEditor);\n';
  let textoInicial = '';
  let almacenamientoInicial;
  const viewport = async () => {
    await page.cdp('Emulation.setDeviceMetricsOverride', {
      width: 393, height: 852, deviceScaleFactor: 1, mobile: true,
    });
    await page.waitForFunction(() => innerWidth === 393 && matchMedia('(max-width: 650px)').matches);
  };
  const porAPI = async idioma => page.evaluate(v => CMGI18n.cambiarIdioma(v), idioma);

  await page.goto(`${origen}/`);
  await page.waitForFunction(() => !!window.CMGI18n);
  almacenamientoInicial = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))
  );
  try {
    await page.evaluate(() => {
      localStorage.setItem('cmg-banco03:vista', JSON.stringify('2d'));
      localStorage.setItem('cmg-banco03:factory-vista', JSON.stringify('2d'));
    });
    await page.goto(`${base}?forma=movil`);
    await viewport();
    await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.editor && !!window.CMGI18n);
    await page.click('[data-vista="2d"]');
    await page.evaluate(() => {
      __banco.elegirReto(0);
      __banco.abrirPrograma('LAU-01');
    });
    // El selector de cabecera está oculto en móvil; aquí solo prepara el documento de prueba.
    await page.selectOption('#sel-lenguaje', 'js', { force: true });
    textoInicial = await page.evaluate(() => cmg.codigo.value);
    await page.fill('#codigo', texto);
    await page.evaluate(() => {
      cmg.codigo.setSelectionRange(4, 16);
      cmg.codigo.dispatchEvent(new CustomEvent('cmg:seleccion'));
      CMGI18n.cambiarIdioma('es');
    });
    await page.evaluate(() => {
      const b = document.querySelector('#edicion [data-accion="cortar"]');
      b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => !!document.querySelector('.variantes-ed:not([hidden])'));

    const refsEs = await page.evaluate(() => {
      const menu = document.querySelector('.variantes-ed');
      const botones = [...menu.querySelectorAll('.variante')];
      const seleccion = document.querySelector('#edicion [data-seleccion]');
      const refs = {
        toolbar: document.querySelector('#edicion'),
        acciones: [...document.querySelectorAll('#edicion [data-accion]')],
        menu, botones, spans: botones.map(b => b.querySelector('span')),
        textos: botones.map(b => b.querySelector('span').firstChild),
        seleccion,
      };
      window.__idiomasEditorRefs = refs;
      botones[0].focus();
      return {
        labels: botones.map(b => b.querySelector('span').textContent),
        catalogos: botones.map(b => CMGI18n.t(`editor.etiqueta.${b.dataset.v}`)),
        selected: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
        foco: document.activeElement === botones[0],
        undo: document.querySelector('#edicion [data-accion="deshacer"]').disabled,
        redo: document.querySelector('#edicion [data-accion="rehacer"]').disabled,
        keyboard: cmg.edicion.activo,
        ariaPressed: document.querySelector('#edicion [data-accion="teclado"]').getAttribute('aria-pressed'),
        selectionAria: seleccion.getAttribute('aria-label'),
        selectionAriaCatalog: CMGI18n.t('editor.aria.seleccion.apagada'),
        texto: cmg.codigo.value,
      };
    });
    eq([refsEs.labels, refsEs.selected, refsEs.foco, refsEs.undo, refsEs.redo, refsEs.keyboard, refsEs.ariaPressed,
      refsEs.selectionAria, refsEs.selectionAriaCatalog],
    [refsEs.catalogos, [4, 16], true, false, true, false, 'false', refsEs.selectionAriaCatalog, refsEs.selectionAriaCatalog],
    'barra y menú móvil arrancan en español con selección, foco e historial preparados');

    for (const [idioma, activo] of [['en', false], ['es', false], ['en', true], ['es', true], ['en', false], ['es', false]]) {
      if (await page.evaluate(() => cmg.edicion.activo) !== activo)
        await page.evaluate(v => cmg.edicion.activar(v), activo);
      await porAPI(idioma);
      const actual = await page.evaluate(() => {
        const r = window.__idiomasEditorRefs;
        const idiomaTeclado = cmg.edicion.activo ? 'activo' : 'inactivo';
        const acciones = [...document.querySelectorAll('#edicion [data-accion]')];
        const menu = document.querySelector('.variantes-ed');
        const botones = [...menu.querySelectorAll('.variante')];
        const seleccion = document.querySelector('#edicion [data-seleccion]');
        const teclado = document.querySelector('#edicion [data-accion="teclado"]');
        return {
          idioma: CMGI18n.idioma,
          mismaBarra: document.querySelector('#edicion') === r.toolbar,
          mismosBotones: acciones.length === r.acciones.length && acciones.every((n, i) => n === r.acciones[i]),
          mismoMenu: menu === r.menu && botones.length === r.botones.length && botones.every((n, i) => n === r.botones[i]),
          mismosSpans: botones.every((b, i) => b.querySelector('span') === r.spans[i]),
          mismosTextos: botones.every((b, i) => b.querySelector('span').firstChild === r.textos[i]),
          etiquetasMenu: botones.map(b => b.querySelector('span').textContent),
          catalogosMenu: botones.map(b => CMGI18n.t(`editor.etiqueta.${b.dataset.v}`)),
          mismaSeleccion: seleccion === r.seleccion,
          seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
          foco: document.activeElement === r.botones[0],
          keyboard: [cmg.edicion.activo, teclado.getAttribute('aria-pressed'), teclado.getAttribute('aria-label'), teclado.dataset.tip,
            CMGI18n.t(`editor.teclado.${idiomaTeclado}.aria`), CMGI18n.t(`editor.teclado.${idiomaTeclado}.tip`)],
          selectionAria: seleccion.getAttribute('aria-label'),
          selectionAriaCatalog: CMGI18n.t('editor.aria.seleccion.apagada'),
          texto: cmg.codigo.value,
          undo: document.querySelector('#edicion [data-accion="deshacer"]').disabled,
          redo: document.querySelector('#edicion [data-accion="rehacer"]').disabled,
          accionesCatalogo: acciones.filter(b => b.dataset.accion !== 'teclado').every(b => b.getAttribute('aria-label') === CMGI18n.t(`editor.accion.${b.dataset.accion}`)
            && b.dataset.tip === CMGI18n.t(`editor.accion.${b.dataset.accion}`)),
        };
      });
      eq([actual.idioma, actual.mismaBarra, actual.mismosBotones, actual.mismoMenu, actual.mismosSpans, actual.mismosTextos,
        actual.etiquetasMenu, actual.catalogosMenu, actual.mismaSeleccion, actual.seleccion, actual.foco, actual.keyboard,
        actual.selectionAria, actual.selectionAriaCatalog, actual.texto, actual.undo, actual.redo, actual.accionesCatalogo],
      [idioma, true, true, true, true, true, actual.catalogosMenu, actual.catalogosMenu, true, [4, 16], true,
        [activo, String(activo), actual.keyboard[4], actual.keyboard[5], actual.keyboard[4], actual.keyboard[5]],
        actual.selectionAriaCatalog, actual.selectionAriaCatalog, texto, false, true, true],
      `barra, estado del teclado, nodos de texto, foco, selección e historial ${idioma.toUpperCase()} (${activo ? 'sin teclado' : 'con teclado'})`);
    }

    // El cambio de idioma solo refresca presentación: el mismo historial debe poder deshacer y rehacer.
    await page.evaluate(() => document.querySelector('#edicion [data-accion="deshacer"]').click());
    await page.waitForFunction(v => cmg.codigo.value !== v, texto);
    eq(await page.evaluate(() => [cmg.codigo.value, document.querySelector('#edicion [data-accion="rehacer"]').disabled]),
      [textoInicial, false], 'deshacer recupera la fuente previa y rehacer sigue disponible');
    await page.evaluate(() => document.querySelector('#edicion [data-accion="rehacer"]').click());
    await page.waitForFunction(v => cmg.codigo.value === v, texto);
    eq(await page.evaluate(() => [cmg.codigo.value, document.querySelector('#edicion [data-accion="deshacer"]').disabled]),
      [texto, false], 'rehacer recupera el documento sin cambios de interfaz en su historial');

    // El cambio de lenguaje del programa reconstruye el interior; la nueva instancia debe seguir oyendo cmg:idioma.
    await page.selectOption('#sel-lenguaje', 'python', { force: true });
    await page.waitForFunction(() => cmg.editor.documento().lenguaje === 'python');
    await porAPI('en');
    eq(await page.evaluate(() => {
      const botones = [...document.querySelectorAll('#edicion [data-accion]')].filter(b => b.dataset.accion !== 'teclado');
      return [cmg.editor.documento().lenguaje, botones.every(b => b.getAttribute('aria-label') === CMGI18n.t(`editor.accion.${b.dataset.accion}`))];
    }), ['python', true], 'tras reconstruir el editor, la nueva barra también responde al cambio de idioma');
  } finally {
    if (almacenamientoInicial) {
      await page.evaluate(estado => {
        localStorage.clear();
        for (const [k, v] of Object.entries(estado)) localStorage.setItem(k, v);
      }, almacenamientoInicial);
      await page.goto(`${origen}/`);
    }
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }
  console.log(`${checks} comprobaciones de editor i18n correctas`);
  return checks;
}
