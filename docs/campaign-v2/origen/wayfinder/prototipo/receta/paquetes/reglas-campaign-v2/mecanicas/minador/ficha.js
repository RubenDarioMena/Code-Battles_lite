export default {
  id: "minador", tipo: "MIN", modelo: null /* placeholder */, capacidades: ["movimiento"],
  verbos: [{ nombre: "drop", nombres: { python: "drop" }, clase: "modo", firma: "drop()", nota: "i18n:min.drop" }],
  lecturas: ["charges"],
  eventos: [{ nombre: "onDetonation", nombres: { python: "on_detonation" }, parametro: "carga", seudo: "i18n:min.cuandoDetone" }],
};
