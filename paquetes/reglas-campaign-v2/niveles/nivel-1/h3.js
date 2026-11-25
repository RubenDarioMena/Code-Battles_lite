// H3 · Máquina lenta: la mezcladora absorbe de sus dos tarimas y necesita una vacía para su salida.
export default {
  clave: 'h3', fabrica: true, pistas: 3,
  alEmpezar: { entregas: [{ lugar: 'BAY-1', pieza: 'steel', n: 12 }, { lugar: 'BAY-1', pieza: 'polymer', n: 12 }] },
  metas: [{ k: 'cargas', tipo: 'hechos', pieza: 'charge', n: 4 }],
};
