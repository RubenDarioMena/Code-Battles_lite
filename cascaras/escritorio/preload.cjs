// El sandbox solo permite require('electron'); sin fs ni módulos locales.
const { contextBridge, ipcRenderer } = require('electron');
const datos = ipcRenderer.sendSync('cbl:cargar');

function crearAlmacen(inicial, canal) {
  const cache = new Map(Object.entries(inicial));
  return {
    leer(clave) { return cache.get(clave) ?? null; },
    escribir(clave, texto) {
      if (typeof clave !== 'string' || typeof texto !== 'string') return;
      cache.set(clave, texto);
      ipcRenderer.send(canal, 'escribir', clave, texto);
    },
    borrar(clave) {
      if (typeof clave !== 'string') return;
      cache.delete(clave);
      ipcRenderer.send(canal, 'borrar', clave);
    },
  };
}

contextBridge.exposeInMainWorld('cblCascara', {
  nombre: 'escritorio', version: datos.version,
  plataforma: { almacen: crearAlmacen(datos.almacen, 'cbl:cambiar'), sesion: crearAlmacen(datos.sesion, 'cbl:sesion') },
});
