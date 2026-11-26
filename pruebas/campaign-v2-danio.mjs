// Campaign-V2 · P8 · daño por componentes y recuperación (consolidado del 23-nov, 7.1–7.5, 8.2 y 13.B) con las
// invariantes de 12.2 y los casos de 12.3 que le tocan:
// - Conservación exacta en gramos: reutilizable + fragmento + chatarra + perdido = masa original, en cada golpe.
// - Tanque corroído en el centro: dos fragmentos grandes (proa y popa) con masas coherentes.
// - Preciso frente a explosivo: los dos lo dejan fuera de combate; el preciso conserva casi toda la masa.
// - Láser en un borde: un solo fragmento nuevo, sin masas absurdas.
// - Destrucción total sin material que reaparezca y golpes repetidos sin botín doble; recogida una sola vez.
// - Sin dependencia de la malla ni de los efectos, determinista y estable ante miles de erosiones pequeñas.
// - Los lotes recogidos entran en la fundidora del catálogo de la fábrica y la masa cuadra de punta a punta.
import assert from 'node:assert/strict';
import { danio, motorFabrica as motor } from '../paquetes/reglas-campaign-v2/index.js';
import { catalogo } from '../paquetes/reglas-campaign-v2/fabrica/index.js';
import * as THREE from '../shared/vendor/three-r180/three.module.min.js';
import { crearRestos3D } from '../paquetes/vista-3d/index.js';

const { crearRestos, golpear, balance, fragmentos, estado, recuperar, VEHICULOS: { oruga: ORUGA } } = danio;
const MASA_LOTE = catalogo.PIEZAS.scrap.masa;
const ORIGINAL = 77000;

/** Comprueba las invariantes de un estado de restos (12.2, 1, 3 y 6). */
function invariantes(r, antes) {
  const b = balance(r);
  assert.equal(b.total, b.original, `la masa no cuadra: ${b.total} g de ${b.original} g`);
  for (const c of r.componentes) {
    assert.ok(Number.isInteger(c.masa) && c.masa >= 0 && c.masa <= c.masa0, `${c.id}: masa fuera de rango (${c.masa})`);
    assert.ok(c.integridad >= 0 && c.integridad <= 1, `${c.id}: integridad fuera de rango (${c.integridad})`);
    assert.equal(c.masa + c.chatarra + c.perdido, c.masa0, `${c.id}: su masa no cuadra`);
    if (antes) {
      const a = antes.get(c.id);
      assert.ok(c.masa <= a.masa && c.chatarra >= a.chatarra && c.perdido >= a.perdido, `${c.id}: la materia volvió atrás`);
    }
  }
  const enFragmentos = fragmentos(r).reduce((s, f) => s + f.masa, 0);
  assert.equal(enFragmentos, b.reutilizable + b.fragmento, 'los fragmentos reparten exactamente la masa que queda');
}
const foto = r => new Map(r.componentes.map(c => [c.id, { masa: c.masa, chatarra: c.chatarra, perdido: c.perdido }]));
function atacar(r, ataques) {
  for (const a of ataques) { const antes = foto(r); golpear(r, a); invariantes(r, antes); }
  return r;
}
const CENTRO = [0, 0, 0.45], MOTOR = [-0.65, 0, 0.8], ARMA = [0.1, 0, 0.92];
const kg = g => g / 1000;

// 0 · Vehículo intacto.
const intacto = crearRestos(ORUGA);
invariantes(intacto);
assert.equal(balance(intacto).original, ORIGINAL);
assert.deepEqual(estado(intacto), { funciones: { movilidad: true, fuego: true }, fueraDeCombate: false });
assert.equal(fragmentos(intacto).length, 1, 'intacto, es un solo fragmento');

// 1 · Tanque corroído en el centro (7.2): el ácido se lleva el chasis central y quedan proa y popa sueltas.
const corroido = crearRestos(ORUGA);
let dosis = 0;
while (!estado(corroido).fueraDeCombate) { atacar(corroido, [{ perfil: 'corrosivo', punto: CENTRO }]); dosis++; }
assert.equal(dosis, 4, 'cuatro dosis de ácido bastan para partirlo');
const [grande, segundo] = fragmentos(corroido);
assert.deepEqual([grande.componentes.sort(), segundo.componentes.sort()], [['motor', 'popa'], ['electronica', 'proa']],
  'los dos fragmentos grandes son la popa con el motor y la proa con la electrónica');
