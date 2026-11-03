// Escenario 3D de Factory: modelo T1 con tres LOD, nivel según el zoom, brazo y carga. Origen de QA 8771.
import assert from 'node:assert/strict';
export async function probarFactory3D(page) {
  let checks = 0;
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK 3D ${++checks}: ${msg}`); };
  const origen = 'http://127.0.0.1:8771', url = origen + '/Prototypes/Rocket%20Launcher/?serie=factory&forma=escritorio';
  await page.goto(origen);
  const respaldo = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('cmg-banco03:'))));
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  try {
    await page.evaluate(() => { localStorage.removeItem('cmg-banco03:factory-vista'); localStorage.removeItem('cmg-banco03:vista'); });
    await page.goto(url);
    await page.waitForFunction(() => window.FACTORY_3D?.ultimo?.robot?.niveles?.length === 3, undefined, { timeout: 20000 });
    eq(await page.evaluate(() => [document.querySelector('[data-vista="3d"]').getAttribute('aria-pressed'), document.querySelector('#c3d').hidden]), ['true', false], 'Factory abre en 3D');
    eq(await page.evaluate(() => FACTORY_3D.ultimo.robot.niveles.map(l => [l.torreta, l.hombro, l.codo, l.muneca, l.dedoI, l.dedoD, l.carga].every(Boolean))), [true, true, true], 'los tres LOD tienen los mismos pivotes');
    const tris = await page.evaluate(() => FACTORY_3D.ultimo.robot.niveles.map(l => { let n = 0; l.raiz.traverse(o => { if (o.isMesh) n += o.geometry.index.count / 3; }); return n; }));
    eq(tris[0] > tris[1] && tris[1] > tris[2] && tris[0] <= 12000, true, `triángulos decrecientes por nivel (${tris.join(' / ')})`);
    // Zoom con la rueda sobre el robot: cerca LOD0, lejos LOD2.
    await page.evaluate(() => __banco.seleccionar('R1'));
    await page.click('[data-accion="centrar"]');
    await page.mouse.move(400, 420);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -700);
    await page.waitForFunction(() => cmg.camara().lod === 0, undefined, { timeout: 5000 });
    eq(await page.evaluate(() => cmg.camara().lod), 0, 'acercar muestra LOD0');
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 900);
    await page.waitForFunction(() => cmg.camara().lod === 2, undefined, { timeout: 5000 });
    eq(await page.evaluate(() => [cmg.camara().lod, cmg.camara().dist]), [2, 30], 'alejar hasta el límite muestra LOD2');
    eq(await page.evaluate(() => FACTORY_3D.ultimo.robot.niveles.map(l => l.raiz.visible)), [false, false, true], 'solo un nivel visible');
    // Cinemática del brazo: alcanza un punto a su alcance con la pinza vertical.
    eq(await page.evaluate(() => { const a = FACTORY_3D.ik(.5, .1), L1 = .44, L2 = .38; const x = L1 * Math.sin(a.a1) + L2 * Math.sin(a.a1 + a.a2), y = L1 * Math.cos(a.a1) + L2 * Math.cos(a.a1 + a.a2); return [Math.abs(x - .5) < 1e-6, Math.abs(y - .1) < 1e-6, Math.abs(a.a1 + a.a2 + a.a3 - Math.PI) < 1e-9]; }), [true, true, true], 'IK de dos tramos con la pinza hacia el suelo');
    // La carga del modelo sigue a la del mundo durante una partida, y el resultado no cambia por el 3D.
    await page.evaluate(() => { const b = __banco; b.elegirReto(0); b.programas.R1 = 'for (let i = 0; i < 3; i++) {\n  await pickUp(ENT_1, "cobre");\n  await deliver(FUN);\n}\n'; b.abrirPrograma('R1'); b.turbo(1); b.ejecutar(); });
    await page.waitForFunction(() => window.__banco.mundo.robot.carga === 'cobre', undefined, { timeout: 15000 });
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => FACTORY_3D.ultimo.robot.niveles.every(l => l.carga.visible)), true, 'la caja aparece al recoger');
    await page.waitForFunction(() => !!window.__banco.mundo.fin, undefined, { timeout: 30000 });
    eq(await page.evaluate(() => [__banco.mundo.fin, Math.abs(__banco.mundo.t - 8.7) < 1e-9, FACTORY_3D.ultimo.robot.niveles.some(l => l.carga.visible)]), ['victoria', true, false], 'mismo resultado en 3D y caja entregada');
    await page.click('[data-vista="2d"]');
    eq(await page.evaluate(() => [JSON.parse(localStorage.getItem('cmg-banco03:factory-vista')), localStorage.getItem('cmg-banco03:vista') === JSON.stringify('2d')]), ['2d', false], 'Factory recuerda su vista sin tocar la de War');
    return checks;
  } finally {
    await page.goto(origen);
    await page.evaluate(d => { for (const k of Object.keys(localStorage)) if (k.startsWith('cmg-banco03:')) localStorage.removeItem(k); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, respaldo);
  }
}
