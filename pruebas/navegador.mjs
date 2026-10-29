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
  await page.waitForFunction(() => !!window.__banco && !!window.cmg);
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
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
    ctx.font = s.font;
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
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log(`${checks} comprobaciones de navegador correctas`);
  return checks;
}
