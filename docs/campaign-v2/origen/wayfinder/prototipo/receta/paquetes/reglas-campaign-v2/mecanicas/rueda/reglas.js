// WHL · rueda kamikaze. Usa «movimiento». Al morir reaparece y su programa vuelve a la primera línea.

export const TIPO = { vel: 6, vida: 1, dano: 8, radio: 2.5, reaparece: 12 }; // experimentales

/** Verbo `detonate()`: war.danoEnArea(x, y, 2.5, 8); 2 de daño a VEH propios cercanos; la rueda muere. */
export function detonate(unidad, campo, war) {}

/** Paso: cuenta atrás de reaparición. Al cumplirse: recrea la unidad en `home` y pide al anfitrión
 *  reiniciar su programa (la misma operación que «aplicar ahora», ticket 07). */
export function paso(campo, dt) {}
