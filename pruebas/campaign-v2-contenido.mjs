import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { niveles, validarNivel, esFabrica } from '../paquetes/reglas-campaign-v2/index.js';
import war, { retos } from '../paquetes/reglas-war/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';

import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';

const raiz = new URL('../paquetes/reglas-campaign-v2/niveles/', import.meta.url);
const carpetas = (await readdir(raiz, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
assert.deepEqual(Object.keys(niveles).sort(), carpetas.sort());
const config = (opciones = {}, contenido) => componerCampaignV2(new URLSearchParams({ serie: 'campaign-v2', ...opciones }), contenido, catalogo);
for (const carpeta of carpetas) {
  const contenido = niveles[carpeta];
  const { hitos } = contenido.default;
  assert.deepEqual(validarNivel(carpeta, contenido, war.api.tipos, catalogo), []);
  const archivos = await readdir(new URL(carpeta + '/', raiz));
  // nivel.js, un archivo por hito y la planta de fábrica (fabrica.js) si el nivel tiene hitos de fábrica.
  const planta = hitos.some(esFabrica) ? ['fabrica.js'] : [];
  assert.deepEqual(archivos.filter(f => f.endsWith('.js')).sort(), ['nivel.js', ...planta, ...hitos.map(h => h + '.js')].sort());
  for (const hito of hitos) {
    // Los hitos de fábrica se juegan en su sesión (pruebas/campaign-v2-fabrica.mjs); no tienen ensayo suelto.
    if (esFabrica(hito)) { assert.throws(() => config({ ensayo: hito }, contenido), new RegExp(`${hito}\\.js · ensayo`)); continue; }
    const c = config({ ensayo: hito }, contenido);
    const p = crearPartida({ reglas: c.reglas, escenario: c.escenario(c.indiceInicial), semilla: 7 });
    assert.deepEqual([p.mundo.hito, p.mundo.modo], [hito, 'ensayo']);
    while (!p.evaluar() && p.pasoActual < 8001) p.paso();
    assert.ok(p.evaluar(), hito);
    assert.deepEqual(c.reglas.escena(p.mundo), war.escena(p.mundo.batalla));
    assert.ok(p.sucesos().some(s => s.tipo === 'fin'), hito);
  }
}
const base = niveles['nivel-1'];
const comprobarError = (contenido, patron) => assert.throws(() => config({}, contenido), patron);
comprobarError({ ...base, b1: { clave: 'b1', war: 7 } }, /nivel-1\/b1\.js · war · .*1 a 5/);
comprobarError({ ...base, default: { ...base.default, hitos: ['b1', 'b1'] } }, /nivel-1\/nivel\.js · hitos\[1\] · hito repetido/);
comprobarError({ ...base, b1: { war: 1 } }, /nivel-1\/b1\.js · clave/);
comprobarError({ ...base, b1: { clave: 'b1' } }, /nivel-1\/b1\.js · lanzadores/);
comprobarError({ ...base, default: { ...base.default, marco: {} } }, /nivel-1\/nivel\.js · marco.origen/);
comprobarError({ ...base, h1: { ...base.h1, pistas: 9 } }, /h1\.js · campaign\.hito\.1\.pista\.3 · falta la clave i18n/);
comprobarError({ ...base, h1: { ...base.h1, metas: [{ ...base.h1.metas[0], pieza: 'ausente' }] } }, /h1\.js · metas\[0\]\.pieza · pieza desconocida/);
comprobarError({ ...base, h2: { ...base.h2, metas: [{ ...base.h2.metas[0], lugar: 'PAL-9' }] } }, /h2\.js · metas\[0\]\.lugar · lugar desconocido/);
comprobarError({ ...base, h0: { ...base.h0, alEmpezar: { entregas: [{ lugar: 'BAY-9', pieza: 'steel', n: 12 }] } } }, /h0\.js · alEmpezar\.entregas\[0\]\.lugar/);
const original = retos.normalizar(retos.RETOS[0]);
const propio = { ...original, suministro: 0, mapa: { cols: 40 } };
const copia = { ...base, b1: { clave: 'b1', ...propio } };
for (const [opciones, modo, reto] of [[{}, 'campaign', propio], [{ ensayo: 'b1' }, 'ensayo', propio],
  [{ modo: 'paridad', batalla: 'b1' }, 'paridad', original]]) {
  const c = config(opciones, copia);
  const p = crearPartida({ reglas: c.reglas, escenario: c.escenario(c.batallas.indexOf('b1')), semilla: 1 });
  assert.deepEqual([p.mundo.hito, p.mundo.modo, p.mundo.batalla.def], ['b1', modo, reto]);
}
console.log('Contenido Campaign-V2: Batallas jugadas sin vista, hitos de fábrica sin ensayo suelto, errores por archivo y campo, reto propio y original de paridad comprobados.');
