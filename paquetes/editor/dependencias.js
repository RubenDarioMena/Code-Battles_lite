/** Servicios opcionales del anfitrión. Se consultan al usarlos, sin capturar globales. */
/** @type {{ i18n?: any, presentacion?: any, lezer?: any, acorn?: any, vistas?: boolean }} */
export const dependencias = {};
/** @param {{ i18n?: any, presentacion?: any, lezer?: any, acorn?: any, vistas?: boolean }} [servicios] */
export function configurar(servicios = {}) { Object.assign(dependencias, servicios); }

export const localizarHTML = html => dependencias.presentacion ? dependencias.presentacion.html(html) : html;
