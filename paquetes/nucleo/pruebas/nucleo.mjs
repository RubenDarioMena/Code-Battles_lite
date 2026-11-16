import comprobar from 'node:assert/strict';
import {
  DT, avanzar, mulberry32, crearRng, pasoDe, crearColaOrdenes,
  crearRegistroSucesos, adjuntarSucesos, anotarSuceso, crearPartida, restaurar,
} from '../index.js';

let comprobaciones = 0;
function igual(actual, esperado) {
  comprobar.deepEqual(actual, esperado);
  comprobaciones++;
}
function cerca(actual, esperado) {
  comprobar.ok(Math.abs(actual - esperado) < 1e-12);
  comprobaciones++;
}
function falla(accion, mensaje) {
  comprobar.throws(accion, mensaje);
  comprobaciones++;
}

// Acumulador: cortes, orden de consultas y resto sin redondear.
igual(DT, 0.05);
{
  const mundo = { activo: true, fin: null };
  const llamadas = [];
  const control = {
    algunoCorre() { llamadas.push('corre'); return false; },
    despertarProgramas() { llamadas.push('despertar'); return false; },
    paso(dt) { llamadas.push(dt); },
  };
  igual(avanzar(0.01, mundo, control), 0.01);
  igual(llamadas, []);
  cerca(avanzar(0.12, mundo, control), 0.02);
  igual(llamadas, ['corre', 'despertar', DT, 'corre', 'despertar', DT]);
  llamadas.length = 0;
  igual(avanzar(0.12, mundo, { ...control, algunoCorre: () => true }), 0.12);
  igual(llamadas, []);
  igual(avanzar(0.12, mundo, {
    ...control, despertarProgramas() { llamadas.push('despertar'); return true; },
  }), 0.12);
  igual(llamadas, ['corre', 'despertar']);
  llamadas.length = 0;
  igual(avanzar(0.12, { activo: false, fin: null }, control), 0.12);
  igual(avanzar(0.12, { activo: true, fin: 'victoria' }, control), 0.12);
  igual(llamadas, []);
  for (const campo of ['activo', 'fin', 'corre', 'despertar']) {
    const estado = { activo: true, fin: null };
    let pasos = 0;
    const resto = avanzar(0.17, estado, {
      algunoCorre: () => campo === 'corre' && pasos === 1,
      despertarProgramas: () => campo === 'despertar' && pasos === 1,
      paso(dt) {
        igual(dt, DT);
        pasos++;
        if (campo === 'activo') estado.activo = false;
        if (campo === 'fin') estado.fin = 'victoria';
      },
    });
    igual(pasos, 1);
    cerca(resto, 0.12);
  }
}

