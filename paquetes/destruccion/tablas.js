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
  granada: { velocidad: 10, potenciaPrincipal: .18, satelites: 10, inicial: .019, radio: .044,
    distanciaMin: .15, distanciaMax: .25, alturaRebote: .09, alcance: .17 },
  chorro: { velocidad: 15, duracion: 1.2, fasePlena: 2 / 3, presionMin: 1 / 3, aperturaFinal: 3,
    directo: { cono: Math.PI / 180, arrastre: .12, turbulencia: 0 },
    caotico: { cono: Math.PI / 30, arrastre: 1.1, turbulencia: 3 },
    escalaRuido: .8, concentracion: 2, fusion: .065, inicial: .018, radio: .038, radioMax: .11, gotasMax: 160, manchasPorPieza: 6 },
  acido: { inicial: .045, radio: .22, duracion: 2.4, irregularidad: .13 },
});
export const MATERIALES = congelar(['acero', 'cobre', 'circuito', 'cristal', 'bateria']);
export const FISICA = congelar({
  dt: 1 / 60, fraccionesPorPaso: 3_600_000_000, celda: .04, gravedad: 9.81, restitucion: .22, friccion: .79,
  amortiguacion: .84, umbral: .11, pasosReposo: 18, escoria: 3,
  perdidaFuncion: .48, fraccionFundida: .25, radioUnion: .045, contactoReposo: .0001,
});
export const RESTOS = congelar({ visible: 3, salida: 1 });
export const RENDIMIENTO = congelar({ intacta: 1, dañada: .96, partida: .86, fundida: .60, bordeFundido: .38 });
export const PUENTE = congelar({
  capas: 2, flexion: .28, traccion: 2, ceder: .55, caidaMax: 14 * Math.PI / 180,
  giroPorPaso: 2 * Math.PI / 180, impulsoPorCelda: .8
});
export const CHARCO = congelar({ radio: .36, gota: .065, radioMax: .48, crecimiento: .5, duracion: 6,
  altura: .10, ascenso: 3, mancha: 3, irregularidad: .12, escalaRuido: .14 });
export const PROYECTIL = congelar({ alcance: 35, tiempo: 6 });
