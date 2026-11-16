/** Plataforma aislada: dos almacenes de texto independientes, sin persistencia.
 * @returns {import('./index.js').Plataforma} */
export function crearPlataformaMemoria() {
  const crearAlmacen = () => {
    const datos = new Map();
    return {
      leer: clave => datos.get(clave) ?? null,
      escribir: (clave, texto) => { datos.set(clave, texto); },
      borrar: clave => { datos.delete(clave); },
    };
  };
  return { almacen: crearAlmacen(), sesion: crearAlmacen() };
}
