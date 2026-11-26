// Campaign-V2 · P7 · producción circular mínima (consolidado del 23-nov, 13.A) y sus invariantes (12.2–12.3).
// Planta de taller montada aquí, sobre el motor y el catálogo de V2: placa → embutidora → domo → sierra o láser →
// semiesfera + recortes → fundidora → placa. Un guion en JS hace de programa (sin intérprete ni pantalla).
// - Conservación: masa en planta + pérdidas = masa inicial + entregas, en cada paso.
// - Ciclo completo: con 5 placas salen 7 semiesferas reciclando dos veces; sin reciclar, solo 5.
// - Acumulación: si nadie retira los recortes, la sierra se bloquea (los recortes no desaparecen).
// - No duplicación, inventarios dentro de capacidad, procesos compatibles, semilla fija y guardado.
// - Sierra frente a láser: la misma semiesfera, con distinto tiempo y energía.
// - Catálogo honesto: una receta que crea masa, o con masa a medias, no deja crear el motor.
import assert from 'node:assert/strict';
import { motor, catalogo } from '../paquetes/reglas-campaign-v2/fabrica/index.js';
import { crearMotor } from '../paquetes/fabrica/index.js';

const { MAQUINAS, PIEZAS, TARIMA_CAP } = catalogo;
const DT = 0.05;
const lote = (id, x, y, tarimaInicial = true) => ({ id, clase: 'lugar', tipo: 'lot', cx: x, cy: y, ax: x, ay: y, tarimaInicial });
function taller({ placas = 5, energia = 12, meta = 7 } = {}) {
  return {
    clave: 'taller', revision: 1, mapa: { losa: { x0: 0, y0: 0, x1: 40, y1: 20 } },
    unidades: [
      { id: 'OBR-1', clase: 'obrero', cx: 10, cy: 10 }, { id: 'OBR-2', clase: 'obrero', cx: 12, cy: 10 },
      lote('PAL-P', 4, 10, { pieza: 'plate', n: placas }), lote('PAL-S', 20, 14), lote('PAL-R', 20, 6),
      { id: 'EMB-01', clase: 'embutidora', cx: 8, cy: 6, ax: 8, ay: 7.5 },
      { id: 'SAW-01', clase: 'sierra', cx: 14, cy: 6, ax: 14, ay: 7.5 },
      { id: 'LSR-01', clase: 'laser', cx: 14, cy: 14, ax: 14, ay: 12.5 },
      { id: 'FND-01', clase: 'fundidora', cx: 26, cy: 10, ax: 24.5, ay: 10 },
      { id: 'BAY-1', clase: 'bahia', cx: 2, cy: 2, ax: 3, ay: 3 },
    ],
    hitos: [{ clave: 'H6', metas: [{ k: 'semiesferas', tipo: 'en', lugar: 'PAL-S', pieza: 'shell', n: meta }] }],
    inicial: {}, presupuesto: 500, premioHito: 0, energia,
  };
}

/** Mundo con un guion síncrono: cada orden avanza el paso fijo hasta su resultado y comprueba las invariantes. */
function abrir(def) {
  const m = motor.crear(def); m.activo = true;
  const resultados = new Map();
  let entregado = 0, sig = 1, pasos = 0, maxUso = 0;
  const c = motor.conectar(m, {
    terminarOrden(_u, id, r) { resultados.set(id, r); },
    entrega(_b, p) { entregado += PIEZAS[p.pieza].masa * p.n; },
  });
  const masa0 = motor.masaEnPlanta(m);
  function invariantes() {
    const balance = motor.masaEnPlanta(m) + m.perdida - (masa0 + entregado);
    assert.ok(Math.abs(balance) < 1e-9, `masa: sobran ${balance} kg en t=${m.t}`);
    for (const q of m.estaciones) {
      assert.ok(q.salida.length <= MAQUINAS[q.clase].salida, `${q.id}: salida sobre su capacidad`);
      assert.ok(motor.totalEntrada(q) <= MAQUINAS[q.clase].entrada, `${q.id}: entrada sobre su capacidad`);
    }
    for (const t of m.tarimas) assert.ok(t.piezas.length <= TARIMA_CAP, `${t.id}: tarima sobre su capacidad`);
  }
  function paso() { c.paso(DT); pasos++; maxUso = Math.max(maxUso, m.energia.uso); invariantes(); }
  function esperar(cond, limite = 4000) {
    for (let i = 0; i < limite && !cond(); i++) paso();
    assert.ok(cond(), `no se cumplió la espera en t=${m.t}`);
  }
  /** Lanza el encargo sin esperarlo y devuelve su id. */
  function lanzar(robot, verbo, lugar, pieza) {
    const id = sig++;
    c.iniciarOrden(robot, { id, verbo, args: pieza === undefined ? [lugar] : [lugar, pieza] });
    return id;
  }
  function orden(robot, verbo, lugar, pieza) {
    const id = lanzar(robot, verbo, lugar, pieza);
    esperar(() => resultados.has(id));
    return resultados.get(id);
  }
  const hay = (id, pieza) => motor.cuantos(m, id, pieza);
  const enSalida = (id, pieza) => m.porId[id].salida.includes(pieza);
  return { m, c, orden, lanzar, esperar, paso, hay, enSalida, resultados, get entregado() { return entregado; },
    get maxUso() { return maxUso; }, masa0 };
}

