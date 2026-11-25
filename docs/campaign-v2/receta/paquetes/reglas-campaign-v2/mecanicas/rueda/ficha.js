export default {
  id: "rueda", tipo: "WHL", modelo: "whl_v1", capacidades: ["movimiento"],
  verbos: [{ nombre: "detonate", nombres: { python: "detonate" }, clase: "modo", firma: "detonate()", nota: "i18n:whl.detonate" }],
  lecturas: ["hp"],
};
