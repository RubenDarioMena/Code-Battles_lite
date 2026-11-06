// Cambiar el idioma de la interfaz nunca debe convertir ni reiniciar el programa.
// Importar con el mismo adaptador page.cdp que las suites de navegador existentes.
import assert from 'node:assert/strict';

export async function probarIdiomas(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, mensaje) => { assert.deepEqual(a, b, mensaje); console.log(`OK idiomas ${++checks}: ${mensaje}`); };
  const idioma = () => page.evaluate(() => [CMGI18n.idioma, document.documentElement.lang]);
  // También detecta textos nuevos que alguien olvide extraer: comprobar solo
  // nodos marcados permitiría añadir accidentalmente español fijo en estas zonas.
  const textosSinMarcar = selector => page.evaluate(selector => {
    const raiz = document.querySelector(selector), pendientes = [];
    const marcas = new Set(['CBL', 'Code Battle', 'Lite', 'Code Battle Lite', 'ES', 'EN']);
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let nodo;
    while ((nodo = walker.nextNode())) {
      const padre = nodo.parentElement, texto = nodo.textContent.trim();
      if (!texto || marcas.has(texto) || /^[\d\s×←→↗⚙·]+$/.test(texto)) continue;
      if (padre.closest('[data-i18n], script, style, svg, [aria-hidden="true"], #ajustes-orientacion-nota, #ajustes-pantalla-estado')) continue;
      pendientes.push(texto);
    }
    return pendientes;
  }, selector);
  const marcadoCorrecto = () => page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-title], [data-i18n-content]')].every(el => {
    for (const atributo of ['textContent', 'aria-label', 'title', 'content']) {
      const clave = el.getAttribute(atributo === 'textContent' ? 'data-i18n' : `data-i18n-${atributo}`);
      if (clave && (atributo === 'textContent' ? el.textContent : el.getAttribute(atributo)) !== CMGI18n.t(clave)) return false;
    }
    return true;
  }));
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${origen}/`);
  const anterior = await page.evaluate(() => localStorage.getItem('cmg-interfaz-idioma'));
  try {
    await page.evaluate(() => localStorage.removeItem('cmg-interfaz-idioma'));
    await page.reload();
    eq(await idioma(), ['es', 'es'], 'español por defecto');
    eq(await page.evaluate(() => document.querySelector('.intro').textContent), 'Un robot, una defensa, un programa tuyo. Elige dónde empezar.', 'portada española conservada');
    eq(await textosSinMarcar('body'), [], 'portada: todos los textos de interfaz tienen clave');
    const enlaces = await page.evaluate(() => [...document.querySelectorAll('.cuadro')].map(el => el.getAttribute('href')));
    await page.click('[data-idioma-interfaz="en"]');
    eq(await idioma(), ['en', 'en'], 'selector de portada cambia idioma y lang');
    eq(await marcadoCorrecto(), true, 'texto y atributos de portada en el catálogo elegido');
    eq(await page.evaluate(() => [...document.querySelectorAll('.cuadro')].map(el => el.getAttribute('href'))), enlaces, 'los enlaces de juegos no se traducen');
    eq(await page.evaluate(() => document.querySelectorAll('.ilustracion').length), 3, 'la traducción conserva las ilustraciones');
    await page.reload();
    eq(await idioma(), ['en', 'en'], 'idioma persistente tras recargar');
    for (const width of [320, 393, 768]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true });
      eq(await page.evaluate(ancho => innerWidth === ancho && document.documentElement.scrollWidth === innerWidth && [...document.querySelectorAll('[data-idioma-interfaz]')].every(el => el.getBoundingClientRect().width > 25), width), true, `selector y portada inglesa sin desborde a ${width}px`);
    }
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const serie of ['', 'factory']) {
      const nombre = serie || 'war';
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?${serie ? 'serie=factory&' : ''}forma=escritorio`);
      await page.waitForFunction(() => window.__juegoListo && window.cmg?.editor);
      eq(await idioma(), ['en', 'en'], `${nombre}: idioma compartido con portada`);
      await page.evaluate(() => {
        const b = window.__banco;
        b.elegirReto(0);
        b.programas[Object.keys(b.programas)[0]] = '// idioma: conservar código\nawait esperar(0.5);';
        b.abrirPrograma(Object.keys(b.programas)[0]);
        cmg.seudo.aplicarModo('js');
        cmg.edicion.activar(false);
        cmg.codigo.setSelectionRange(3, 9);
        window.__estadoIdiomas = {
          mundo: b.mundo, cmg, editor: cmg.editor, codigo: cmg.codigo,
          texto: cmg.codigo.value, programas: JSON.stringify(b.programas),
        };
      });
      await page.click('#b-ajustes');
      eq(await page.evaluate(() => document.querySelector('#ajustes-titulo').textContent), 'Settings', `${nombre}: Ajustes abre en inglés`);
      eq(await textosSinMarcar('#ajustes'), [], `${nombre}: Ajustes no contiene textos fijos sin extraer`);
      // Abrir Ajustes sincroniza controles (p. ej. confirmar Replace); tomar la
      // referencia después de esa acción para aislar únicamente el cambio de idioma.
      await page.evaluate(() => {
        window.__estadoIdiomas.controles = [...document.querySelectorAll('#ajustes input, #ajustes select')].map(el => [el, el.value, el.checked]);
        window.__estadoIdiomas.almacenamiento = JSON.stringify(Object.keys(localStorage).filter(k => k !== 'cmg-interfaz-idioma').sort().map(k => [k, localStorage.getItem(k)]));
      });
      for (const siguiente of ['es', 'en', 'es', 'en']) await page.click(`#ajustes [data-idioma-interfaz="${siguiente}"]`);
      eq(await marcadoCorrecto(), true, `${nombre}: cambio repetido traduce texto y accesibilidad`);
      eq(await page.evaluate(() => {
        const s = window.__estadoIdiomas;
        return __banco.mundo === s.mundo && cmg === s.cmg && cmg.editor === s.editor && cmg.codigo === s.codigo && cmg.codigo.value === s.texto && JSON.stringify(__banco.programas) === s.programas;
      }), true, `${nombre}: mismos objetos, programa y partida tras los cambios`);
      eq(await page.evaluate(() => window.__estadoIdiomas.controles.every(([el, valor, checked]) => el.isConnected && el.value === valor && el.checked === checked)), true, `${nombre}: controles y preferencias intactos`);
      eq(await page.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k !== 'cmg-interfaz-idioma').sort().map(k => [k, localStorage.getItem(k)])) === window.__estadoIdiomas.almacenamiento), true, `${nombre}: ninguna clave de guardado cambia salvo el idioma de interfaz`);
      // Los textos dinámicos se vuelven a calcular después de cambiar una preferencia.
      await page.selectOption('#ajustes-orientacion', 'vertical');
      eq(await page.evaluate(() => document.querySelector('#ajustes-orientacion-nota').textContent), 'The panels will always appear one above the other.', `${nombre}: nota dinámica en inglés`);
      await page.click('#ajustes [data-idioma-interfaz="es"]');
      eq(await page.evaluate(() => document.querySelector('#ajustes-orientacion-nota').textContent), 'Los paneles se mostrarán siempre uno encima del otro.', `${nombre}: nota dinámica vuelve al español`);
      await page.click('#ajustes-cerrar');
      // Cambiar por API no debe quitar el foco ni alterar selección o scroll del editor.
      await page.evaluate(() => { cmg.codigo.focus(); cmg.codigo.setSelectionRange(3, 9); CMGI18n.cambiarIdioma('en'); });
      eq(await page.evaluate(() => [document.activeElement === cmg.codigo, cmg.codigo.selectionStart, cmg.codigo.selectionEnd]), [true, 3, 9], `${nombre}: selección y foco conservados`);
      await page.reload();
      await page.waitForFunction(() => window.__juegoListo);
      eq(await idioma(), ['en', 'en'], `${nombre}: recarga del juego conserva interfaz inglesa`);
    }
    // El selector no debe parar ni sustituir una ejecución real en el Worker.
    await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio`);
    await page.waitForFunction(() => window.__juegoListo);
    await page.evaluate(() => {
      __banco.elegirReto(0);
      __banco.programas['LAU-01'] = 'while (true) { console.log("idioma-worker"); await esperar(0.5); }';
      __banco.abrirPrograma('LAU-01');
      document.querySelector('[data-vista="2d"]').click();
      __banco.ejecutar();
    });
    await page.waitForFunction(() => cmg.ejecutando && __banco.mundo.t > .1 && document.querySelector('#consola').textContent.includes('idioma-worker'));
    await page.evaluate(() => { window.__mundoIdiomas = __banco.mundo; window.__tiempoIdiomas = __banco.mundo.t; });
    await page.click('#b-ajustes');
    await page.click('#ajustes [data-idioma-interfaz="es"]');
    eq(await page.evaluate(() => cmg.ejecutando && cmg.codigo.readOnly && __banco.mundo === window.__mundoIdiomas && __banco.mundo.t >= window.__tiempoIdiomas), true, 'el cambio desde Ajustes conserva la ejecución del Worker');
    await page.click('#ajustes-cerrar');
    await page.click('#b-ejecutar');
    await page.waitForFunction(() => !cmg.ejecutando);
  } finally {
    await page.evaluate(v => { if (v === null) localStorage.removeItem('cmg-interfaz-idioma'); else localStorage.setItem('cmg-interfaz-idioma', v); }, anterior);
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }
  console.log(`${checks} comprobaciones de idiomas correctas`);
  return checks;
}