/** Un obrero hace la cadena entera; si `reciclar`, lleva cada tres recortes a la fundidora. */
function ciclo(w, { cortadora = 'SAW-01', reciclar = true } = {}) {
  const ok = r => assert.equal(r, 'ok');
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    if (reciclar && w.hay('PAL-R', 'scrap') >= 3) {
      for (let i = 0; i < 3; i++) { ok(w.orden('OBR-1', 'pickUp', 'PAL-R', 'scrap')); ok(w.orden('OBR-1', 'deliver', 'FND-01')); }
      w.esperar(() => w.enSalida('FND-01', 'plate'));
      ok(w.orden('OBR-1', 'pickUp', 'FND-01', 'plate')); ok(w.orden('OBR-1', 'deliver', 'PAL-P'));
    }
    if (!w.hay('PAL-P', 'plate')) return;
    ok(w.orden('OBR-1', 'pickUp', 'PAL-P', 'plate')); ok(w.orden('OBR-1', 'deliver', 'EMB-01'));
    w.esperar(() => w.enSalida('EMB-01', 'dome'));
    ok(w.orden('OBR-1', 'pickUp', 'EMB-01', 'dome')); ok(w.orden('OBR-1', 'deliver', cortadora));
    w.esperar(() => w.enSalida(cortadora, 'shell') && w.enSalida(cortadora, 'scrap'));
    ok(w.orden('OBR-1', 'pickUp', cortadora, 'shell')); ok(w.orden('OBR-1', 'deliver', 'PAL-S'));
    ok(w.orden('OBR-1', 'pickUp', cortadora, 'scrap')); ok(w.orden('OBR-1', 'deliver', 'PAL-R'));
  }
}

// 1 · Ciclo completo con reciclaje: 5 placas → 7 semiesferas, 1 recorte suelto y 4 kg de escoria (50 kg en total).
const w = abrir(taller());
assert.equal(w.masa0, 50);
ciclo(w);
assert.equal(w.hay('PAL-S', 'shell'), 7, 'reciclando, cinco placas dan siete semiesferas');
assert.equal(w.hay('PAL-R', 'scrap'), 1);
assert.equal(w.m.perdida, 4, 'dos fundiciones, 2 kg de escoria cada una');
assert.equal(w.m.producidos.scrap, 7, 'cada corte deja sus recortes');
assert.equal(w.m.completado, true, 'la meta de siete semiesferas cierra el hito');
const tReciclando = w.m.t;

// 2 · Sin reciclar, la misma planta se queda en cinco y los recortes se acumulan.
const sin = abrir(taller());
ciclo(sin, { reciclar: false });
assert.equal(sin.hay('PAL-S', 'shell'), 5);
assert.equal(sin.hay('PAL-R', 'scrap'), 5, 'los recortes no desaparecen: se amontonan');
assert.equal(sin.m.perdida, 0);
assert.equal(sin.m.completado, false);

// 3 · Acumulación: si solo se retiran las semiesferas, a la tercera la sierra se bloquea con sus recortes.
const acu = abrir(taller());
for (let i = 0; i < 3; i++) {
  assert.equal(acu.orden('OBR-1', 'pickUp', 'PAL-P', 'plate'), 'ok'); assert.equal(acu.orden('OBR-1', 'deliver', 'EMB-01'), 'ok');
  acu.esperar(() => acu.enSalida('EMB-01', 'dome'));
  assert.equal(acu.orden('OBR-1', 'pickUp', 'EMB-01', 'dome'), 'ok'); assert.equal(acu.orden('OBR-1', 'deliver', 'SAW-01'), 'ok');
  if (i < 2) {
    acu.esperar(() => acu.enSalida('SAW-01', 'shell'));
    assert.equal(acu.orden('OBR-1', 'pickUp', 'SAW-01', 'shell'), 'ok'); assert.equal(acu.orden('OBR-1', 'deliver', 'PAL-S'), 'ok');
  }
}
for (let i = 0; i < 400; i++) acu.paso();
const sierra = acu.m.porId['SAW-01'];
assert.deepEqual(sierra.salida, ['scrap', 'scrap'], 'dos recortes ocupan la salida');
assert.equal(sierra.entrada.dome, 1, 'el tercer domo espera');
assert.equal(motor.estadoMaquina(sierra, acu.m), 'blocked');
assert.equal(motor.estadoMaquina(sierra), 'blocked', 'también sin el mundo (vista y fichas)');
assert.equal(motor.instantanea(acu.m).u['SAW-01'].outputFull, true, 'el programa lo lee en outputFull');
assert.equal(acu.orden('OBR-1', 'pickUp', 'SAW-01', 'scrap'), 'ok');
acu.esperar(() => sierra.proceso !== null, 40);
assert.equal(motor.estadoMaquina(sierra, acu.m), 'working', 'retirar un recorte la desbloquea');

