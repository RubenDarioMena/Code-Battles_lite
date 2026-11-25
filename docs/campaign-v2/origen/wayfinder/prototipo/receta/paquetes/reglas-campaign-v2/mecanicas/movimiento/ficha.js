export default {
  id: "movimiento",
  verbos: [
    { nombre: "moveTo", nombres: { python: "move_to" }, clase: "modo", firma: "moveTo(lugar)", nota: "i18n:mov.moveTo" },
    { nombre: "stop", nombres: { python: "stop" }, clase: "modo", firma: "stop()", nota: "i18n:mov.stop" },
    { nombre: "arrive", nombres: { python: "arrive" }, await: true, firma: "await arrive()", nota: "i18n:mov.arrive" },
  ],
  lecturas: ["position", "home", "moving"],
  eventos: [{ nombre: "onArrive", nombres: { python: "on_arrive" }, seudo: "i18n:mov.cuandoLlegues" }], // extensión (ticket 07)
};
