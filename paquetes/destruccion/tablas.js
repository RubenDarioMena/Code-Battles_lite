export function congelar(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) congelar(v);
    Object.freeze(o);
  }
  return o;
}
export const ARMAS = congelar({
  cinetico: { impulso: 9, propagacion: .48, radio: .047 },
  explosivo: { impulso: 14, radio: .8, crater: .105 },
  laser: { radio: .052, alcance: .8, anillo: .024 },
  acido: { inicial: .045, radio: .22, duracion: 2.4, irregularidad: .13 },
});
export const MATERIALES = congelar(['acero', 'cobre', 'circuito', 'cristal', 'bateria']);
export const FISICA = congelar({
  dt: 1 / 60, fraccionesPorPaso: 3_600_000_000, celda: .04, gravedad: 9.81, restitucion: .22, friccion: .79,
  amortiguacion: .84, umbral: .11, pasosReposo: 18, escoria: 3,
  perdidaFuncion: .48, fraccionFundida: .25, radioUnion: .045,
});
export const RESTOS = congelar({ visible: 3, salida: 1 });
export const RENDIMIENTO = congelar({ intacta: 1, dañada: .96, partida: .86, fundida: .60, bordeFundido: .38 });
