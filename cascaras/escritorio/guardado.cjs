const fs = require('node:fs');
const path = require('node:path');

/** Texto exacto, caché en el principal y volcado síncrono atómico.
 * @param {string} carpeta
 * @param {{ retardo?: number, disco?: typeof fs, alError?: (error: Error) => void }} [opciones] */
function crearGuardado(carpeta, { retardo = 300, disco = fs, alError = console.error } = {}) {
  disco.mkdirSync(carpeta, { recursive: true });
  const archivo = path.join(carpeta, 'guardado.json');
  let almacen = Object.create(null), pendiente = false, reloj = null;
  try {
    const datos = JSON.parse(disco.readFileSync(archivo, 'utf8'));
    if (datos?.version !== 1 || !datos.almacen || typeof datos.almacen !== 'object'
      || Array.isArray(datos.almacen) || Object.values(datos.almacen).some(v => typeof v !== 'string'))
      throw new Error('Formato de guardado desconocido');
    almacen = Object.assign(Object.create(null), datos.almacen);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Si no se puede apartar, se falla sin sobreescribir el original.
      const marca = `${Date.now()}-${process.pid}`;
      let danado = `${archivo}.danado-${marca}`, intento = 0;
      while (disco.existsSync(danado)) danado = `${archivo}.danado-${marca}-${++intento}`;
      disco.renameSync(archivo, danado);
    }
  }

  function volcar() {
    if (reloj) clearTimeout(reloj);
    reloj = null;
    if (!pendiente) return;
    const temporal = `${archivo}.temporal-${process.pid}`;
    try {
      disco.writeFileSync(temporal, JSON.stringify({ version: 1, almacen }), { encoding: 'utf8', mode: 0o600 });
      disco.renameSync(temporal, archivo);
      pendiente = false;
    } catch (error) {
      // El destino anterior queda intacto; el siguiente cambio/cierre reintenta.
      try { disco.unlinkSync(temporal); } catch { /* puede no existir */ }
      alError(error);
    }
  }

  function cambiar(operacion, clave, texto) {
    if (typeof clave !== 'string' || !['escribir', 'borrar'].includes(operacion)
      || (operacion === 'escribir' && typeof texto !== 'string')) return;
    if (operacion === 'escribir') almacen[clave] = texto;
    else delete almacen[clave];
    pendiente = true;
    if (!reloj) reloj = setTimeout(volcar, retardo);
  }
  return { cargar: () => ({ ...almacen }), cambiar, volcar };
}

module.exports = { crearGuardado };
