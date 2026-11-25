import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';
import { repetirIntento } from '../paquetes/app/juego/repetir-intento.js';
import { repartirClic } from '../paquetes/reglas-campaign-v2/index.js';
import { crearHuella } from '../herramientas/partida/huella.mjs';

const terreno = 'terrain.onClick', enemigos = 'enemies.onClick';
const punto = { x: 18, y: 5 };
const enemigo = { id: 'D1', tipo: 'drone', x: 10, y: 4, vx: -2, vy: 0, hp: 1 };
const datos = { id: 'D1', type: 'drone', x: 10, y: 4, hp: 1, vx: -2, vy: 0 };
const ids = ['ambos', 'suelo', 'enemigo', 'ninguno'];
const escucha = (id, e) => id === 'ambos' || (e === terreno ? id === 'suelo' : id === 'enemigo');
const clic = (destino, forzar) => repartirClic(ids, punto, destino, escucha, forzar);
assert.deepEqual(clic(enemigo).map(e => e.args), [[enemigos, datos], [terreno, punto], [enemigos, datos], [datos]]);
assert.deepEqual(clic(null).map(e => e.args), [[terreno, punto], [terreno, punto], [punto], [punto]]);
assert.ok(clic(enemigo, true).every(e => e.verbo === 'intentoPuntual'));

const huella = crearHuella(), copia = crearHuella();
let grabando = true;
const paso = h => (_, foto) => { if (grabando) h.paso(foto); };
const sesion = await montar({ consulta: 'ensayo=b5', alPaso: paso(huella), textos: {
  'LAU-01': 'terrain.onClick(async p => { log(p.x); await esperar(.1); log(p.x+100); regularShoot(p); });\nterrain.onClick(p=>log(-p.x));',
  'LAU-02': 'await Promise.resolve();\nterrain.onClick(p=>log(p.x));',
} });
const { conductor, anfitrion, partida, b, ordenar, avisos, opciones, reglas } = sesion;
assert.equal(anfitrion.estado('LAU-01'), 'escuchando');
assert.equal(anfitrion.estado('LAU-02'), 'error');
assert.equal(avisos.find(m => m.type === 'errorUnidad').linea, 2);
ordenar('clicProgramado', terreno, { x: 1, y: 0 });
await conductor.avanzar(1);
ordenar('clicProgramado', terreno, { x: 2, y: 0 });
await conductor.avanzar(4);
assert.deepEqual(avisos.filter(m => m.type === 'consola').map(m => +m.texto), [1,-1,2,-2,101,102]);
assert.ok(anfitrion.escucha('LAU-01', terreno));
assert.equal(b.porId["LAU-01"].lugar.x, 2);
const grabada = partida.serializar();
assert.deepEqual(grabada.intento.entradas.map(e => e.paso), [0, 1]);
const repetida = await repetirIntento(grabada, reglas, opciones, paso(copia));
grabando = false;
assert.deepEqual(copia.terminar(), huella.terminar());
assert.deepEqual(repetida.serializar(), grabada);

// Un enemigo visible aislado permite comparar directamente con el autoTarget de War.
ordenar('stopFire');
await conductor.avanzar(22);
const l = b.porId['LAU-01'];
Object.assign(enemigo, { x: l.cx + 5, y: l.cy, z: 2.5 });
b.enemigos.push(enemigo);
sesion.aplicar(l.id, 'enemies.onClick(e => regularShoot(e));\nterrain.onClick(p => regularShoot(p));');
await conductor.avanzar(0);
const { tipo, ...lugar } = partida.instantanea().auto[l.id].visual.drone;
const enviar = (e, forzar = false) => {
  for (const orden of repartirClic([l.id], punto, e, anfitrion.escucha, forzar)) conductor.encolar(orden);
};
enviar(enemigo);
await conductor.avanzar(0);
assert.deepEqual(l.lugar, lugar);
assert.equal(l.modo, 'regular');
enviar(null);
await conductor.avanzar(1);
assert.deepEqual(l.lugar, { ...punto, z: 0, id: null });
const previos = l.st.lanzados, previo = l.lugar;
assert.ok(l.cd > .8);
const { tipo: ignorado, ...prediccion } = partida.instantanea().auto[l.id].visual.drone;
enviar(enemigo, true);
await conductor.avanzar(15);
assert.equal(l.st.lanzados, previos);
await conductor.avanzar(5);
assert.equal(l.st.lanzados, previos + 1);
const ultimo = partida.sucesos().filter(s => s.tipo === 'disparo' && s.unidad === l.id).at(-1);
assert.deepEqual([ultimo.datos.x, ultimo.datos.y, ultimo.datos.z], [prediccion.x, prediccion.y, prediccion.z]);
assert.deepEqual(l.lugar, previo);
await conductor.avanzar(20);
assert.equal(l.st.lanzados, previos + 2);
assert.equal(partida.sucesos().filter(s => s.tipo === 'disparo').at(-1).datos.x, punto.x);
ordenar('stopFire');
await conductor.avanzar(0);
for (const motivo of ['municion', 'atasco']) {
  l.misiles = motivo === 'municion' ? 0 : 3;
  l.atascado = motivo === 'atasco';
  const antes = l.st.lanzados;
  enviar(null, true);
  await conductor.avanzar(1);
  assert.equal(partida.sucesos().filter(s => s.tipo === 'puntual-descartada').at(-1).datos.motivo, motivo);
  l.atascado = false; l.misiles = 3;
  await conductor.avanzar(22);
  assert.equal(l.st.lanzados, antes);
}
conductor.cerrar();
console.log('Reparto, registro inicial, solapamiento, repetición, intercepción y disparo puntual verificados.');
