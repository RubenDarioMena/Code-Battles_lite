// Pruebas de las fronteras de la fase 2 (docs/PLAN-ARQUITECTURA.md), sin pantalla:
//  1. partida completa con vista nula (reglamento + anfitrión + núcleo), con la huella de las referencias;
//  2. repetición exacta desde escenario, semilla y órdenes;
//  3. una orden de origen `jugador` en un escenario de prueba (control manual mínimo).
// La cuarta (editor montado solo) es de navegador: pruebas/editor-demo.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import reglas, { retos } from '../paquetes/reglas-war/index.js';
import { crearAnfitrion } from '../paquetes/anfitrion/index.js';
import { jugarPartida, crearVistaNula } from '../paquetes/app/index.js';
import { restaurar } from '../paquetes/nucleo/index.js';
import { validarInstantanea, validarSuceso, canonico } from '../paquetes/protocolo/index.js';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';

let comprobaciones = 0;
const igual = (a, b, m) => { assert.deepEqual(a, b, m); comprobaciones++; };
const ok = (v, m) => { assert.ok(v, m); comprobaciones++; };
const referencias = JSON.parse(readFileSync(new URL('referencias/partidas.json', import.meta.url), 'utf8')).casos;
const sesion = cargar();

/** Vista nula que además comprueba que solo recibe datos del protocolo. */
function vistaVigilada() {
  const base = crearVistaNula();
  return { ...base,
    dibujar(a, b, f) { assert.deepEqual(validarInstantanea(b), []); base.dibujar(a, b, f); },
    alSuceso(s) { assert.deepEqual(validarSuceso(s), []); base.alSuceso(s); } };
}

/** Partida War de los retos públicos con sus programas iniciales, instrumentados como en el juego. */
async function partidaWar(reto, semilla, { vista = vistaVigilada(), ordenes = [] } = {}) {
  const def = retos.normalizar(retos.RETOS[reto - 1]);
  // El instrumentador real (extraído de juego.js) necesita los nombres del mundo; uno de prueba basta.
  const muestra = reglas.crearMundo({ reto: def }, () => 0.5);
  const lenguaje = crearInstrumentador(sesion.contexto, muestra, 'war');
  const anfitrion = crearAnfitrion({ reglas, crearTrabajador: (fuente, unidad, recibir) => crearPrograma(sesion.fuenteWorker, unidad, recibir, 4000),
    contexto: { nombres: [...muestra.programables, ...muestra.sensores].map(e => e.id) } });
  for (const l of muestra.programables) {
    const texto = (def.inicial[l.id] || []).join('\n');
    assert.equal(lenguaje.revisar(texto), null);
    await anfitrion.cargar(l.id, lenguaje.instrumentar(texto));
  }
  const huella = crearHuella(), ordenesVistas = [];
  const r = await jugarPartida({ reglas, escenario: { reto: def }, semilla, anfitrion, vista, ordenes,
    alPaso: (_p, snap) => huella.paso(snap) });
  return { ...r, huella: huella.terminar(), vista };
}

// 1. Partida completa con vista nula: mismas huellas, pasos y final que las referencias de la fase 0.
for (const caso of referencias.filter(c => c.reglas === 'war' && !c.parametros.programas)) {
  const { reto, semilla } = caso.parametros;
  const r = await partidaWar(reto, semilla);
  igual(r.huella.hash, caso.hash, `${caso.id}: huella`);
  igual(r.pasos, caso.pasos, `${caso.id}: pasos`);
  igual(r.error, null, `${caso.id}: sin error de programa`);
  igual([r.evaluacion.fin, r.evaluacion.motivo, r.evaluacion.mensaje, r.partida.mundo.t],
    [caso.resultado.fin, caso.resultado.motivo, caso.resultado.texto, caso.resultado.t], `${caso.id}: final`);
  const resumen = r.vista.resumen();
  igual(resumen.fotogramas, caso.pasos + 1, `${caso.id}: la vista nula recibe cada instantánea`);
  ok(resumen.sucesos > 0, `${caso.id}: la vista nula recibe sucesos`);
}

// 2. Repetición exacta: escenario, semilla y órdenes bastan; sin programas ni anfitrión.
const jugada = await partidaWar(2, 7);
const datos = JSON.parse(JSON.stringify(jugada.partida.serializar()));
ok(datos.ordenes.length > 0 && datos.ordenes.every(o => o.origen === 'programa'), 'la partida guarda las órdenes de los programas');
const repetida = restaurar(datos, reglas);
igual(repetida.pasoActual, jugada.pasos, 'mismo número de pasos');
igual(canonico(repetida.instantanea()), canonico(jugada.instantanea), 'misma instantánea final');
igual(repetida.evaluar(), jugada.evaluacion, 'mismo final');
igual(canonico(repetida.sucesos()), canonico(jugada.partida.sucesos()), 'mismos sucesos');
const huellaRepetida = crearHuella();
const sinProgramas = await jugarPartida({ reglas, escenario: datos.escenario, semilla: datos.semilla, ordenes: datos.ordenes,
  maxPasos: datos.paso, alPaso: (_p, snap) => huellaRepetida.paso(snap) });
igual(huellaRepetida.terminar().hash, jugada.huella.hash, 'la huella de la repetición coincide paso a paso');
igual(sinProgramas.evaluacion, jugada.evaluacion, 'repetición con la vista nula y sin anfitrión');

// 3. Orden de origen `jugador`: control manual mínimo por el mismo canal que los programas.
const escenario = { reto: retos.normalizar(retos.RETOS[0]) };
const base = await jugarPartida({ reglas, escenario, semilla: 1, maxPasos: 200 });
ok(!base.partida.sucesos().some(s => s.tipo === 'disparo'), 'sin órdenes nadie dispara');
const lugar = { x: 20, y: 9.5, z: 0, id: null };
const manual = await jugarPartida({ reglas, escenario, semilla: 1, maxPasos: 200,
  ordenes: [{ paso: 10, origen: 'jugador', unidad: 'LAU-01', verbo: 'regularShoot', args: [lugar] }] });
const disparos = manual.partida.sucesos().filter(s => s.tipo === 'disparo');
ok(disparos.length > 0 && disparos.every(s => s.unidad === 'LAU-01'), 'la orden del jugador hace disparar a LAU-01');
ok(disparos[0].paso > 10, 'se aplica en el paso indicado, no antes');
igual([disparos[0].datos.x, disparos[0].datos.y], [lugar.x, lugar.y], 'al lugar que eligió el jugador');
igual(manual.partida.serializar().ordenes[0].origen, 'jugador', 'la orden queda guardada con su origen');
const manualRepetida = restaurar(manual.partida.serializar(), reglas);
igual(canonico(manualRepetida.sucesos()), canonico(manual.partida.sucesos()), 'la partida manual también se repite');

console.log(`Fronteras de la fase 2 (1–3): ${comprobaciones} comprobaciones; 10 partidas War con vista nula iguales a las referencias.`);
