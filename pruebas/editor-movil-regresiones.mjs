// Regresiones del review móvil: ficha en todas las vistas, Tab vacío, listas y seguimiento de consola.
// Mismo adaptador page/cdp y origen dedicado que editor-movil.mjs; no se ejecuta sobre una partida real.
import assert from 'node:assert/strict';

export async function probarRegresionesEditorMovil(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, mensaje) => { assert.deepEqual(a, b, mensaje); console.log(`OK regresión ${++checks}: ${mensaje}`); };
  const url = `${origen}/Prototypes/Rocket%20Launcher/`;
  const poner = (texto, pos = 0) => page.evaluate(([t, p]) => { const c = cmg.codigo; c.value = t; c.dispatchEvent(new Event('input')); c.setSelectionRange(p, p); }, [texto, pos]);
  const texto = () => page.evaluate(() => [cmg.codigo.value, cmg.codigo.selectionStart, cmg.codigo.selectionEnd]);
  const abrirFicha = async pestana => { await page.click('#b-info-reto'); await page.click(`#info-t-${pestana}`); await page.waitForTimeout(220); };
  const ajustes = async selector => { await page.click('#b-menu-cod'); await page.click('#menu-cod [data-menu="ajustes"]'); await page.click(selector); await page.click('#ajustes-cerrar'); };
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.goto(`${url}?forma=movil`);
  await page.waitForFunction(() => window.__juegoListo);
  const previa = await page.evaluate(() => { const k = 'cmg-juego-pantalla-completa', v = localStorage.getItem(k); localStorage.setItem(k, 'true'); return v; });
  try {
    await page.reload();
    await page.waitForFunction(() => window.__juegoListo);
    await page.evaluate(() => { cmg.edicion.activar(false); __banco.elegirReto(0); document.querySelector('#app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })); });

    for (const [inicial, pos, esperado, cursor] of [
      ['', 0, '  ', 2],
      ['stopFire();\n\n', 12, 'stopFire();\n  \n', 14],
      ['if (true) {\n  \n}', 14, 'if (true) {\n    \n}', 16],
      ['stopFire();\nstopFire();', 12, 'stopFire();\n  stopFire();', 14],
    ]) {
      await poner(inicial, pos);
      await page.click('#paleta [data-ico="tabular"]');
      eq(await texto(), [esperado, cursor, cursor], 'Tab sangra la línea del cursor, incluso vacía o al principio');
    }
    await poner('stopFire();');
    await ajustes('[data-lenguaje-programa="python"]');
    await poner('if True:\n    \n', 13);
    await page.click('#paleta [data-ico="tabular"]');
    eq(await texto(), ['if True:\n        \n', 17, 17], 'Tab en una línea vacía de Python añade cuatro espacios y conserva el cursor');
    await page.evaluate(() => cmg.edicion.accion('desangrar'));
    eq(await texto(), ['if True:\n    \n', 13, 13], 'quitar sangría en la línea vacía de Python recupera el nivel anterior');
    await ajustes('[data-modo-codigo="js"]');

    await poner(Array(18).fill('await esperar(0.5);').join('\n'));
    await page.evaluate(() => cmg.seudo.aplicarModo('pseudo'));
    eq(await page.evaluate(() => !!document.querySelector('#b-info-reto').getClientRects().length), true, 'la ficha sigue accesible en seudocódigo');
    await abrirFicha('inspector');
    eq(await page.evaluate(() => document.querySelector('#pie-ins').getBoundingClientRect().height > 0), true, 'el inspector se abre sin salir del seudocódigo');
    await page.click('#info-t-consola');
    eq(await page.evaluate(() => document.querySelector('#consola').getBoundingClientRect().height > 0), true, 'la consola se abre sin salir del seudocódigo');
    await page.click('#info-reto-cerrar');
    await page.evaluate(() => { const p = document.querySelector('#prog'); p.scrollTop = p.scrollHeight; });
    await page.click('#prog .slot-s >> nth=17');
    const listaDentro = () => page.evaluate(() => {
      const l = document.querySelector('.sugerencias:not([hidden])').getBoundingClientRect(), p = document.querySelector('#prog').getBoundingClientRect();
      const barras = ['#edicion', '#paleta-seudo'].map(s => document.querySelector(s).getBoundingClientRect());
      return l.height > 50 && l.top >= p.top && l.bottom <= p.bottom && barras.every(b => l.bottom <= b.top || l.top >= b.bottom);
    });
    eq(await listaDentro(), true, 'la lista del último renglón no tapa ninguna barra');
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 740, deviceScaleFactor: 1, mobile: true });
    await page.evaluate(() => document.querySelector('#prog .slot.abierto').scrollIntoView({ block: 'nearest' }));
    await page.waitForTimeout(150);
    eq(await listaDentro(), true, 'la lista se adapta a un cambio de alto con el hueco abierto');
    await page.click('.sugerencias:not([hidden]) .sug[data-i="0"]');
    eq(await page.evaluate(() => cmg.codigo.value), [...Array(17).fill('await esperar(0.5);'), 'await esperar(0.1);'].join('\n') + '\n', 'la opción elegida solo cambia el último renglón');

    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate(() => cmg.seudo.aplicarModo('js'));
    await poner('for (let i = 0; i < 100; i++) { console.log("fila " + i); }\nawait esperar(30);');
    await page.click('#b-ejecutar-movil');
    await page.waitForFunction(() => document.querySelector('#consola').textContent.includes('fila 99'));
    await page.click('#b-ver-codigo');
    await abrirFicha('consola');
    const ultimoVisible = () => page.evaluate(() => {
      const c = document.querySelector('#pie-con'), r = c.getBoundingClientRect(), u = document.querySelector('#consola').lastElementChild.getBoundingClientRect();
      return c.scrollTop > 0 && u.top >= r.top && u.bottom <= r.bottom;
    });
    eq(await ultimoVisible(), true, 'abrir una consola larga muestra el mensaje final');
    await page.evaluate(() => { document.querySelector('#pie-con').scrollTop = 0; });
    await page.click('#b-ejecutar-movil'); // detener añade otro mensaje mientras la consola está abierta
    await page.waitForTimeout(80);
    eq(await ultimoVisible(), true, 'un mensaje nuevo desplaza el contenedor visible de la consola');
    eq(await page.evaluate(() => document.querySelector('#b-info-reto').classList.contains('con-nuevo')), false, 'un mensaje mostrado no queda marcado como pendiente');
    await page.click('#b-ejecutar-movil'); // nuevo intento: la ficha sigue abierta, pero el mapa oculta el código
    await page.waitForFunction(() => document.querySelector('#consola').textContent.includes('fila 99'));
    eq(await page.evaluate(() => document.querySelector('#b-info-reto').classList.contains('con-nuevo')), true, 'los mensajes recibidos en el mapa quedan pendientes');
    await page.click('#b-ver-codigo');
    eq(await ultimoVisible(), true, 'volver del mapa con la ficha abierta muestra los mensajes nuevos');
    eq(await page.evaluate(() => document.querySelector('#b-info-reto').classList.contains('con-nuevo')), false, 'volver a la consola borra la marca de novedades');
    await page.click('#b-ejecutar-movil');
    await page.click('#info-reto-cerrar');

    await page.goto(`${url}?serie=factory&forma=movil`);
    await page.waitForFunction(() => window.__juegoListo);
    await page.evaluate(() => { __banco.elegirReto(0); document.querySelector('#app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })); cmg.seudo.aplicarModo('bloques'); });
    eq(await page.evaluate(() => !!document.querySelector('#b-info-reto').getClientRects().length), true, 'la ficha sigue accesible en los bloques de Factory');
    await abrirFicha('inspector');
    eq(await page.evaluate(() => document.querySelector('#pie-ins').textContent.includes('pickUp')), true, 'el inspector de Factory se consulta desde bloques');
    await page.click('#info-t-consola');
    eq(await page.evaluate(() => document.querySelector('#consola').getBoundingClientRect().height > 0), true, 'la consola de Factory se consulta desde bloques');
  } finally {
    await page.evaluate(v => { const k = 'cmg-juego-pantalla-completa'; if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }, previa);
    await page.cdp('Emulation.clearDeviceMetricsOverride');
    await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  }
  return checks;
}
