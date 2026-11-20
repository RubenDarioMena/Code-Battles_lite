import { FISICA, RESTOS, RENDIMIENTO } from './tablas.js';
import { compactar } from './celdas.js';
import { suma, escalar } from './geometria.js';

export function actualizarMascara(p) {
  const { centros, dim } = p.g, plano = dim[0] * dim[1];
  let centro = [0, 0, 0], vivas = 0, fundidas = 0;
  const primera = [], ultima = [];
  for (let i = 0; i < p.mask.length; i++) if (p.mask[i]) {
    vivas++; if (p.mask[i] === 2) fundidas++;
    centro = suma(centro, centros[i]);
    const col = i % plano;
    primera[col] ??= centros[i]; ultima[col] = centros[i];
  }
  Object.assign(p, {
    vivas, fundidas, centro: escalar(centro, 1 / (vivas || 1)), extremos: primera.concat(ultima).filter(Boolean),
    rle: Object.freeze(compactar(p.mask))
  });
}
export const materiales = p => p.d.materiales.map(m => ({ ...m, cantidad: m.cantidad * p.vivas / p.g.total }));
export function etiqueta(p) {
  return p.materiales.map(m => m.material + '-' + Number(m.cantidad.toFixed(1))).join('+') + '-' + (p.funcion ?? 'sin') + '-' + p.estado;
}
export function resto(w, p) {
  const r = {
    robot: p.robot, pieza: p.id, fragmento: p.fragmento, etiqueta: '', materiales: materiales(p),
    funcion: p.funcion, funcionOriginal: p.d.funcion, estado: p.estado, pos: [...p.pos], rot: [...p.rot],
    mascara: p.rle, instante: w.paso * FISICA.dt
  };
  r.etiqueta = etiqueta(r);
  return r;
}
// Única regla de recuperación: masa viva × calidad del estado, descontando
// únicamente la fracción del material que ocupa celdas presentes fundidas.
export function recuperar(p) {
  const factor = RENDIMIENTO[p.estado] * (1 - (1 - RENDIMIENTO.bordeFundido) * p.fundidas / p.vivas);
  return materiales(p).map(m => ({ ...m, cantidad: m.cantidad * factor }));
}
export function botin(w) {
  const materialesTotal = new Map(), funciones = new Map(), restos = [];
  for (const p of w.piezas) if (p.reposo) {
    const r = { ...p.reposo, materiales: recuperar(p) };
    for (const m of r.materiales) materialesTotal.set(m.material, (materialesTotal.get(m.material) ?? 0) + m.cantidad);
    if (r.funcion) funciones.set(r.funcion, (funciones.get(r.funcion) ?? 0) + 1);
    restos.push(r);
  }
  return structuredClone({ restos, total: { materiales: Object.fromEntries(materialesTotal), funciones: Object.fromEntries(funciones) } });
}
export function instantanea(w) {
  return {
    paso: w.paso, tiempo: w.paso * FISICA.dt, terminada: w.terminada, robots: w.robots.map(r => ({
      id: r.id, caido: r.caido,
      piezas: r.def.piezas.map(d => w.piezas.find(p => p.robot === r.id && p.id === d.id && !p.fragmento && p.vivas)?.uid ?? null)
    })),
    restos: w.piezas.filter(p => p.reposo).map(p => ({ ...structuredClone({ ...p.reposo, mascara: undefined }), mascara: p.rle })),
    piezas: w.piezas.filter(p => p.vivas).map(p => {
      const edad = p.reposo ? w.paso * FISICA.dt - p.reposo.instante : 0;
      const salida = p.salida === 'saliendo' ? w.modo : p.salida;
      const fraccion = Math.min(1, Math.max(0, (edad - RESTOS.visible) / RESTOS.salida));
      return {
        uid: p.uid, robot: p.robot, id: p.id, fragmento: p.fragmento, padre: p.padre, forma: p.d.forma, color: p.d.color,
        pos: [...p.pos], rot: [...p.rot], funcion: p.funcion, funcionOriginal: p.d.funcion, zonaFuncion: p.d.zonaFuncion ?? null,
        estado: p.estado, materiales: materiales(p), version: p.version, mascara: p.rle, dim: [...p.g.dim], celda: FISICA.celda,
        celdas: p.vivas, celdasIniciales: p.g.total, fundidas: p.fundidas, volumenes: structuredClone(p.volumenes),
        salida, opacidad: salida === 'oculto' ? 0 : salida === 'desvaneciendose' ? 1 - fraccion : 1,
        hundimiento: salida === 'hundiendose' ? fraccion * (Math.hypot(...p.g.dim) * FISICA.celda + Math.abs(p.pos[2])) : 0
      };
    })
  };
}