assert.ok(grande.masa <= 24000 && segundo.masa <= 17000, 'ningún fragmento pesa más que sus componentes enteros');
assert.ok(grande.masa > 18000 && segundo.masa > 12000, 'el ácido del centro apenas toca los extremos');
const bc = balance(corroido);
assert.ok(bc.perdido < ORIGINAL * 0.12, `se pierde relativamente poco (${kg(bc.perdido)} kg)`);
assert.ok(corroido.uniones.filter(u => u.rota).every(u => u.a === 'centro' || u.b === 'centro'), 'solo se rompen las uniones del centro');

// 2 · Preciso frente a explosivo (7.1 y 12.3): dos disparos al motor y al arma frente a una explosión en el centro.
const preciso = atacar(crearRestos(ORUGA), [{ perfil: 'preciso', punto: MOTOR }, { perfil: 'preciso', punto: ARMA }]);
const explosivo = atacar(crearRestos(ORUGA), [{ perfil: 'explosivo', punto: CENTRO }]);
assert.equal(estado(preciso).fueraDeCombate, true, 'sin motor ni arma queda fuera de combate');
assert.equal(estado(explosivo).fueraDeCombate, true);
const bp = balance(preciso), be = balance(explosivo);
assert.ok(bp.perdido < ORIGINAL * 0.02, 'fuera de combate y casi toda su masa sigue ahí (7.4)');
assert.ok(bp.reutilizable > ORIGINAL * 0.75, 'el resto del vehículo sigue entero');
assert.ok(be.perdido > bp.perdido * 5 && be.reutilizable === 0, 'la explosión dispersa mucho más y no deja nada reutilizable');
assert.ok(fragmentos(explosivo).length > fragmentos(preciso).length, 'y lo parte en más pedazos');
const rp = recuperar(preciso, { masaLote: MASA_LOTE }), re = recuperar(explosivo, { masaLote: MASA_LOTE });
assert.ok(rp.lotes > re.lotes, `el disparo preciso deja más botín (${rp.lotes} lotes frente a ${re.lotes})`);
for (const [b, rec] of [[bp, rp], [be, re]]) {
  assert.equal(rec.lotes * MASA_LOTE * 1000 + rec.sobra + rec.perdidoRecogida + b.perdido, ORIGINAL, 'la recogida conserva la masa');
}

// 3 · Una explosión leve no destruye por definición: el vehículo sigue operativo.
const leve = atacar(crearRestos(ORUGA), [{ perfil: 'explosivo', punto: [0.6, 0, 0], energia: 0.5 }]);
assert.equal(estado(leve).fueraDeCombate, false);
assert.equal(fragmentos(leve).length, 1);

// 4 · Láser en un borde pequeño (12.3): solo la electrónica, un fragmento nuevo y masas sensatas.
const borde = atacar(crearRestos(ORUGA), [{ perfil: 'preciso', punto: [0.9, 0.2, 0.9] }]);
assert.deepEqual(borde.historial[0].efectos.map(e => e.id), ['electronica'], 'el preciso solo alcanza un componente');
const fb = fragmentos(borde);
assert.equal(fb.length, 2);
assert.deepEqual(fb[1].componentes, ['electronica']);
assert.ok(fb[1].masa < 3000 && fb[1].masa > 2000);
assert.deepEqual(estado(borde).funciones, { movilidad: true, fuego: false }, 'sin sensores no dispara, pero se mueve');

// 5 · Destrucción total y golpes sobre lo destruido: nada reaparece y nada da botín doble.
const total = crearRestos(ORUGA);
for (let i = 0; i < 12; i++) atacar(total, [{ perfil: 'explosivo', punto: CENTRO, energia: 3 }]);
assert.ok(total.componentes.every(c => c.masa === 0), 'todo destruido');
const bt = balance(total);
assert.equal(bt.reutilizable + bt.fragmento, 0);
const ultimo = golpear(total, { perfil: 'explosivo', punto: CENTRO, energia: 3 });
assert.deepEqual(ultimo.efectos, [], 'golpear lo ya destruido no genera nada');
assert.deepEqual(balance(total), bt);
assert.deepEqual(fragmentos(total), []);
const rt = recuperar(total, { masaLote: MASA_LOTE });
assert.ok(rt.lotes > 0, 'la chatarra sí se recoge');
assert.equal(rt.lotes * MASA_LOTE * 1000 + rt.sobra + rt.perdidoRecogida + bt.perdido, ORIGINAL);
assert.deepEqual(recuperar(total, { masaLote: MASA_LOTE }), { lotes: 0, sobra: 0, perdidoRecogida: 0, reutilizables: [], repetida: true },
  'el mismo resto no se recoge dos veces');

