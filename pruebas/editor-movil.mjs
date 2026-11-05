// Teléfono rediseñado: barra superior mínima, ProtoMouse, selección con luz, variantes de la barra,
// pares y signos metálicos, menú ⋯, ficha ⓘ con inspector y consola, y Ajustes → Editor.
// Importar desde ego-browser nodejs con el origen de pruebas (escribe en su localStorage), como las demás suites.
import assert from 'node:assert/strict';

export async function probarEditorMovil(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; console.log(`OK ${checks}: ${message}`); };
  const evaluar = (fn, arg) => page.evaluate(fn, arg);
  const url = `${origen}/Prototypes/Rocket%20Launcher/`;
  const centro = sel => evaluar(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const toque = async (p, id = 1) => { await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id }] }); await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(60); };
  const mantener = async (sel, id = 2) => {
    const p = await centro(sel);
    await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id }] });
    await page.waitForTimeout(600);
    await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(60);
  };
  // Arrastre en el ProtoMouse: pasos lentos (unos 8 px por carácter, sin aceleración).
  const arrastrar = async (pasos, id = 3) => {
    const p = await centro('#edicion .protomouse');
    await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id }] });
    for (const [dx, dy] of pasos) { p.x += dx; p.y += dy; await page.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id }] }); await page.waitForTimeout(20); }
    await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(60);
  };
  const poner = (texto, a = 0, b = a) => evaluar(([t, x, y]) => { const c = window.cmg.codigo; c.value = t; c.dispatchEvent(new Event('input')); c.setSelectionRange(x, y); c.scrollTop = 0; }, [texto, a, b]);
  const sel = () => evaluar(() => { const c = window.cmg.codigo; return [c.selectionStart, c.selectionEnd]; });

  await page.goto(`${url}?forma=movil&marco=1`);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.edicion);
  await evaluar(() => { window.cmg.edicion.activar(false); window.cmg.seudo.aplicarModo('js'); window.__banco.elegirReto(0); window.__banco.abrirPrograma('LAU-01'); window.cmg.codigo.blur(); });

  // Barra superior mínima: lenguaje, letra y colores fuera; ▶, comentar y ⋯ a la vista.
  eq(await evaluar(() => [...['#b-ejecutar-movil', '#b-comentar-movil', '#b-menu-cod'].map(s => !!document.querySelector(s).offsetParent),
    ...['#sel-lenguaje', '#b-menos', '#b-mas', '#b-colores', '.tabs', '#b-barras', '#pie'].map(s => !document.querySelector(s).offsetParent)]),
    Array(10).fill(true), 'barra superior mínima: ▶, comentar y ⋯; lenguaje, letra, colores, pestañas y panel inferior fuera');

  // ProtoMouse con el teclado cerrado: mueve el cursor sin enfocar el código y pinta su propio cursor.
  const prog = 'const pos = autoTarget("crawler", "visual");\nregularShoot(pos);\nawait esperar(0.5);\n';
  await poner(prog, 0);
  await arrastrar(Array(10).fill([8, 0]));
  eq(await evaluar(() => { const c = window.cmg.codigo; return [c.selectionStart, c.selectionEnd, document.activeElement === c, !document.querySelector('.pm-cursor').hidden]; }),
    [10, 10, false, true], 'ProtoMouse: arrastrar 80 px despacio mueve el cursor 10 caracteres, sin abrir el teclado y con su cursor a la vista');
  await poner('uno\ndos\ntres\ncuatro', 1);
  await arrastrar(Array(11).fill([0, 4]));
  eq(await sel(), [9, 9], 'ProtoMouse: hacia abajo baja de renglón conservando la columna');
  await toque(await centro('#edicion .protomouse'));
  eq(await evaluar(() => { const t = document.querySelector('.toast-edicion'); return !t.hidden && /arrastra/.test(t.textContent); }), true, 'un toque sin arrastrar explica cómo se usa');

  // Selección: interruptor con luz; encendida, el ProtoMouse amplía; copiar la apaga.
  await poner(prog, 6);
  await page.click('#edicion [data-seleccion]');
  eq(await evaluar(() => [window.cmg.edicion.seleccionando, document.querySelector('#edicion [data-seleccion]').getAttribute('aria-pressed'), document.querySelector('#edicion').classList.contains('seleccionando')]),
    [true, 'true', true], 'el botón de selección se enciende');
  await arrastrar(Array(6).fill([8, 0]));
  eq(await evaluar(() => { const c = window.cmg.codigo; return [c.value.slice(c.selectionStart, c.selectionEnd), document.querySelectorAll('.pm-sel').length > 0]; }), ['pos = ', true], 'con la selección encendida el ProtoMouse amplía lo elegido');
  await arrastrar(Array(3).fill([-8, 0]));
  eq(await evaluar(() => { const c = window.cmg.codigo; return c.value.slice(c.selectionStart, c.selectionEnd); }), 'pos', 'volver atrás reduce la selección desde el mismo extremo');
  await page.click('#edicion [data-accion="copiar"]');
  eq(await evaluar(() => [window.cmg.edicion.seleccionando, window.cmg.edicion.portapapeles]), [false, 'pos'], 'copiar guarda lo elegido y apaga la selección');

  // Con el teclado abierto el arrastre no quita el foco.
  await evaluar(() => { const c = window.cmg.codigo; c.focus(); c.setSelectionRange(0, 0); });
  await page.waitForFunction(() => document.querySelector('#app').classList.contains('teclado'));
  await arrastrar(Array(5).fill([8, 0]));
  eq(await evaluar(() => [document.activeElement === window.cmg.codigo, document.querySelector('#app').classList.contains('teclado'), window.cmg.codigo.selectionStart]),
    [true, true, 5], 'con el teclado abierto, el ProtoMouse mueve el cursor y el teclado sigue');
  await evaluar(() => window.cmg.codigo.blur());
  await page.waitForFunction(() => !document.querySelector('#app').classList.contains('teclado'));

  // Al llegar abajo, el código se desplaza.
  await poner(Array.from({ length: 60 }, (_, i) => `console.log(${i});`).join('\n'), 0);
  await arrastrar(Array(40).fill([0, 12]));
  eq(await evaluar(() => { const c = window.cmg.codigo; return [c.scrollTop > 0, c.value.slice(0, c.selectionStart).split('\n').length > 15]; }), [true, true], 'al pasar del borde inferior el código se desplaza y el cursor sigue');

  // Variantes de la barra: mantener pulsado despliega placas metálicas; Duplicar actúa sobre la línea.
  const variantes = () => evaluar(() => [...document.querySelectorAll('.variantes-ed .variante')].map(v => v.dataset.v));
  await poner('regularShoot(pos);\n', 3);
  await mantener('#edicion [data-seleccion]');
  eq(await variantes(), ['seleccion', 'ampliar', 'reducir', 'subir', 'bajar'], 'mantener Selección: ampliar, reducir, subir y bajar');
  await page.keyboard.press('Escape');
  await mantener('#edicion [data-accion="pegar"]');
  eq(await variantes(), ['pegar', 'linea', 'sangrar', 'desangrar'], 'mantener Pegar: línea nueva, sangrar y quitar sangría');
  await page.click('.variantes-ed [data-v="sangrar"]');
  eq(await evaluar(() => { const c = window.cmg.codigo; return [c.value, c.selectionStart, c.selectionEnd]; }), ['  regularShoot(pos);\n', 5, 5], 'sangrar con solo el cursor conserva el cursor en su sitio');
  await mantener('#edicion [data-accion="pegar"]');
  await page.click('.variantes-ed [data-v="desangrar"]');
  eq(await evaluar(() => { const c = window.cmg.codigo; return [c.value, c.selectionStart]; }), ['regularShoot(pos);\n', 3], 'quitar sangría lo deshace');
  await evaluar(() => window.cmg.codigo.setSelectionRange(3, 3));
  await mantener('#edicion [data-accion="copiar"]');
  eq(await variantes(), ['copiar', 'duplicar'], 'mantener Copiar: duplicar');
  await page.click('.variantes-ed [data-v="duplicar"]');
  eq(await evaluar(() => [window.cmg.codigo.value, document.querySelector('.variantes-ed')?.hidden]), ['regularShoot(pos);\nregularShoot(pos);\n', true], 'elegir Duplicar duplica la línea y cierra las placas');

  // Pares y signos metálicos: delante en la barra de inserción; un par rodea lo elegido.
  eq(await evaluar(() => { const vis = [...document.querySelectorAll('#paleta > *')].filter(x => x.getClientRects().length).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return [vis.slice(0, 3).map(x => x.dataset.ico || x.className), !document.querySelector('#paleta .atajo[data-ico="comentar"]').getClientRects().length]; }),
    [['parentesis', 'punto', 'sep-pal sep-movil solo-movil'], true], 'la barra de inserción empieza con los pares y los signos; comentar está arriba');
  await poner('regularShoot(pos);', 13, 16);
  await page.click('#paleta .atajo[data-ico="parentesis"]');
  eq(await evaluar(() => window.cmg.codigo.value), 'regularShoot((pos));', 'el botón de pares rodea lo elegido');
  await mantener('#paleta .atajo[data-ico="punto"]');
  eq(await evaluar(() => [...document.querySelectorAll('.variantes:not(.variantes-ed):not(.menu-cod) .variante span')].map(s => s.textContent)),
    ['Punto', 'Coma', 'Punto y coma', 'Dos puntos'], 'mantener la puntuación ofrece . , ; :');
  await poner('a', 1);
  await page.click('.variantes .variante[data-v="3"]');
  eq(await evaluar(() => window.cmg.codigo.value), 'a:', 'elegir una variante inserta el signo');
  // Desplazar la barra de inserción no abre variantes.
  const bucle = await centro('#paleta .atajo[data-ico="whileTrue"]');
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...bucle, id: 9 }] });
  for (let i = 1; i <= 6; i++) { await page.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bucle.x - i * 12, y: bucle.y, id: 9 }] }); await page.waitForTimeout(30); }
  await page.waitForTimeout(650);
  eq(await evaluar(() => document.querySelector('.variantes:not(.variantes-ed):not(.menu-cod)').hidden), true, 'desplazar la barra de inserción no abre variantes');
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  eq(await evaluar(() => window.cmg.codigo.value), 'a:', 'ni inserta nada');

  // Comentar desde la barra superior.
  await poner('regularShoot(pos);', 0);
  await page.click('#b-comentar-movil');
  eq(await evaluar(() => window.cmg.codigo.value), '// regularShoot(pos);', 'comentar desde la barra superior');

  // Menú ⋯: pestañas, modo sin teclado y Ajustes.
  await page.click('#b-menu-cod');
  eq(await evaluar(() => [...document.querySelectorAll('#menu-cod [data-menu]')].map(b => b.dataset.menu + (b.classList.contains('activa') ? '*' : ''))),
    ['programa*', 'registro', 'ayuda', 'escenario', 'teclado', 'ajustes'], 'el menú ⋯ ofrece pestañas, sin teclado y Ajustes con la pestaña actual encendida');
  await page.click('#menu-cod [data-menu="registro"]');
  eq(await evaluar(() => [document.querySelector('#zona-codigo').dataset.pestana, !!document.querySelector('#t-programa').offsetParent, document.querySelector('#menu-cod').hidden]), ['registro', true, true], 'Registro desde el menú; sus pestañas aparecen para volver');
  await page.click('#t-programa');
  await page.click('#b-menu-cod');
  await page.click('#menu-cod [data-menu="ajustes"]');
  eq(await evaluar(() => document.querySelector('#ajustes').open), true, 'Ajustes desde el menú');

  // Ajustes → Editor: letra y colores.
  await page.click('#ajustes-letra [data-letra="16"]');
  eq(await evaluar(() => [getComputedStyle(document.querySelector('#app')).getPropertyValue('--code-size').trim(), document.querySelector('#ajustes-letra [data-letra="16"]').getAttribute('aria-pressed')]), ['16px', 'true'], 'Ajustes cambia el tamaño de la letra');
  await page.click('#ajustes-letra [data-letra="14"]');
  await page.click('#ajustes-colores');
  eq(await evaluar(() => [document.querySelector('#editor').classList.contains('colores'), document.querySelector('#b-colores').getAttribute('aria-pressed')]), [false, 'false'], 'Ajustes apaga los colores del código');
  await page.click('#ajustes-colores');
  await page.click('#ajustes-cerrar');

  // Ficha ⓘ: el inspector (segunda pestaña) y la consola muestran los nodos del panel inferior.
  await page.click('#b-info-reto');
  eq(await evaluar(() => [...document.querySelectorAll('#info-pestanas [data-info]')].filter(b => b.getClientRects().length).map(b => b.dataset.info)),
    ['objetivo', 'inspector', 'metas', 'enemigos', 'pista', 'intento', 'consola'], 'la ficha ⓘ tiene el inspector como segunda pestaña y la consola al final');
  await page.click('#info-t-inspector');
  eq(await evaluar(() => [!!document.querySelector('#info-cuerpo > #pie-ins'), document.querySelectorAll('#info-cuerpo .tk').length > 5]), [true, true], 'el inspector del programa se ve en la ficha');
  await page.click('#info-reto-cerrar');
  eq(await evaluar(() => !!document.querySelector('#pie-cuerpo > #pie-ins') && !!document.querySelector('#pie-cuerpo > #pie-con')), true, 'al cerrar la ficha el inspector vuelve a su sitio');
  // Ejecutar: ▶ pasa a ■ y los mensajes nuevos marcan el botón ⓘ.
  await poner('console.log("hola");\nawait esperar(5);', 0);
  await page.click('#b-ejecutar-movil');
  await page.waitForFunction(() => document.querySelector('#b-info-reto').classList.contains('con-nuevo'), null, { timeout: 5000 });
  eq(await evaluar(() => [document.querySelector('#b-ejecutar-movil').classList.contains('corriendo'), document.querySelector('#b-ejecutar-movil').getAttribute('aria-label'), document.querySelector('#info-t-consola').dataset.estado]),
    [true, 'Detener', 'nueva'], 'ejecutando, ▶ pasa a ■ y la ⓘ avisa de mensajes nuevos');
  await page.click('#b-ejecutar-movil');
  await page.click('#b-info-reto');
  await page.click('#info-t-consola');
  eq(await evaluar(() => [!!document.querySelector('#info-cuerpo > #pie-con'), /hola/.test(document.querySelector('#consola').textContent), document.querySelector('#b-info-reto').classList.contains('con-nuevo')]),
    [true, true, false], 'la consola en la ficha muestra los mensajes y borra la marca');
  await page.click('#info-reto-cerrar');

  // Sin teclado: el ⋯ lo recuerda con una marca roja y el ProtoMouse mueve el cursor de bloques.
  await page.click('#b-menu-cod');
  await page.click('#menu-cod [data-menu="teclado"]');
  await poner('regularShoot(pos);\nstopFire();', 0);
  await evaluar(() => window.cmg.edicion.elegir(0, 0));
  await arrastrar(Array(4).fill([8, 0]));
  eq(await evaluar(() => [window.cmg.edicion.activo, getComputedStyle(document.querySelector('#b-menu-cod')).borderTopColor !== getComputedStyle(document.querySelector('#b-comentar-movil')).borderTopColor, window.cmg.codigo.selectionStart, !!document.querySelector('.cursor-b')]),
    [true, true, 4, true], 'sin teclado: marca roja en ⋯ y el ProtoMouse mueve el cursor de bloques');
  await page.click('#b-menu-cod');
  await page.click('#menu-cod [data-menu="teclado"]');
  await evaluar(() => window.cmg.codigo.blur());

  // Seudocódigo: barra completa al pie, sin ProtoMouse.
  await evaluar(() => window.cmg.seudo.aplicarModo('pseudo'));
  eq(await evaluar(() => [getComputedStyle(document.querySelector('#edicion [data-accion="borrar"]')).display !== 'none', !document.querySelector('#edicion .protomouse').getClientRects().length]), [true, true], 'en seudocódigo la barra completa vuelve y el ProtoMouse se retira');
  await evaluar(() => window.cmg.seudo.aplicarModo('js'));

  // PC: nada de lo anterior cambia la barra ni la paleta.
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await page.goto(`${url}?forma=escritorio`);
  await page.waitForFunction(() => window.__juegoListo);
  eq(await evaluar(() => [!document.querySelector('.acciones-movil').getClientRects().length, !document.querySelector('#paleta .solo-movil').getClientRects().length, !document.querySelector('#info-t-inspector').getClientRects().length, !!document.querySelector('#b-menos').offsetParent]),
    [true, true, true, true], 'en PC no aparecen la barra del teléfono, los pares, ni las pestañas del teléfono');
  console.log(`${checks} comprobaciones del editor en el teléfono correctas`);
  return checks;
}
