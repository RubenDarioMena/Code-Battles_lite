import * as produccion from './fabrica/produccion.js';

// El ciclo de la prensa, las existencias y la evaluación de metas pertenecen a producción.
export function configurarFabrica(nivel, h0) {
  const { prensa, bodega, receta } = h0;
  const def = { clave: nivel.clave, revision: nivel.revision, unidades: [prensa, bodega],
    hitos: [h0], inicial: {}, presupuesto: 0, energia: produccion.MAQUINAS[prensa.clase].kw };
  const recetas = { [receta.base]: { ...produccion.RECETAS[receta.base], sale: receta.sale } };
  return {
    crear(guardado) {
      const m = produccion.restaurar(guardado, def);
      m.activo = true;
      return m;
    },
    paso(m, dt) {
      m.t += dt;
      const q = m.porId[prensa.id];
      q.entrada.steel = produccion.MAQUINAS[prensa.clase].entrada;
      produccion.pasoMaquina(m, q, dt, 1, recetas);
      if (q.salida.length && m.arsenal.misiles < produccion.ARSENAL.cap) {
        q.salida.shift();
        m.arsenal.misiles++;
        m.arsenal.aMano++;
      }
    },
    metas: produccion.metas, serializar: produccion.serializar,
  };
}
