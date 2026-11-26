// Vehículos del experimento de daño (consolidado del 23-nov, 7.3 y 13.B): pocos componentes con masa, material,
// una caja aproximada en metros locales y uniones. La caja es [x, y, z, largo, ancho, alto] con el centro en (x, y, z);
// x apunta a la proa, y a babor (izquierda), z hacia arriba. Las masas son provisionales.
//
// La oruga blindada es la de la B8. Sus orugas cuelgan del chasis central, así que si el centro se pierde, la proa y la
// popa quedan como dos fragmentos grandes (el caso del tanque corroído, 7.2).

/** @typedef {[number, number, number, number, number, number]} Caja */
/** @typedef {{ id: string, tipo: string, material: string, kg: number, caja: Caja, dureza?: number }} Componente */
/** @typedef {{ clase: string, componentes: Componente[], uniones: Array<[string, string]>,
 *   funciones: Record<string, string[]> }} Vehiculo */

/** @type {Vehiculo} */
export const ORUGA = {
  clase: 'oruga',
  componentes: [
    { id: 'proa', tipo: 'blindaje', material: 'acero', kg: 14, caja: [0.7, 0, 0.45, 0.5, 1.0, 0.5] },
    { id: 'centro', tipo: 'chasis', material: 'acero', kg: 12, caja: [0, 0, 0.45, 0.9, 1.0, 0.5] },
    { id: 'popa', tipo: 'blindaje', material: 'acero', kg: 14, caja: [-0.7, 0, 0.45, 0.5, 1.0, 0.5] },
    // Bajo la cubierta de popa y algo más blando que el blindaje.
    { id: 'motor', tipo: 'motor', material: 'acero', kg: 10, caja: [-0.65, 0, 0.8, 0.4, 0.6, 0.3], dureza: 0.8 },
    { id: 'oruga-izq', tipo: 'transmision', material: 'acero', kg: 9, caja: [0, 0.62, 0.22, 1.9, 0.24, 0.44] },
    { id: 'oruga-der', tipo: 'transmision', material: 'acero', kg: 9, caja: [0, -0.62, 0.22, 1.9, 0.24, 0.44] },
    { id: 'arma', tipo: 'arma', material: 'acero', kg: 6, caja: [0.1, 0, 0.92, 0.5, 0.35, 0.34] },
    { id: 'electronica', tipo: 'electronica', material: 'acero', kg: 3, caja: [0.75, 0, 0.8, 0.3, 0.4, 0.2], dureza: 0.5 },
  ],
  uniones: [
    ['proa', 'centro'], ['centro', 'popa'], ['popa', 'motor'], ['centro', 'oruga-izq'], ['centro', 'oruga-der'],
    ['centro', 'arma'], ['proa', 'electronica'],
  ],
  // Regla funcional (7.3): cada función necesita sus componentes enteros y unidos entre sí.
  funciones: { movilidad: ['motor', 'oruga-izq', 'oruga-der'], fuego: ['arma', 'electronica'] },
};

export const VEHICULOS = { oruga: ORUGA };
