export default {
  id: "vehiculo", tipo: "VEH", modelo: "veh_v1", capacidades: ["movimiento"],
  verbos: [
    { nombre: "shootAt", nombres: { python: "shoot_at" }, clase: "modo", firma: "shootAt(objetivo)", nota: "i18n:veh.shootAt" },
    { nombre: "autoTarget", nombres: { python: "auto_target" }, lectura: true, firma: "autoTarget()", nota: "i18n:veh.autoTarget" },
  ],
  lecturas: ["hp", "missiles"],
};
