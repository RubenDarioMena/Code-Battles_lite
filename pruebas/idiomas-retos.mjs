import assert from 'node:assert/strict';

// Contenidos incluidos frente a datos del jugador: cambiar idioma nunca selecciona otro reto.
export async function probarIdiomasRetos(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK idiomas retos ${++checks}: ${msg}`); };
  const titulos = { war: ['First target', 'Priorities', 'Fog', 'Swarm', 'Two launchers'],
    factory: ['First trip', 'Two materials', 'No rejected deliveries', 'Against the clock', 'Until empty', 'Plan B'] };
  await page.goto(origen);
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  try {
    for (const serie of ['war', 'factory']) {
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?serie=${serie}`);
      await page.waitForFunction(() => window.__juegoListo);
      for (let i = 0; i < titulos[serie].length; i++) {
        const antes = await page.evaluate(i => {
          __banco.elegirReto(i); cmg.seudo.aplicarModo("js"); CMGI18n.cambiarIdioma('es');
          const codigo = cmg.codigo; codigo.focus(); codigo.setSelectionRange(0, 3);
          window.__qaReto = { mundo: __banco.mundo, def: JSON.stringify(__banco.def), codigo: codigo.value,
            fuentes: JSON.stringify(__banco.fuentes), seleccion: [codigo.selectionStart, codigo.selectionEnd],
            storage: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'cmg-interfaz-idioma')) };
          return [__banco.def.titulo, __banco.def.objetivo, __banco.def.leccion];
        }, i);
        const en = await page.evaluate(() => {
          CMGI18n.cambiarIdioma('en'); const r = __qaReto;
          return { textos: ['titulo', 'objetivo-corto', 'leccion'].map(id => document.getElementById(id).textContent),
            estable: r.mundo === __banco.mundo && r.def === JSON.stringify(__banco.def) && r.codigo === cmg.codigo.value
              && r.fuentes === JSON.stringify(__banco.fuentes) && document.activeElement === cmg.codigo,
            seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
            storage: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'cmg-interfaz-idioma')),
            esperadoStorage: r.storage, esperadoSeleccion: r.seleccion };
        });
        eq([en.textos[0], en.textos[1] !== antes[1], en.textos[2] !== antes[2]],
          [titulos[serie][i], true, true], `${serie}/${i}: título, objetivo y lección en inglés`);
        eq([en.estable, en.seleccion, en.storage], [true, en.esperadoSeleccion, en.esperadoStorage],
          `${serie}/${i}: conserva mundo, escenario, código, foco, selección y guardados`);
        eq(await page.evaluate(() => { CMGI18n.cambiarIdioma('es'); return ['titulo', 'objetivo-corto', 'leccion'].map(id => document.getElementById(id).textContent); }),
          antes, `${serie}/${i}: español original sin cambios`);
      }
      await page.evaluate(() => { __banco.elegirReto(0); document.querySelector('#b-info-reto').click(); document.querySelector('#info-t-pista').click(); });
      await page.click('[data-info-accion="ver-pista"]');
      const pista = await page.evaluate(() => {
        const nodo = document.querySelector('.pista-partes li');
        window.__qaPista = { nodo, texto: nodo.textContent, guardado: localStorage.getItem('cmg-banco03:pistas') };
        CMGI18n.cambiarIdioma('en');
        return [nodo === document.querySelector('.pista-partes li'), nodo.textContent !== __qaPista.texto,
          localStorage.getItem('cmg-banco03:pistas') === __qaPista.guardado,
          document.querySelectorAll('.pista-partes li').length];
      });
      eq(pista, [true, true, true, 1], `${serie}: pista abierta cambia de idioma conservando nodo y desbloqueo`);
      eq(await page.evaluate(() => { CMGI18n.cambiarIdioma('es'); return document.querySelector('.pista-partes li').textContent === __qaPista.texto; }),
        true, `${serie}: la misma parte vuelve al español`);
      await page.evaluate(() => document.querySelector('#info-t-metas').click());
      eq(await page.evaluate(() => {
        const filas = [...document.querySelectorAll('.meta-fila')], b = document.querySelector('#info-t-metas'); b.focus();
        const antes = document.querySelector('.m-nombre').textContent;
        CMGI18n.cambiarIdioma('en');
        return [document.querySelector('.m-nombre').textContent !== antes,
          filas.every((n, i) => n === document.querySelectorAll('.meta-fila')[i]), document.activeElement === b];
      }), [true, true, true], `${serie}: las metas traducen etiquetas conservando filas y foco`);
      if (serie === 'war') eq(await page.evaluate(() => document.querySelector('#metas').textContent.includes('breaches')
        && document.querySelector('#metas').textContent.includes('₵ per kill')), true, 'War: HUD en inglés sin esperar cambios de simulación');

      for (const ancho of [320, 393]) {
        await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 852, deviceScaleFactor: 1, mobile: true });
        await page.waitForFunction(w => innerWidth === w, ancho);
        eq(await page.evaluate(() => {
          const mundo = __banco.mundo, titulo = document.querySelector('#titulo');
          CMGI18n.cambiarIdioma('es'); const es = titulo.textContent;
          CMGI18n.cambiarIdioma('en');
          return [__banco.mundo === mundo, titulo === document.querySelector('#titulo'), titulo.textContent !== es];
        }), [true, true, true], `${serie}/${ancho} px: título en inglés sin recrear la cabecera ni el mundo`);
      }
      await page.cdp('Emulation.clearDeviceMetricsOverride');
      // Un escenario copiado o importado tiene contenido propio, aunque coincida con el original.
      eq(await page.evaluate(() => {
        const d = JSON.parse(JSON.stringify(__banco.def)); d.titulo = 'Mi reto personalizado'; d.objetivo = 'Conservar mi objetivo'; d.pista = 'Pista propia.';
        __banco.usarEscenario(d); const guardado = JSON.stringify(__banco.def);
        for (const idioma of ['en', 'es']) { CMGI18n.cambiarIdioma(idioma);
          if (document.querySelector('#titulo').textContent !== d.titulo || document.querySelector('#objetivo-corto').textContent !== d.objetivo
            || JSON.stringify(__banco.def) !== guardado) return false;
        }
        return true;
      }), true, `${serie}: enunciado propio y escenario importado no se traducen`);
    }
  } finally {
    await page.evaluate(datos => { localStorage.clear(); for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v); }, storage);
  }
  return checks;
}
