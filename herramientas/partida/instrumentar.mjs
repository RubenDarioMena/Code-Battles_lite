import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { archivoJuego } from './cargar.mjs';

/** Extrae una función por su nombre y su árbol real, sin contar llaves en cadenas/comentarios.
 * @param {string} texto @param {string} nombre @param {any} acorn */
export function extraerFuncion(texto, nombre, acorn) {
  const marca = `function ${nombre}(`;
  const inicio = texto.indexOf(marca);
  if (inicio < 0 || texto.indexOf(marca, inicio + marca.length) >= 0)
    throw new Error(`juego.js: no se encuentra una única función ${nombre}.`);
  try {
    const nodo = acorn.parseExpressionAt(texto, inicio, { ecmaVersion: 2022 });
    if (nodo.type !== 'FunctionExpression' || nodo.id?.name !== nombre) throw new Error('función inesperada');
    return { texto: texto.slice(inicio, nodo.end), inicio, fin: nodo.end };
  } catch (error) { throw new Error(`juego.js: no se pudo extraer ${nombre}: ${error.message}`); }
}

/** Extrae una declaración const con una función flecha por su expresión Acorn.
 * @param {string} texto @param {string} nombre @param {any} acorn */
export function extraerConst(texto, nombre, acorn) {
  const marca = `const ${nombre} = `, inicio = texto.indexOf(marca);
  if (inicio < 0 || texto.indexOf(marca, inicio + marca.length) >= 0)
    throw new Error(`juego.js: no se encuentra una única declaración ${nombre}.`);
  try {
    const nodo = acorn.parseExpressionAt(texto, inicio + marca.length, { ecmaVersion: 2022 });
    if (nodo.type !== 'ArrowFunctionExpression') throw new Error('se esperaba una función flecha');
    return texto.slice(inicio, nodo.end) + ';';
  } catch (error) { throw new Error(`juego.js: no se pudo extraer ${nombre}: ${error.message}`); }
}

/** Evalúa el léxico/instrumentador y las otras funciones puras necesarias de juego.js.
 * @param {vm.Context} contexto @param {any} mundo */
export function crearInstrumentador(contexto, mundo) {
  const texto = readFileSync(archivoJuego, 'utf8');
  const fn = nombre => extraerFuncion(texto, nombre, contexto.acorn);
  const instrumento = fn('instrumentar');
  const inicio = texto.indexOf('const KW =');
  if (inicio < 0 || inicio >= instrumento.inicio || texto.indexOf('const KW =', inicio + 1) >= 0)
    throw new Error('juego.js: no se encuentra el bloque léxico desde const KW hasta instrumentar.');
  // Se valida además el bloque completo antes de evaluarlo. Ninguna función se copia a mano.
  const bloque = texto.slice(inicio, instrumento.fin);
  contexto.acorn.parse(bloque, { ecmaVersion: 2022 });
  contexto.__mundoPartida = mundo;
  return vm.runInContext(`(() => {
    const ES_FACTORY = false, ES_CAMPAIGN = false;
    const nombresVar = () => [...__mundoPartida.programables, ...__mundoPartida.sensores].map(e => e.id.replace(/-/g, '_'));
    ${bloque}
    const proveedorEditor = window.CMGProveedor.crear({ serie: 'war',
      sensores: () => __mundoPartida.sensores.map(e => e.id.replace(/-/g, '_')) });
    let opcionesPy = null, clavePy = '', nombresPython = null;
    ${fn('revisar').texto}
    ${fn('opcionesPython').texto}
    ${fn('mensajePython').texto}
    const r2 = v => Math.round(v * 100) / 100;
    ${extraerConst(texto, 'fmtLugar', contexto.acorn)}
    ${extraerConst(texto, 'fmtValor', contexto.acorn)}
    return { instrumentar, revisar, opcionesPython, mensajePython, fmtLugar, fmtValor };
  })()`, contexto, { filename: 'juego.js:extracto-partida' });
}