// 4 · No duplicación: dos obreros piden el único recorte a la vez y solo uno se lo lleva.
const conUno = taller({ placas: 0 });
conUno.unidades = conUno.unidades.map(u => u.id === 'PAL-R' ? { ...u, tarimaInicial: { pieza: 'scrap', n: 1 } } : u);
const dup = abrir(conUno);
const a = dup.lanzar('OBR-1', 'pickUp', 'PAL-R', 'scrap'), b = dup.lanzar('OBR-2', 'pickUp', 'PAL-R', 'scrap');
dup.esperar(() => dup.resultados.has(a) && dup.resultados.has(b));
assert.deepEqual([dup.resultados.get(a), dup.resultados.get(b)].sort(), ['ok', 'viaje_vacio'], 'un solo obrero se lleva el recorte');
assert.equal(['OBR-1', 'OBR-2'].filter(id => dup.m.porId[id].carga === 'scrap').length, 1);

// 5 · Procesos compatibles: la fundidora solo acepta recortes y la sierra no acepta placas.
const comp = abrir(taller());
assert.equal(comp.orden('OBR-1', 'pickUp', 'PAL-P', 'plate'), 'ok');
assert.equal(comp.orden('OBR-1', 'deliver', 'FND-01'), 'rechazado');
assert.equal(comp.orden('OBR-1', 'deliver', 'SAW-01'), 'rechazado');
assert.equal(comp.orden('OBR-1', 'deliver', 'EMB-01'), 'ok');

// 6 · Sierra frente a láser: la misma semiesfera y los mismos recortes, en un tercio del tiempo y con cinco veces la potencia.
function cortar(cortadora, energia) {
  const x = abrir(taller({ energia }));
  x.orden('OBR-1', 'pickUp', 'PAL-P', 'plate'); x.orden('OBR-1', 'deliver', 'EMB-01');
  x.esperar(() => x.enSalida('EMB-01', 'dome'));
  x.orden('OBR-1', 'pickUp', 'EMB-01', 'dome'); x.orden('OBR-1', 'deliver', cortadora);
  const t0 = x.m.t; let maxUso = 0;
  x.esperar(() => { maxUso = Math.max(maxUso, x.m.energia.uso); return x.enSalida(cortadora, 'shell'); });
  return { t: Math.round((x.m.t - t0) * 100) / 100, uso: maxUso, salida: [...x.m.porId[cortadora].salida].sort() };
}
const conSierra = cortar('SAW-01', 12), conLaser = cortar('LSR-01', 12), laserJusto = cortar('LSR-01', 4);
assert.deepEqual(conSierra.salida, conLaser.salida, 'la misma receta final');
assert.deepEqual(conSierra.salida, ['scrap', 'shell']);
assert.ok(Math.abs(conSierra.t - 6) <= DT * 2 && Math.abs(conLaser.t - 2) <= DT * 2, `sierra ${conSierra.t} s, láser ${conLaser.t} s`);
assert.deepEqual([conSierra.uso, conLaser.uso], [1, 5], 'kW de cada una mientras corta');
assert.ok(laserJusto.t > conLaser.t + .3, `con 4 kW el láser se frena (${laserJusto.t} s)`);

// 7 · Semilla fija y guardado: la misma partida da el mismo estado, y la pérdida viaja en el checkpoint.
const otra = abrir(taller());
ciclo(otra);
assert.deepEqual(motor.serializar(otra.m), motor.serializar(w.m), 'repetir da exactamente lo mismo');
assert.equal(otra.m.t, tReciclando);
const guardado = motor.serializar(w.m);
assert.equal(guardado.perdida, 4);
assert.equal(motor.crear(taller(), guardado).perdida, 4, 'la escoria registrada vuelve con el checkpoint');

// 8 · Catálogo honesto: el motor no se crea con una receta que fabrica masa ni con masa a medias.
const base = { ...catalogo, PIEZAS: { ...PIEZAS }, RECETAS: { ...catalogo.RECETAS } };
assert.throws(() => crearMotor({ ...base, RECETAS: { ...base.RECETAS, plate: { entra: { scrap: 2 }, sale: 'plate', t: 6 } } }), /sale más masa/);
assert.throws(() => crearMotor({ ...base, RECETAS: { ...base.RECETAS, raro: { entra: { steel: 1 }, sale: 'plate', t: 1 } } }), /todas sus piezas/);
assert.doesNotThrow(() => crearMotor(base));

console.log(`Producción circular: 5 placas → 7 semiesferas reciclando (5 sin reciclar), 4 kg de escoria y masa conservada en cada paso; sierra ${conSierra.t} s a ${conSierra.uso} kW, láser ${conLaser.t} s a ${conLaser.uso} kW (${laserJusto.t} s con 4 kW); acumulación que bloquea, sin duplicados, procesos compatibles, repetible y con la pérdida en el checkpoint.`);
