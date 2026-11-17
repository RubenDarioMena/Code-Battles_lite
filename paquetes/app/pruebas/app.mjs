// Pruebas propias de app en Node: vista nula y bucle de partida con un reglamento mínimo y un anfitrión falso.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crearVistaNula, crearConductor, jugarPartida } from '../index.js';
import { crearPartida } from '../../nucleo/index.js';
import { crearAnfitrion, crearTrabajadorInterprete } from '../../anfitrion/index.js';
import factory, { retos } from '../../reglas-factory/index.js';

let comprobaciones = 0;
const igual = (a, b, m) => { assert.deepEqual(a, b, m); comprobaciones++; };

// Reglamento mínimo: un contador que termina al llegar a 5; las órdenes «sumar» le añaden.
const reglas = {
  id: 'contador', version: 1,
  crearMundo: (escenario) => ({ t: 0, n: escenario.inicio, fin: null }),
  paso(m, dt) { m.t += dt; m.n++; if (m.n >= 5) m.fin = 'hecho'; m.sucesos?.anotar({ paso: Math.round(m.t / dt), tipo: 'tic', datos: { n: m.n } }); },
  aplicarOrden(m, o) { m.n += o.args[0]; },
  instantanea: (m) => ({ t: m.t, n: m.n }),
  evaluar: (m) => m.fin,
};

const vista = crearVistaNula();
const r = await jugarPartida({ reglas, escenario: { inicio: 0 }, semilla: 1, vista });
igual([r.pasos, r.evaluacion, r.instantanea.n, r.error, r.limite], [5, 'hecho', 5, null, false], 'juega hasta el fin');
igual(vista.resumen(), { fotogramas: 6, sucesos: 5, t: r.instantanea.t }, 'la vista recibe la inicial, cada paso y cada suceso');
igual(vista.elegir(1, 2), null, 'la vista nula no elige');
vista.destruir();
assert.throws(() => vista.dibujar({ t: 0 }, { t: 0 }, 1)); comprobaciones++;
assert.throws(() => crearVistaNula().dibujar({ t: 0 }, { t: 0 }, 2)); comprobaciones++;

// Anfitrión falso: en el primer turno pide sumar 2 en el paso 0; después, nada.
const turnos = [];
const anfitrion = {
  async ceder(snap) { turnos.push(snap.n); return { ordenes: turnos.length === 1 ? [{ paso: 0, origen: 'programa', unidad: 'x', verbo: 'sumar', args: [2] }] : [], avisos: [], error: null }; },
  detener() { turnos.push('detenido'); },
};
const c = await jugarPartida({ reglas, escenario: { inicio: 0 }, semilla: 1, anfitrion });
igual([c.pasos, c.instantanea.n], [3, 5], 'la orden se aplica al principio del paso siguiente');
igual(turnos, [0, 3, 4, 'detenido'], 'cede tras cada paso salvo el último y detiene al acabar');
igual(c.partida.serializar().ordenes.length, 1, 'la orden queda en la partida');

// Error de programa y límite de pasos.
const conError = await jugarPartida({ reglas, escenario: { inicio: 0 }, semilla: 1,
  anfitrion: { async ceder() { return { ordenes: [], avisos: [], error: { unidad: 'x', mensaje: 'mal', linea: 3 } }; }, detener() {} } });
igual([conError.pasos, conError.error.mensaje], [0, 'mal'], 'un error de programa para la partida');
const corta = await jugarPartida({ reglas, escenario: { inicio: -100 }, semilla: 1, maxPasos: 3 });
igual([corta.pasos, corta.limite, corta.evaluacion], [3, true, null], 'límite de pasos');

// Factory: dos rechazos inmediatos y done deben agotar el programa sin consumir pasos.
{
  const respuestas = [];
  const orden = verbo => ({ paso: 0, origen: verbo === 'programa-acabado' ? 'sistema' : 'programa',
    unidad: 'R1', verbo, args: verbo === 'entregar' ? ['FUN'] : [] });
  const turno = verbo => ({ ordenes: [orden(verbo)], avisos: [], error: null });
  let cesiones = 0;
  const anfitrion = {
    async ceder() { cesiones++; return turno('entregar'); },
    async responder(lote) {
      respuestas.push(...lote);
      return turno(respuestas.length === 1 ? 'entregar' : 'programa-acabado');
    },
    detener() {},
  };
  const r = await jugarPartida({ reglas: factory, escenario: { reto: retos.RETOS[0] }, semilla: 1, anfitrion, maxPasos: 0 });
  igual([r.pasos, r.limite, r.evaluacion.motivo, cesiones], [0, false, 'incompleto', 1], 'resuelve la cadena inmediata antes de avanzar');
  igual(respuestas.map(r => [r.resultado, r.instantanea.t]), [['manos_vacias', 0], ['manos_vacias', 0]], 'todas las respuestas pertenecen al instante inicial');
  igual(r.partida.serializar().ordenes.map(o => o.verbo), ['entregar', 'entregar', 'programa-acabado'], 'guarda también las órdenes del mismo paso');
}

