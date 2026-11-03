// Paridad contra el oráculo histórico, en la aplicación y runtime comunes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function probarFactoryComun(page, { origen = 'http://127.0.0.1:8771', todos = true } = {}) {
  assert.match(origen, /^http:\/\/(127\.0\.0\.1|localhost):8771$/);
  const fixture = JSON.parse(await readFile(new URL('./factory-oraculo.json', import.meta.url), 'utf8'));
  const deltas = JSON.parse(await readFile(new URL('./factory-deltas.json', import.meta.url), 'utf8'));
  for (const c of fixture.casos) if (deltas.casos[c.id]) Object.assign(c.resultado, deltas.casos[c.id].cambios);
  const casos = fixture.casos.filter(c => todos || c.reto === 0);
  await page.goto(origen);
  const respaldo = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('cmg-banco03:'))));
  const original = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('cmg-banco02:'))));
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  try {
    for (const c of casos) {
      await page.goto(origen);
      await page.evaluate(caso => {
        localStorage.setItem('cmg-banco03:factory-reto', JSON.stringify(caso.reto));
        localStorage.setItem('cmg-banco03:factory-telemetria', JSON.stringify(Array.from({ length: caso.intento - 1 }, () => ({ reto: caso.reto + 1 }))));
        if (caso.escenario) localStorage.setItem('cmg-banco03:factory-propio', JSON.stringify(caso.escenario));
      }, c);
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?serie=factory&forma=escritorio`);
      await page.waitForFunction(() => !!window.cmg && !!window.__banco);
      await page.evaluate(caso => {
        const b = window.__banco;
        b.programas.R1 = caso.codigo; b.abrirPrograma('R1');
        b.turbo(20); // Escala visual ya ofrecida por War para QA; DT y reglas intactos.
        b.ejecutar();
      }, c);
      await page.waitForFunction(() => !!window.__banco.mundo.fin, undefined, { timeout: 30000 });
      const actual = await page.evaluate(() => {
        const b = window.__banco, m = b.mundo, t = b.telemetria.at(-1);
        return {
          fin: m.fin, motivo: t.motivo, mensaje: t.mensaje, linea: t.linea,
          t: m.t, intento: t.intento, derrames: m.derrames, vacios: m.vacios, stockOculto: m.stockOculto,
          metas: b.def.metas.map(meta => {
            const e = m.porId[meta.id];
            const valor = meta.tipo === 'vaciar' ? e.stock[meta.mat] || 0 : e.recibido[meta.mat] || 0;
            return { ...meta, valor, cumplida: meta.tipo === 'vaciar' ? valor === 0 && m.robot.carga !== meta.mat : valor >= meta.n };
          }),
          robot: { x: m.robot.x, y: m.robot.y, carga: m.robot.carga, viajes: m.robot.viajes },
          resultados: m.resultados, eventos: m.eventos,
        };
      });
      const rechazos = await page.evaluate(() => __banco.mundo.rechazos);
      assert.equal(rechazos, (actual.resultados.lleno || 0) + (actual.resultados.rechazado || 0), `${c.id}: cuenta rechazos sin derramar`);
      assert(Math.abs(actual.t - c.resultado.t) <= 1e-9, `${c.id}: tiempo`);
      assert.deepEqual(actual, c.resultado, `${c.id}: paridad de reglas y runtime`);
      console.log(`OK Factory común: ${c.id}`);
    }
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('cmg-banco02:')))), original, 'No se escribe en el Factory original');
    return casos.length;
  } finally {
    await page.goto(origen);
    await page.evaluate(datos => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('cmg-banco03:')) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
    }, respaldo);
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: false });
  }
}
