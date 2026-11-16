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

