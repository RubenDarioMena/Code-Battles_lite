import comprobarNodo from 'node:assert/strict';
import { crearPartida, restaurar, crearRng, DT } from '../../nucleo/index.js';
import { validarInstantanea, validarSuceso, esDatoPlano } from '../../protocolo/index.js';
import reglamento, { legado, retos } from '../index.js';

let comprobaciones = 0;
function igual(actual, esperado, mensaje) {
  comprobarNodo.deepEqual(actual, esperado, mensaje);
  comprobaciones++;
}
function comprobar(condicion, mensaje) {
  comprobarNodo.ok(condicion, mensaje);
  comprobaciones++;
}
const escenario = { reto: retos.normalizar(retos.RETOS[0]) };
const nueva = () => crearPartida({ reglas: reglamento, escenario, semilla: 7 });

function verificarInstantanea(partida) {
  const instantanea = partida.instantanea();
  igual(validarInstantanea(instantanea), [], 'instantánea válida');
  return instantanea;
}
function verificarSucesos(partida) {
  const sucesos = partida.sucesos();
  for (const suceso of sucesos) {
    igual(validarSuceso(suceso), [], 'suceso válido');
    comprobar(Object.values(suceso.datos ?? {}).every(valor => valor === null
      || typeof valor === 'string' || (typeof valor === 'number' && Number.isFinite(valor))),
    'los datos de los sucesos son escalares planos');
  }
  comprobar(!Object.keys(partida.mundo).includes('sucesos'), 'registro no enumerable');
  comprobar(!JSON.stringify(partida.mundo).includes('"sucesos"'), 'JSON sin registro');
  return sucesos;
}
function apuntar(partida) {
  if (partida.pasoActual % 10) return;
  const instantanea = verificarInstantanea(partida);
  for (const [unidad, sensores] of Object.entries(instantanea.auto)) {
    const objetivo = Object.values(sensores).flatMap(tipos => Object.values(tipos)).find(Boolean) ?? null;
    partida.ordenar({ paso: partida.pasoActual, origen: 'sistema', unidad, verbo: 'regularShoot', args: [objetivo] });
  }
}
function ejecutar(conOrdenes) {
  const partida = nueva(), instantaneas = [verificarInstantanea(partida)];
  for (let paso = 0; paso < 10000 && !partida.evaluar(); paso++) {
    if (conOrdenes) apuntar(partida);
    partida.paso();
    instantaneas.push(verificarInstantanea(partida));
  }
  comprobar(partida.evaluar(), 'la partida termina');
  return { partida, instantaneas, sucesos: verificarSucesos(partida) };
}

igual(typeof globalThis.window, 'undefined', 'se ejecuta sin entorno de navegador');
igual(reglamento.id, 'war');
igual(reglamento.version, 1);
comprobar(esDatoPlano(reglamento.api), 'API de datos planos');
igual(reglamento.api.ordenes, ['regularShoot', 'burstFire', 'stopFire']);
igual(reglamento.api.tipos, legado.TIPOS);
igual(reglamento.api.sensores, legado.SENSOR);
igual(Object.keys(legado), ['crear', 'conectar', 'aplicarOrden', 'TIPOS', 'SENSOR', 'LAU', 'MISIL', 'REP', 'COSTE', 'cadencia']);
igual(Object.keys(retos), ['RETOS', 'PROPIO_BASE', 'POS_LANZADORES', 'normalizar']);

for (const conOrdenes of [false, true]) {
  const primera = ejecutar(conOrdenes), segunda = ejecutar(conOrdenes);
  igual(primera.partida.mundo.semilla, null, 'el reglamento recibe un RNG hecho');
  igual(primera.instantaneas, segunda.instantaneas, 'instantáneas deterministas');
  igual(primera.sucesos, segunda.sucesos, 'sucesos deterministas');
  if (!conOrdenes) {
    igual(primera.partida.evaluar().fin, 'fallo');
    igual(primera.partida.evaluar().motivo, 'brecha');
    for (const tipo of ['aparece', 'brecha', 'fin'])
      comprobar(primera.sucesos.some(suceso => suceso.tipo === tipo), `hay ${tipo}`);
  } else {
    for (const tipo of ['disparo', 'explosion', 'golpe', 'derribo'])
      comprobar(primera.sucesos.some(suceso => suceso.tipo === tipo), `hay ${tipo}`);
  }
  const datos = JSON.parse(JSON.stringify(primera.partida.serializar()));
  const recuperada = restaurar(datos, reglamento);
  igual(verificarInstantanea(recuperada), primera.instantaneas.at(-1), 'restauración exacta');
  igual(verificarSucesos(recuperada), primera.sucesos, 'restauración de sucesos');
  igual(recuperada.evaluar(), primera.partida.evaluar(), 'restauración del resultado');
  igual(recuperada.serializar(), datos, 'guardado exacto tras restaurar');
}

