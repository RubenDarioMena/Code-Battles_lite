export function estadisticas(valores) {
  const v = [...valores].sort((a, b) => a - b), n = v.length;
  const p = q => n ? v[Math.ceil(n * q) - 1] : null;
  return { muestras: n, mediaMs: n ? v.reduce((a, b) => a + b, 0) / n : null,
    p50Ms: p(.5), p95Ms: p(.95), p99Ms: p(.99), maxMs: n ? v[n - 1] : null };
}
export function resumirPasos(muestras) {
  return Object.fromEntries(['simulacion', 'instantanea', 'ceder', 'responder', 'total'].map(k => [k, estadisticas(muestras.map(m => m[k]))]));
}
export function deriva({ duracionMs, pasos, dt = .05 }) {
  const realS = duracionMs / 1000, juegoS = pasos * dt;
  return { realS, juegoS, pasos, pasosPorSegundoReal: pasos / realS,
    derivaS: juegoS - realS, derivaPasos: (juegoS - realS) / dt,
    mantieneRitmo: Math.abs(juegoS - realS) <= dt + 1e-9 };
}
export function resumirPagina(r) {
  const ritmo = deriva(r), costes = resumirPasos(r.muestras);
  return { ...ritmo, fotogramas: r.intervalos.length, fotograma: estadisticas(r.intervalos),
    fotogramasMas33: r.intervalos.filter(v => v > 33).length,
    fotogramasRecortados: r.recortados, sinAcumularMs: r.sinAcumularMs, costes,
    cumple: ritmo.mantieneRitmo && r.recortados === 0 && costes.total.p95Ms !== null && costes.total.p95Ms < 16.7,
    entorno: r.entorno, error: r.error, arranqueMs: r.arranqueMs };
}
