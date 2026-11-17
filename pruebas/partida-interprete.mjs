// Paridad entre motores, sin tocar la selección ni las referencias grabadas.
import assert from 'node:assert/strict';
import { referencias } from '../herramientas/espina-interprete/corpus.mjs';
import { ejecutarWar } from '../herramientas/partida/anfitrion-war.mjs';
import { ejecutarFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { ejecutarCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';
import { casosFactory, opcionesFactory } from './partida-factory-casos.mjs';
import { createRequire } from 'node:module';
import { crearPrograma as crearVM } from '../herramientas/partida/programa.mjs';
import { crearAnfitrion, crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { adaptar } from './juego-adaptador.mjs';
import { traducir } from '../herramientas/partida/diagnosticos.mjs';
const ejecutar = { war: ejecutarWar, factory: ejecutarFactory, campaign: ejecutarCampaign };
const determinista = r => ({ hash: r.hash, pasos: r.metricas.pasos, t: r.metricas.t,
  mensajes: r.metricas.mensajes, resultado: r.resultado, ...(r.tramos ? { tramos: r.tramos } : {}) });
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
for (const caso of referencias) {
  const trazas = { vm: [], interprete: [] };
  const capturar = (motor, crear) => (fuente, unidad, recibir, max) => crear(fuente, unidad, m => {
    trazas[motor].push({ unidad, mensaje: structuredClone(m) }); recibir(m);
  }, max);
  const vm = await ejecutar[caso.reglas]({ ...caso.parametros, motor: 'vm', crearPrograma: capturar('vm', crearVM) });
  const interprete = await ejecutar[caso.reglas]({ ...caso.parametros, motor: 'interprete', crearPrograma: capturar('interprete', crearTrabajadorInterprete({ acorn })) });
  assert.deepEqual(determinista(interprete), determinista(vm), caso.id);
  assert.deepEqual(trazas.interprete, trazas.vm, `${caso.id}: mensajes completos y orden`);
}
const bucleFactory = casosFactory().find(c => c.id === 'bucle-sin-await');
const casos = [
  { ...opcionesFactory(bucleFactory), reglas: 'factory', unidad: 'R1', linea: 1 },
  { reglas: 'war', reto: 1, semilla: 1, unidad: 'LAU-01', linea: 1, codigo: 'while(true){}' },
  // Getter de sensor sin órdenes ni mensajes: también consume presupuesto y conserva línea.
  { reglas: 'war', reto: 1, semilla: 1, unidad: 'LAU-01', linea: 2, codigo: 'await esperar(0.1);\nwhile(true){ yo.jammed; }' },
  { reglas: 'war', reto: 3, semilla: 1, unidad: 'LAU-01', linea: 2, codigo: 'await esperar(0.1);\nwhile(true){ VIB_01.count; }' },
  { reglas: 'campaign', unidad: 'FRK-01', linea: 1, codigo: 'while(true){}' },
];
for (const c of casos) {
  const programas = c.programas ?? { [c.unidad]: c.codigo };
  const opciones = { ...c, programas: c.reglas === 'campaign' ? [programas] : programas };
  const a = await ejecutar[c.reglas](opciones), b = await ejecutar[c.reglas](opciones);
  assert.deepEqual(determinista(a), determinista(b), `${c.reglas}: dos ejecuciones idénticas`);
  const resultado = c.reglas === 'campaign' ? a.resultado.registro : a.resultado;
  const clave = c.reglas === 'campaign' ? 'campaign.presupuesto' : `partida.presupuesto.${c.reglas}`;
  const mensaje = traducir(clave, { unidad: c.unidad });
  assert.equal(resultado.fin ?? resultado.resultado, 'error');
  assert.equal(resultado.motivo, 'error'); assert.equal(resultado.linea, c.linea);
  assert.equal(resultado.texto ?? resultado.mensaje, mensaje);
  assert(!/2[.,]5/.test(mensaje)); assert.match(traducir(clave, { unidad: c.unidad }, 'en'), /too many iterations/);
  // Mismo error, posición y consola por el adaptador de la aplicación, sin DOM/Chromium.
  const juego = adaptar(c); juego.cargar(programas);
  for (let n = 0; !juego.resultado && n < 10; n++) await juego.avanzar(1);
  assert.deepEqual(JSON.parse(JSON.stringify(juego.resultado)), a.resultado);
}
// Detener, ejecutar de nuevo y crear mundo descartan todas las colas de la sesión anterior.
for (const reglas of ['war', 'factory', 'campaign']) {
  const unidades = [];
  const juego = adaptar({ reglas, reto: 1, semilla: 1 }, { crearAnfitrion(opciones) {
    const crear = opciones.crearTrabajador;
    return crearAnfitrion({ ...opciones, crearTrabajador(...args) {
      const u = crear(...args); unidades.push(u); return u;
    } });
  } });
  const fuentes = reglas === 'war' ? { 'LAU-01': 'await esperar(1);' } : reglas === 'factory'
    ? { R1: 'await yo.esperar(1);' } : { 'FRK-01': 'await wait(1);' };
  juego.cargar(fuentes); await juego.avanzar(0); juego.detener();
  assert(unidades.every(u => u.medir().liberado));
  juego.cargar(fuentes); await juego.avanzar(0);
  const previas = unidades.slice();
  juego.cargar(fuentes); await juego.avanzar(0);
  assert(previas.every(u => u.medir().liberado), `${reglas}: ejecutar otra vez libera`);
  juego.nuevoMundo();
  assert(unidades.every(u => u.medir().liberado && !u.entregar()), `${reglas}: crear mundo libera`);
}
console.log('Intérprete: 41/41 VM iguales (huella, pasos, resultado, mensajes); 5 límites deterministas y juego iguales.');