// 6 · Reutilizables apartados: si no se funden, salen como componentes y no entran en los lotes.
const aparte = atacar(crearRestos(ORUGA), [{ perfil: 'preciso', punto: MOTOR }]);
const ra = recuperar(aparte, { masaLote: MASA_LOTE, fundirReutilizables: false });
const enteros = ra.reutilizables.reduce((s, x) => s + x.masa, 0);
assert.ok(ra.reutilizables.some(x => x.id === 'arma') && !ra.reutilizables.some(x => x.id === 'motor'));
assert.equal(ra.lotes * MASA_LOTE * 1000 + ra.sobra + ra.perdidoRecogida + balance(aparte).perdido + enteros, ORIGINAL);

// 7 · Independiente de la malla y de los efectos (13.B, 12.2-7): la misma definición con una malla de 500 o de 50 000
// triángulos y efectos encendidos o no da el mismo resultado; y la misma secuencia da siempre lo mismo.
const secuencia = [{ perfil: 'corrosivo', punto: CENTRO }, { perfil: 'preciso', punto: MOTOR }, { perfil: 'explosivo', punto: [0.8, 0.3, 0.5], energia: 0.7 },
  { perfil: 'corrosivo', punto: [-0.6, -0.5, 0.3], energia: 2 }];
const conMalla = tri => ({ ...ORUGA, malla: { triangulos: tri }, vfx: tri > 1000,
  componentes: ORUGA.componentes.map(c => ({ ...c, triangulos: tri / 8 })) });
const huella = def => JSON.stringify((({ porId, ...r }) => r)(atacar(crearRestos(def), secuencia)));
assert.equal(huella(conMalla(500)), huella(conMalla(50000)), 'el resultado no depende de los triángulos');
assert.equal(huella(ORUGA), huella(ORUGA), 'determinista');

// 8 · Estabilidad (12.2-8): dos mil erosiones pequeñas en sitios distintos no corrompen el estado.
const lento = crearRestos(ORUGA);
for (let i = 0; i < 2000; i++) {
  const antes = foto(lento);
  golpear(lento, { perfil: 'corrosivo', punto: [Math.sin(i) * 0.9, Math.cos(i * 1.3) * 0.6, 0.2 + (i % 7) / 10], energia: 0.01 });
  invariantes(lento, antes);
}
assert.ok(lento.componentes.every(c => Number.isFinite(c.integridad)));

// 9 · Del campo a la fundidora con el mismo modelo de material (13.B-5): los lotes del disparo preciso se funden en
// la fábrica de V2. La masa del tanque cuadra de punta a punta: perdida en combate + sobra en el campo + placas +
// recortes sin fundir + escoria.
const lotes = rp.lotes;
const pal = (id, x, n) => ({ id, clase: 'lugar', tipo: 'lot', cx: x, cy: 10, ax: x, ay: 10, tarimaInicial: n ? { pieza: 'scrap', n } : true });
const planta = {
  clave: 'recogida', revision: 1, mapa: { losa: { x0: 0, y0: 0, x1: 30, y1: 20 } },
  unidades: [
    { id: 'OBR-1', clase: 'obrero', cx: 10, cy: 12 },
    pal('PAL-A', 4, Math.min(lotes, catalogo.TARIMA_CAP)), pal('PAL-B', 7, lotes - Math.min(lotes, catalogo.TARIMA_CAP)), pal('PAL-P', 18, 0),
    { id: 'FND-01', clase: 'fundidora', cx: 12, cy: 6, ax: 12, ay: 7.5 },
    { id: 'BAY-1', clase: 'bahia', cx: 2, cy: 2, ax: 3, ay: 3 },
  ],
  hitos: [{ clave: 'R', metas: [{ k: 'placas', tipo: 'en', lugar: 'PAL-P', pieza: 'plate', n: 99 }] }],
  inicial: {}, presupuesto: 0, premioHito: 0, energia: 10,
};
const m = motor.crear(planta); m.activo = true;
const hechos = new Map();
let sig = 1;
const c = motor.conectar(m, { terminarOrden(_u, id, r) { hechos.set(id, r); } });
const enPlanta = () => motor.masaEnPlanta(m) + m.perdida;
assert.equal(enPlanta(), lotes * MASA_LOTE, 'la planta recibe exactamente la masa de los lotes');
function orden(verbo, lugar, pieza) {
  const id = sig++;
  c.iniciarOrden('OBR-1', { id, verbo, args: pieza ? [lugar, pieza] : [lugar] });
  for (let i = 0; i < 4000 && !hechos.has(id); i++) { c.paso(0.05); assert.ok(Math.abs(enPlanta() - lotes * MASA_LOTE) < 1e-9); }
  assert.equal(hechos.get(id), 'ok', `${verbo} ${lugar}`);
}
for (let placa = 0; placa < Math.floor(lotes / 3); placa++) {
  for (let i = 0; i < 3; i++) {
    orden('pickUp', motor.cuantos(m, 'PAL-A', 'scrap') ? 'PAL-A' : 'PAL-B', 'scrap');
    orden('deliver', 'FND-01');
  }
  for (let i = 0; i < 4000 && !m.porId['FND-01'].salida.includes('plate'); i++) c.paso(0.05);
  orden('pickUp', 'FND-01', 'plate'); orden('deliver', 'PAL-P');
}
const placas = motor.cuantos(m, 'PAL-P', 'plate'), sueltos = lotes % 3;
assert.equal(placas, Math.floor(lotes / 3));
assert.equal(motor.cuantos(m, 'PAL-A', 'scrap') + motor.cuantos(m, 'PAL-B', 'scrap'), sueltos);
const masaPlaca = catalogo.PIEZAS.plate.masa;
assert.equal(bp.perdido + rp.perdidoRecogida + rp.sobra + (placas * masaPlaca + sueltos * MASA_LOTE + m.perdida) * 1000, ORIGINAL,
  'perdido en combate + sobra + placas + recortes + escoria = la masa original del tanque');

