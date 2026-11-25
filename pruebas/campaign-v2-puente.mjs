import assert from 'node:assert/strict';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';

const c = componerCampaignV2(new URLSearchParams('serie=campaign-v2&ensayo=b5'));
for (const n of [0, 1, 3, 8]) {
  const p = crearPartida({ reglas: c.reglas, escenario: { ...c.escenario(c.indiceInicial), bodega: n }, semilla: 7 });
  const m = p.mundo, b = m.batalla;
  // Aislamos el inventario y vaciamos los dos cargadores del reto.
  m.fabrica.estaciones[0].marcha = false;
  for (const l of b.lanzadores) l.misiles = 0;
  for (let i = 1; i <= 150; i++) {
    p.paso();
    const cargados = b.lanzadores.reduce((total, l) => total + l.misiles, 0);
    assert.equal(cargados + m.bodega.misiles, n);
    const porTorreta = Math.floor(i * .05 * b.def.suministro + 1e-9);
    assert.equal(cargados, Math.min(2 * porTorreta, n));
  }
  assert.equal(m.bodega.misiles, 0);
}
console.log('Puente B5: dos cargadores al ritmo del reto, conservación de 0, 1, 3 y 8 misiles.');
