/** Servicios opcionales del anfitrión. Se consultan al usarlos, sin capturar globales. */
const datosSesion = new Map();
/** @type {import('./index.js').AlmacenSesion} */
const sesionMemoria = {
  leer: clave => datosSesion.get(clave) ?? null,
  escribir: (clave, texto) => { datosSesion.set(clave, texto); },
  borrar: clave => { datosSesion.delete(clave); },
};
/** @type {{ sesion: import('./index.js').AlmacenSesion, i18n?: any, presentacion?: any, lezer?: any, acorn?: any, vistas?: boolean }} */
export const dependencias = { sesion: sesionMemoria };
/** @param {{ sesion?: import('./index.js').AlmacenSesion, i18n?: any, presentacion?: any, lezer?: any, acorn?: any, vistas?: boolean }} [servicios] */
export function configurar(servicios = {}) { Object.assign(dependencias, servicios); }

export const localizarHTML = html => dependencias.presentacion ? dependencias.presentacion.html(html) : html;
