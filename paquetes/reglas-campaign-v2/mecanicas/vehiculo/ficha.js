export const ficha = {
  id: 'vehiculo', tipo: 'VEH', rol: 'ofensiva', modelo: 'veh_v1', capacidades: ['movimiento'], lecturas: ['hp', 'missiles'],
  verbos: [
    { nombre: 'regularShoot', nombres: { python: 'regular_shoot' }, clase: 'modo', firma: ['cv2.objetivo'],
      nota: 'cv2.fuego', paleta: 'regularShoot(/* objetivo */);' },
    { nombre: 'autoTarget', nombres: { python: 'auto_target' }, clase: 'lectura', firma: ['cv2.tipo', 'cv2.sensor'],
      nota: 'cv2.vehSensor', paleta: 'autoTarget("drone", "visual")' },
  ],
  experimental: { vel: 3, vida: 4, alcance: 8, sensor: 9, cadencia: 1, cargador: 10, reparar: .5,
    recargar: 2, reaparece: 6, misil: { vel: 14, radio: 1.3, dano: 1 } },
};
