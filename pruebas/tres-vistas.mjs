// Importar desde ego-browser nodejs. El puerto 8771 está reservado para QA:
// se escriben programas y preferencias del banco 02 solo en ese origen.
import assert from 'node:assert/strict';

export async function probarTresVistas(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK ${++checks}: ${mensaje}`);
  };
  const url = `${origen}/Prototypes/Tres%20vistas/index.html`;
  const evaluar = fn => page.evaluate(fn);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${origen}/Prototypes/02_tres_vistas.html?forma=escritorio`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => !!window.cmg && !!window.__banco);
  eq(await evaluar(() => location.pathname.endsWith('/Tres%20vistas/index.html') && location.search === '?forma=escritorio'), true, 'entrada anterior conserva parámetros');
  await evaluar(() => {
    // Preparar únicamente las claves usadas por esta prueba, sin borrar el almacenamiento.
    for (const [k, v] of Object.entries({
      'cmg-banco02:modo': 'bloques', 'cmg-banco02:idioma': 'en', 'cmg-banco02:reto': 0,
      'cmg-banco02:prog-0': null, 'cmg-banco02:letra': 14, 'cmg-banco02-ui-orientacion': 'auto',
      'cmg-banco02-ui-primero-horizontal': 'mapa', 'cmg-banco02-ui-primero-vertical': 'mapa',
      'cmg-banco02-ui-reparto-escritorio': 58, 'cmg-banco02-ui-reparto-movil': 50,
      'cmg-banco02-ui-barras-plegadas': false,
    })) localStorage.setItem(k, JSON.stringify(v));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.cmg);
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const inicial = await evaluar(() => window.__banco.generar(window.__banco.programa.modelo).codigo);
  eq(await evaluar(() => [...document.querySelectorAll('#paleta [data-ladrillo]')].map(b => b.dataset.ladrillo)), ['recoger', 'entregar', 'repetir'], 'bloques ofrece los ladrillos del reto');
  const arrastrar = async tactil => {
    const puntos = await evaluar(() => {
      const a = document.querySelector('#paleta [data-ladrillo="recoger"]').getBoundingClientRect();
      const b = document.querySelector('#prog').getBoundingClientRect();
      return { a: { x: a.left + a.width / 2, y: a.top + a.height / 2 }, b: { x: b.left + b.width / 2, y: b.top + b.height / 2 } };
    });
    if (tactil) {
      await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...puntos.a, id: 1 }] });
      await page.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: puntos.a.x, y: puntos.a.y + 20, id: 1 }] });
      await page.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...puntos.b, id: 1 }] });
      await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    } else {
      await page.mouse.move(puntos.a.x, puntos.a.y); await page.mouse.down();
      await page.mouse.move(puntos.a.x, puntos.a.y + 20);
      await page.mouse.move(puntos.b.x, puntos.b.y); await page.mouse.up();
    }
    // Esperar el periodo de 80 ms que impide que soltar el arrastre añada además un clic.
    await page.waitForTimeout(100);
  };
  await arrastrar(false);
  eq(await evaluar(() => window.__banco.programa.modelo.cuerpo.length), 3, 'arrastre real de ratón desde la paleta');
  await page.click('#prog .fila.simple.sel'); await page.click('#edicion [data-accion="borrar"]');
  await page.click('#modos [data-modo="pseudo"]');
  eq(await evaluar(() => document.querySelector('#prog').classList.contains('v-pseudo') && document.querySelector('#paleta').classList.contains('v-pseudo-paleta')), true, 'seudocódigo usa su programa y su barra');
  await page.click('#g-idioma [data-idioma="es"]');
  eq(await evaluar(() => document.querySelector('#paleta [data-ladrillo="recoger"]').textContent.trim()), 'recoge', 'seudocódigo en español');
  await page.click('#g-idioma [data-idioma="en"]');
  eq(await evaluar(() => document.querySelector('#paleta [data-ladrillo="recoger"]').textContent.trim()), 'pick up', 'seudocódigo en inglés');
  await page.click('#modos [data-modo="bloques"]');
  eq(await evaluar(() => window.__banco.generar(window.__banco.programa.modelo).codigo), inicial, 'cambiar modo e idioma conserva el programa');
  await page.click('[data-ladrillo="repetir"]');
  eq(await evaluar(() => window.__banco.programa.modelo.cuerpo.at(-1).t), 'repetir', 'paleta añade un bloque');
  await page.click('#prog .contenedor .cabeza');
  await page.click('#edicion [data-accion="duplicar"]');
  eq(await evaluar(() => window.__banco.programa.modelo.cuerpo.length), 4, 'duplicar conserva la edición por bloques');
  await page.click('#edicion [data-accion="borrar"]');
  eq(await evaluar(() => window.__banco.programa.modelo.cuerpo.length), 3, 'borrar bloque funciona');
  await page.click('#modos [data-modo="js"]');
  eq(await evaluar(() => document.querySelector('#paleta [data-js]') !== null && document.querySelector('#paleta [data-ladrillo]') === null && document.querySelector('#g-idioma').hidden), true, 'JavaScript cambia de barra y oculta el idioma de bloques');
  await page.fill('#codigo', 'await yo.entregar("FUN");');
  await evaluar(() => window.cmg.codigo.select());
  await page.click('[data-js="4"]');
  eq(await evaluar(() => window.cmg.codigo.value), 'while (/* condición */) {\n  await yo.entregar("FUN");\n}', 'while envuelve el código elegido');
  await page.fill('#codigo', '"ENT-1"');
  await evaluar(() => window.cmg.codigo.select());
  await page.click('[data-js="1"]');
  eq(await evaluar(() => window.cmg.codigo.value), 'await yo.recoger("ENT-1", /* material */);', 'recoger coloca la selección en el primer argumento');
  await page.fill('#codigo', ''); await page.click('[data-js="6"]');
  eq(await evaluar(() => window.cmg.codigo.value.slice(window.cmg.codigo.selectionStart, window.cmg.codigo.selectionEnd)), '/* lugar */', 'sensor selecciona su primer argumento al insertarse');
  await page.fill('#codigo', 'const total = 3;');
  await page.click('#modos [data-modo="pseudo"]');
  eq(await evaluar(() => window.cmg.modo === 'js' && !document.querySelector('#aviso').hidden), true, 'texto libre no traducible permanece en JavaScript');
  await page.click('#aviso button >> nth=1');
  eq(await evaluar(() => window.cmg.modo), 'js', 'descartar texto requiere la confirmación existente');
  await page.click('#aviso button >> nth=1');
  eq(await evaluar(() => window.cmg.modo), 'pseudo', 'segunda pulsación recupera el árbol');

  const solucion = 'for (let i = 0; i < 3; i++) {\n  await yo.recoger("ENT-1", "cobre");\n  await yo.entregar("FUN");\n}';
  await page.click('#modos [data-modo="js"]');
  await page.fill('#codigo', solucion);
  await page.click('#modos [data-modo="pseudo"]');
  eq(await evaluar(() => window.__banco.programa.modelo.cuerpo[0].n), 3, 'JavaScript se traduce al árbol compartido');
  await page.click('#b-vel'); await page.click('#b-vel');
  const tiempos = [];
  for (const modo of ['pseudo', 'bloques', 'js']) {
    await page.click(`#modos [data-modo="${modo}"]`);
    await page.click('#b-ejecutar');
    await page.waitForFunction(() => !window.cmg.ejecutando, undefined, { timeout: 15000 });
    eq(await evaluar(() => window.__banco.mundo.fin), 'victoria', `ejecución real en ${modo}`);
    tiempos.push(await evaluar(() => window.__banco.mundo.t));
    await page.click('#banner button >> nth=1');
  }
  eq(tiempos[1], tiempos[0], 'bloques y seudocódigo conservan el tiempo fijo');
  eq(tiempos[2], tiempos[0], 'JavaScript ejecuta el mismo programa y tiempo');
  await page.reload(); await page.waitForFunction(() => !!window.cmg);
  eq(await evaluar(() => window.cmg.codigo.value.includes('i < 3')), true, 'programa persiste en el formato banco 02');

  // Mapa e inspector: usar la posición real del canvas después de ajustarlo al panel.
  const robot = await evaluar(() => {
    const r = document.querySelector('#lienzo').getBoundingClientRect();
    const bot = window.__banco.mundo.robot;
    return { x: r.left + (bot.x + .5) * r.width / 9, y: r.top + (bot.y + .5) * r.height / 7 };
  });
  await page.mouse.click(robot.x, robot.y, { label: 'Abrir ficha de R1' });
  eq(await evaluar(() => document.querySelector('#inspector').dataset.estado), 'abierto', 'clic en mapa ajustado abre inspector');
  await evaluar(() => { document.querySelector('#inspector').scrollTop = 10000; });
  eq(await evaluar(() => {
    const i = document.querySelector('#inspector').getBoundingClientRect();
    const c = document.querySelector('[data-cerrar-inspector]').getBoundingClientRect();
    return c.top >= i.top && c.bottom <= i.bottom;
  }), true, 'cierre permanece visible al desplazar la ficha');
  await page.click('[data-cerrar-inspector]');
  eq(await evaluar(() => window.__banco.seleccionMapa), 'R1', 'cerrar la ficha conserva la selección');

  await page.click('#b-ajustes');
  await page.selectOption('#ajustes-orientacion', 'vertical');
  await page.selectOption('#ajustes-primero-vertical', 'codigo');
  await page.click('#ajustes-cerrar');
  eq(await evaluar(() => [document.querySelector('#app').dataset.eje, document.querySelector('#app').dataset.primero]), ['vertical', 'codigo'], 'distribución y orden configurables');
  await page.focus('#divisor'); await page.keyboard.press('End');
  eq(await evaluar(() => document.querySelector('#zona-mapa').inert), true, 'extremo del divisor oculta mapa y su foco');
  await page.dblclick('#divisor');
  eq(await evaluar(() => document.querySelector('#zona-mapa').inert), false, 'doble clic recupera el reparto');
  await page.click('#b-ajustes'); await page.selectOption('#ajustes-orientacion', 'auto');
  await page.click('#ajustes-cerrar');
  await page.click('#b-barras');
  await evaluar(() => window.cmg.abrirPestana('ayuda'));
  eq(await evaluar(() => document.querySelector('#cabecera-editor').classList.contains('plegada')), false, 'otras pestañas mantienen navegación accesible');
  await page.click('#t-programa'); await page.click('#b-barras');

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await page.goto(`${url}?forma=movil&marco=1`, { waitUntil: "domcontentloaded", timeout: 30000 }); await page.waitForFunction(() => !!window.cmg);
  await page.focus('#codigo');
  await page.waitForFunction(() => document.querySelector('#app').classList.contains('teclado'));
  eq(await evaluar(() => !document.querySelector('#simbolos').hidden && document.querySelector('#cabecera-editor').classList.contains('plegada') && window.cmg.codigo.clientHeight > 150), true, 'teclado simulado prioriza editor, paleta y símbolos');
  await page.fill('#codigo', 'FUN'); await evaluar(() => window.cmg.codigo.select());
  await page.click('#simbolos [data-i="4"]');
  eq(await evaluar(() => window.cmg.codigo.value), '(FUN)', 'símbolos envuelven la selección');
  eq(await evaluar(() => document.activeElement === window.cmg.codigo && document.querySelector('#app').classList.contains('teclado')), true, 'símbolos conservan foco y teclado');
  await page.click('#b-barras');
  await page.click('#modos [data-modo="bloques"]');
  await page.click('#aviso button >> nth=1'); await page.click('#aviso button >> nth=1');
  eq(await evaluar(() => document.querySelector('#simbolos').hidden && !document.querySelector('#app').classList.contains('teclado')), true, 'bloques no muestra teclado ni símbolos JavaScript');
  await page.click('#modos [data-modo="pseudo"]'); await page.click('#g-idioma [data-idioma="es"]');
  eq(await evaluar(() => document.querySelector('#paleta [data-ladrillo="repetir"]').textContent.trim().endsWith('repite')), true, 'barra móvil de seudocódigo conserva su idioma');
  const nodosAntes = await evaluar(() => window.__banco.generar(window.__banco.programa.modelo).codigo);
  await arrastrar(true);
  eq(await evaluar(() => window.__banco.generar(window.__banco.programa.modelo).codigo) !== nodosAntes, true, 'arrastre táctil desde la paleta de seudocódigo añade un bloque');
  for (const [ancho, alto] of [[320, 852], [393, 852], [375, 667]]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: true });
    eq(await evaluar(() => {
      const c = document.querySelector('#prog').getBoundingClientRect();
      return c.width > 200 && c.height > 70 && c.right <= innerWidth && document.documentElement.scrollWidth === innerWidth
        && [...document.querySelectorAll("#paleta .ladrillo")].every(b => b.scrollWidth <= b.clientWidth);
    }), true, `editor por bloques y etiquetas legibles sin desborde a ${ancho}×${alto}`);
  }
  await page.click('#b-ajustes');
  await page.click('[data-tamano="1"]');
  eq(await evaluar(() => document.querySelector('#ajustes-letra').textContent), '16 px', 'Ajustes permite aumentar letra en teléfonos bajos');
  await page.click('[data-tamano="-1"]');
  eq(await evaluar(() => document.querySelector('#app').style.getPropertyValue('--code-size')), '14px', 'tamaño de letra compartido con la barra del editor');
  await page.click('[data-ajuste-modo="js"]');
  eq(await evaluar(() => window.cmg.modo === 'js' && !document.querySelector('#ajustes').open), true, 'Ajustes selecciona el modo y su barra');
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log(`${checks} comprobaciones de Tres vistas correctas`);
  return checks;
}
