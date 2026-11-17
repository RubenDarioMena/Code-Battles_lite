/** Sucesos de muestra: el enriquecimiento visual no altera los sucesos del juego. */
export function muestra(nombre) {
  const tipos = { 'derribo-oruga': 'crawler', 'derribo-dron': 'drone', 'derribo-dron-frio': 'stealth' };
  const z = nombre === 'derribo-dron' ? 2.5 : nombre === 'derribo-dron-frio' ? 2 : 0;
  if (nombre === 'disparo') return { paso: 0, tipo: 'disparo', unidad: 'LAU-01',
    datos: { origen: [16, 9, 1], x: 24, y: 8, z: 0, misil: 1 } };
  if (nombre === 'impacto' || nombre === 'fallo') return { paso: 0, tipo: 'explosion', unidad: 'LAU-01',
    datos: { x: 16, y: 9, z: 0, golpe: nombre === 'impacto' ? 1 : 0, misil: 1 } };
  if (tipos[nombre]) return { paso: 0, tipo: 'derribo', unidad: 'E1',
    datos: { origen: [16, 9, z], tipo: tipos[nombre], por: 'LAU-01' } };
  return { paso: 0, tipo: nombre, unidad: 'LAU-01', datos: { origen: [16, 9, nombre === 'brecha' ? 0 : .7] } };
}
