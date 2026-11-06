// Regresiones de idioma de interfaz que cruzan el programa guardado y el Ajustes móvil.
// Usa el adaptador page.cdp de las suites de navegador existentes.
import assert from 'node:assert/strict';

export async function probarIdiomasBordes(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, mensaje) => {
    assert.deepEqual(a, b, mensaje);
    console.log(`OK bordes idioma ${++checks}: ${mensaje}`);
  };
  const urlJuego = `${origen}/Prototypes/Rocket%20Launcher/?forma=movil`;
  const claveIdioma = 'cmg-interfaz-idioma';
  const textoJS = 'await esperar(0.25);\n';
  const textoPython = '# fuente Python de QA\nesperar(0.25)\n';
  const notaEnExtendida = Array(7).fill(
    'This longer settings description checks that translated text wraps while the language buttons, editor choices, saved program, and screen controls remain available at a narrow mobile width.'
  ).join(' ');
  let almacenamientoInicial;

  await page.cdp('Emulation.setDeviceMetricsOverride', {
    width: 393, height: 852, deviceScaleFactor: 1, mobile: true,
  });
  await page.goto(`${origen}/`);
  await page.waitForFunction(() => !!window.CMGI18n && !!document.querySelector('.intro'));
  almacenamientoInicial = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))
  );

  try {
    // Textos exactos de portada en ambos idiomas, independientes del catálogo como oracle.
    await page.click('[data-idioma-interfaz="es"]');
    eq(await page.evaluate(() => document.querySelector('.intro').textContent),
      'Un robot, una defensa, un programa tuyo. Elige dónde empezar.', 'portada: intro exacta en español');
    await page.click('[data-idioma-interfaz="en"]');
    eq(await page.evaluate(() => document.querySelector('.intro').textContent),
      'A robot, a defense, a program of your own. Choose where to start.', 'portada: intro exacta en inglés');

    await page.goto(urlJuego);
    await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.editor);
    const abrirAjustes = async () => {
      if (await page.evaluate(() => document.querySelector('#ajustes').open)) return;
      await page.click('#b-menu-cod');
      await page.click('#menu-cod [data-menu="ajustes"]');
      await page.waitForFunction(() => document.querySelector('#ajustes').open);
    };
    await abrirAjustes();
    await page.click('#ajustes [data-idioma-interfaz="es"]');
    eq(await page.evaluate(() => [
      document.querySelector('#ajustes-titulo').textContent,
      document.querySelector('#ajustes [data-i18n="ajustes.nota_idioma"]').textContent,
    ]), [
      'Ajustes',
      'La portada, Ajustes y los controles principales están traducidos. Algunos contenidos y ayudas del juego siguen pendientes.',
    ], 'Ajustes: título y nota exactos en español');
    await page.click('#ajustes [data-idioma-interfaz="en"]');
    eq(await page.evaluate(() => [
      document.querySelector('#ajustes-titulo').textContent,
      document.querySelector('#ajustes [data-i18n="ajustes.nota_idioma"]').textContent,
    ]), [
      'Settings',
      'The home page, Settings, and main controls are translated. Some game content and help are still pending translation.',
    ], 'Ajustes: título y nota exactos en inglés');

    // Guarda una fuente JS y una Python por los controles del juego, y fija un snapshot estable.
    await page.evaluate(texto => {
      __banco.elegirReto(0);
      const id = Object.keys(__banco.programas)[0];
      window.__idiomasBordesId = id;
      __banco.abrirPrograma(id);
      cmg.codigo.value = texto;
      cmg.codigo.dispatchEvent(new Event('input', { bubbles: true }));
    }, textoJS);
    await page.waitForTimeout(400);
    await page.click('#ajustes [data-lenguaje-programa="python"]');
    await page.waitForFunction(() => cmg.editor.documento().lenguaje === 'python');
    await page.evaluate(texto => {
      cmg.codigo.value = texto;
      cmg.codigo.dispatchEvent(new Event('input', { bubbles: true }));
    }, textoPython);
    await page.waitForTimeout(400);

    const estado = () => page.evaluate(() => {
      const id = window.__idiomasBordesId;
      return {
        js: __banco.programas[id],
        python: __banco.fuentes[id]?.texto,
        fuenteActiva: cmg.codigo.value,
        lenguaje: cmg.editor.documento().lenguaje,
        vista: document.querySelector('#app').dataset.modo || 'js',
        guardados: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'cmg-interfaz-idioma').sort().map(k => [k, localStorage.getItem(k)])),
      };
    });
    const basePython = await estado();
    eq([basePython.js, basePython.python, basePython.fuenteActiva, basePython.lenguaje],
      [textoJS, textoPython, textoPython, 'python'], 'Python conserva sus fuentes y no altera el JavaScript guardado');

    for (const idioma of ['es', 'en', 'es', 'en']) {
      await page.click(`#ajustes [data-idioma-interfaz="${idioma}"]`);
      const despues = await estado();
      eq([despues.fuenteActiva, despues.lenguaje, despues.vista, despues.js, despues.python, despues.guardados],
        [basePython.fuenteActiva, basePython.lenguaje, basePython.vista, basePython.js, basePython.python, basePython.guardados],
        `cambio de interfaz a ${idioma} conserva Python, JavaScript y guardados`);
    }

    // Pasar a la vista seudocódigo vuelve a mostrar el mismo fuente JavaScript.
    await page.click('#ajustes [data-modo-codigo="pseudo"]');
    await page.waitForFunction(() => document.querySelector('#app').dataset.modo === 'pseudo');
    await page.waitForTimeout(400);
    const baseSeudo = await estado();
    eq([baseSeudo.js, baseSeudo.python, baseSeudo.fuenteActiva, baseSeudo.lenguaje, baseSeudo.vista],
      [textoJS, textoPython, textoJS, 'js', 'pseudo'], 'seudocódigo es otra vista y preserva las fuentes JS y Python');
    for (const idioma of ['es', 'en', 'es']) {
      await page.click(`#ajustes [data-idioma-interfaz="${idioma}"]`);
      const despues = await estado();
      eq([despues.fuenteActiva, despues.lenguaje, despues.vista, despues.js, despues.python, despues.guardados],
        [baseSeudo.fuenteActiva, baseSeudo.lenguaje, baseSeudo.vista, baseSeudo.js, baseSeudo.python, baseSeudo.guardados],
        `cambio de interfaz a ${idioma} conserva seudocódigo y guardados`);
    }

    // Añade una traducción larga solo en este documento. Navegar al final restaura los catálogos.
    eq(await page.evaluate(texto => CMGI18n.registrar('en', { 'ajustes.nota_idioma': texto }), notaEnExtendida),
      true, 'registrar acepta el texto inglés de prueba');
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 852, deviceScaleFactor: 1, mobile: true });
    for (const ancho of [320, 393]) {
      if (ancho !== 320) {
        await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 852, deviceScaleFactor: 1, mobile: true });
      }
      for (const idioma of ['es', 'en']) {
        await page.click(`#ajustes [data-idioma-interfaz="${idioma}"]`);
        const esperadoNota = idioma === 'en' ? notaEnExtendida
          : 'La portada, Ajustes y los controles principales están traducidos. Algunos contenidos y ayudas del juego siguen pendientes.';
        eq(await page.evaluate(() => document.querySelector('#ajustes [data-i18n="ajustes.nota_idioma"]').textContent),
          esperadoNota, `Ajustes móvil ${ancho}px aplica el texto ${idioma} esperado`);

        const geometria = await page.evaluate(() => {
          const dialogo = document.querySelector('#ajustes');
          const r = dialogo.getBoundingClientRect();
          const controles = [...dialogo.querySelectorAll('button, input:not([type="hidden"]), select, a[href]')]
            .filter(el => !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
          const recortados = controles.filter(el => {
            const c = el.getBoundingClientRect();
            return c.width <= 0 || c.left < r.left - 1 || c.right > r.right + 1 || c.left < -1 || c.right > innerWidth + 1;
          }).map(el => el.id || el.getAttribute('data-idioma-interfaz') || el.tagName.toLowerCase());
          return {
            anchoVentana: innerWidth,
            scrollDocumento: document.documentElement.scrollWidth,
            dialogoAbierto: dialogo.open,
            dialogoDentro: r.left >= -1 && r.right <= innerWidth + 1,
            scrollHorizontalDialogo: dialogo.scrollWidth > dialogo.clientWidth + 1,
            controlesRecortados: recortados,
          };
        });
        eq([
          geometria.anchoVentana === ancho,
          geometria.scrollDocumento === geometria.anchoVentana,
          geometria.dialogoAbierto,
          geometria.dialogoDentro,
          geometria.scrollHorizontalDialogo,
          geometria.controlesRecortados,
        ], [true, true, true, true, false, []], `Ajustes y controles caben sin clipping horizontal a ${ancho}px en ${idioma}`);

        // El final del diálogo debe seguir siendo alcanzable aunque la nota inglesa alargue la hoja.
        await page.click('#ajustes-reparto');
        eq(await page.evaluate(() => {
          const d = document.querySelector('#ajustes').getBoundingClientRect();
          const c = document.querySelector('#ajustes-reparto').getBoundingClientRect();
          return document.querySelector('#ajustes').open && c.width > 0 && c.left >= d.left - 1 && c.right <= d.right + 1 && c.top >= d.top && c.bottom <= d.bottom;
        }), true, `control final de Ajustes alcanzable a ${ancho}px en ${idioma}`);
      }
    }
  } finally {
    // Restablece preferencias/guardados byte por byte y carga catálogos limpios en un documento nuevo.
    await page.evaluate(estado => {
      localStorage.clear();
      for (const [k, v] of Object.entries(estado)) localStorage.setItem(k, v);
    }, almacenamientoInicial);
    await page.goto(`${origen}/`);
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }

  console.log(`${checks} comprobaciones de bordes i18n correctas`);
  return checks;
}
