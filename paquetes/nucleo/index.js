import { validarOrden, validarSuceso } from '../protocolo/index.js';

/** Paso fijo compartido por las partidas. */
export const DT = 0.05;

/**
 * @param {number} acum
 * @param {import('./index.js').RelojMundo} mundo
 * @param {import('./index.js').ControlAvance} control
 */
export function avanzar(acum, mundo, { algunoCorre, despertarProgramas, paso }) {
  while (acum >= DT && mundo.activo && !mundo.fin && !algunoCorre()) {
    if (despertarProgramas()) break;
    paso(DT); acum -= DT;
  }
  return acum;
}

/** @param {number} a @returns {import('./index.js').Rng} */
export function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** @param {number} semilla */
export function crearRng(semilla) {
  return mulberry32((semilla * 2654435761) >>> 0);
}

/** @param {number} t */
export function pasoDe(t) { return Math.round(t / DT); }

/** @returns {import('./index.js').ColaOrdenes} */
export function crearColaOrdenes() {
  /** @type {import('../protocolo/index.js').Orden[]} */
  let ordenes = [];
  return {
    poner(orden) {
      const errores = validarOrden(orden);
      if (errores.length) throw new Error(errores.join('\n'));
      ordenes.push(structuredClone(orden));
      // La ordenación estable conserva la llegada dentro del mismo paso.
      ordenes.sort((primera, segunda) => primera.paso - segunda.paso);
    },
    tomar(paso) {
      const listas = ordenes.filter(orden => orden.paso <= paso);
      ordenes = ordenes.filter(orden => orden.paso > paso);
      return listas;
    },
    pendientes() { return structuredClone(ordenes); },
  };
}

/** @param {{ limite?: number }} opciones @returns {import('./index.js').RegistroSucesos} */
export function crearRegistroSucesos({ limite = 2000 } = {}) {
  if (!Number.isInteger(limite) || limite < 0) throw new Error('El límite de sucesos debe ser un entero no negativo.');
  /** @type {import('../protocolo/index.js').Suceso[]} */
  const sucesos = [];
  return {
    anotar(suceso) {
      const errores = validarSuceso(suceso);
      if (errores.length) throw new Error(errores.join('\n'));
      sucesos.push(structuredClone(suceso));
      if (sucesos.length > limite) sucesos.splice(0, sucesos.length - limite);
    },
    desde(paso) { return structuredClone(sucesos.filter(suceso => suceso.paso >= paso)); },
    vaciar() { sucesos.length = 0; },
  };
}

/**
 * @param {object & { sucesos?: import('./index.js').RegistroSucesos }} mundo
 * @param {import('./index.js').RegistroSucesos} registro
 */
export function adjuntarSucesos(mundo, registro = crearRegistroSucesos()) {
  if ('sucesos' in mundo) return mundo.sucesos;
  Object.defineProperty(mundo, 'sucesos', { value: registro, enumerable: false });
  return registro;
}

/**
 * @param {import('./index.js').MundoConSucesos} mundo
 * @param {string} tipo
 * @param {string | null} [unidad]
 * @param {import('../protocolo/index.js').Suceso['datos'] | null} [datos]
 */
export function anotarSuceso(mundo, tipo, unidad, datos) {
  if (!mundo.sucesos) return;
  mundo.sucesos.anotar({ paso: pasoDe(mundo.t), tipo,
    ...(unidad == null ? {} : { unidad }), ...(datos == null ? {} : { datos }) });
}

/**
 * @template {object} Mundo
 * @template {import('../protocolo/index.js').DatoPlano} Escenario
 * @template Evaluacion
 * @param {{ reglas: import('./index.js').Reglamento<Mundo, Escenario, Evaluacion>, escenario: Escenario, semilla: number }} opciones
 * @returns {import('./index.js').Partida<Mundo, Escenario, Evaluacion>}
 */
export function crearPartida({ reglas, escenario, semilla }) {
  const escenarioOriginal = structuredClone(escenario);
  const rng = crearRng(semilla);
  const mundo = reglas.crearMundo(structuredClone(escenarioOriginal), rng);
  const registro = adjuntarSucesos(mundo);
  const cola = crearColaOrdenes();
  /** @type {import('../protocolo/index.js').Orden[]} */
  const ordenes = [];
  let pasoActual = 0;
  return {
    mundo: /** @type {Mundo & { sucesos: import('./index.js').RegistroSucesos }} */ (mundo),
    ordenar(orden) {
      cola.poner(orden);
      ordenes.push(structuredClone(orden));
    },
    paso() {
      for (const orden of cola.tomar(pasoActual)) reglas.aplicarOrden(mundo, orden);
      reglas.paso(mundo, DT);
      pasoActual++;
    },
    instantanea() { return reglas.instantanea(mundo); },
    sucesos(desdePaso = 0) { return registro.desde(desdePaso); },
    evaluar() { return reglas.evaluar(mundo); },
    serializar() {
      return structuredClone({ reglas: reglas.id, version: reglas.version,
        escenario: escenarioOriginal, semilla, paso: pasoActual, ordenes });
    },
    get pasoActual() { return pasoActual; },
  };
}

/**
 * @template {object} Mundo
 * @template {import('../protocolo/index.js').DatoPlano} Escenario
 * @template Evaluacion
 * @param {import('./index.js').DatosPartida<Escenario>} datos
 * @param {import('./index.js').Reglamento<Mundo, Escenario, Evaluacion>} reglas
 */
export function restaurar(datos, reglas) {
  if (datos.reglas !== reglas.id || datos.version !== reglas.version)
    throw new Error('El reglamento o su versión no coincide con la partida.');
  if (!Number.isSafeInteger(datos.paso) || datos.paso < 0)
    throw new Error('El paso de la partida debe ser un entero seguro no negativo.');
  const partida = crearPartida({ reglas, escenario: datos.escenario, semilla: datos.semilla });
  for (const orden of datos.ordenes) partida.ordenar(orden);
  while (partida.pasoActual < datos.paso) partida.paso();
  return partida;
}
