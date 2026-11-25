// El proveedor resuelve las claves en el idioma del editor.
export const fichaClic = {
  eventos: [
    { objeto: 'terrain', nombre: 'onClick', nombres: { python: 'on_click' }, firma: ['fn'],
      parametro: 'punto', campos: ['x', 'y'], nota: 'cv2.terreno', seudo: 'cv2.cuandoTerreno' },
    { objeto: 'enemies', nombre: 'onClick', nombres: { python: 'on_click' }, firma: ['fn'],
      parametro: 'enemigo', campos: ['id', 'type', 'x', 'y', 'hp', 'vx', 'vy'], nota: 'cv2.enemigo', seudo: 'cv2.cuandoEnemigo' },
  ],
  ampliaciones: [{ nombre: 'regularShoot', firma: ['cv2.objetivo'], nota: 'cv2.fuego' }],
};