// Tramos: misma partida y respuestas antes de esperas; el corte precede a ambas.
{
  const cola = [], llamadas = [];
  const reglasTramo = { ...reglas, evaluar: () => null,
    paso(m, dt) { m.t += dt; m.n++; cola.push({ unidad: 'x', resultado: 'ok', instantanea: { t: m.t } }); },
    respuestas() { return cola.splice(0); } };
  const anfitrion = {
    async ceder(snap) { llamadas.push(['ceder', snap.t]); return { ordenes: [], avisos: [], error: null }; },
    async responder(rs) { llamadas.push(['responder', rs[0].instantanea.t]); return { ordenes: [], avisos: [], error: null }; },
    detener(rs) { llamadas.push(['detener', rs.length]); },
  };
  const primero = await jugarPartida({ reglas: reglasTramo, escenario: { inicio: 0 }, semilla: 1,
    anfitrion, detener: p => p.mundo.n === 2 });
  igual(llamadas, [['ceder', 0], ['responder', 0.05], ['ceder', 0.05], ['detener', 1]], 'corte antes de mensajes y respuestas antes de esperas');
  const segundo = await jugarPartida({ reglas: reglasTramo, partida: primero.partida,
    anfitrion, detener: p => p.mundo.n === 3 });
  igual(segundo.partida, primero.partida, 'continúa la misma partida');
  igual([segundo.pasos, segundo.partida.pasoActual, segundo.instantanea.n], [1, 3, 3], 'pasos locales y reloj acumulado');
}

// Conductor por llamadas: límites locales, callbacks, sucesos del mismo paso e inicio/cierre únicos.
{
  const sucesos = [], pasos = [], turnos = [], vista = crearVistaNula();
  const reglasConSucesos = { ...reglas,
    crearMundo(e) { const m = reglas.crearMundo(e); return m; },
    aplicarOrden(m, o) {
      reglas.aplicarOrden(m, o);
      m.sucesos.anotar({ paso: Math.round(m.t / 0.05), tipo: 'orden' });
    } };
  const partida = crearPartida({ reglas: reglasConSucesos, escenario: { inicio: 0 }, semilla: 1 });
  partida.mundo.sucesos.anotar({ paso: 0, tipo: 'inicial' });
  let cesiones = 0, cierres = 0;
  const anfitrion = {
    async ceder() { return { ordenes: ++cesiones === 1 ? [{ paso: 0, origen: 'programa', unidad: 'x', verbo: 'sumar', args: [1] }] : [], avisos: [], error: null }; },
    detener() { cierres++; },
  };
  const c = crearConductor({ reglas: reglasConSucesos, partida, anfitrion, vista,
    alSucesos: lista => sucesos.push(lista.map(s => [s.paso, s.tipo])),
    alTurno: turno => turnos.push(turno), alPaso: paso => pasos.push(paso) });
  await c.iniciar(); await c.iniciar();
  igual([vista.resumen().fotogramas, cesiones], [1, 1], 'iniciar es idempotente');
  igual(await c.avanzar(0), { pasos: 0, terminada: false }, 'presupuesto cero');
  igual(await c.avanzar(2), { pasos: 2, terminada: false }, 'primer lote acotado');
  igual(await c.avanzar(20), { pasos: 2, terminada: true }, 'segundo lote termina antes del máximo');
  igual([c.error, c.terminada, pasos], [null, true, [1, 2, 3, 4]], 'contadores acumulados y getters');
  igual(sucesos.slice(0, 2), [[[0, 'inicial']], [[0, 'orden'], [1, 'tic']]], 'entrega también sucesos añadidos después del dibujo inicial');
  igual(sucesos.flat().length, vista.resumen().sucesos, 'callback y vista reciben los mismos sucesos una vez');
  igual(turnos.length, 4, 'alTurno tras cada ceder, salvo el paso terminal');
  c.cerrar(); c.cerrar();
  partida.ordenar({ paso: 4, origen: 'jugador', unidad: 'x', verbo: 'sumar', args: [9] });
  igual(await c.avanzar(2), { pasos: 0, terminada: true }, 'no avanza tras cerrar');
  igual([cierres, partida.mundo.n], [1, 5], 'cerrar una sola vez y no aplicar órdenes posteriores');
}

