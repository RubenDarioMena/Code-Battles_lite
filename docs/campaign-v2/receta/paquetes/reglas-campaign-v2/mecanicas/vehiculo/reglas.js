// VEH · vehículo con torreta que sale de la muralla. Usa la capacidad «movimiento».
// Su arma es de V2: un proyectil propio que, al impactar, llama a war.danoEnArea (ticket 05).

export const TIPO = { vel: 3, vida: 4, alcance: 8, sensor: 9, misiles: 10 }; // experimentales

/** Crea un VEH en `home` (dentro de la muralla). */
export function crear(campo, def) {}

/** Verbo `shootAt(objetivo)`: el mismo disparo dirigido que la orden puntual (ticket 06). */
export function shootAt(unidad, objetivo) {}

/** Lectura `autoTarget()`: enemigo más cercano dentro del sensor (enemigos de War + de V2). */
export function autoTarget(unidad, campo, war) {}

/** Paso: dentro de la muralla repara 1 cada 2 s y recarga 2 misiles/s; vuela proyectiles. */
export function paso(campo, dt, war) {}
