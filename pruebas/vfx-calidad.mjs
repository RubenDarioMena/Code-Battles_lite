// Preferencia, accesibilidad y regresión binaria; no necesita navegador.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolverEfectos, crearCalidadEfectos } from '../paquetes/app/juego/calidad-efectos.js';
import { instalarAjusteEfectos } from '../paquetes/interfaz/layout-efectos.js';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';
import { evaluar, crearEfectos, crearRecetasWar, validarReceta } from '../paquetes/vfx/index.js';

for (const reducido of [false, true]) {
  for (const guardado of [null, 'desconocido', {}, 'auto', 'alto', 'medio', 'bajo', 'no']) {
    for (const url of [null, '', 'desconocido', 'auto', 'alto', 'medio', 'bajo', 'no']) {
      const validos = ['auto', 'alto', 'medio', 'bajo', 'no'];
      const elegido = validos.includes(url) ? url : validos.includes(guardado) ? guardado : 'auto';
      assert.deepEqual(resolverEfectos(url, guardado, reducido), {
        calidad: elegido === 'auto' ? reducido ? 'bajo' : 'alto' : elegido, sinDestellos: reducido,
      });
    }
  }
}
const plataforma = crearPlataformaMemoria();
let cambio, retirado;
const media = { matches: false, addEventListener(tipo, f) { assert.equal(tipo, 'change'); cambio = f; },
  removeEventListener(tipo, f) { assert.equal(tipo, 'change'); retirado = f; } };
plataforma.almacen.escribir('cmg-juego-efectos', '"desconocido"');
const calidad = crearCalidadEfectos({ almacen: plataforma.almacen, media });
assert.equal(calidad.preferencia, 'auto'); assert.equal(calidad.leer().calidad, 'alto');
cambio({ matches: true }); assert.deepEqual(calidad.leer(), { calidad: 'bajo', sinDestellos: true });
let seleccionar;
const select = { value: '', addEventListener(tipo, f) { assert.equal(tipo, 'change'); seleccionar = f; } };
instalarAjusteEfectos(select, {
  leer: (k, d) => JSON.parse(plataforma.almacen.leer(`cmg-juego-${k}`) ?? JSON.stringify(d)),
  escribir: (k, v) => plataforma.almacen.escribir(`cmg-juego-${k}`, JSON.stringify(v)),
  cambiar: calidad.cambiar,
});
assert.equal(select.value, 'auto');
select.value = 'medio'; seleccionar();
assert.equal(plataforma.almacen.leer('cmg-juego-efectos'), '"medio"');
assert.deepEqual(calidad.leer(), { calidad: 'medio', sinDestellos: true });
cambio({ matches: false }); assert.deepEqual(calidad.leer(), { calidad: 'medio', sinDestellos: false });
assert.equal(crearCalidadEfectos({ almacen: plataforma.almacen }).leer().calidad, 'medio');
const forzada = crearCalidadEfectos({ almacen: plataforma.almacen, search: '?vfx=no' });
forzada.cambiar('alto'); assert.equal(forzada.leer().calidad, 'no');
plataforma.almacen.escribir('cmg-juego-efectos', '{roto');
assert.equal(crearCalidadEfectos({ almacen: plataforma.almacen }).preferencia, 'auto');
assert.equal(crearCalidadEfectos({ almacen: { leer() { throw Error(); } } }).preferencia, 'auto');
calidad.destruir(); assert.equal(retirado, cambio);
const html = readFileSync(new URL('../Prototypes/Rocket Launcher/index.html', import.meta.url), 'utf8');
assert(html.includes('id="ajustes-efectos"')); assert(html.includes('aria-describedby="ajustes-efectos-nota"'));

const recetas = crearRecetasWar({ radioDanio: 1.3 });
const bytes = ps => {
  const numeros = ps.flatMap(p => [p.x, p.y, p.z, p.tam, p.alfa, ...p.color, p.paso, p.capa, p.indice, p.estela]);
  const salida = Buffer.alloc(numeros.length * 8);
  numeros.forEach((n, i) => salida.writeDoubleLE(n, i * 8));
  return salida;
};
const todas = [];
for (const nivel of ['alto', 'medio', 'bajo', 'no']) {
  for (const [tipo, r] of Object.entries(recetas)) {
    assert.deepEqual(validarReceta(r), []);
    const sinMarcas = { capas: r.capas.map(({ destello, ...c }) => c) };
    for (const t of [0, .04, .1, .19, .35, .7, 1.1, 1.6]) {
      const s = { paso: 0, tipo, unidad: 'L', datos: { origen: [2, 3, 1], rumbo: .7 } };
      const opciones = { dt: .05, calidad: nivel, colores: {} };
      for (const c of r.capas) for (const token of c.color) if (!token.startsWith('#')) opciones.colores[token] = '#369';
      const original = [], explicito = [], reducido = [], desmarcado = [];
      // El hash es el de las nueve recetas previas: la detonación (Campaign-V2) se valida igual pero no lo cambia.
      if (tipo !== 'detonacion') evaluar(s, r, t, opciones, p => todas.push(p));
      evaluar(s, r, t, opciones, p => original.push(p));
      evaluar(s, r, t, { ...opciones, sinDestellos: false }, p => explicito.push(p));
      evaluar(s, sinMarcas, t, opciones, p => desmarcado.push(p));
      evaluar(s, r, t, { ...opciones, sinDestellos: true }, p => reducido.push(p));
      assert.deepEqual(bytes(original), bytes(explicito));
      assert.deepEqual(bytes(original), bytes(desmarcado));
      assert.deepEqual(reducido, original.filter(p => !r.capas[p.capa].destello));
      const fx = crearEfectos({ dt: .05, recetas: { r }, recetaDe: () => 'r' });
      fx.anotar(s);
      assert.deepEqual(fx.particulas(t, { colores: opciones.colores, calidad: nivel, sinDestellos: true }), reducido);
    }
    for (const c of r.capas.filter(c => c.destello)) {
      assert.equal(c.forma, 'brillo'); assert.equal(c.mezcla, 'suma'); assert((Array.isArray(c.vida) ? c.vida[1] : c.vida) <= .2);
    }
  }
}
assert.equal(todas.length, 4360);
// IEEE-754 little endian, incluidos ceros con signo: capturado del HEAD anterior.
assert.equal(createHash('sha256').update(bytes(todas)).digest('hex'),
  '370ead51dc80156275505ac728f4fda02b951f04c68d1f96e62bd287afd4dc63');
// Capturado ANTES del cambio (paso 2): identidad de 4360 partículas serializadas.
assert.equal(createHash('sha256').update(JSON.stringify(todas)).digest('hex'),
  'a4bff7aa89332d6bd0869c80511d2f6ce8036019e0f464ffe02c00d845224322');
assert.deepEqual(Object.entries(recetas).flatMap(([k, r]) => r.capas.flatMap((c, i) => c.destello ? [`${k}/${i}`] : [])), ['disparo/0', 'impacto/0', 'detonacion/0']);
assert.deepEqual(validarReceta({ capas: [{ ...recetas.disparo.capas[0], destello: false }] }), []);
assert(validarReceta({ capas: [{ ...recetas.disparo.capas[0], destello: 1 }] }).some(e => e.includes('destello')));
console.log('Calidad: prioridad, persistencia independiente, movimiento reducido en caliente, esquema y filtro de destellos; 4360 partículas idénticas al hash anterior.');
