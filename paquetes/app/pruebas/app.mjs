// Pruebas propias de app en Node: vista nula y bucle de partida con un reglamento mínimo y un anfitrión falso.
import assert from 'node:assert/strict';
import { crearVistaNula, jugarPartida } from '../index.js';

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

console.log(`app: ${comprobaciones} comprobaciones`);
