export const ficha = {
  id: 'movimiento', lecturas: ['position', 'home', 'moving'],
  verbos: [
    { nombre: 'moveTo', nombres: { python: 'move_to' }, clase: 'modo', firma: ['cv2.arg.lugar'], nota: 'cv2.moveTo', seudo: { rotulo: 'cv2.bloque.moveTo', lugar: 'home' }, paleta: 'moveTo(/* lugar */);' },
    { nombre: 'stop', nombres: { python: 'stop' }, clase: 'modo', firma: [], nota: 'cv2.stop', seudo: { rotulo: 'cv2.bloque.stop', lugar: null }, paleta: 'stop();' },
    { nombre: 'arrive', nombres: { python: 'arrive' }, clase: 'espera', await: true, firma: [], nota: 'cv2.arrive', seudo: { rotulo: 'cv2.bloque.arrive', lugar: null }, paleta: 'await arrive();' },
  ],
  eventos: [{ nombre: 'onArrive', nombres: { python: 'on_arrive' }, firma: ['fn'], parametro: 'punto',
    campos: ['x', 'y'], nota: 'cv2.arrive', seudo: 'cv2.onArrive' }],
};
