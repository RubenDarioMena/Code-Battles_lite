// WHL · rueda kamikaze (receta del ticket 10). Valores experimentales.
export const ficha = {
  id: 'rueda', tipo: 'WHL', rol: 'ofensiva', modelo: null, capacidades: ['movimiento', 'rueda'], lecturas: ['hp', 'nearest'],
  verbos: [
    { nombre: 'detonate', nombres: { python: 'detonate' }, clase: 'modo', firma: [], nota: 'cv2.detonate', paleta: 'detonate();' },
  ],
  experimental: { vel: 6, vida: 1, radio: 2.5, dano: 8, reaparece: 12 },
};
