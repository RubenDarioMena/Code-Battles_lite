/** Adaptador síncrono de texto; incluso obtener el almacenamiento puede fallar.
 * @param {typeof globalThis | { localStorage?: Storage, sessionStorage?: Storage }} [ventana]
 * @returns {import('../../paquetes/app/index.js').Plataforma} */
export function crearPlataformaWeb(ventana = globalThis) {
  /** @param {'localStorage' | 'sessionStorage'} nombre */
  const adaptar = nombre => ({
    leer(clave) {
      try { return ventana[nombre].getItem(clave); } catch { return null; }
    },
    escribir(clave, texto) {
      try { ventana[nombre].setItem(clave, texto); } catch { /* sin almacenamiento */ }
    },
    borrar(clave) {
      try { ventana[nombre].removeItem(clave); } catch { /* sin almacenamiento */ }
    },
  });
  return { almacen: adaptar('localStorage'), sesion: adaptar('sessionStorage') };
}
