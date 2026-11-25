import assert from 'node:assert/strict';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { validarSuceso } from '../paquetes/protocolo/index.js';
import reglamento, { retos, leerEnemigos, danoEnArea } from '../paquetes/reglas-war/index.js';

// Reto 3 (dos tipos de enemigo) y sin programas: nadie dispara, solo entra el daño de fuera.
const nueva = () => crearPartida({ reglas: reglamento, escenario: { reto: retos.normalizar(retos.RETOS[2]) }, semilla: 7 });
const p = nueva();
while (p.mundo.enemigos.length < 3 && p.mundo.t < 60) p.paso();
const m = p.mundo;
assert.ok(m.enemigos.length >= 3, 'hacen falta tres enemigos en el campo');

// leerEnemigos: copia plana, separada del mundo.
const copia = leerEnemigos(m);
assert.deepEqual(copia, m.enemigos);
copia[0].hp = -99;
assert.notEqual(m.enemigos[0].hp, -99);

// Un círculo que solo alcanza al primero: 1 de daño baja su vida y no lo derriba si le queda.
const [a, b] = m.enemigos;
const lejos = Math.hypot(a.x - b.x, a.y - b.y);
const radio = Math.min(0.5, lejos / 2);
const hpA = a.hp, derribos = m.derribos, desde = p.pasoActual;
assert.deepEqual(danoEnArea(m, a.x, a.y, radio, 1, 'VEH-01'), [a.id]);
assert.equal(a.hp, hpA - 1);
assert.equal(a.golpeT, m.t);
assert.equal(b.hp, b.hpMax, 'fuera del radio no hay daño');

// Daño de sobra: derriba, cuenta para derribosMin y deja los sucesos con su autor.
danoEnArea(m, a.x, a.y, radio, 10, 'VEH-01');
assert.equal(m.enemigos.includes(a), false);
assert.equal(m.derribos, derribos + 1);
assert.ok(m.derribados.some(d => d.tipo === a.tipo && d.t0 === m.t));
const suyos = p.sucesos(desde).filter(s => s.unidad === a.id);
assert.deepEqual(suyos.map(s => s.tipo), ['golpe', 'golpe', 'derribo']);
assert.ok(suyos.every(s => s.datos.por === 'VEH-01'));
for (const s of suyos) assert.deepEqual(validarSuceso(s), []);

// Un círculo vacío no cambia nada y la partida sigue con normalidad.
const antes = structuredClone(m.enemigos);
assert.deepEqual(danoEnArea(m, -50, -50, 1, 5), []);
assert.deepEqual(m.enemigos, antes);
for (let i = 0; i < 40; i++) p.paso();

// Sin llamarlas, War no cambia: misma instantánea que una partida que nunca las usa.
const x = nueva(), y = nueva();
for (let i = 0; i < 300; i++) { x.paso(); y.paso(); leerEnemigos(y.mundo); }
assert.deepEqual(y.instantanea(), x.instantanea());

console.log('War: leerEnemigos copia plana; danoEnArea con radio, derribo contado, sucesos con autor y War intacto sin llamarlas.');