// 10 · La vista solo representa (13.B-4, 9.1): un grupo por fragmento, sin masa no se ve, chatarra acotada, el punto de
// un clic vuelve a las coordenadas de las reglas, y la calidad cambia la máscara sin tocar las reglas.
const vista = crearRestos3D(THREE, { perfiles: danio.PERFILES });
const vr = crearRestos(ORUGA);
vista.actualizar(vr, fragmentos(vr));
const grupos = () => vista.grupo.children.filter(o => o.userData.ids);
assert.equal(grupos().length, 1, 'intacta, un solo grupo');
const mallaDe = id => vista.mallas().find(m => m.userData.componente === id);
const caja = new THREE.Box3().setFromObject(mallaDe('motor'));
const centroMotor = caja.getCenter(new THREE.Vector3());
assert.deepEqual(vista.puntoLocal({ object: mallaDe('motor'), point: centroMotor }), [-0.65, 0, 0.8], 'el clic vuelve a metros de las reglas');
const antes = JSON.stringify(vr.componentes);
for (let i = 0; i < 4; i++) golpear(vr, { perfil: 'corrosivo', punto: CENTRO });
vista.actualizar(vr, fragmentos(vr));
assert.equal(grupos().length, fragmentos(vr).length, 'un grupo por fragmento lógico');
for (let i = 0; i < 60; i++) vista.animar(0.05);
const g = grupos().find(o => o.userData.ids.includes('arma'));
assert.ok(Math.abs(g.position.y + (0.92 - 0.17)) < 0.01, 'el arma suelta cae hasta el suelo');
const vt = crearRestos(ORUGA);
for (let i = 0; i < 12; i++) golpear(vt, { perfil: 'explosivo', punto: CENTRO, energia: 3 });
const vistaTotal = crearRestos3D(THREE, { perfiles: danio.PERFILES, calidad: 'baja' });
vistaTotal.actualizar(vt, fragmentos(vt));
assert.equal(vistaTotal.mallas().length, 0, 'sin masa no queda nada visible');
const trozos = vistaTotal.grupo.children.find(o => !o.userData.ids && o.type === 'Group');
assert.equal(trozos.children.length, 8, 'la chatarra se ve como ocho trozos como mucho');
const huellaReglas = JSON.stringify(vr.componentes);
vista.fijarCalidad('baja', vr, fragmentos(vr));
assert.equal(vista.triangulos(), 2);
assert.equal(JSON.stringify(vr.componentes), huellaReglas, 'cambiar la calidad no toca las reglas');
assert.notEqual(antes, huellaReglas);
vista.liberar(); vistaTotal.liberar();

console.log(`campaign-v2-danio ok · corroído en ${dosis} dosis (${kg(grande.masa)} + ${kg(segundo.masa)} kg), preciso ${rp.lotes} lotes frente a`
  + ` explosivo ${re.lotes}, ${placas} placas de un tanque`);
