import { CMGProveedor } from './datos-proveedor.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarProveedorJuego(ctx) {
  const proveedorEditor = CMGProveedor.crear({
    extension: ctx.extension,
    serie: ctx.SERIE,
    sensores: () => ctx.mundo ? ctx.mundo.sensores.map(s => ctx.varDe(s.id)) : [],
    objetos: () => ["yo", ...(ctx.mundo ? (ctx.ES_CAMPAIGN ? ctx.mundo.unidades : ctx.ES_FACTORY ? ctx.mundo.entidades : ctx.mundo.maquinas).map(e => ctx.varDe(e.id)) : [])],
    propiedades: () => [...ctx.PROPS],
  });

  return {
    get proveedorEditor() { return proveedorEditor; }
  };
}