// Adaptador asíncrono opcional (la producción usa unidades síncronas): se recupera el control sin pasos, se reanuda y no se duplican los turnos.
const reglasAsync = { ...reglas, id: 'war', aplicarOrden(m, o) { m.n += o.args[0]?.x ?? 0; } };
{
  let recibir, cerrado = false;
  const enviados = [], turnos = [];
  const anfitrion = crearAnfitrion({ reglas: reglasAsync, crearTrabajador(_f, _u, r) {
    recibir = r;
    return { postMessage: m => enviados.push(m), terminate() { cerrado = true; } };
  } });
  await anfitrion.cargar('A', 'x');
  const partida = crearPartida({ reglas: reglasAsync, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasAsync, partida, anfitrion, alTurno: t => turnos.push(t) });
  await c.iniciar();
  igual(await c.avanzar(3), { pasos: 0, terminada: false }, 'no espera al Worker ni adelanta el reloj mientras corre');
  igual([partida.mundo.t, enviados.length, turnos.length], [0, 1, 0], 'un único run pendiente');
  recibir({ type: 'cmd', verbo: 'regularShoot', lugar: { x: 2, y: 0 }, res: 'ok' });
  recibir({ type: 'espera', id: 1, s: 0.05 });
  igual(await c.avanzar(3), { pasos: 1, terminada: false }, 'aplica al llegar y para cuando el despertar vuelve a correr');
  igual([partida.mundo.n, enviados.map(m => m.type)], [3, ['run', 'despierta']], 'no da pasos durante la continuación pendiente');
  recibir({ type: 'done' });
  igual(await c.avanzar(1), { pasos: 1, terminada: false }, 'continúa con presupuesto nuevo');
  igual([partida.mundo.n, turnos.length], [4, 3], 'alTurno también para el turno sin mensajes');
  c.cerrar(); igual(cerrado, true, 'cierra el Worker');
}

// API opcional conservada: el vigía libera el turno pendiente y el conductor informa el error sin avanzar.
{
  const anfitrion = crearAnfitrion({ reglas: reglasAsync, ahora: () => 50,
    crearTrabajador: () => ({ postMessage() {}, terminate() {} }) });
  await anfitrion.cargar('A', 'x');
  const partida = crearPartida({ reglas: reglasAsync, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasAsync, partida, anfitrion });
  await c.iniciar();
  igual(anfitrion.vigilar(100, 50, id => `bloqueado ${id}`), 'A', 'vigía externo');
  igual(await c.avanzar(5), { pasos: 0, terminada: true }, 'el error detiene al conductor');
  igual(c.error.mensaje, 'bloqueado A', 'expone el diagnóstico');
  c.cerrar();
}

// detener también corta durante un turno pendiente; cerrar lo libera.
{
  let parar = false;
  const anfitrion = crearAnfitrion({ reglas: reglasAsync,
    crearTrabajador: () => ({ postMessage() {}, terminate() {} }) });
  await anfitrion.cargar('A', 'x');
  const partida = crearPartida({ reglas: reglasAsync, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasAsync, partida, anfitrion, detener: () => parar });
  await c.iniciar(); parar = true;
  igual(await c.avanzar(5), { pasos: 0, terminada: true }, 'detener durante un Worker que sigue corriendo');
  c.cerrar();
}

// jugarPartida sí espera a los turnos asíncronos, incluso el del último paso permitido.
{
  const anfitrion = crearAnfitrion({ reglas: reglasAsync, crearTrabajador(_f, _u, recibir) {
    return { postMessage(m) { setImmediate(() => {
      if (m.type === 'run') recibir({ type: 'espera', s: 0.05, id: 1 });
      else {
        recibir({ type: 'cmd', verbo: 'regularShoot', lugar: { x: 2, y: 0 }, res: 'ok' });
        recibir({ type: 'done' });
      }
    }); }, terminate() {} };
  } });
  await anfitrion.cargar('A', 'x');
  const r = await jugarPartida({ reglas: reglasAsync, escenario: { inicio: 0 }, semilla: 1, anfitrion, maxPasos: 1 });
  igual([r.pasos, r.limite, r.instantanea.n, r.partida.serializar().ordenes.length], [1, true, 3, 1], 'resuelve el turno del límite antes de cerrar');
}

