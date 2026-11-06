// El formulario de «Tu reto» cambia de idioma sin reconstruir ni guardar el borrador.
import assert from 'node:assert/strict';

export async function probarIdiomasFormulario(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK idiomas formulario ${++checks}: ${mensaje}`);
  };
  const base = `${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio&serie=factory&reto=propio`;
  const viewport = async (ancho, movil) => {
    await page.cdp('Emulation.setDeviceMetricsOverride', {
      width: ancho, height: movil ? 852 : 900, deviceScaleFactor: 1, mobile: movil,
    });
    await page.waitForFunction(({ w, m }) => innerWidth === w && matchMedia('(max-width: 650px)').matches === m,
      { w: ancho, m: movil });
  };

  await page.goto(`${origen}/`);
  await page.waitForFunction(() => !!window.CMGI18n);
  const almacenamiento = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  try {
    await page.goto(base);
    await page.waitForFunction(() => window.__juegoListo && !!document.querySelector('#rf-objetivo'));
    await viewport(1366, false);
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
    await page.click('#t-escenario');
    await page.click('#rf-objetivo');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#rf-objetivo'));

    const previo = await page.evaluate(() => {
      const objetivo = document.querySelector('#rf-objetivo');
      objetivo.value = 'Enviar 4 piezas editadas';
      objetivo.focus();
      objetivo.setSelectionRange(7, 11);
      document.querySelector('#rf-titulo').value = 'Prueba de borrador';
      document.querySelector('#rf-tiempoMax').value = '42';
      const tipo = document.querySelector('#esc-form [data-k="tipo"]');
      tipo.value = 'entregar';
      const refs = [...document.querySelectorAll('#esc-form input, #esc-form select, #esc-form textarea, #esc-form button, #esc-form [data-formulario-i18n]')];
      const optionValues = [...document.querySelectorAll('#esc-form select')].map(s => [...s.options].map(o => o.value));
      const mapLabels = [...document.querySelectorAll('#rf-base option')].map(o => o.textContent);
      window.__qaFormulario = { refs, objetivo, tipo, optionValues, mapLabels };
      return { objetivo: objetivo.value, titulo: document.querySelector('#rf-titulo').value,
        limite: document.querySelector('#rf-tiempoMax').value, seleccion: [7, 11],
        tipo: tipo.value, etiquetaTipo: tipo.selectedOptions[0].textContent,
        etiquetaGuardar: document.querySelector('#rf-guardar').textContent,
        etiquetaObjetivo: objetivo.labels[0].textContent.trim(), optionValues, mapLabels };
    });
    eq([previo.tipo, previo.etiquetaTipo, previo.etiquetaGuardar],
      ['entregar', 'llegar a', 'Guardar y jugar'], 'la base española conserva valores y etiquetas iniciales');

    for (const idioma of ['en', 'es']) {
      const actual = await page.evaluate(i => {
        CMGI18n.cambiarIdioma(i);
        const r = window.__qaFormulario, objetivo = document.querySelector('#rf-objetivo');
        const refs = [...document.querySelectorAll('#esc-form input, #esc-form select, #esc-form textarea, #esc-form button, #esc-form [data-formulario-i18n]')];
        return {
          mismosNodos: refs.length === r.refs.length && refs.every((n, j) => n === r.refs[j]),
          foco: document.activeElement === r.objetivo,
          seleccion: [objetivo.selectionStart, objetivo.selectionEnd],
          objetivo: objetivo.value, titulo: document.querySelector('#rf-titulo').value,
          limite: document.querySelector('#rf-tiempoMax').value,
          tipo: r.tipo.value, etiquetaTipo: r.tipo.selectedOptions[0].textContent,
          etiquetaGuardar: document.querySelector('#rf-guardar').textContent,
          etiquetaObjetivo: objetivo.labels[0].textContent.trim(),
          optionValues: [...document.querySelectorAll('#esc-form select')].map(s => [...s.options].map(o => o.value)),
          mapLabels: [...document.querySelectorAll('#rf-base option')].map(o => o.textContent),
        };
      }, idioma);
      eq([actual.mismosNodos, actual.foco, actual.seleccion, actual.objetivo, actual.titulo, actual.limite,
        actual.tipo, actual.optionValues, actual.mapLabels],
      [true, true, previo.seleccion, previo.objetivo, previo.titulo, previo.limite, previo.tipo,
        previo.optionValues, previo.mapLabels], `${idioma}: conserva nodos, foco, selección, borrador y valores funcionales`);
      eq(idioma === 'en' ? [actual.etiquetaTipo, actual.etiquetaGuardar, actual.etiquetaObjetivo]
        : [actual.etiquetaTipo, actual.etiquetaGuardar, actual.etiquetaObjetivo],
      idioma === 'en' ? ['deliver to', 'Save and play', 'What you ask for (shown above as the objective)']
        : ['llegar a', 'Guardar y jugar', 'Lo que pides (aparece arriba como objetivo)'],
      `${idioma}: traduce etiquetas y opciones del formulario en sitio`);
    }

    // La misma hoja se actualiza en viewport móvil sin alterar su borrador ni la estructura.
    await viewport(393, true);
    const movil = await page.evaluate(() => {
      const refs = [...document.querySelectorAll('#esc-form input, #esc-form select, #esc-form textarea, #esc-form button')];
      window.__qaFormularioMovil = refs;
      return { labels: document.querySelector('#rf-guardar').textContent,
        valores: [document.querySelector('#rf-objetivo').value, document.querySelector('#rf-tiempoMax').value],
        alcanzable: document.querySelector('#rf-guardar').getBoundingClientRect().width > 0 };
    });
    eq([movil.labels, movil.valores, movil.alcanzable],
      ['Guardar y jugar', [previo.objetivo, previo.limite], true], '393 px: formulario español, borrador y acción accesible');

    // Guardar en inglés comprueba que el botón sigue delegado y que el contenido guardado no se traduce.
    await page.evaluate(() => CMGI18n.cambiarIdioma('en'));
    await page.click('#rf-guardar');
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('cmg-banco03:factory-propio')));
    eq([guardado.objetivo, guardado.titulo, guardado.tiempoMax],
      [previo.objetivo, previo.titulo, 42], 'guardar tras cambiar de idioma conserva el borrador y sus datos');
  } finally {
    await page.evaluate(datos => {
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
    }, almacenamiento);
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }
  return checks;
}
