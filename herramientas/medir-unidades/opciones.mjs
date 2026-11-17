export const uso = `node herramientas/medir-unidades.mjs [--modo sin-pantalla|juego] [--series war,campaign]
  [--unidades 50,200,500] [--pasos 1200] [--calentamiento 40] [--semilla 7]
  [--segundos 60] [--vistas 2d,3d] [--origen http://127.0.0.1:8771]
  [--salida tmp/medir-unidades] [--repeticiones 2]
Sin --origen, modo juego usa Electron. --help y la validación no abren aplicaciones.`;
export function opciones(args) {
  const o = { modo: 'sin-pantalla', series: ['war', 'campaign'], unidades: [50, 200, 500],
    pasos: 1200, calentamiento: 40, semilla: 7, segundos: 60, vistas: ['2d', '3d'],
    origen: '', salida: 'tmp/medir-unidades', repeticiones: 2, caso: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const k = args[i].replace(/^--/, '');
    if (k === 'help' || k === 'caso') { o[k] = true; continue; }
    if (!(k in o) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(uso);
    const v = args[++i];
    if (['series', 'vistas'].includes(k)) o[k] = v.split(',');
    else if (k === 'unidades') o.unidades = v.split(',').map(Number);
    else if (typeof o[k] === 'number') o[k] = Number(v);
    else o[k] = v;
  }
  if (!['sin-pantalla', 'juego'].includes(o.modo)) throw Error('--modo: sin-pantalla|juego');
  if (!o.series.length || o.series.some(v => !['war', 'campaign'].includes(v))) throw Error('--series: war,campaign; Factory solo tiene R1');
  if (!o.vistas.length || o.vistas.some(v => !['2d', '3d'].includes(v))) throw Error('--vistas: 2d,3d');
  if (!o.unidades.length || o.unidades.some(n => !Number.isInteger(n) || n < 1 || n > 500)) throw Error('--unidades: enteros 1..500');
  for (const k of ['pasos', 'repeticiones']) if (!Number.isSafeInteger(o[k]) || o[k] < 1) throw Error(`--${k}: entero positivo`);
  if (!Number.isSafeInteger(o.calentamiento) || o.calentamiento < 0) throw Error('--calentamiento: entero no negativo');
  if (!Number.isSafeInteger(o.semilla)) throw Error('--semilla: entero seguro');
  if (!Number.isFinite(o.segundos) || o.segundos <= 0) throw Error('--segundos: positivo');
  if (o.origen) {
    const u = new URL(o.origen);
    if (!/^https?:$/.test(u.protocol)) throw Error('--origen: HTTP(S)');
    o.origen = u.origin;
  }
  return o;
}
