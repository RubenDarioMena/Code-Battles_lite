// Paletas e inspector: el idioma solo cambia su presentación, nunca los programas insertables.
import assert from 'node:assert/strict';

export async function probarIdiomasPaletaInspector(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (actual, esperado, mensaje) => {
    assert.deepEqual(actual, esperado, mensaje);
    console.log(`OK idiomas paleta/inspector ${++checks}: ${mensaje}`);
  };
  await page.goto(origen);
  const guardados = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  try {
    for (const serie of ['war', 'factory']) {
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio&serie=${serie}`);
      await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.editor);
      for (const lenguaje of ['js', 'python']) {
        await page.selectOption('#sel-lenguaje', lenguaje);
        await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
        await page.evaluate(() => {
          const b = document.querySelector('#paleta .atajo.con-variantes');
          b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        });
        await page.waitForFunction(() => !!document.querySelector('.variantes:not(.variantes-ed):not([hidden])'));
        const antesPaleta = await page.evaluate(() => {
          const menu = document.querySelector('.variantes:not(.variantes-ed):not([hidden])');
          const nodos = [...document.querySelectorAll('#paleta button'), ...menu.querySelectorAll('button')];
          window.__qaPaleta = { menu, nodos, foco: menu.querySelector('button') };
          cmg.codigo.setSelectionRange(0, Math.min(5, cmg.codigo.value.length));
          window.__qaPaleta.foco.focus();
          return { codigo: cmg.codigo.value, seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
            muestras: nodos.map(b => b.dataset.tipCod || ''),
            etiquetas: nodos.map(b => b.dataset.tip), simbolos: [...document.querySelectorAll('#simbolos button')].map(b => b.textContent),
            titulo: document.querySelector('#paleta [data-ico="comentar"]').dataset.tip };
        });
        for (const idioma of ['en', 'es']) {
          await page.evaluate(i => CMGI18n.cambiarIdioma(i), idioma);
          const actual = await page.evaluate(() => {
            const r = window.__qaPaleta;
            const nodos = [...document.querySelectorAll('#paleta button'), ...r.menu.querySelectorAll('button')];
            return { mismos: nodos.length === r.nodos.length && nodos.every((n, i) => n === r.nodos[i]),
              menu: !r.menu.hidden, foco: document.activeElement === r.foco,
              codigo: cmg.codigo.value, seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
              muestras: nodos.map(b => b.dataset.tipCod || ''), etiquetas: nodos.map(b => b.dataset.tip),
              simbolos: [...document.querySelectorAll('#simbolos button')].map(b => b.textContent),
              titulo: document.querySelector('#paleta [data-ico="comentar"]').dataset.tip };
          });
          eq([actual.mismos, actual.menu, actual.foco, actual.codigo, actual.seleccion, actual.muestras, actual.simbolos],
            [true, true, true, antesPaleta.codigo, antesPaleta.seleccion, antesPaleta.muestras, antesPaleta.simbolos],
            `${serie}/${lenguaje}/${idioma}: paleta abierta conserva nodos, foco, código, muestras y símbolos`);
          eq(idioma === 'es' ? actual.etiquetas : actual.titulo !== antesPaleta.titulo,
            idioma === 'es' ? antesPaleta.etiquetas : true,
            `${serie}/${lenguaje}/${idioma}: las etiquetas cambian de idioma y vuelven al español`);
        }
        await page.keyboard.press('Escape');

        await page.evaluate(id => {
          __banco.seleccionar(id);
          document.querySelector('#inspector [data-accion="abrir"]')?.click();
        }, serie === 'factory' ? 'R1' : 'LAU-01');
        const antesIns = await page.evaluate(() => {
          const nodos = [...document.querySelectorAll('#inspector button, #pie-ins button')];
          const foco = document.querySelector('#inspector button[data-ins]');
          foco.focus();
          window.__qaInspector = { nodos, foco, codigo: cmg.codigo.value,
            seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd] };
          return { datos: nodos.map(b => [b.dataset.ins, b.dataset.fin, b.dataset.ajeno]),
            firmas: nodos.filter(b => b.dataset.ins != null).map(b => b.textContent),
            titulo: document.querySelector('#ins-cuerpo .placa').textContent,
            unidad: __banco.seleccionadas };
        });
        for (const idioma of ['en', 'es']) {
          const actual = await page.evaluate(i => {
            // Medir el propio evento en una tarea: el editor también tiene repintados diferidos independientes.
            const antesCambio = [...document.querySelectorAll('#inspector button, #pie-ins button')];
            CMGI18n.cambiarIdioma(i);
            const r = window.__qaInspector, nodos = [...document.querySelectorAll('#inspector button, #pie-ins button')];
            return { mismos: nodos.length === antesCambio.length && nodos.every((n, i) => n === antesCambio[i]),
              foco: document.activeElement === r.foco, codigo: cmg.codigo.value === r.codigo,
              seleccion: cmg.codigo.selectionStart === r.seleccion[0] && cmg.codigo.selectionEnd === r.seleccion[1],
              datos: nodos.map(b => [b.dataset.ins, b.dataset.fin, b.dataset.ajeno]),
              firmas: nodos.filter(b => b.dataset.ins != null).map(b => b.textContent),
              titulo: document.querySelector('#ins-cuerpo .placa').textContent,
              unidad: __banco.seleccionadas };
          }, idioma);
          eq([actual.mismos, actual.foco, actual.codigo, actual.seleccion, actual.datos, actual.firmas, actual.unidad],
            [true, true, true, true, antesIns.datos, antesIns.firmas, antesIns.unidad],
            `${serie}/${lenguaje}/${idioma}: inspector conserva controles, foco, selección, API y datos insertables`);
          eq(idioma === 'es' ? actual.titulo : actual.titulo !== antesIns.titulo,
            idioma === 'es' ? antesIns.titulo : true,
            `${serie}/${lenguaje}/${idioma}: el encabezado del inspector se traduce sin repintarlo`);
        }

        // Ejecutar el atajo tras traducir comprueba el texto insertado, además del tooltip.
        await page.evaluate(() => CMGI18n.cambiarIdioma('en'));
        await page.fill('#codigo', '');
        await page.click('#paleta [data-ico="esperar"]');
        const esperado = lenguaje === 'python' ? `await wait(${serie === 'war' ? '0.5' : '1'})`
          : serie === 'war' ? 'await esperar(0.5);' : 'await wait(1);';
        eq(await page.evaluate(() => cmg.codigo.value.trim()), esperado,
          `${serie}/${lenguaje}: el atajo en inglés inserta el mismo código`);
      }
    }
  } finally {
    await page.evaluate(datos => {
      localStorage.clear();
      for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
    }, guardados);
  }
  return checks;
}
