/** Percentil de rango más próximo; ms de reloj real o de CPU según la muestra. */
export function estadisticas(valores) {
  if (!valores.length) return { muestras: 0, mediaMs: null, p95Ms: null, p99Ms: null, maxMs: null, totalMs: 0 };
  const orden = [...valores].sort((a, b) => a - b), n = orden.length;
  const totalMs = valores.reduce((a, b) => a + b, 0);
  return { muestras: n, mediaMs: totalMs / n, p95Ms: orden[Math.ceil(n * .95) - 1],
    p99Ms: orden[Math.ceil(n * .99) - 1], maxMs: orden[n - 1], totalMs };
}

export function resumir(medida) {
  const { intervalos, muestras, ...resto } = medida;
  return { ...resto, fotogramas: intervalos.length, fotogramasMas33: intervalos.filter(t => t > 33).length,
    fotograma: estadisticas(intervalos), cpu: {
      particulas: estadisticas(muestras.map(m => m.particulasMs)),
      dibujar: estadisticas(muestras.map(m => m.dibujarMs)),
      total: estadisticas(muestras.map(m => m.particulasMs + m.dibujarMs)),
    } };
}
