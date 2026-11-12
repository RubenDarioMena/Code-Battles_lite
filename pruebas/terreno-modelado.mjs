// Recibe una Page de Playwright; utiliza exclusivamente el origen dedicado de QA.
import assert from 'node:assert/strict';

export async function probarModelado(page, base = 'http://127.0.0.1:8771') {
  let comprobaciones = 0;
  const verificar = (valor, mensaje) => { assert.ok(valor, mensaje); comprobaciones++; };
  const errores = [], registrarError = e => errores.push(e.message);
  const estado = () => page.evaluate(() => CMGTerreno.serializar(__terreno.mapa));
  const bloques = () => page.evaluate(() => __terreno.mapa.bloques);
  async function vector(nombre, valores) {
    for (let i = 0; i < 3; i++) await page.locator(`[data-bloques-${nombre}] input`).nth(i).fill(String(valores[i]));
  }
  async function pulsarCampo(x, z, sumar = false) {
    const p = await page.evaluate(([x, z]) => __terreno.proyectar(x, z), [x, z]);
    if (sumar) await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y);
    if (sumar) await page.keyboard.up('Shift');
  }
  page.on('pageerror', registrarError);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/herramientas/terreno/?motor=webgl');
    await page.waitForFunction(() => window.__terreno?.listo);
    await page.evaluate(() => { localStorage.removeItem(CMGTerreno.CLAVE_BORRADOR); localStorage.removeItem(CMGTerreno.CLAVE_JUEGO); });
    await page.reload(); await page.waitForFunction(() => window.__terreno?.listo);
    await page.locator('#modo-bloques').click();
    verificar((await bloques()).length === 0, 'Escena inicial sin bloques.');
    await page.locator('[data-bloque-crear="caja"]').click();
    verificar((await bloques()).length === 1, 'Crear una caja desde la interfaz.');
    const cajaId = (await bloques())[0].id;
    const antesTransformar = await estado();
    await page.locator('[data-bloques-nombre]').fill('Caja <img src=x onerror=alert(1)>');
    await vector('posicion', [12, 2, 7]); await vector('rotacion', [0, 45, 0]); await vector('escala', [1.5, .5, 2]);
    await page.locator('[data-bloques-aplicar-objeto]').click();
    let caja = (await bloques())[0];
    verificar(JSON.stringify(caja.posicion) === '[12,2,7]' && Math.abs(caja.rotacion[1] - Math.PI / 4) < 1e-12 && JSON.stringify(caja.escala) === '[1.5,0.5,2]', 'Transformación completa y grados convertidos a radianes.');
    verificar(await page.locator('#panel-bloques img').count() === 0 && (await page.locator('[data-bloques-titulo]').textContent()).includes('<img'), 'Los nombres importables se muestran como texto.');
    const transformado = await estado();
    await page.locator('[data-bloques-escala] input').nth(0).fill('0');
    await page.locator('[data-bloques-aplicar-objeto]').click();
    verificar(await estado() === transformado, 'Una escala inválida no altera el documento.');
    await page.locator('#deshacer').click(); verificar(await estado() === antesTransformar, 'Una entrada rechazada no añade historial.');
    await page.locator('#rehacer').click(); verificar(await estado() === transformado, 'Rehacer restaura geometría, nombre y transformación.');

    // Dejar una caja conocida para verificar los clics sobre vértices y caras.
    await page.locator('[data-bloque-id]').check();
    await page.locator('[data-bloques-nombre]').fill('Caja de pruebas');
    await vector('posicion', [16, 0, 9]); await vector('rotacion', [0, 0, 0]); await vector('escala', [1, 1, 1]);
    await page.locator('[data-bloques-aplicar-objeto]').click();
    await page.locator('#cenital').click(); await page.waitForTimeout(400);
    await page.locator('[data-bloque-modo="vertice"]').click();
    await pulsarCampo(14, 7);
    const descripcionVertice = await page.locator('[data-bloques-vertice-info]').textContent();
    verificar(/Vértice \d+/.test(descripcionVertice), 'Un clic elige un vértice proyectado.');
    const indice = Number(descripcionVertice.match(/Vértice (\d+)/)[1]) - 1;
    const antesVertice = (await bloques())[0].vertices.slice();
    const nuevaY = antesVertice[indice * 3 + 1] + .75;
    await page.locator('[data-bloques-vertice-xyz] input').nth(1).fill(String(nuevaY));
    await page.locator('[data-bloques-aplicar-vertice]').click();
    caja = (await bloques())[0];
    verificar(caja.vertices[indice * 3 + 1] === nuevaY && caja.vertices.every((v, i) => i === indice * 3 + 1 || v === antesVertice[i]), 'Editar un vértice cambia únicamente su coordenada local elegida.');
    await page.locator('[data-bloque-modo="cara"]').click(); await pulsarCampo(16.6, 8.5);
    verificar(/Cara triangular \d+/.test(await page.locator('[data-bloques-cara-info]').textContent()), 'Raycast selecciona una cara triangular.');
    const antesExtruir = (await bloques())[0];
    await page.locator('[data-bloques-distancia]').fill('1'); await page.locator('[data-bloques-extruir]').click();
    caja = (await bloques())[0];
    verificar(caja.vertices.length === antesExtruir.vertices.length + 9 && caja.indices.length === antesExtruir.indices.length + 18, 'Extruir agrega la tapa y tres paredes trianguladas.');

    await page.locator('[data-bloque-modo="objeto"]').click();
    for (const [tipo, x] of [['rampa', 0], ['cilindro', 32], ['plano', 44]]) {
      await page.locator(`[data-bloque-crear="${tipo}"]`).click();
      await vector('posicion', [x, 0, 9]); await page.locator('[data-bloques-aplicar-objeto]').click();
    }
    verificar((await bloques()).length === 4, 'Las cuatro primitivas se crean y permanecen editables.');
    await page.locator('#cenital').click(); await page.waitForTimeout(400);
    await pulsarCampo(16.5, 9);
    verificar(await page.locator(`[data-bloque-id="${cajaId}"]`).isChecked() && await page.locator('[data-bloque-id]:checked').count() === 1, 'Clic selecciona un objeto sin pintar el terreno.');
    await pulsarCampo(0, 9, true);
    verificar(await page.locator('[data-bloque-id]:checked').count() === 2, 'Shift + clic añade otro objeto.');
    await page.locator('[data-bloque-id]').nth(2).check();
    verificar(await page.locator('[data-bloque-id]:checked').count() === 3, 'La lista ofrece selección múltiple mediante casillas.');
    const antesUnir = await estado(), elegidos = (await bloques()).slice(0, 3);
    await page.locator('[data-bloques-unir]').click();
    const unidos = await bloques(), union = unidos.find(b => b.nombre === 'Unión de bloques');
    verificar(unidos.length === 2 && union.vertices.length === elegidos.reduce((n, b) => n + b.vertices.length, 0), 'Unir combina las mallas seleccionadas y conserva el objeto restante.');
    const despuesUnir = await estado();
    await page.locator('#deshacer').click(); verificar(await estado() === antesUnir, 'Deshacer devuelve las mallas originales de una unión.');
    await page.locator('#rehacer').click(); verificar(await estado() === despuesUnir, 'Rehacer recupera exactamente la malla combinada.');
    await page.locator(`[data-bloque-id="${union.id}"]`).check(); await page.locator('[data-bloques-eliminar]').click();
    verificar((await bloques()).length === 1, 'Eliminar quita solo los objetos elegidos.');
    await page.locator('#deshacer').click(); verificar(await estado() === despuesUnir, 'Eliminar se puede deshacer sin perder la geometría.');

    const descargaPendiente = page.waitForEvent('download'); await page.locator('#json').click();
    const descarga = await descargaPendiente, stream = await descarga.createReadStream(), partes = [];
    for await (const parte of stream) partes.push(parte);
    const json = Buffer.concat(partes);
    verificar(JSON.stringify(JSON.parse(json.toString('utf8'))) === despuesUnir, 'El JSON descargado contiene vértices, índices y transformaciones.');
    await page.locator('#nuevo').click(); await page.getByRole('button', { name: 'Terreno plano', exact: true }).click();
    await page.waitForFunction(() => __terreno.mapa.bloques.length === 0);
    verificar((await bloques()).length === 0, 'Nuevo mapa también limpia los bloques.');
    await page.locator('#archivo').setInputFiles({ name: 'modelado.json', mimeType: 'application/json', buffer: json });
    await page.waitForFunction(() => __terreno.mapa.bloques.length === 2);
    verificar(await estado() === despuesUnir, 'Importar recupera exactamente el mapa modelado.');
    await page.waitForFunction(() => localStorage.getItem(CMGTerreno.CLAVE_BORRADOR) === CMGTerreno.serializar(__terreno.mapa));
    await page.reload(); await page.waitForFunction(() => window.__terreno?.listo);
    verificar(await estado() === despuesUnir, 'Autoguardado y recarga conservan las mallas.');
    const preciso = JSON.parse(despuesUnir);
    Object.assign(preciso.bloques[0], { posicion: [44.123456789, .123456789, 9], rotacion: [0, .123456789, 0], escala: [1.123456789, 1, 1] });
    preciso.bloques[0].vertices[0] += .000000123456;
    await page.locator('#archivo').setInputFiles({ name: 'precision.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(preciso)) });
    await page.waitForFunction(() => __terreno.mapa.bloques[0].posicion[0] === 44.123456789);
    await page.locator('#modo-bloques').click(); await page.locator('[data-bloque-id]').first().check();
    await page.locator('[data-bloques-nombre]').fill('Precisión conservada'); await page.locator('[data-bloques-aplicar-objeto]').click();
    const renombrado = (await bloques())[0], esperado = { ...preciso.bloques[0], nombre: 'Precisión conservada' };
    verificar(JSON.stringify(renombrado) === JSON.stringify(esperado), 'Renombrar conserva la precisión importada de geometría y transformaciones.');
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#modo-bloques').click();
    await page.locator('[data-bloque-id]').first().check();
    verificar(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'El panel de modelado funciona a 390 px sin desbordar.');
    verificar(await page.locator('[data-bloques-posicion] input').count() === 3 && await page.locator('[data-bloques-aplicar-objeto]').isVisible(), 'Las transformaciones siguen disponibles en móvil.');
    verificar(errores.length === 0, 'Sin excepciones de navegador: ' + errores.join('; '));
    return { comprobaciones, objetos: (await bloques()).length };
  } finally { page.off('pageerror', registrarError); }
}
