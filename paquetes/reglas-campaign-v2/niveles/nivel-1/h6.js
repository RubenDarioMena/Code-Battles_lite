// H6 · Carcasas: la torreta esfera necesita semiesferas (consolidado 3.2 y 13.A). Cada corte deja recortes, un
// subproducto previsto; la fundidora los vuelve placa. Cinco placas dan cinco semiesferas; la sexta sale de reciclar.
export default {
  clave: 'h6', fabrica: true, pistas: 3,
  alEmpezar: { entregas: [{ lugar: 'BAY-1', pieza: 'plate', n: 5 }] },
  metas: [
    { k: 'semiesferas', tipo: 'en', lugar: 'PAL-7', pieza: 'shell', n: 6 },
    { k: 'refundidas', tipo: 'hechos', pieza: 'plate', n: 1 },
  ],
};
