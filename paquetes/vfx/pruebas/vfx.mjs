import assert from 'node:assert/strict';
import { evaluar, validarReceta, crearEfectos, crearRecetasWar, recetaWar, PRESUPUESTOS } from '../index.js';

let casos = 0;
function prueba(nombre, f) { f(); casos++; }
const colores = Object.fromEntries(['explosion', 'misil', 'enemigo', 'enemigo-frio', 'bad', 'ok', 'edge', 'grid-2'].map((t, i) => [t, [i / 10, .3, .5]]));
const recetas = crearRecetasWar({ radioDanio: 1.3 });
const suceso = { paso: 2, tipo: 'explosion', unidad: 'LAU-01', datos: { x: 3, y: 4, z: 0, golpe: 1, misil: 1 } };
const capa = cambios => ({ forma: 'disco', mezcla: 'normal', n: 1, vida: 1, tam: [1, 2], alfa: [1, 0], color: ['#f00', '#00f'], ...cambios });
function evaluarArray(s = suceso, r = recetas.impacto, t = .4, calidad = 'alto') {
  const salida = [];
  evaluar(s, r, t, { dt: .05, colores, calidad }, p => salida.push(p));
  return salida;
}
const congelar = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(x => { if (x && typeof x === 'object' && !Object.isFrozen(x)) congelar(x); }); } return o; };
function bytes(ps) {
  return Buffer.from(new Float64Array(ps.flatMap(p => [p.x, p.y, p.z, p.tam, p.alfa, ...p.color, p.paso, p.capa, p.indice, p.estela])).buffer);
}
prueba('Esquema de las nueve recetas y legibilidad', () => {
  assert.equal(Object.keys(recetas).length, 9);
  for (const [nombre, receta] of Object.entries(recetas)) {
    assert.deepEqual(validarReceta(receta), [], nombre);
    for (const c of receta.capas) {
      const max = x => Array.isArray(x) ? x[1] : x;
      assert(max(c.vida) + max(c.retraso || 0) <= 1.6);
      if (c.forma === 'humo') assert(Math.max(...c.alfa) <= .24);
      if (c.forma === 'brillo') assert.equal(c.mezcla, 'suma');
      if (c.forma === 'brillo' && Math.max(...c.tam) >= .9) assert(max(c.vida) <= .2);
    }
  }
  const aro = recetas.impacto.capas.find(c => c.dir === 'anillo');
  assert.equal(aro.radioFinal, 1.3);
  assert.equal(crearRecetasWar({ radioDanio: 2 }).impacto.capas.find(c => c.dir === 'anillo').radioFinal, 2);
  assert.throws(() => crearRecetasWar({ radioDanio: 0 }), /radioDanio/);
});
prueba('Diagnósticos de esquema con ruta', () => {
  for (const r of [null, {}, { capas: [] }]) assert(validarReceta(r).some(e => e.includes('capas')));
  const mal = capa({ forma: 'otra', mezcla: 'otra', n: [2, 1], vida: 0, retraso: -1,
    dir: 'otra', deriva: [0], tam: [], alfa: [2], color: ['#no'], suelo: 1, estela: .5, arrastre: -1, typo: 1 });
  const errores = validarReceta({ capas: [mal, null] });
  for (const campo of ['forma', 'mezcla', 'n', 'vida', 'retraso', 'dir', 'deriva', 'tam', 'alfa', 'color', 'suelo', 'estela', 'arrastre', 'typo']) assert(errores.some(e => e.startsWith(`capas[0].${campo}:`)), campo);
  assert(validarReceta({ capas: [capa({ ciclo: .5 })] }).length === 0);
});
prueba('Bit a bit, congelación, orden de llamada y ausencia de estado', () => {
  congelar(suceso); congelar(recetas); congelar(colores);
  const directo = evaluarArray(), datos = JSON.stringify(directo);
  assert(directo.length > 0);
  assert.deepEqual(bytes(directo), bytes(evaluarArray()));
  evaluarArray({ ...suceso, paso: 8, unidad: 'otra' }, recetas.impacto, .9);
  evaluarArray(suceso, recetas.impacto, .9);
  assert.equal(JSON.stringify(evaluarArray()), datos);
  const s0 = { ...suceso, paso: 0 };
  const a = evaluarArray(s0, recetas.impacto, .3);
  evaluarArray(s0, recetas.impacto, .9);
  assert.deepEqual(bytes(evaluarArray(s0, recetas.impacto, .3)), bytes(a));
  for (const cambio of [{ paso: 3 }, { tipo: 'otra' }, { unidad: 'otra' }]) {
    const r = { capas: [capa({ dir: 'esfera', vel: [1, 3], n: 10 })] };
    // Compara edades idénticas para aislar la semilla del tiempo.
    const nuevo = { ...suceso, ...cambio };
    assert.notDeepEqual(evaluarArray(nuevo, r, nuevo.paso * .05 + .2).map(p => p.x), evaluarArray(suceso, r, .3).map(p => p.x));
  }
});
prueba('Tiempo paso×dt, retraso y vida con extremos exclusivos', () => {
  const r = { capas: [capa({ retraso: .2, vida: .5 })] };
  assert.equal(evaluarArray(suceso, r, .299).length, 0);
  assert.equal(evaluarArray(suceso, r, .301).length, 1);
  assert.equal(evaluarArray(suceso, r, .799).length, 1);
  assert.equal(evaluarArray(suceso, r, .8).length, 0);
  const p = evaluarArray({ ...suceso, paso: 0 }, { capas: [capa()] }, .5)[0];
  assert.equal(p.tam, 1.5); assert.equal(p.alfa, .5); assert.deepEqual(p.color, [.5, 0, .5]);
});
prueba('Fórmula de arrastre, deriva y gravedad', () => {
  const s = { paso: 0, tipo: 'x', datos: { origen: [2, 3, 1] } };
  const r = { capas: [capa({ dir: 'arriba', vel: 2, arrastre: 3, grav: -4, deriva: [1, -2, .5] })] };
  const p = evaluarArray(s, r, .4)[0];
  assert.equal(p.x, 2.4); assert.equal(p.y, 2.2);
  assert(Math.abs(p.z - (1 + 2 * (1 - Math.exp(-3 * .4)) / 3 + .5 * .4 - 2 * .4 ** 2)) < 1e-14);
  const q = evaluarArray(s, { capas: [capa({ dir: 'arriba', vel: 2 })] }, .4)[0];
  assert.equal(q.z, 1.8);
  const negativo = evaluarArray(s, { capas: [capa({ alto: -2 })] }, .4)[0];
  assert.equal(negativo.z, -1, 'sin suelo se conserva el origen de la fórmula');
});
prueba('Suelo: primera colisión detiene las tres coordenadas', () => {
  const s = { paso: 0, tipo: 'x', datos: { x: 1, y: 2, z: 1 } };
  const r = { capas: [capa({ vel: 0, grav: -8, deriva: [2, 1, 0], suelo: true })] };
  const antes = evaluarArray(s, r, .3)[0], despues = evaluarArray(s, r, .7)[0], tarde = evaluarArray(s, r, .9)[0];
  assert(antes.z > 0);
  assert.equal(despues.z, 0); assert(Math.abs(despues.x - 2) < 1e-12); assert(Math.abs(despues.y - 2.5) < 1e-12);
  assert.deepEqual([despues.x, despues.y, despues.z], [tarde.x, tarde.y, tarde.z]);
  // Sale desde el suelo hacia arriba antes de volver: no se pega al origen.
  const arriba = { capas: [capa({ dir: 'arriba', vel: 2, grav: -8, suelo: true, deriva: [1, 0, 0] })] };
  const cero = { ...s, datos: { x: 1, y: 2, z: 0 } };
  assert(evaluarArray(cero, arriba, .2)[0].z > 0);
  assert(Math.abs(evaluarArray(cero, arriba, .8)[0].x - 1.5) < 1e-12);
  // Trayectoria con gravedad positiva: aunque vuelva a subir, se queda al primer contacto.
  const rebote = { capas: [capa({ dir: 'arriba', vel: 0, deriva: [1, 0, -5], grav: 10, suelo: true })] };
  const b = evaluarArray(s, rebote, .9)[0];
  assert.equal(b.z, 0); assert(Math.abs(b.x - (1 + (5 - Math.sqrt(5)) / 10)) < 1e-12);
});
prueba('Disparo por la boca hacia destino y aro al radio exacto', () => {
  const s = { paso: 0, tipo: 'disparo', unidad: 'L', datos: { origen: [5, 6, 1], x: 5, y: 12 } };
  const p = evaluarArray(s, recetas.disparo, .04)[0];
  assert(Math.abs(p.x - 5) < 1e-12); assert(Math.abs(p.y - 6.65) < 1e-12);
  const soloAro = { capas: recetas.impacto.capas.filter(c => c.dir === 'anillo') };
  for (const calidad of ['alto', 'medio', 'bajo']) for (const p of evaluarArray(suceso, soloAro, .2, calidad)) assert(Math.abs(Math.hypot(p.x - 3, p.y - 4) - 1.3) < 1e-12);
});
prueba('Calidades, destellos pequeños, no, colores y errores', () => {
  const a = evaluarArray(), m = evaluarArray(suceso, recetas.impacto, .4, 'medio'), b = evaluarArray(suceso, recetas.impacto, .4, 'bajo');
  assert(a.length > m.length && m.length > b.length);
  assert.equal(evaluarArray(suceso, recetas.impacto, .4, 'no').length, 0);
  const r = { capas: [capa({ forma: 'brillo', mezcla: 'suma', n: 10 })] };
  assert.equal(evaluarArray(suceso, r)[0].tam * .8, evaluarArray(suceso, r, .4, 'medio')[0].tam);
  assert.equal(evaluarArray(suceso, r)[0].tam * .6, evaluarArray(suceso, r, .4, 'bajo')[0].tam);
  assert.throws(() => evaluarArray(suceso, r, .4, 'ultra'), /Calidad/);
  assert.throws(() => evaluar(suceso, r, .4, { dt: 0 }, () => {}), /dt/);
  assert.throws(() => evaluarArray(suceso, { capas: [capa({ color: ['no-resuelto'] })] }), /Color sin resolver/);
});
prueba('Intervalo n entero inclusivo, incluyendo cero partículas', () => {
  const r = { capas: [capa({ n: [0, 1] })] };
  const cantidades = new Set(Array.from({ length: 64 }, (_, paso) => evaluarArray({ paso, tipo: 'n' }, r, paso * .05 + .2).length));
  assert.deepEqual([...cantidades].sort(), [0, 1]);
});
prueba('Selector War evita duplicar atasco y descarta sucesos ajenos', () => {
  assert.equal(recetaWar(suceso), 'impacto');
  assert.equal(recetaWar({ ...suceso, datos: { misil: 1, golpe: 0 } }), 'fallo');
  assert.equal(recetaWar({ ...suceso, datos: { misil: null, golpe: 0 } }), null);
  for (const [tipo, nombre] of [['crawler', 'derribo-oruga'], ['drone', 'derribo-dron'], ['stealth', 'derribo-dron-frio']]) assert.equal(recetaWar({ paso: 0, tipo: 'derribo', datos: { tipo } }), nombre);
  for (const tipo of ['golpe', 'aparece', 'registro']) assert.equal(recetaWar({ paso: 0, tipo }), null);
  for (const tipo of ['disparo', 'atasco', 'reparado', 'brecha']) assert.equal(recetaWar({ paso: 0, tipo }), tipo);
});
prueba('Presupuesto: humo antes de restos, antiguos primero aunque se anoten después', () => {
  const r = { capas: [capa({ forma: 'humo' }), capa({ forma: 'disco' }), capa({ forma: 'brillo', mezcla: 'suma' })] };
  function crear(presupuesto) {
    const g = crearEfectos({ recetas: { r }, recetaDe: () => 'r', dt: .05, presupuesto });
    g.anotar({ paso: 2, tipo: 'nuevo' }); g.anotar({ paso: 0, tipo: 'viejo' });
    return g;
  }
  const cinco = crear(5).particulas(.3);
  assert.equal(cinco.filter(p => p.forma === 'humo').length, 1);
  assert.equal(cinco.find(p => p.forma === 'humo').paso, 2);
  const tres = crear(3).particulas(.3);
  assert.equal(tres.filter(p => p.forma === 'humo').length, 0);
  assert.equal(tres.find(p => p.forma === 'disco').paso, 2);
  assert(crear(2).particulas(.3).every(p => p.mezcla === 'suma'));
  assert.equal(crear(0).particulas(.3).length, 0);
});
prueba('Presupuestos predeterminados, ajustables, emisor, vaciar y poda definitiva', () => {
  assert.deepEqual(PRESUPUESTOS, { alto: 2000, medio: 1200, bajo: 600, no: 0 });
  const r = { capas: [capa({ n: 10000, estela: 1 })] };
  const g = crearEfectos({ recetas: { r }, recetaDe: () => 'r', dt: .05 });
  g.anotar({ paso: 0, tipo: 'x' });
  for (const c of ['alto', 'medio', 'bajo', 'no']) assert.equal(g.particulas(.3, { calidad: c }).length, PRESUPUESTOS[c]);
  const emitidas = []; const vivas = g.particulas(.3, {}, p => emitidas.push(p)); assert.deepEqual(emitidas, vivas);
  g.particulas(2); assert.equal(g.particulas(.3).length, 0);
  const mutable = { paso: 0, tipo: 'x' }; g.anotar(mutable); mutable.paso = 999;
  assert.equal(g.particulas(.3).length, 2000); g.vaciar(); assert.equal(g.particulas(.3).length, 0);
  const porCalidad = crearEfectos({ recetas: { r }, recetaDe: () => 'r', dt: .05, presupuesto: { medio: 7 } });
  porCalidad.anotar({ paso: 0, tipo: 'x' }); assert.equal(porCalidad.particulas(.3, { calidad: 'medio' }).length, 7);
  assert.throws(() => crearEfectos({ recetas: { r }, recetaDe: () => 'r', dt: .05, presupuesto: -1 }), /presupuesto/);
});
console.log(`VFX: ${casos} grupos de pruebas; determinismo binario, fórmula, suelo, calidades, recetas y presupuesto.`);
