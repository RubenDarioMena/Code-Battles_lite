// Fase 2, paso 7a: Factory por las entradas públicas, sin conectar el legado al ciclo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import reglas, { retos as factoryRetos, legado } from '../paquetes/reglas-factory/index.js';
import { restaurar } from '../paquetes/nucleo/index.js';
import { canonico } from '../paquetes/protocolo/index.js';
import war from '../paquetes/reglas-war/index.js';
import { crearAnfitrion } from '../paquetes/anfitrion/index.js';
import { jugarPartida } from '../paquetes/app/index.js';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { resultadoFactory } from '../herramientas/partida/anfitrion-factory.mjs';

const referencias = JSON.parse(readFileSync(new URL('referencias/partidas.json', import.meta.url), 'utf8')).casos
  .filter(c => c.reglas === 'factory');
assert.equal(referencias.length, 28);
const { contexto: C, fuenteWorker } = cargar();
let iguales = 0, mismosPasos = 0, mismosResultados = 0, repetidas = 0;
const diferencias = [];
for (const caso of referencias) {
  const { reto, intento = 1, escenario, programas, maxPasos = 10000 } = caso.parametros;
  const def = reto === 7 ? factoryRetos.normalizar(escenario) : factoryRetos.RETOS[reto - 1];
  const muestra = reglas.crearMundo({ reto: def, intento }, () => 0.5);
  const lenguaje = crearInstrumentador(C, muestra, 'factory');
  const idiomas = {};
  const anfitrion = crearAnfitrion({ reglas, maxOrdenes: 4000,
    crearTrabajador: (_fuente, unidad, recibir) => crearPrograma(fuenteWorker, unidad, recibir, 4000),
    contexto: { nombres: muestra.maquinas.map(e => e.id), tipos: Object.keys(war.api.tipos),
      sensores: Object.keys(war.api.sensores), conf: war.api.conf } });
  for (const l of muestra.programables) {
    const fuente = programas ? programas[l.id] ?? '' : (def.inicial[l.id] || []).join('\n');
    const idioma = typeof fuente === 'string' ? 'js' : fuente.lenguaje;
    const texto = typeof fuente === 'string' ? fuente : fuente.codigo;
    idiomas[l.id] = idioma;
    let codigo = texto;
    if (idioma === 'python') {
      const traduccion = C.CMGPythonJS.traducirCache(texto, lenguaje.opcionesPython());
      assert.equal(traduccion.ok, true, `${caso.id}: traducción`);
      codigo = traduccion.js;
    }
    await anfitrion.cargar(l.id, lenguaje.instrumentar(codigo), { lenguaje: idioma });
  }
  const huella = crearHuella();
  const r = await jugarPartida({ reglas, escenario: { reto: def, intento }, semilla: intento, anfitrion,
    // La huella de las referencias (fase 0) se calculó sobre la instantánea del legado, que conserva campos
    // undefined (acepta/entrada de las bodegas, stock de las máquinas); la pública los quita. Se mide igual.
    maxPasos, alPaso: (_paso, _snap, partida) => huella.paso({ t: partida.mundo.t, maq: {}, auto: {}, vib: {},
      factory: legado.instantanea(partida.mundo) }) });
  const final = r.error ? { fin: 'error', motivo: 'error', mensaje: idiomas[r.error.unidad] === 'python'
    ? lenguaje.mensajePython(r.error.mensaje) : r.error.mensaje, linea: r.error.linea }
    : r.limite ? { fin: 'límite', motivo: 'pasos', mensaje: `Límite de ${maxPasos} pasos.` }
      : r.evaluacion;
  const resultado = resultadoFactory({ ...r.partida.mundo, ...anfitrion.registro() }, intento,
    final.fin, final.motivo, final.mensaje, final.linea);
  const comprobar = (actual, esperado, campo) => {
    try { assert.deepEqual(actual, esperado, `${caso.id}: ${campo}`); return true; }
    catch (error) { diferencias.push(error); return false; }
  };
  const hashIgual = comprobar(huella.terminar().hash, caso.hash, 'hash');
  const pasosIguales = comprobar(r.pasos, caso.pasos, 'pasos');
  const resultadoIgual = comprobar(resultado, caso.resultado, 'resultado completo');
  if (pasosIguales) mismosPasos++;
  if (resultadoIgual) mismosResultados++;
  if (hashIgual && pasosIguales && resultadoIgual) iguales++;
  // Repetición exacta (prueba 2) desde escenario, semilla y órdenes, también si terminó sin avanzar.
  const datos = JSON.parse(JSON.stringify(r.partida.serializar()));
  const repetida = restaurar(datos, reglas);
  repetida.aplicarOrdenes();  // jugarPartida aplica las órdenes del paso actual al llegar
  if (comprobar([repetida.pasoActual, canonico(repetida.instantanea()), repetida.evaluar()],
    [r.pasos, canonico(r.instantanea), r.evaluacion], 'repetición')) repetidas++;
}
if (diferencias.length) {
  for (const error of diferencias) console.error(error.message.includes(': hash')
    ? `${error.message.split('\n')[0]}: actual ${error.actual}; referencia ${error.expected}` : error);
  process.exitCode = 1;
}
console.log(`Fronteras Factory: ${iguales}/28 iguales; pasos ${mismosPasos}/28; resultado completo ${mismosResultados}/28; repetición exacta ${repetidas}/28.`);