// Guardado en marcha con una orden pendiente y evolución posterior idéntica.
const original = nueva();
for (let paso = 0; paso < 600; paso++) { apuntar(original); original.paso(); }
original.ordenar({ paso: original.pasoActual + 15, origen: 'sistema', unidad: 'LAU-01', verbo: 'stopFire', args: [null] });
const recuperada = restaurar(JSON.parse(JSON.stringify(original.serializar())), reglamento);
igual(verificarInstantanea(recuperada), verificarInstantanea(original));
igual(verificarSucesos(recuperada), verificarSucesos(original));
while (!original.evaluar() && original.pasoActual < 10000) {
  apuntar(original); apuntar(recuperada);
  original.paso(); recuperada.paso();
  igual(verificarInstantanea(recuperada), verificarInstantanea(original), 'evolución tras restaurar');
}
igual(verificarSucesos(recuperada), verificarSucesos(original));
igual(recuperada.evaluar(), original.evaluar());

// La orden cambia el mismo lanzador y conserva la referencia del lugar.
const mundo = legado.crear(escenario.reto, 7), lugar = { x: 12, y: 9, z: 0 };
const orden = verbo => ({ paso: 0, origen: 'sistema', unidad: 'LAU-01', verbo, args: [lugar] });
legado.aplicarOrden(mundo, orden('burstFire'));
comprobarNodo.equal(mundo.lanzadores[0].lugar, lugar); comprobaciones++;
igual(mundo.lanzadores[0].modo, 'burst');
igual(mundo.lanzadores[0].falla, legado.LAU.fallaRafaga);
legado.aplicarOrden(mundo, orden('regularShoot'));
igual(mundo.lanzadores[0].modo, 'regular');
legado.aplicarOrden(mundo, orden('stopFire'));
igual(mundo.lanzadores[0].lugar, null);
legado.aplicarOrden(mundo, { ...orden('regularShoot'), args: [null] });
igual(mundo.lanzadores[0].modo, 'idle');
const rngEsperado = crearRng(7);
igual(mundo.lanzadores[0].umbral, .75 + rngEsperado() / 2, 'mismo umbral inicial');
igual(mundo.rng(), rngEsperado(), 'el RNG del legado ya consumió el umbral inicial');

// Atasco, reparación y agotamiento: mismos hooks, sin interferencia del registro.
const retoLargo = retos.normalizar({ ...retos.PROPIO_BASE, oleadas: [
  { tipo: 'crawler', n: 1, t: 300, cada: 1, carriles: [9] },
], metas: { brechasMax: 0 } });
const conRegistro = legado.crear(retoLargo, 7), sinRegistro = { ...legado.crear(retoLargo, 7) };
const llamadas = [[], []];
const conexiones = [conRegistro, sinRegistro].map((mundo, indice) => {
  mundo.activo = true;
  mundo.lanzadores[0].riesgo = 2;
  legado.aplicarOrden(mundo, orden('regularShoot'));
  return legado.conectar(mundo, Object.fromEntries(['registrar', 'terminar', 'avisoSistema', 'globo']
    .map(nombre => [nombre, (...args) => llamadas[indice].push([nombre, ...args])])));
});
for (let paso = 0; paso < 200; paso++) {
  for (const conexion of conexiones) conexion.paso(DT);
  igual(conexiones[0].instantanea(), conexiones[1].instantanea(), 'anotar no altera la evolución');
}
igual(llamadas[0], llamadas[1], 'anotar no altera llamadas ni orden de los hooks');
for (const tipo of ['atasco', 'reparado', 'explosion'])
  comprobar(conRegistro.sucesos.desde(0).some(suceso => suceso.tipo === tipo), `hay ${tipo}`);
conRegistro.lanzadores[0].misiles = 0;
conRegistro.def.suministro = 0;
conexiones[0].paso(1);
comprobar(conRegistro.sucesos.desde(0).some(suceso => suceso.tipo === 'sin-misiles'), 'hay sin-misiles');
verificarSucesos({ mundo: conRegistro, sucesos: () => conRegistro.sucesos.desde(0) });

console.log(`reglas-war: ${comprobaciones} comprobaciones`);
