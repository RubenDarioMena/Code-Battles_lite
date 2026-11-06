// Estado, clase, rol y métricas del inspector se localizan solo en la presentación.
import assert from 'node:assert/strict';

export async function probarIdiomasInspectorEstados(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK idiomas inspector estados ${++checks}: ${msg}`); };
  await page.goto(origen);
  const guardados = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  try {
    for (const [serie, id] of [['factory', 'R1'], ['war', 'LAU-01']]) {
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio&serie=${serie}`);
      await page.waitForFunction(() => window.__juegoListo && !!window.cmg?.editor);
      await page.evaluate(unidad => { __banco.seleccionar(unidad); document.querySelector('#inspector [data-accion="abrir"]')?.click(); }, id);
      await page.waitForFunction(() => !!document.querySelector('#inspector [data-ins-estado]'));
      await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
      const base = await page.evaluate(() => {
        const root = document.querySelector('#inspector');
        const controls = [...root.querySelectorAll('button')];
        const inserciones = controls.map(b => [b.dataset.ins, b.dataset.fin, b.dataset.ajeno]);
        const materias = [...root.querySelectorAll('[data-ins]')].map(b => b.dataset.ins);
        const estado = root.querySelector('[data-ins-estado]');
        const m = __banco.mundo;
        const firmaMundo = JSON.stringify({ t: m.t, seleccionadas: __banco.seleccionadas,
          entidades: (m.entidades || []).map(e => ({ id: e.id, carga: e.carga, tarea: e.tarea, misiles: e.misiles, stock: e.stock })),
          enemigos: (m.enemigos || []).map(e => ({ id: e.id, tipo: e.tipo, hp: e.hp, x: e.x, y: e.y })), cola: m.colaReparar });
        window.__insEstados = { root, controls, estado, inserciones, materias, codigo: cmg.codigo.value,
          seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd], firmaMundo };
        controls.find(b => b.dataset.ins != null)?.focus();
        return { status: estado.textContent, cls: root.querySelector('[data-ins-clase]').textContent,
          role: root.querySelector('[data-ins-rol]').textContent,
          metrics: [...root.querySelectorAll('[data-metricas] .m')].map(x => x.textContent.trim()), materias,
          inserciones, codigo: cmg.codigo.value, seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd], firmaMundo };
      });
      const english = await page.evaluate(() => {
        CMGI18n.cambiarIdioma('en');
        const root = document.querySelector('#inspector'), r = window.__insEstados;
        return { mismoPanel: root === r.root, mismosControles: [...root.querySelectorAll('button')].every((b, i) => b === r.controls[i]),
          status: root.querySelector('[data-ins-estado]').textContent, cls: root.querySelector('[data-ins-clase]').textContent,
          role: root.querySelector('[data-ins-rol]').textContent,
          metrics: [...root.querySelectorAll('[data-metricas] .m')].map(x => x.textContent.trim()),
          inserciones: [...root.querySelectorAll('button')].map(b => [b.dataset.ins, b.dataset.fin, b.dataset.ajeno]),
          materias: [...root.querySelectorAll('[data-ins]')].map(b => b.dataset.ins), foco: document.activeElement === r.controls.find(b => b.dataset.ins != null),
          codigo: cmg.codigo.value, seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd],
          firmaMundo: JSON.stringify({ t: __banco.mundo.t, seleccionadas: __banco.seleccionadas,
            entidades: (__banco.mundo.entidades || []).map(e => ({ id: e.id, carga: e.carga, tarea: e.tarea, misiles: e.misiles, stock: e.stock })),
            enemigos: (__banco.mundo.enemigos || []).map(e => ({ id: e.id, tipo: e.tipo, hp: e.hp, x: e.x, y: e.y })), cola: __banco.mundo.colaReparar }) };
      });
      eq([english.mismoPanel, english.mismosControles, english.foco, english.codigo, english.seleccion, english.inserciones, english.materias, english.firmaMundo],
        [true, true, true, base.codigo, base.seleccion, base.inserciones, base.materias, base.firmaMundo], `${serie}: idioma cambia solo presentación y conserva controles, código, selección y mundo`);
      eq(english.cls === base.cls, false, `${serie}: clase visible se traduce`);
      eq(english.status === base.status, false, `${serie}: estado visible se traduce`);
      if (serie === 'war') eq(english.metrics.some(x => /launched|hits|accuracy/.test(x)), true, 'war: etiquetas métricas en inglés');
      await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
      const vuelta = await page.evaluate(() => ({ status: document.querySelector('[data-ins-estado]').textContent,
        cls: document.querySelector('[data-ins-clase]').textContent,
        metrics: [...document.querySelectorAll('[data-metricas] .m')].map(x => x.textContent.trim()) }));
      eq([vuelta.status, vuelta.cls, vuelta.metrics], [base.status, base.cls, base.metrics], `${serie}: volver a español restaura estado, clase y métricas`);
      if (serie === 'factory') {
        const ensambladora = await page.evaluate(() => {
          __banco.elegirReto(1);
          const ens = __banco.mundo.entidades.find(e => e.id === 'ENS');
          if (!ens) throw new Error('El reto 2 debe incluir ENS para esta regresión');
          __banco.seleccionar('ENS');
          document.querySelector('#inspector [data-accion="abrir"]')?.click();
          CMGI18n.cambiarIdioma('en');
          return { en: document.querySelector('[data-ins-clase]').textContent, nombre: ens.nombre };
        });
        if (ensambladora) {
          eq(ensambladora.en, 'Assembler', 'factory: ENS conserva su clase de presentación traducida');
          const personalizado = await page.evaluate(() => {
            const ens = __banco.mundo.entidades.find(e => e.id === 'ENS'), previo = ens.nombre;
            ens.nombre = 'Mi máquina'; __banco.seleccionar('ENS');
            const visible = document.querySelector('[data-ins-clase]').textContent;
            ens.nombre = previo; CMGI18n.cambiarIdioma('es');
            return visible;
          });
          eq(personalizado, 'Mi máquina', 'factory: nombre personalizado se conserva sin traducir');
        }
      } else {
        const actualizado = await page.evaluate(async () => {
          const l = __banco.mundo.porId['LAU-01'], anterior = l.atascado;
          try {
            l.atascado = true;
            CMGI18n.cambiarIdioma('en');
            const inmediato = document.querySelector('[data-ins-estado]').textContent;
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            return [inmediato, document.querySelector('[data-ins-estado]').textContent, l.atascado];
          } finally { l.atascado = anterior; CMGI18n.cambiarIdioma('es'); }
        });
        eq(actualizado, ['jammed', 'jammed', true], 'war: un estado nuevo permanece traducido tras el evento y los refrescos vivos');
      }
    }
  } finally {
    await page.evaluate(datos => { localStorage.clear(); for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v); }, guardados);
  }
  return checks;
}
