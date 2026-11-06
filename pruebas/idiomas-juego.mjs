// Regresiones del lote de textos del juego y su layout; usa el adaptador page.cdp.
import assert from 'node:assert/strict';

export async function probarIdiomasJuego(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK idiomas juego ${++checks}: ${mensaje}`);
  };
  const base = `${origen}/Prototypes/Rocket%20Launcher/`;
  const claveIdioma = 'cmg-interfaz-idioma';
  let almacenamientoInicial;
  let anchoActual = 1366;
  const textoJS = 'await esperar(0.5);\n';
  const textoBucle = 'while (true) {\n  console.log("idioma-worker");\n  await esperar(0.5);\n}\n';

  const viewport = async (forma, ancho = forma === 'movil' ? 393 : 1366) => {
    anchoActual = ancho;
    await page.cdp('Emulation.setDeviceMetricsOverride', {
      width: ancho, height: forma === 'movil' ? 852 : 900, deviceScaleFactor: 1, mobile: forma === 'movil',
    });
    await page.waitForFunction(({ w, m }) => innerWidth === w && matchMedia('(max-width: 650px)').matches === m, { w: ancho, m: forma === 'movil' });
  };
  const abrirJuego = async (serie = 'war', forma = 'escritorio', ancho) => {
    const q = new URLSearchParams();
    if (serie === 'factory') q.set('serie', 'factory');
    q.set('forma', forma);
    await page.goto(`${base}?${q}`);
    await viewport(forma, ancho);
    await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.editor);
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
  };
  const abrirAjustes = async () => {
    if (await page.evaluate(() => document.querySelector('#ajustes').open)) return;
    if (await page.evaluate(() => getComputedStyle(document.querySelector('#b-ajustes')).display === 'none')) {
      await page.click('#b-menu-cod');
      await page.click('#menu-cod [data-menu="ajustes"]');
    } else await page.click('#b-ajustes');
    await page.waitForFunction(() => document.querySelector('#ajustes').open);
  };
  const cambiarDesdeAjustes = async idioma => page.click(`#ajustes [data-idioma-interfaz="${idioma}"]`);
  const cambiarPorAPI = async idioma => page.evaluate(v => CMGI18n.cambiarIdioma(v), idioma);
  const idiomaEstatica = async serie => {
    const esperadoEs = ['▶ Ejecutar', 'Pausa', 'Reiniciar', 'Programa', 'Registro', 'Órdenes', serie === 'factory' ? 'Tu reto' : 'Escenario'];
    const esperadoEn = ['▶ Run', 'Pause', 'Reset', 'Program', 'Log', 'Commands', serie === 'factory' ? 'Your challenge' : 'Scenario'];
    await cambiarPorAPI('es');
    eq(await page.evaluate(() => [
      document.querySelector('#b-ejecutar').textContent,
      document.querySelector('#b-pausa').textContent,
      document.querySelector('#b-reiniciar').textContent,
      ...['#t-programa', '#t-registro', '#t-ayuda', '#t-escenario'].map(s => document.querySelector(s).textContent),
    ]), esperadoEs, `${serie}: controles y navegación fieles en español`);
    await abrirAjustes();
    await cambiarDesdeAjustes('en');
    eq(await page.evaluate(() => [
      document.documentElement.lang,
      document.querySelector('#b-ejecutar').textContent,
      document.querySelector('#b-pausa').textContent,
      document.querySelector('#b-reiniciar').textContent,
      ...['#t-programa', '#t-registro', '#t-ayuda', '#t-escenario'].map(s => document.querySelector(s).textContent),
    ]), ['en', ...esperadoEn], `${serie}: controles y navegación en inglés`);
  };

  await page.goto(`${origen}/`);
  await page.waitForFunction(() => !!window.CMGI18n);
  almacenamientoInicial = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))
  );

  try {
    // La prueba usa el plano para que el watchdog de Worker no dependa de 3D por software.
    await page.evaluate(() => {
      localStorage.setItem('cmg-banco03:vista', JSON.stringify('2d'));
      localStorage.setItem('cmg-banco03:factory-vista', JSON.stringify('2d'));
    });

    // Textos de los controles y selector de lenguaje en ambas series.
    for (const serie of ['war', 'factory']) {
      await abrirJuego(serie);
      await page.click('[data-vista="2d"]');
      await idiomaEstatica(serie);
      await page.evaluate(() => document.querySelector('#ajustes-cerrar').click());

      await page.evaluate(() => {
        __banco.elegirReto(0);
        const id = Object.keys(__banco.programas)[0];
        window.__idiomasJuegoUnidad = id;
        __banco.abrirPrograma(id);
      });
      await page.selectOption('#sel-lenguaje', 'python');
      await page.waitForFunction(() => cmg.editor.documento().lenguaje === 'python');
      await page.waitForTimeout(400);
      const basePython = await page.evaluate(() => {
        const id = window.__idiomasJuegoUnidad, select = document.querySelector('#sel-lenguaje');
        window.__idiomasJuegoSelectRef = select;
        window.__idiomasJuegoOptionRefs = [...select.querySelectorAll('option, optgroup')];
        return {
          lenguaje: cmg.editor.documento().lenguaje,
          seleccionado: select.value,
          texto: cmg.codigo.value,
          js: __banco.programas[id],
          python: __banco.fuentes[id]?.texto,
          valores: [...select.options].map(o => o.value),
          guardados: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'cmg-interfaz-idioma').sort().map(k => [k, localStorage.getItem(k)])),
        };
      });
      eq([basePython.lenguaje, basePython.seleccionado, basePython.valores.includes('python'), typeof basePython.js, typeof basePython.python],
        ['python', 'python', true, 'string', 'string'], `${serie}: fixture estable en Python antes de cambiar la interfaz`);
      await abrirAjustes();
      for (const idioma of ['es', 'en', 'es', 'en']) {
        await cambiarDesdeAjustes(idioma);
        const despues = await page.evaluate(() => {
          const id = window.__idiomasJuegoUnidad, select = document.querySelector('#sel-lenguaje');
          return {
            lenguaje: cmg.editor.documento().lenguaje,
            seleccionado: select.value,
            texto: cmg.codigo.value,
            js: __banco.programas[id],
            python: __banco.fuentes[id]?.texto,
            selectIgual: select === window.__idiomasJuegoSelectRef,
            opcionesIguales: [...select.querySelectorAll('option, optgroup')].every((o, i) => o === window.__idiomasJuegoOptionRefs[i])
              && select.querySelectorAll('option, optgroup').length === window.__idiomasJuegoOptionRefs.length,
            valores: [...select.options].map(o => o.value),
            guardados: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'cmg-interfaz-idioma').sort().map(k => [k, localStorage.getItem(k)])),
          };
        });
        eq([despues.lenguaje, despues.seleccionado, despues.texto, despues.js, despues.python, despues.selectIgual, despues.opcionesIguales, despues.valores, despues.guardados],
          [basePython.lenguaje, basePython.seleccionado, basePython.texto, basePython.js, basePython.python, true, true, basePython.valores, basePython.guardados],
          `${serie}: cambio de interfaz a ${idioma} conserva Python, opciones y guardados`);
      }
      await page.evaluate(() => document.querySelector('#ajustes-cerrar').click());
      await page.goto(`${origen}/`);
      await page.waitForFunction(() => !!window.CMGI18n);
    }

    // Estados dinámicos del Worker: cambiar idioma no detiene, reanuda ni reemplaza la partida.
    await abrirJuego('war');
    await page.click('[data-vista="2d"]');
    await page.evaluate(() => {
      __banco.elegirReto(0);
      __banco.abrirPrograma('LAU-01');
    });
    // Elegir el reto puede recuperar la fuente Python guardada en el caso anterior.
    // Cambiar el lenguaje de esta unidad antes de introducir el programa JavaScript.
    await page.selectOption('#sel-lenguaje', 'js');
    await page.evaluate(texto => {
      cmg.codigo.value = texto;
      cmg.codigo.dispatchEvent(new Event('input', { bubbles: true }));
    }, textoBucle);
    await page.click('#b-ejecutar');
    await page.waitForFunction(() => cmg.ejecutando && cmg.codigo.readOnly && __banco.mundo.t > 0.1 && document.querySelector('#consola').textContent.includes('idioma-worker'));
    await page.evaluate(() => { window.__idiomasJuegoMundo = __banco.mundo; });
    await abrirAjustes();
    const activoEs = await page.evaluate(() => [
      document.querySelector('#b-ejecutar').textContent, document.querySelector('#b-pausa').textContent,
      cmg.ejecutando, cmg.codigo.readOnly, document.querySelector('#b-pausa').disabled,
      __banco.mundo === window.__idiomasJuegoMundo,
    ]);
    eq(activoEs, ['■ Detener', 'Pausa', true, true, false, true], 'Worker activo en español mantiene ejecución, control y mundo');
    await cambiarDesdeAjustes('en');
    eq(await page.evaluate(() => [
      document.querySelector('#b-ejecutar').textContent, document.querySelector('#b-pausa').textContent,
      cmg.ejecutando, cmg.codigo.readOnly, document.querySelector('#b-pausa').disabled,
      __banco.mundo === window.__idiomasJuegoMundo,
    ]), ['■ Stop', 'Pause', true, true, false, true], 'Worker activo en inglés mantiene ejecución, control y mundo');
    await page.evaluate(() => document.querySelector('#ajustes-cerrar').click());
    await page.click('#b-pausa');
    await page.waitForTimeout(180);
    const tiempoPausado = await page.evaluate(() => __banco.mundo.t);
    await abrirAjustes();
    await cambiarDesdeAjustes('es');
    await page.waitForTimeout(180);
    eq(await page.evaluate(t => [
      document.querySelector('#b-ejecutar').textContent, document.querySelector('#b-pausa').textContent,
      cmg.ejecutando, cmg.codigo.readOnly, document.querySelector('#b-pausa').disabled,
      __banco.mundo === window.__idiomasJuegoMundo, __banco.mundo.t === t,
    ], tiempoPausado), ['■ Detener', 'Seguir', true, true, false, true, true], 'pausa española sobrevive al cambio de idioma y congela el mundo');
    await cambiarDesdeAjustes('en');
    await page.waitForTimeout(180);
    eq(await page.evaluate(t => [
      document.querySelector('#b-ejecutar').textContent, document.querySelector('#b-pausa').textContent,
      cmg.ejecutando, cmg.codigo.readOnly, document.querySelector('#b-pausa').disabled,
      __banco.mundo === window.__idiomasJuegoMundo, __banco.mundo.t === t,
    ], tiempoPausado), ['■ Stop', 'Resume', true, true, false, true, true], 'pausa inglesa conserva controles y mundo congelado');

    // Prueba una traducción hostil en un botón: solo debe entrar como texto plano.
    const hostil = '<img id="qa-idiomas-juego-inyectado" src="x" onerror="window.__qaIdiomasJuegoXss=1">';
    eq(await page.evaluate(texto => CMGI18n.registrar('en', { 'partida.ejecutar.detener': texto }), hostil), true, 'el catálogo acepta el texto hostil de prueba');
    await cambiarDesdeAjustes('es');
    await cambiarDesdeAjustes('en');
    eq(await page.evaluate(texto => [
      document.querySelector('#b-ejecutar').textContent,
      !!document.querySelector('#b-ejecutar img'),
      !!document.querySelector('#qa-idiomas-juego-inyectado'),
      window.__qaIdiomasJuegoXss === 1,
    ], hostil), [hostil, false, false, false], 'la etiqueta del botón se inserta como texto, nunca como HTML');
    await page.evaluate(() => document.querySelector('#ajustes-cerrar').click());
    await page.click('#b-pausa');
    await page.click('#b-ejecutar');
    await page.waitForFunction(() => !cmg.ejecutando && !cmg.codigo.readOnly);

    // El Replace abierto conserva su pregunta, checkbox, nodos, selección y fuentes hasta cancelar.
    await abrirJuego('war');
    await page.click('[data-vista="2d"]');
    eq(await page.evaluate(() => {
      cmg.edicion.activar(true);
      const leer = () => [...document.querySelectorAll('#b-teclado, #b-teclado-movil')].map(b => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')]);
      const antes = leer();
      CMGI18n.cambiarIdioma('en');
      const despues = leer();
      const conserva = cmg.edicion.activo && antes.every(([, pulsado]) => pulsado === 'true')
        && despues.every(([etiqueta, pulsado]) => pulsado === 'true' && etiqueta === CMGI18n.t('editor.teclado.activo.aria'))
        && despues.every(([etiqueta], i) => etiqueta !== antes[i][0]);
      cmg.edicion.activar(false);
      CMGI18n.cambiarIdioma('es');
      return conserva;
    }), true, 'los controles del editor traducen su descripción conservando el modo activo');
    await page.evaluate(() => {
      __banco.elegirReto(4);
      __banco.programas['LAU-01'] = '// fuente uno';
      __banco.programas['LAU-02'] = '// fuente dos';
      __banco.abrirPrograma('LAU-01');
      __banco.seleccionar(['LAU-01', 'LAU-02']);
    });
    await page.fill('#codigo', 'console.log("borrador de QA");');
    const fuentesAntesReplace = await page.evaluate(() => ({
      seleccion: __banco.seleccionadas,
      programas: { ...__banco.programas },
      borrador: cmg.codigo.value,
    }));
    await page.click('#b-replace');
    await page.waitForFunction(() => document.querySelector('#confirmar-replace').open);
    await page.click('#replace-no-preguntar');
    const replaceEs = await page.evaluate(() => {
      const d = document.querySelector('#confirmar-replace');
      const refs = ['#replace-titulo', '#replace-texto', '#replace-no-preguntar', '[value="cancelar"]', '[value="reemplazar"]'].map(s => d.querySelector(s));
      window.__idiomasJuegoReplaceRefs = [d, ...refs];
      window.__idiomasJuegoReplaceFoco = document.activeElement;
      return [d.open, refs[0].textContent, refs[1].textContent, refs[2].checked, __banco.seleccionadas, { ...__banco.programas }, cmg.codigo.value];
    });
    eq([replaceEs[0], replaceEs[1], replaceEs[3], replaceEs[4], replaceEs[5], replaceEs[6]], [true, '¿Sustituir los programas?', true, fuentesAntesReplace.seleccion, fuentesAntesReplace.programas, fuentesAntesReplace.borrador],
      'Replace español mantiene la pregunta, opción marcada y destinos');
    await cambiarPorAPI('en');
    const textoReplaceEs = replaceEs[2];
    eq(await page.evaluate(textoEs => {
      const d = document.querySelector('#confirmar-replace'), refs = window.__idiomasJuegoReplaceRefs;
      const texto = d.querySelector('#replace-texto').textContent;
      return [
        d === refs[0], [...['#replace-titulo', '#replace-texto', '#replace-no-preguntar', '[value="cancelar"]', '[value="reemplazar"]'].map(s => d.querySelector(s))].every((n, i) => n === refs[i + 1]),
        d.open, d.querySelector('#replace-titulo').textContent,
        texto.includes('LAU-01') && texto.includes('LAU-02') && texto !== textoEs,
        d.querySelector('#replace-no-preguntar').checked, document.activeElement === window.__idiomasJuegoReplaceFoco,
        __banco.seleccionadas, { ...__banco.programas }, cmg.codigo.value, !document.querySelector('#acciones-multi').hidden,
      ];
    }, textoReplaceEs), [true, true, true, 'Replace the programs?', true, true, true, fuentesAntesReplace.seleccion, fuentesAntesReplace.programas, fuentesAntesReplace.borrador, true],
    'Replace inglés mantiene nodos, foco, destinos y confirmación pendiente');
    await page.click('#confirmar-replace [value="cancelar"]');
    await page.waitForFunction(() => !document.querySelector('#confirmar-replace').open);
    eq(await page.evaluate(antes => [cmg.confirmarReplace, __banco.seleccionadas, { ...__banco.programas }, cmg.codigo.value, !document.querySelector('#acciones-multi').hidden], fuentesAntesReplace),
      [true, fuentesAntesReplace.seleccion, fuentesAntesReplace.programas, fuentesAntesReplace.borrador, true], 'cancelar Replace resuelve sin aplicar ni cambiar preferencias');

    // El primer toque de Restaurar mantiene su temporizador; cambiar idioma no arma una segunda vez.
    await abrirJuego('war');
    await page.click('[data-vista="2d"]');
    await page.evaluate(() => { __banco.elegirReto(0); __banco.abrirPrograma('LAU-01'); });
    await page.click('#pie [data-pie-modo="consola"]');
    const inicial = await page.evaluate(() => cmg.inicial().texto);
    await page.fill('#codigo', 'const qaIdioma = "guardar hasta confirmar";\n');
    await page.waitForTimeout(400);
    const fuenteTemporal = await page.evaluate(() => cmg.codigo.value);
    await page.click('#b-restaurar');
    eq(await page.evaluate(() => document.querySelector('#b-restaurar').textContent), '¿Seguro? Se pierde tu programa. Toca otra vez', 'primer toque arma la confirmación en español');
    await page.waitForTimeout(2200);
    await cambiarPorAPI('en');
    eq(await page.evaluate(() => [document.querySelector('#b-restaurar').textContent, cmg.codigo.value]),
      ['Are you sure? Your program will be lost. Tap again', fuenteTemporal], 'el cambio de idioma conserva la segunda confirmación mientras corre el temporizador');
    await page.waitForTimeout(1000);
    eq(await page.evaluate(() => [document.querySelector('#b-restaurar').textContent, cmg.codigo.value]),
      ['Restore starter program', fuenteTemporal], 'el temporizador original se cumple en inglés sin restaurar');
    await page.click('#b-restaurar');
    await cambiarPorAPI('es');
    eq(await page.evaluate(() => document.querySelector('#b-restaurar').textContent), '¿Seguro? Se pierde tu programa. Toca otra vez', 'segundo primer toque arma la confirmación antes del cambio');
    await page.click('#b-restaurar');
    await page.waitForFunction(t => cmg.codigo.value === t, inicial);
    eq(await page.evaluate(t => [cmg.codigo.value, __banco.programas['LAU-01'] === t], inicial), [inicial, true], 'el segundo toque sigue restaurando tras cambiar idioma');

    // Las frases estáticas del diálogo de pantalla traducen en el sitio sin cerrar el diálogo.
    await abrirJuego('war', 'movil', 393);
    await page.click('[data-vista="2d"]');
    const pulsar = (sel, tipo) => page.evaluate(([s, t]) => document.querySelector(s).dispatchEvent(
      new PointerEvent(t, { bubbles: true, pointerId: 701, pointerType: 'touch', isPrimary: true })
    ), [sel, tipo]);
    await pulsar('#b-pantalla', 'pointerdown');
    await page.waitForFunction(() => document.querySelector('#app').dataset.pantallaCompleta === 'true', null, { timeout: 4500 });
    await pulsar('#b-pantalla', 'pointerup');
    await page.click('#b-ajustes');
    await page.click('#ajustes-pantalla-info');
    await page.waitForFunction(() => document.querySelector('#info-pantalla').open);
    await page.evaluate(() => {
      window.__idiomasInfoRefs = [document.querySelector('#info-pantalla'), document.querySelector('#info-pantalla-titulo'), document.querySelector('#info-pantalla > p')];
    });
    eq(await page.evaluate(() => [document.querySelector('#info-pantalla-titulo').textContent, document.querySelector('#info-pantalla > p').textContent]),
      ['Modo pantalla completa', 'Pensado para tabletas y teléfonos: la batalla y el código ocupan, cada uno, toda la pantalla, y se pasa de uno a otro con un toque.'], 'información de pantalla fiel en español');
    await cambiarPorAPI('en');
    eq(await page.evaluate(() => [
      document.querySelector('#info-pantalla') === window.__idiomasInfoRefs[0], document.querySelector('#info-pantalla-titulo') === window.__idiomasInfoRefs[1], document.querySelector('#info-pantalla > p') === window.__idiomasInfoRefs[2],
      document.querySelector('#info-pantalla').open, document.querySelector('#info-pantalla-titulo').textContent, document.querySelector('#info-pantalla > p').textContent,
      document.querySelector('#app').dataset.pantallaCompleta, document.querySelector('#ajustes-pantalla-estado').textContent,
    ]), [true, true, true, true, 'Full screen mode', 'For tablets and phones: the battle and code each fill the screen. Tap to switch between them.', 'true', 'Active'], 'información traduce in situ sin cerrar diálogo ni salir de pantalla completa');
    await page.evaluate(() => document.querySelector('#info-pantalla-cerrar').click());
    await page.click('#ajustes [data-idioma-interfaz="es"]');
    eq(await page.evaluate(() => [
      document.querySelector('#app').dataset.pantallaCompleta,
      ...[...document.querySelectorAll('.b-pantalla')].map(b => [b.getAttribute('aria-pressed'), b.getAttribute('aria-label'), b.dataset.tip, b.dataset.tipCod]),
    ]), ['true', ...Array(3).fill(['true', 'Modo pantalla completa activo: mantén pulsado 2 segundos para salir', 'Pantalla completa activa', 'mantén pulsado 2 s para salir'])],
    'pantalla completa activa conserva estado y etiquetas al volver al español');
    await page.click('#ajustes [data-idioma-interfaz="en"]');
    eq(await page.evaluate(() => [
      document.querySelector('#app').dataset.pantallaCompleta, document.querySelector('#ajustes-pantalla-estado').textContent,
      ...[...document.querySelectorAll('.b-pantalla')].map(b => [b.getAttribute('aria-pressed'), b.getAttribute('aria-label'), b.dataset.tip, b.dataset.tipCod]),
    ]), ['true', 'Active', ...Array(3).fill(['true', 'Full-screen mode active: press and hold for 2 seconds to exit', 'Full-screen mode active', 'hold for 2 sec to exit'])],
    'pantalla completa activa no se revierte al cambiar a inglés');
    await page.click('#ajustes-cerrar');
    await pulsar('#b-pantalla', 'pointerdown');
    await page.waitForFunction(() => document.querySelector('#app').dataset.pantallaCompleta === 'false', null, { timeout: 4500 });
    await pulsar('#b-pantalla', 'pointerup');

    // El menú móvil mantiene sus mismos nodos y el foco al refrescar etiquetas de ES/EN.
    for (const serie of ['war', 'factory']) {
      for (const ancho of [393, 320]) {
        await abrirJuego(serie, 'movil', ancho);
        await page.click('[data-vista="2d"]');
        await page.click('#b-menu-cod');
        const labelsEs = ['Programa', 'Registro', 'Órdenes', serie === 'factory' ? 'Tu reto' : 'Escenario', 'Ajustes'];
        const labelsEn = ['Program', 'Log', 'Commands', serie === 'factory' ? 'Your challenge' : 'Scenario', 'Settings'];
        const refsMenu = await page.evaluate(() => {
          const menu = document.querySelector('#menu-cod');
          const botones = [...menu.querySelectorAll('[data-menu]')];
          botones[0].focus();
          window.__idiomasJuegoMenuRef = menu;
          window.__idiomasJuegoMenuItems = botones;
          window.__idiomasJuegoMenuFoco = document.activeElement;
          return [menu.getAttribute('aria-label'), botones.map(b => b.querySelector('span').textContent)];
        });
        eq(refsMenu, ['Más opciones del código', labelsEs], `${serie} ${ancho}px: menú móvil español visible`);
        await cambiarPorAPI('en');
        const menuEn = await page.evaluate(() => {
          const m = document.querySelector('#menu-cod'), botones = [...m.querySelectorAll('[data-menu]')];
          const rect = m.getBoundingClientRect();
          return {
            aria: m.getAttribute('aria-label'), labels: botones.map(b => b.querySelector('span').textContent),
            mismos: m === window.__idiomasJuegoMenuRef && botones.length === window.__idiomasJuegoMenuItems.length && botones.every((b, i) => b === window.__idiomasJuegoMenuItems[i]),
            foco: document.activeElement === window.__idiomasJuegoMenuFoco,
            abierto: !m.hidden && document.querySelector('#b-menu-cod').getAttribute('aria-expanded') === 'true',
            dentro: rect.left >= 0 && rect.right <= innerWidth && botones.every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }),
            scroll: document.documentElement.scrollWidth,
          };
        });
        eq([menuEn.aria, menuEn.labels, menuEn.mismos, menuEn.foco, menuEn.abierto, menuEn.dentro, menuEn.scroll],
          ['More code options', labelsEn, true, true, true, true, ancho], `${serie} ${ancho}px: menú inglés sin recrear nodos, perder foco o recortar controles`);
        await cambiarPorAPI('es');
        await page.click('#menu-cod [data-menu="registro"]');
        eq(await page.evaluate(() => [document.querySelector('#menu-cod').hidden, document.querySelector('#zona-codigo').dataset.pestana]),
          [true, 'registro'], `${serie} ${ancho}px: listener del menú sigue operativo en español`);
      }
    }
  } catch (error) {
    console.error('Estado de la comprobación fallida:', await page.evaluate(() => ({
      url: location.href, lenguaje: window.cmg?.editor.documento().lenguaje,
      texto: window.cmg?.codigo.value, ejecutando: window.cmg?.ejecutando,
      tiempo: window.__banco?.mundo.t, fin: window.__banco?.mundo.fin,
      consola: document.querySelector('#consola')?.textContent,
      banner: document.querySelector('#banner')?.textContent,
    })).catch(() => null));
    throw error;
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

  console.log(`${checks} comprobaciones de juego i18n correctas (viewport final ${anchoActual}px)`);
  return checks;
}
