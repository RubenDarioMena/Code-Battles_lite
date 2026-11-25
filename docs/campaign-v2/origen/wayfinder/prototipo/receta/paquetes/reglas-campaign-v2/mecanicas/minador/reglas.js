// Minador · deja cargas con drop(); detonan cuando un enemigo pasa encima. Usa «movimiento».

export const TIPO = { vel: 2, vida: 3, cargas: 4, radio: 1.5, dano: 4 }; // inventados para el esqueleto

/** Verbo `drop()`: deja una carga en `unidad.position`. Sin cargas: aviso, no error. */
export function drop(unidad, campo) {}

/** Paso: por cada carga, si un enemigo (war.enemigos()) está dentro del radio → war.danoEnArea
 *  y emite `{ evento: "detonation", unidad, datos: { x, y, enemigos } }`. */
export function paso(campo, dt, war) {}