// Copia literal de War, independiente de las funciones del paquete.
function mulberryWar(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
for (const semilla of [1, 7, 2 ** 40]) {
  const esperado = mulberryWar((semilla * 2654435761) >>> 0);
  const actual = crearRng(semilla);
  for (let indice = 0; indice < 1000; indice++) igual(actual(), esperado());
}
{
  const actual = mulberry32(7), esperado = mulberryWar(7);
  for (let indice = 0; indice < 20; indice++) igual(actual(), esperado());
}
igual(pasoDe(0), 0);
igual(pasoDe(0.15), 3);
igual(pasoDe(0.1 + 0.2), 6);
igual(pasoDe(0.026), 1);

function orden(paso, verbo, cantidad = 1) {
  return { paso, origen: 'jugador', unidad: 'unidad', verbo, args: [cantidad] };
}
{
  const cola = crearColaOrdenes();
  const primera = orden(3, 'primera');
  cola.poner(primera);
  cola.poner(orden(1, 'segunda'));
  cola.poner(orden(3, 'tercera'));
  cola.poner(orden(0, 'cuarta'));
  primera.paso = 0;
  primera.args[0] = 99;
  igual(cola.pendientes().map(entrada => entrada.verbo), ['cuarta', 'segunda', 'primera', 'tercera']);
  const copia = cola.pendientes();
  copia[2].args[0] = 55;
  copia.length = 0;
  igual(cola.pendientes()[2], orden(3, 'primera'));
  igual(cola.tomar(0), [orden(0, 'cuarta')]);
  igual(cola.tomar(2), [orden(1, 'segunda')]);
  igual(cola.tomar(2), []);
  igual(cola.tomar(3), [orden(3, 'primera'), orden(3, 'tercera')]);
  igual(cola.pendientes(), []);
  falla(() => cola.poner(orden(-1, 'inválida')), /paso/);
  falla(() => cola.poner({ ...orden(0, 'inválida'), origen: 'desconocido' }), /origen/);
  falla(() => cola.poner({ ...orden(0, 'inválida'), args: [NaN] }), /args/);
  igual(cola.pendientes(), []);
}

{
  const registro = crearRegistroSucesos({ limite: 2 });
  const suceso = { paso: 1, tipo: 'avance', datos: { valores: [1] } };
  registro.anotar(suceso);
  suceso.datos.valores[0] = 99;
  igual(registro.desde(1)[0].datos.valores, [1]);
  const copia = registro.desde(0);
  copia[0].datos.valores[0] = 77;
  copia.push({ paso: 3, tipo: 'extra' });
  igual(registro.desde(0).length, 1);
  igual(registro.desde(0)[0].datos.valores, [1]);
  registro.anotar({ paso: 2, tipo: 'segundo' });
  registro.anotar({ paso: 3, tipo: 'tercero' });
  igual(registro.desde(0), [{ paso: 2, tipo: 'segundo' }, { paso: 3, tipo: 'tercero' }]);
  igual(registro.desde(3), [{ paso: 3, tipo: 'tercero' }]);
  igual(registro.desde(4), []);
  falla(() => registro.anotar({ paso: -1, tipo: 'inválido' }), /paso/);
  falla(() => registro.anotar({ paso: 4, tipo: '' }), /tipo/);
  igual(registro.desde(0).length, 2);
  registro.vaciar();
  igual(registro.desde(0), []);
  const sinRetencion = crearRegistroSucesos({ limite: 0 });
  sinRetencion.anotar({ paso: 0, tipo: 'descartado' });
  igual(sinRetencion.desde(0), []);
  falla(() => crearRegistroSucesos({ limite: -1 }), /límite/);
  falla(() => crearRegistroSucesos({ limite: 1.5 }), /límite/);
  const habitual = crearRegistroSucesos();
  for (let paso = 0; paso < 2001; paso++) habitual.anotar({ paso, tipo: 'avance' });
  igual(habitual.desde(0).length, 2000);
  igual(habitual.desde(0)[0].paso, 1);
}

{
  const mundo = { t: 0.15, valor: 7 };
  const registro = crearRegistroSucesos();
  igual(adjuntarSucesos(mundo, registro), registro);
  igual(adjuntarSucesos(mundo, crearRegistroSucesos()), registro);
  igual(Object.getOwnPropertyDescriptor(mundo, 'sucesos').enumerable, false);
  igual(Object.keys(mundo), ['t', 'valor']);
  igual(JSON.parse(JSON.stringify(mundo)), { t: 0.15, valor: 7 });
  igual(structuredClone(mundo), { t: 0.15, valor: 7 });
  anotarSuceso(mundo, 'simple');
  anotarSuceso(mundo, 'nulos', null, null);
  anotarSuceso(mundo, 'completo', 'unidad', { valor: [7] });
  igual(registro.desde(0), [
    { paso: 3, tipo: 'simple' }, { paso: 3, tipo: 'nulos' },
    { paso: 3, tipo: 'completo', unidad: 'unidad', datos: { valor: [7] } },
  ]);
  anotarSuceso({ t: 0 }, 'sin registro');
  igual(adjuntarSucesos({}).desde(0), []);
}

// Reglamento de juguete: consume RNG al crear y avanzar; las órdenes no conmutan.
const reglas = {
  id: 'juguete', version: 1,
  crearMundo(escenario, rng) {
    const mundo = { t: 0, valor: escenario.base, azar: rng(), rng, ordenes: [] };
    escenario.base = 999;
    return mundo;
  },
  aplicarOrden(mundo, entrada) {
    mundo.valor = entrada.verbo === 'sumar' ? mundo.valor + entrada.args[0] : mundo.valor * entrada.args[0];
    mundo.ordenes.push({ paso: pasoDe(mundo.t), valor: mundo.valor });
    anotarSuceso(mundo, 'orden', entrada.unidad, { valor: mundo.valor });
    entrada.args[0] = -999;
  },
  paso(mundo, dt) {
    mundo.azar = mundo.rng();
    mundo.valor += mundo.azar;
    mundo.t += dt;
    anotarSuceso(mundo, 'avance', null, { valor: mundo.valor });
  },
  instantanea(mundo) {
    return structuredClone({ t: mundo.t, valor: mundo.valor, azar: mundo.azar, ordenes: mundo.ordenes });
  },
  evaluar(mundo) { return mundo.valor > 20; },
};
{
  const escenario = { base: 2 };
  const primera = crearPartida({ reglas, escenario, semilla: 7 });
  const segunda = crearPartida({ reglas, escenario, semilla: 7 });
  const distinta = crearPartida({ reglas, escenario, semilla: 1 });
  igual(escenario, { base: 2 });
  igual(primera.pasoActual, 0);
  igual(primera.sucesos(), []);
  igual(primera.mundo.sucesos.desde(0), []);
  igual(primera.instantanea(), segunda.instantanea());
  igual(primera.instantanea().azar === distinta.instantanea().azar, false);
  const recibidas = [orden(12, 'sumar', 5), orden(0, 'multiplicar', 2), orden(2, 'sumar', 7), orden(0, 'sumar', 3)];
  for (const entrada of recibidas) { primera.ordenar(entrada); segunda.ordenar(entrada); }
  for (let paso = 0; paso < 6; paso++) {
    primera.paso(); segunda.paso();
    igual(primera.instantanea(), segunda.instantanea());
    igual(primera.evaluar(), segunda.evaluar());
  }
  igual(primera.mundo.ordenes.slice(0, 2), [{ paso: 0, valor: 4 }, { paso: 0, valor: 7 }]);
  igual(primera.serializar().ordenes, recibidas);
  const nueva = orden(8, 'multiplicar', 2);
  primera.ordenar(nueva); segunda.ordenar(nueva);
  nueva.args[0] = 100;
  const datos = primera.serializar();
  igual(JSON.parse(JSON.stringify(datos)), datos);
  igual(datos.escenario, { base: 2 });
  igual(datos.paso, 6);
  igual(datos.reglas, 'juguete');
  igual(datos.version, 1);
  igual(datos.semilla, 7);
  igual(datos.ordenes.map(entrada => entrada.paso), [12, 0, 2, 0, 8]);
  const copia = primera.serializar();
  copia.escenario.base = 42;
  copia.ordenes[0].args[0] = 42;
  igual(primera.serializar(), datos);
  const restaurada = restaurar(JSON.parse(JSON.stringify(datos)), reglas);
  igual(restaurada.pasoActual, 6);
  igual(restaurada.instantanea(), primera.instantanea());
  igual(restaurada.sucesos(), primera.sucesos());
  igual(restaurada.serializar(), datos);
  for (let paso = 0; paso < 20; paso++) {
    primera.paso(); segunda.paso(); restaurada.paso();
    igual(primera.instantanea(), segunda.instantanea());
    igual(restaurada.instantanea(), primera.instantanea());
    igual(restaurada.sucesos(), primera.sucesos());
    igual(restaurada.evaluar(), primera.evaluar());
  }
  igual(restaurada.sucesos(8), primera.sucesos().filter(suceso => suceso.paso >= 8));
  falla(() => restaurar({ ...datos, reglas: 'otra' }, reglas), /reglamento/);
  falla(() => restaurar({ ...datos, version: 2 }, reglas), /versión/);
  falla(() => restaurar({ ...datos, paso: -1 }, reglas), /paso/);
  falla(() => restaurar({ ...datos, paso: 0.5 }, reglas), /paso/);
  falla(() => primera.ordenar(orden(-1, 'sumar')), /paso/);
  igual(primera.serializar().ordenes.length, 5);
  const inicial = crearPartida({ reglas, escenario, semilla: 1 });
  igual(restaurar(inicial.serializar(), reglas).instantanea(), inicial.instantanea());
}

// copiaPlana (fase 2): profunda, sin funciones, con referencias compartidas y ciclos.
{
  const { copiaPlana } = await import('../index.js');
  const assert = comprobar;
  const comun = { x: 1 }, original = { a: [comun, comun], b: { comun, f() {} }, g: () => 1, n: null, u: undefined, lista: [1, () => 2] };
  original.yo = original;
  const c = copiaPlana(original);
  assert.ok(c !== original && c.a[0] === c.a[1] && c.a[0] === c.b.comun && c.a[0] !== comun); comprobaciones++;
  assert.ok(c.yo === c && !('g' in c) && !('f' in c.b) && c.n === null && 'u' in c); comprobaciones++;
  assert.deepEqual(c.lista, [1, null]); comprobaciones++;
  c.a[0].x = 9; assert.equal(comun.x, 1); comprobaciones++;
  assert.equal(copiaPlana(5), 5); comprobaciones++;
  const conGetter = { x: 1 }; Object.defineProperty(conGetter, 'cx', { get: () => conGetter.x + .5 });
  assert.deepEqual(copiaPlana(conGetter), { x: 1, cx: 1.5 }); comprobaciones++;
}
console.log(`nucleo: ${comprobaciones} comprobaciones`);
