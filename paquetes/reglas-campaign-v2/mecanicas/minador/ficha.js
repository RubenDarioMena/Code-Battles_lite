// Minador · deja cargas que estallan cuando pasa un enemigo de suelo (receta del ticket 10). Valores experimentales.
export const ficha = {
  id: 'minador', tipo: 'MIN', rol: 'utilitaria', modelo: null, capacidades: ['movimiento', 'minador'], lecturas: ['hp', 'charges'],
  verbos: [
    { nombre: 'drop', nombres: { python: 'drop' }, clase: 'modo', firma: [], nota: 'cv2.drop', paleta: 'drop();' },
  ],
  eventos: [{ nombre: 'onDetonation', nombres: { python: 'on_detonation' }, firma: ['fn'], parametro: 'carga',
    campos: ['x', 'y', 'enemigos'], nota: 'cv2.detonacion', seudo: 'cv2.onDetonation' }],
  experimental: { vel: 2.5, vida: 3, cargas: 4, radio: 1.5, dano: 4, reaparece: 10 },
};