// La pausa de un hito conserva la respuesta del paso y la entrega antes de ceder al seguir.
{
  let parar = false;
  const cola = [], llamadas = [];
  const reglasPausa = { ...reglas, evaluar: () => null,
    paso(m, dt) { m.t += dt; m.n++; cola.push({ unidad: 'x', resultado: 'ok', instantanea: { t: m.t } }); },
    respuestas() { return cola.splice(0); } };
  const anfitrion = {
    async ceder(s) { llamadas.push(['ceder', s.t]); return { ordenes: [], avisos: [], error: null }; },
    async responder(rs) { llamadas.push(['respuesta', rs[0].instantanea.t]); return { ordenes: [], avisos: [], error: null }; },
    detener() {},
  };
  const partida = crearPartida({ reglas: reglasPausa, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasPausa, partida, anfitrion, detener: () => parar,
    alPaso: () => { parar = true; } });
  igual(await c.avanzar(5), { pasos: 1, terminada: true }, 'corta en el paso del hito');
  igual(llamadas, [['ceder', 0]], 'la respuesta sigue pendiente durante el banner');
  c.reanudar();
  igual(await c.avanzar(0), { pasos: 0, terminada: true }, 'no continúa si la condición sigue puesta');
  parar = false; c.reanudar();
  igual(await c.avanzar(0), { pasos: 0, terminada: false }, 'reanuda sin dar pasos');
  igual(llamadas, [['ceder', 0], ['respuesta', .05], ['ceder', .05]], 'responde antes de despertar y arrancar programas nuevos');
  c.cerrar(); c.reanudar();
  igual(await c.avanzar(1), { pasos: 0, terminada: true }, 'un conductor cerrado no se reabre');
}

// Workers reales: un fallo anotado después de cerrar el turno (dos encargos seguidos sin await)
// corta antes del siguiente paso, aunque el turno ya entregado se aplique.
{
  let fallo = null;
  const reglasFallo = { ...reglas, evaluar: () => null, paso(m, dt) { m.t += dt; m.n++; } };
  const anfitrion = {
    async ceder() { return { ordenes: [], avisos: [], error: null }; },
    async responder() { return { ordenes: [], avisos: [], error: null }; },
    fallo: () => fallo, detener() {},
  };
  const partida = crearPartida({ reglas: reglasFallo, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasFallo, partida, anfitrion });
  await c.iniciar();
  fallo = { unidad: 'R1', mensaje: 'Falta await', linea: 2 };
  igual(await c.avanzar(3), { pasos: 0, terminada: true }, 'no da pasos con un fallo anotado tras el turno');
  igual(c.error, fallo, 'el error del conductor es el del anfitrión');
}

// Producción: el intérprete completa el turno en el hilo principal, sin esperar eventos externos.
for (const codigo of ['await esperar(0.05);', 'await esperar(0.05);\nwhile(true){}']) {
  const unidades = [];
  const crear = crearTrabajadorInterprete({ acorn: createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js') });
  const anfitrion = crearAnfitrion({ reglas: reglasAsync, crearTrabajador(...args) {
    const unidad = crear(...args); unidades.push(unidad); return unidad;
  } });
  await anfitrion.cargar('A', codigo);
  const partida = crearPartida({ reglas: reglasAsync, escenario: { inicio: 0 }, semilla: 1 });
  const c = crearConductor({ reglas: reglasAsync, partida, anfitrion });
  igual(await c.avanzar(1), { pasos: 1, terminada: codigo.includes('while') }, 'resuelve la continuación sin mensajes externos');
  igual(c.turnoPendiente(), null, 'ningún turno espera eventos de Worker');
  if (codigo.includes('while')) igual(c.error.linea, 2, 'presupuesto: línea del bucle tras despertar');
  c.cerrar(); c.cerrar();
  igual(unidades.every(u => u.medir().liberado && !u.entregar()), true, 'cerrar libera el intérprete');
}

console.log(`app: ${comprobaciones} comprobaciones`);
