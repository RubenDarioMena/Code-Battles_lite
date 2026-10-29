// Importar desde ego-browser nodejs. Usa un servidor local dedicado a pruebas:
// estas comprobaciones escriben programas y preferencias en su localStorage.
import assert from 'node:assert/strict';

export async function probar(page, url = 'http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/') {
  let checks = 0;
  const eq = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks++;
    console.log(`OK ${checks}: ${message}`);
  };
  const evaluar = fn => page.evaluate(fn);
  await page.goto(`${url}?forma=escritorio`);
  await page.waitForFunction(() => !!window.__banco && !!window.cmg && !!window.cmg.edicion);
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  // El modo sin teclado se recuerda por origen: la suite empieza con teclado.
  await evaluar(() => { window.cmg.edicion.activar(false); window.cmg.seudo.aplicarModo('js'); });
  // Las coordenadas ahora se activan desde Ajustes; la prueba usa un origen dedicado.
  await page.click('#b-ajustes');
  if (!await evaluar(() => document.querySelector('#ajustes-coordenadas').checked)) {
    await page.click('#ajustes-coordenadas');
  }
  await page.click('#ajustes-cerrar');
  await evaluar(() => {
    const b = window.__banco;
    b.elegirReto(4);
    b.programas['LAU-01'] = '// uno';
    b.programas['LAU-02'] = '// dos';
    b.abrirPrograma('LAU-01');
    b.seleccionar(['LAU-01', 'LAU-02']);
    window.cmg.confirmarReplace = true;
  });
  await page.fill('#codigo', 'console.log("borrador");');
  await page.click('[aria-label="Cerrar el inspector"]');
  eq(await evaluar(() => window.__banco.seleccionadas), ['LAU-01', 'LAU-02'], 'cerrar inspector conserva selección');
  await evaluar(() => {
    window.__banco.seleccionar('LAU-02');
    window.__banco.seleccionar(['LAU-02', 'LAU-01']);
  });
  eq(await evaluar(() => window.cmg.codigo.value), 'console.log("borrador");', 'volver a la selección recupera borrador');
  await page.click('#b-ejecutar');
  eq(await evaluar(() => !window.cmg.ejecutando && !document.querySelector('#banner').hidden), true, 'ejecutar avisa del borrador sin aplicar');
  await page.click('#banner button');
  await page.click('#b-add');
  eq(await evaluar(() => window.__banco.programas), {
    'LAU-01': '// uno\nconsole.log("borrador");',
    'LAU-02': '// dos\nconsole.log("borrador");',
  }, 'Add conserva cada programa anterior');
  eq(await evaluar(() => window.cmg.codigo.value), '', 'Add consume el borrador');
  await page.fill('#codigo', 'console.log("programa aplicado"); await esperar(1);');
  await page.click('#b-replace');
  eq(await evaluar(() => document.querySelector('#confirmar-replace').open), true, 'Replace abre confirmación');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#confirmar-replace').open);
  eq(await evaluar(() => window.__banco.programas['LAU-01'].startsWith('// uno')), true, 'cancelar conserva programas');
  await page.click('#b-replace');
  await page.click('#replace-no-preguntar');
  await page.click('#confirmar-replace [value="reemplazar"]');
  await page.waitForFunction(() => document.querySelector('#acciones-multi').hidden);
  eq(await evaluar(() => Object.values(window.__banco.programas).every(x => x === window.cmg.codigo.value)), true, 'Replace aplica a todos');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cmg-banco03:prog-4') || 'null')?.['LAU-01'] === window.cmg.codigo.value);
  await page.reload();
  eq(await evaluar(() => window.cmg.confirmarReplace), false, 'No preguntar otra vez persiste al recargar');
  await page.click('#b-ejecutar');
  await page.waitForFunction(() => window.__banco.mundo.t > .1 && document.querySelector('#consola').textContent.includes('programa aplicado'));
  eq(await evaluar(() => window.cmg.codigo.readOnly), true, 'Web Workers ejecutan el programa aplicado y bloquean edición');
  await page.click('#b-ejecutar');
  eq(await evaluar(() => window.cmg.codigo.readOnly), false, 'detener permite editar otra vez');

  await page.fill('#codigo', 'foo("crawler")');
  const caracter = async pos => page.evaluate(pos => {
    const c = window.cmg.codigo, r = c.getBoundingClientRect(), s = getComputedStyle(c);
    const ctx = document.createElement('canvas').getContext('2d');
    // El atajo «font» calculado queda vacío con font-variant-ligatures: none; se usan las propiedades sueltas.
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    return { x: r.left + parseFloat(s.paddingLeft) + ctx.measureText(c.value.slice(0, pos)).width + 2,
      y: r.top + parseFloat(s.paddingTop) + parseFloat(s.lineHeight) / 2 };
  }, pos);
  let p = await caracter(7);
  await page.mouse.click(p.x, p.y, { clickCount: 2 });
  eq(await evaluar(() => window.cmg.codigo.value.slice(window.cmg.codigo.selectionStart, window.cmg.codigo.selectionEnd)), '"crawler"', 'doble clic selecciona texto con comillas');
  await page.fill('#codigo', '(abc[1])');
  p = await caracter(0);
  await page.mouse.click(p.x, p.y, { clickCount: 3 });
  eq(await evaluar(() => window.cmg.codigo.value.slice(window.cmg.codigo.selectionStart, window.cmg.codigo.selectionEnd)), 'abc[1]', 'triple clic selecciona interior del delimitador');
  // Regresión: con dos argumentos, el doble clic en el primero elegía el segundo (el espejo usaba otra letra).
  await page.fill('#codigo', 'fn("ab", "cd")');
  p = await caracter(4);
  await page.mouse.click(p.x, p.y, { clickCount: 2 });
  eq(await evaluar(() => window.cmg.codigo.value.slice(window.cmg.codigo.selectionStart, window.cmg.codigo.selectionEnd)), '"ab"', 'doble clic en el primer argumento lo elige a él');

  await page.click('[data-vista="2d"]');
  await evaluar(() => window.__banco.seleccionar(null));
  const puntos = await evaluar(() => {
    const r = document.querySelector('#campo').getBoundingClientRect();
    const t = Math.min(r.width / 32, (r.height - 40) / 18);
    const ox = (r.width - t * 32) / 2, oy = Math.max(36, (r.height - t * 18) / 2);
    return window.__banco.mundo.lanzadores.map(l => ({ x: r.left + ox + l.cx * t, y: r.top + oy + l.cy * t }));
  });
  await page.mouse.move(puntos[0].x - 25, puntos[0].y - 25);
  await page.mouse.down();
  await page.mouse.move(puntos[1].x + 25, puntos[1].y + 25, { steps: 8 });
  await page.mouse.up();
  eq(await evaluar(() => window.__banco.seleccionadas), ['LAU-01', 'LAU-02'], 'arrastre de ratón selecciona ambos lanzadores');
  await page.click('[aria-label="Cerrar el inspector"]');
  await page.focus('#coordenadas');
  await page.mouse.click(puntos[0].x, puntos[0].y, { clickCount: 2 });
  const coordenadas = await evaluar(() => document.querySelector('#coordenadas').value);
  const numeros = coordenadas.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  eq(!!numeros && Math.abs(numeros[0] - 6.5) < .1 && Math.abs(numeros[1] - 5.5) < .1 && numeros[2] === 0, true, 'doble clic escribe coordenadas del suelo');
  await page.click('#b-coordenadas');
  eq(await page.evaluate(texto => window.cmg.codigo.value.includes(texto), coordenadas), true, 'Insertar lleva las coordenadas al código');

  await evaluar(() => { window.cmg.codigo.blur(); window.__banco.seleccionar(null); });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const tocar = (type, points) => page.cdp('Input.dispatchTouchEvent', { type, touchPoints: points });
  // Chromium genera los dos toques: la latencia del puente de automatización
  // no debe separar artificialmente el gesto más allá del umbral de 320 ms.
  await page.cdp('Input.synthesizeTapGesture', {
    ...puntos[0], tapCount: 2, duration: 30, gestureSourceType: 'touch',
  });
  eq(await evaluar(() => window.__banco.seleccionadas), ['LAU-01', 'LAU-02'], 'doble toque selecciona el mismo tipo visible');
  eq(await evaluar(() => visualViewport.scale), 1, 'doble toque no activa zoom');
  await evaluar(() => window.__banco.seleccionar(null));
  // Doble toque en el suelo y arrastrar con el segundo: cuadro de selección como con el ratón.
  const suelo = { x: puntos[0].x - 30, y: puntos[0].y - 30 }, fin = { x: puntos[1].x + 30, y: puntos[1].y + 30 };
  await tocar('touchStart', [{ ...suelo, id: 1 }]);
  await tocar('touchEnd', []);
  await tocar('touchStart', [{ ...suelo, id: 2 }]);
  await tocar('touchMove', [{ x: (suelo.x + fin.x) / 2, y: (suelo.y + fin.y) / 2, id: 2 }]);
  await tocar('touchMove', [{ ...fin, id: 2 }]);
  await tocar('touchEnd', []);
  eq(await evaluar(() => window.__banco.seleccionadas), ['LAU-01', 'LAU-02'], 'doble toque en el suelo y arrastrar selecciona en cuadro');
  await evaluar(() => window.__banco.seleccionar(null));
  await tocar('touchStart', [{ ...suelo, id: 3 }]);
  await new Promise(resolve => setTimeout(resolve, 400));
  await tocar('touchMove', [{ ...fin, id: 3 }]);
  await tocar('touchEnd', []);
  eq(await evaluar(() => window.__banco.seleccionadas), [], 'arrastrar con un dedo no selecciona');
  await evaluar(() => window.__banco.seleccionar(null));
  await tocar('touchStart', [{ ...puntos[0], id: 1 }]);
  await page.waitForFunction(() => document.querySelector('#inspector').dataset.estado === 'abierto');
  await tocar('touchEnd', []);
  eq(await evaluar(() => document.querySelector('#inspector').dataset.estado), 'abierto', 'pulsación larga abre ficha');
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await evaluar(() => window.__banco.seleccionar(null));
  await page.click('[data-vista="3d"]');
  eq(await evaluar(() => document.querySelector('#sin3d').hidden && !document.querySelector('#c3d').hidden && document.querySelector('#c3d').width > 0), true, 'visor 3D disponible con WebGL');

  await probarSinTeclado(page, eq);
  await probarSeudo(page, eq);

  await page.goto(`${url}?forma=movil&marco=1`);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await evaluar(() => window.cmg.codigo.focus());
  await page.waitForFunction(() => document.querySelector('#app').classList.contains('teclado'));
  eq(await evaluar(() => {
    const c = document.querySelector('#zona-codigo').getBoundingClientRect();
    const s = document.querySelector('#simbolos').getBoundingClientRect();
    return c.top >= 0 && Math.abs(c.bottom - s.top) <= 1 && window.cmg.codigo.clientHeight > 100;
  }), true, 'editor móvil ocupa espacio disponible encima de símbolos');
  await page.click('#simbolos button[data-i="4"]');
  eq(await evaluar(() => document.activeElement === window.cmg.codigo && document.querySelector('#app').classList.contains('teclado')), true, 'barra de símbolos conserva foco y teclado');
  await evaluar(() => window.cmg.codigo.blur());
  await page.waitForFunction(() => !document.querySelector('#app').classList.contains('teclado'));
  eq(await evaluar(() => document.querySelector('#simbolos').hidden), true, 'cerrar teclado restaura reparto');
  eq(await evaluar(() => getComputedStyle(document.querySelector('#consola')).display === 'none' && getComputedStyle(document.querySelector('#b-pie')).display !== 'none'),
    true, 'en el teléfono la consola empieza cerrada y deja su asa');
  eq(await evaluar(() => ['#paleta', '#edicion'].map(sel => new Set([...document.querySelectorAll(`${sel} button`)].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().top))).size)),
    [1, 1], 'la paleta y la barra de edición ocupan una línea cada una');
  eq(await evaluar(() => {
    const p = document.querySelector('#paleta').getBoundingClientRect(), b = document.querySelector('#edicion').getBoundingClientRect();
    return getComputedStyle(document.querySelector('#edicion')).display === 'flex' && b.top >= p.bottom - 1 && b.top - p.bottom < 12;
  }), true, 'en el teléfono la barra de edición queda fija bajo la paleta');
  // Sin teclado en el teléfono: un toque elige sin enfocar el textarea, así no sube el teclado.
  await page.click('#edicion .b-teclado');
  await evaluar(() => { const c = window.cmg.codigo; c.value = 'regularShoot("visual");\n'; c.dispatchEvent(new Event('input')); });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const toqueEn = await page.evaluate(() => { const el = [...document.querySelectorAll('#bloques-texto span')].find(s => s.textContent === '"visual"'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.cdp('Input.synthesizeTapGesture', { ...toqueEn, tapCount: 1, duration: 40, gestureSourceType: 'touch' });
  await page.waitForTimeout(150);
  eq(await evaluar(() => {
    const c = window.cmg.codigo;
    return [c.value.slice(c.selectionStart, c.selectionEnd), document.activeElement === c, document.querySelector('#app').classList.contains('teclado')];
  }), ['"visual"', false, false], 'sin teclado el toque elige el texto sin abrir el teclado');
  // Mantener pulsado un atajo abre sus variantes.
  const atajoIf = await page.evaluate(() => { const r = document.querySelector('.atajo.con-variantes[aria-label^="If / else"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...atajoIf, id: 5 }] });
  await page.waitForFunction(() => !document.querySelector('.variantes').hidden);
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  eq(await evaluar(() => [...document.querySelectorAll('.variantes .variante span')].map(s => s.textContent)), ['If / else', 'If', 'If / else if'], 'mantener pulsado un atajo muestra sus variantes');
  await evaluar(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await page.click('#edicion .b-teclado');
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log(`${checks} comprobaciones de navegador correctas`);
  return checks;
}

// Modo sin teclado en PC: la vista de bloques se maneja con el ratón real (CDP).
async function probarSinTeclado(page, eq) {
  const evaluar = fn => page.evaluate(fn);
  const elegido = () => evaluar(() => { const c = window.cmg.codigo; return c.value.slice(c.selectionStart, c.selectionEnd); });
  const ficha = (texto, n = 0) => page.evaluate(([t, i]) => {
    const el = [...document.querySelectorAll('#bloques-texto span')].filter(s => s.textContent === t)[i];
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [texto, n]);
  const poner = (texto, a = 0, b = a) => page.evaluate(([t, x, y]) => { const c = window.cmg.codigo; c.value = t; c.dispatchEvent(new Event('input')); window.cmg.edicion.elegir(x, y); }, [texto, a, b]);
  const arrastrar = async (de, a) => { await page.mouse.move(de.x, de.y); await page.mouse.down(); await page.mouse.move(a.x, a.y, { steps: 8 }); await page.mouse.up(); };

  await page.fill('#codigo', 'if (true){\nyo.entregar("oro")\n}');
  await page.click('#b-teclado');
  eq(await evaluar(() => window.cmg.edicion.activo && !document.querySelector('#bloques').hidden && document.querySelector('#b-teclado').getAttribute('aria-pressed') === 'true' && document.activeElement !== window.cmg.codigo),
    true, 'el botón de teclado activa el modo sin teclado');
  const oro = await ficha('"oro"');
  await page.mouse.click(oro.x, oro.y);
  eq(await elegido(), '"oro"', 'sin teclado un clic elige el texto con sus comillas');
  const niveles = [];
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(450); await page.mouse.click(oro.x, oro.y, { clickCount: 2 }); await page.waitForTimeout(50); niveles.push(await elegido()); }
  eq(niveles, ['entregar("oro")', 'yo.entregar("oro")', 'if (true){\nyo.entregar("oro")\n}'], 'cada doble clic amplía hasta el siguiente límite semántico');

  await poner('while (true) {\n  \n  await esperar(0.5);\n}\n', 17);
  await page.click('.atajo[aria-label^="Apuntar"]');
  await page.waitForSelector('.sugerencias:not([hidden])');
  const tipos = await evaluar(() => [...document.querySelectorAll('.sugerencias .sug[data-i] code')].map(x => x.textContent));
  eq(['"crawler"', '"drone"', '"stealth"'].every(t => tipos.includes(t)), true, 'un hueco despliega los valores de la máquina');
  await page.click(`.sugerencias .sug[data-i="${tipos.indexOf('"drone"')}"]`);
  await page.waitForFunction(() => document.querySelector('.sugerencias .sug-cab b')?.textContent === 'Sensor');
  eq(await elegido(), '/* sensor */', 'al elegir un valor pasa al siguiente hueco');
  await page.click('.sugerencias .sug[data-i="0"]');
  eq(await evaluar(() => window.cmg.codigo.value.split('\n')[1]), '  const pos = autoTarget("drone", "visual");', 'las sugerencias rellenan la llamada con su sangría');

  await poner('const pos = autoTarget("drone", "visual");\nregularShoot(/* lugar */);\nstopFire();\n');
  await arrastrar(await ficha('pos'), await ficha('/* lugar */'));
  await arrastrar(await ficha('pos'), await ficha('(', 2));
  eq(await evaluar(() => window.cmg.codigo.value), 'const pos = autoTarget("drone", "visual");\nregularShoot(pos);\nstopFire(pos);\n', 'arrastrar una palabra a un hueco o un paréntesis la copia sin borrarla');

  await poner('while (true) {\n  regularShoot(pos);\n}\nstopFire();\n');
  const numero = await page.evaluate(() => { const r = document.querySelectorAll('#gutter > div')[3].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const linea1 = await page.evaluate(() => document.querySelectorAll('#bloques-texto .ln')[1].getBoundingClientRect().top + 2);
  await arrastrar(numero, { x: numero.x + 60, y: linea1 });
  eq(await evaluar(() => window.cmg.codigo.value), 'while (true) {\n  stopFire();\n  regularShoot(pos);\n}\n', 'el número de línea agarra la línea y la suelta con la sangría del destino');

  eq(await evaluar(() => getComputedStyle(document.querySelector('#edicion')).display), 'flex', 'en PC la barra de edición aparece con el modo sin teclado');
  await poner('const pos = autoTarget("crawler", "visual");\n', 34, 42);
  await page.click('#edicion [data-accion="borrar"]');
  const trasBorrar = await evaluar(() => window.cmg.codigo.value);
  await page.click('#edicion [data-accion="deshacer"]');
  eq([trasBorrar, await evaluar(() => window.cmg.codigo.value)], ['const pos = autoTarget("crawler", /* sensor */);\n', 'const pos = autoTarget("crawler", "visual");\n'], 'borrar un argumento deja su hueco y deshacer lo recupera');

  await poner('stopFire();\n', 12);
  const siNo = await page.evaluate(() => { const r = document.querySelector('.atajo.con-variantes[aria-label^="If / else"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(siNo.x, siNo.y, { button: 'right' });
  await page.waitForSelector('.variantes:not([hidden])');
  await page.click('.variantes .variante[data-v="1"]');
  eq(await evaluar(() => window.cmg.codigo.value), 'stopFire();\nif (/* condición */) {\n  \n}', 'clic derecho en un atajo deja elegir su variante');

  await page.click('#b-teclado');
  eq(await evaluar(() => !window.cmg.edicion.activo && document.querySelector('#bloques').hidden && document.activeElement === window.cmg.codigo), true, 'el mismo botón vuelve al teclado');
}

// Seudocódigo (traído de Tres vistas) y orden de la barra de edición, en PC.
async function probarSeudo(page, eq) {
  const evaluar = fn => page.evaluate(fn);
  const codigo = () => evaluar(() => window.cmg.codigo.value);
  await evaluar(() => window.__banco.elegirReto(3));
  const partida = await codigo();
  await page.click('.modos-codigo [data-modo-codigo="pseudo"]');
  eq(await evaluar(() => [document.querySelector('#app').dataset.modo, document.querySelector('#editor').hidden, [...document.querySelectorAll('#prog .fila')].slice(0, 2).map(f => f.textContent.replace(/\s+/g, ' ').trim())]),
    ['pseudo', true, ['repite siempre', 'pos ← apunta a drone con visual · si no hay: crawler']], 'el programa de partida se lee en seudocódigo');
  eq(await codigo(), partida, 'entrar en seudocódigo no cambia el JavaScript');
  await page.click('#prog .slot-tipo');
  await page.waitForSelector('.sugerencias:not([hidden]) .sug[data-i]');
  const i = await evaluar(() => [...document.querySelectorAll('.sugerencias:not([hidden]) .sug[data-i]')].findIndex(b => b.textContent.includes('stealth')));
  await page.click(`.sugerencias:not([hidden]) .sug[data-i="${i}"]`);
  eq((await codigo()).split('\n')[1], '  const pos = autoTarget("stealth", "visual") ?? autoTarget("crawler", "visual");', 'cambiar un valor reescribe el JavaScript');
  await page.click('#prog .fila[data-parte="cabeza"] >> nth=0');
  await page.click('#paleta-seudo [data-ladrillo="esperar"]');
  eq((await codigo()).split('\n')[1], '  await esperar(0.5);', 'un ladrillo entra donde está el cursor');
  await page.click('#edicion [data-accion="borrar"]');
  const sinEspera = (await codigo()).split('\n')[1];
  await page.click('#edicion [data-accion="deshacer"]');
  eq([sinEspera.trim().startsWith('const pos'), (await codigo()).split('\n')[1]], [true, '  await esperar(0.5);'], 'la barra borra el renglón elegido y deshacer lo devuelve');
  await page.click('#b-ejecutar');
  await page.waitForFunction(() => !!document.querySelector('#prog .fila.corre'));
  eq(await evaluar(() => document.querySelector('#prog').classList.contains('quieto')), true, 'al ejecutar se ilumina el renglón y la edición se bloquea');
  await page.click('#b-ejecutar');
  await page.click('.modos-codigo [data-modo-codigo="js"]');
  const raro = 'let x = 1;\nwhile (x < 3) { x++; }\n';
  await page.fill('#codigo', raro);
  await page.click('.modos-codigo [data-modo-codigo="pseudo"]');
  eq(await evaluar(() => [document.querySelector('#app').dataset.modo, window.cmg.codigo.value]), ['js', raro], 'lo que no tiene seudocódigo se queda intacto en JavaScript');

  // Orden de la barra: arrastrar un botón a otro grupo y restaurar.
  await page.click('#b-ajustes');
  await page.click('#ajustes-orden-barra');
  const centro = (sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const de = await centro('#orden-grupos .orden-btn[data-id="borrar"]'), a = await centro('#orden-grupos .orden-btn[data-id="deshacer"]');
  await page.mouse.move(de.x, de.y); await page.mouse.down(); await page.mouse.move(a.x - 25, a.y, { steps: 8 }); await page.mouse.up();
  eq(await evaluar(() => [...document.querySelectorAll('#edicion .grupo-ed')][1] && [...[...document.querySelectorAll('#edicion .grupo-ed')][1].querySelectorAll('[data-accion]')].map(b => b.dataset.accion)),
    ['borrar', 'deshacer', 'rehacer'], 'en Ajustes los botones de la barra se reordenan arrastrando');
  await page.click('#orden-restaurar');
  eq(await evaluar(() => JSON.parse(localStorage.getItem('cmg-juego-barra'))[2]), ['cortar', 'copiar', 'pegar', 'borrar'], 'restaurar devuelve el orden de fábrica');
  await page.click('#orden-cerrar');
  await page.click('#ajustes-cerrar');
}
