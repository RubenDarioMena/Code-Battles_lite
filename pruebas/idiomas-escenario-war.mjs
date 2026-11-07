// El idioma del formulario War solo cambia presentación, incluido el estado de copia de JSON.
import assert from 'node:assert/strict';

export async function probarIdiomasEscenarioWar(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK idiomas escenario War ${++checks}: ${mensaje}`);
  };
  const base = `${origen}/Prototypes/Rocket%20Launcher/`;
  const errores = [];
  await page.cdp('Page.enable');
  const { identifier } = await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__qaErroresEscenario = [];
    window.addEventListener('error', e => __qaErroresEscenario.push(e.message));
    window.addEventListener('unhandledrejection', e => __qaErroresEscenario.push(String(e.reason)));
  ` });
  await page.goto(origen);
  const almacenamiento = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  try {
    await page.goto(base);
    await page.waitForFunction(() => window.__juegoListo && !!document.querySelector('#esc-titulo'));
    await page.evaluate(() => __banco.elegirReto(0));
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
    await page.click('#t-escenario');
    const fijo = await page.evaluate(() => {
      window.__qaEscenarioFijo = { titulo: document.querySelector('#esc-titulo'), mundo: __banco.mundo };
      CMGI18n.cambiarIdioma('en');
      return [document.querySelector('#esc-copiar-reto').textContent,
        document.querySelector('#esc-titulo').matches(':disabled'),
        document.querySelector('#esc-titulo') === __qaEscenarioFijo.titulo,
        __banco.mundo === __qaEscenarioFijo.mundo];
    });
    eq(fijo, ['Use as the basis for Your scenario', true, true, true],
      'el reto fijo traduce su aviso conservando controles deshabilitados y mundo');
    const tituloFijo = await page.evaluate(() => document.querySelector('#esc-titulo').value);
    await page.click('#esc-copiar-reto span');
    eq(await page.evaluate(() => [document.querySelector('#esc-titulo').matches(':disabled'),
      document.querySelector('#esc-titulo').value, document.querySelector('#esc-guardar').textContent]),
    [false, `${tituloFijo} (mío)`, 'Save and play'],
    'copiar desde la etiqueta traducida abre el escenario editable sin traducir su contenido');

    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
    const previo = await page.evaluate(() => {
      const objetivo = document.querySelector('#esc-objetivo');
      document.querySelector('#esc-titulo').value = 'Escenario de prueba';
      objetivo.value = 'Defender el mapa sin perder mis datos';
      objetivo.focus(); objetivo.setSelectionRange(9, 16);
      document.querySelector('#esc-tiempo').value = '42';
      document.querySelector('#esc-atascos').value = '';
      document.querySelector('#esc-lanzadores').value = '2';
      document.querySelector('#esc-niebla').checked = true;
      document.querySelector('#esc-vib').checked = true;
      document.querySelector('#esc-oleadas [data-k="n"]').value = '7';
      const json = document.querySelector('#esc-json');
      json.value = '{"titulo":"Mi borrador JSON"}';
      json.closest('details').open = true;
      const leer = () => ({
        valores: [...document.querySelectorAll('#esc-form input, #esc-form select, #esc-form textarea')].map(n => [n.value, n.checked ?? null]),
        opciones: [...document.querySelectorAll('#esc-form select')].map(n => [...n.options].map(o => o.value)),
        seleccion: [objetivo.selectionStart, objetivo.selectionEnd],
        detalles: json.closest('details').open,
        guardados: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'cmg-interfaz-idioma')),
        programas: JSON.stringify(__banco.fuentes),
      });
      const nodos = [...document.querySelectorAll('#esc-form *')];
      window.__qaEscenario = { objetivo, nodos, leer, mundo: __banco.mundo };
      return leer();
    });
    for (const idioma of ['en', 'es', 'en']) {
      const actual = await page.evaluate(i => {
        CMGI18n.cambiarIdioma(i);
        const r = __qaEscenario;
        return { datos: r.leer(), foco: document.activeElement === r.objetivo,
          nodos: [...document.querySelectorAll('#esc-form *')].every((n, j) => n === r.nodos[j]),
          mundo: __banco.mundo === r.mundo,
          textos: [document.querySelector('#esc-guardar').textContent,
            document.querySelector('#esc-lanzadores').selectedOptions[0].textContent,
            document.querySelector('#esc-json').getAttribute('aria-label'),
            document.querySelector('#esc-oleadas [data-k="carriles"]').labels[0].textContent],
        };
      }, idioma);
      eq([actual.datos, actual.foco, actual.nodos, actual.mundo], [previo, true, true, true],
        `${idioma}: conserva borrador completo, nodos, foco, selección, datos, programas y mundo`);
      eq(actual.textos, idioma === 'en'
        ? ['Save and play', '2 · LAU-01 and LAU-02', 'Scenario as JSON', 'Lanes (rows 0–17)']
        : ['Guardar y jugar', '2 · LAU-01 y LAU-02', 'Escenario en JSON', 'Carriles (filas 0–17)'],
      `${idioma}: traduce etiquetas, opciones descriptivas y accesibilidad del JSON`);
    }

    const filas = await page.evaluate(() => document.querySelectorAll('#esc-oleadas .ola').length);
    await page.click('#esc-mas span');
    eq(await page.evaluate(() => [document.querySelectorAll('#esc-oleadas .ola').length,
      document.querySelector('#esc-oleadas .ola:last-child [data-k="n"]').labels[0].textContent,
      document.querySelector('#esc-oleadas [data-k="n"]').value, document.querySelector('#esc-titulo').value]),
    [filas + 1, 'How many', '7', 'Escenario de prueba'], 'añadir oleada en inglés conserva lo editado y traduce la fila nueva');
    await page.click('#esc-oleadas .ola:last-child [data-quitar] span');
    eq(await page.evaluate(() => document.querySelectorAll('#esc-oleadas .ola').length), filas, 'quitar desde una etiqueta interna sigue funcionando');

    await page.evaluate(() => { document.querySelector('#esc-json').closest('details').open = true; });
    await page.fill('#esc-json', '<img src=x onerror=alert(1)>');
    await page.click('#esc-json-aplicar span');
    eq(await page.evaluate(() => [document.querySelector('#esc-json-msg [data-i18n]').textContent,
      !!document.querySelector('#esc-json-msg img')]), ['This is not valid JSON', false],
    'JSON inválido presenta el error localizado como texto');
    eq(await page.evaluate(() => {
      const detalle = document.querySelector('#esc-json-msg span:last-child').textContent;
      CMGI18n.cambiarIdioma('es');
      return [document.querySelector('#esc-json-msg [data-i18n]').textContent,
        document.querySelector('#esc-json-msg span:last-child').textContent === detalle,
        document.querySelector('#esc-json').value];
    }), ['No es un JSON válido', true, '<img src=x onerror=alert(1)>'],
    'el error abierto cambia de idioma conservando detalle técnico y JSON');

    // Portapapeles controlado para comprobar el contenido y el temporizador de la acción real.
    await page.evaluate(() => {
      const qa = window.__qaEscCopia = { originalTimeout: window.setTimeout,
        clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'), timers: 0, texto: null };
      Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: texto => { qa.texto = texto; return Promise.resolve(); } } });
      window.setTimeout = (fn, ms, ...args) => {
        if (ms === 1500) qa.timers++;
        return qa.originalTimeout.call(window, fn, ms, ...args);
      };
    });
    await page.click('#esc-json-copiar');
    await page.waitForFunction(() => document.querySelector('#esc-json-copiar').textContent === 'Copiado');
    eq(await page.evaluate(() => {
      CMGI18n.cambiarIdioma('en'); CMGI18n.cambiarIdioma('es'); CMGI18n.cambiarIdioma('en');
      const copiado = JSON.parse(__qaEscCopia.texto);
      return [document.querySelector('#esc-json-copiar').textContent, __qaEscCopia.timers,
        copiado.titulo, copiado.objetivo, copiado.oleadas[0].n, copiado.lanzadores.map(l => l.id),
        copiado.metas.atascosMax, copiado.niebla];
    }), ['Copied', 1, 'Escenario de prueba', 'Defender el mapa sin perder mis datos', 7, ['LAU-01', 'LAU-02'], null, true],
    'cambiar idioma conserva Copiado, un único temporizador y el JSON con sus valores originales');
    await page.waitForFunction(() => document.querySelector('#esc-json-copiar').textContent === 'Copy JSON');
    eq(await page.evaluate(() => __qaEscCopia.timers), 1, 'el temporizador original restaura la etiqueta en el idioma actual');

    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('QA sin permiso')); });
    await page.click('#esc-json-copiar');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#esc-json'));
    eq(await page.evaluate(() => [document.querySelector('#esc-json').closest('details').open,
      JSON.parse(document.querySelector('#esc-json').value).titulo,
      document.querySelector('#esc-json').selectionEnd === document.querySelector('#esc-json').value.length]),
    [true, 'Escenario de prueba', true], 'sin portapapeles sigue disponible el JSON seleccionado para copiar');

    for (const ancho of [320, 393]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 852, deviceScaleFactor: 1, mobile: true });
      await page.waitForFunction(w => innerWidth === w && document.querySelector('#app').dataset.forma === 'movil', ancho);
      eq(await page.evaluate(() => {
        const titulo = document.querySelector('#esc-titulo'), boton = document.querySelector('#esc-guardar');
        CMGI18n.cambiarIdioma('es'); CMGI18n.cambiarIdioma('en');
        const ancho = document.querySelector('#v-escenario').getBoundingClientRect().width;
        return [document.querySelector('#esc-titulo') === titulo, titulo.value, boton.textContent,
          boton.getBoundingClientRect().width > 0 && boton.getBoundingClientRect().width <= ancho];
      }), [true, 'Escenario de prueba', 'Save and play', true], `${ancho} px: cambio de idioma y acción de guardado conservan el borrador`);
      eq(await page.evaluate(() => {
        const formulario = document.querySelector('#esc-form');
        return formulario.scrollWidth <= formulario.clientWidth + 1;
      }), true, `${ancho} px: las oleadas y el formulario inglés caben sin desplazamiento horizontal`);
    }
    await page.click('#esc-guardar span');
    eq(await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('cmg-banco03:propio'));
      return [d.titulo, d.objetivo, d.metas.tiempoMax, d.metas.atascosMax, d.oleadas[0].n, d.lanzadores.map(l => l.id), d.niebla];
    }), ['Escenario de prueba', 'Defender el mapa sin perder mis datos', 42, null, 7, ['LAU-01', 'LAU-02'], true],
    'guardar en inglés conserva enunciado, metas, oleadas, IDs y opciones del escenario');

    errores.push(...await page.evaluate(() => __qaErroresEscenario));
    await page.cdp('Emulation.clearDeviceMetricsOverride');
    await page.goto(base);
    await page.waitForFunction(() => window.__juegoListo);
    eq(await page.evaluate(() => [document.documentElement.lang, document.querySelector('#esc-guardar').textContent,
      document.querySelector('#esc-titulo').value, document.querySelector('#esc-oleadas [data-k="n"]').value]),
    ['en', 'Save and play', 'Escenario de prueba', '7'], 'la recarga conserva preferencia inglesa, datos y traducción inicial');
    await page.click('#t-escenario');
    const importado = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('cmg-banco03:propio'));
      d.titulo = 'Importación sin traducir'; d.pista = 'Mantén esta pista';
      document.querySelector('#esc-json').closest('details').open = true;
      document.querySelector('#esc-json').value = JSON.stringify(d);
      return d;
    });
    await page.click('#esc-json-aplicar span');
    eq(await page.evaluate(() => JSON.parse(localStorage.getItem('cmg-banco03:propio'))), importado,
      'aplicar JSON válido desde su etiqueta inglesa conserva íntegros los datos importados');
    errores.push(...await page.evaluate(() => __qaErroresEscenario));
    eq(errores, [], 'sin excepciones de navegador durante el formulario War');
  } finally {
    await page.evaluate(datos => {
      if (window.__qaEscCopia) {
        window.setTimeout = __qaEscCopia.originalTimeout;
        if (__qaEscCopia.clipboard) Object.defineProperty(navigator, 'clipboard', __qaEscCopia.clipboard);
        else delete navigator.clipboard;
      }
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
    }, almacenamiento);
    await page.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }
  return checks;
}
