import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { configurar } from '../paquetes/editor/index.js';
import { preparar as modelo } from '../paquetes/editor/seudo-modelo.js';
import { preparar as edicion } from '../paquetes/editor/seudo-edicion.js';
import { preparar as vista } from '../paquetes/editor/seudo-vista.js';
import { CMGProveedor, componerCampaignV2 } from '../paquetes/app/index.js';
import { crearExtensionV2 } from '../paquetes/app/juego/proveedor-v2.js';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';

const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
configurar({ acorn });
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2&ensayo=b1'), undefined, catalogo);
const extension = config.runtime.crearExtension(k => catalogo.es[k]);
const prueba = crearExtensionV2([{ eventos: [{ nombre: 'onDamage', parametro: 'hit',
  nombres: { python: 'on_damage' }, firma: ['fn'], seudo: 'golpe' }] }], k => k, { es: { golpe: 'Cuando recibas daño' } });
const proveedor = CMGProveedor.crear({ serie: 'war', extension });
assert.ok(proveedor.vocabulario('python').objetos.includes('enemies'));
assert.ok(proveedor.alias('python').some(f => f.objeto === 'terrain' && f.nombre === 'on_click'));
assert.deepEqual(proveedor.funciones().find(f => f.nombre === 'regularShoot').firma, ['lugar o enemigo']);
assert.ok(!CMGProveedor.crear({ serie: 'war' }).vocabulario().funciones.includes('onClick'));
const datos = () => ({ tipos: [], red: [], eventos: [...extension.eventos, ...prueba.eventos] });
const ctx = { cmg: { datos }, $: () => ({}), preferencias: {}, datos, idioma: 'es' };
modelo(ctx)(); edicion(ctx); vista(ctx);
ctx.leerCampo = (n, k) => n[k];
ctx.modelo = ctx.raizDe([]); ctx.quieto = () => false;
ctx.cursor = { padre: 'raiz', rama: 'cuerpo', idx: 0 };
ctx.pintarPaleta();
for (const e of datos().eventos) {
  const nodo = ctx.nuevoLadrillo(e.evento);
  assert.equal(nodo.t, 'cuando');
  ctx.modelo.cuerpo.push(nodo);
  nodo.cuerpo = [ctx.nuevoLadrillo('disparo', nodo.id)];
  assert.equal(nodo.cuerpo[0].lugar, e.parametro);
  assert.ok(ctx.$paleta.innerHTML.includes('data-ladrillo="' + e.evento + '"'));
  assert.ok(ctx.htmlNodo(nodo).includes(e.rotulo('es')));
  const js = ctx.generar({ cuerpo: [nodo] }).codigo;
  const vuelta = ctx.parsear(js);
  assert.equal(vuelta.cuerpo[0].evento, e.evento);
  assert.equal(ctx.generar(vuelta).codigo, js);
}
console.log('Las fichas alimentan Python y los bloques de eventos, incluido onDamage de prueba.');
