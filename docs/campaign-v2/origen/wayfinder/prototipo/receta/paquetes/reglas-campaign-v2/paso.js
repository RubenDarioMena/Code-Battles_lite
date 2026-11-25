// Orden fijo (ticket 05): fábrica → puente → batalla de War → mecánicas. Una línea por mecánica.
import * as movimiento from "./mecanicas/movimiento/reglas.js";
import * as vehiculo from "./mecanicas/vehiculo/reglas.js";
import * as rueda from "./mecanicas/rueda/reglas.js";
import * as minador from "./mecanicas/minador/reglas.js";

export function paso(mundo, dt) {
  // produccion.paso(...); puente.paso(...); war.paso(...);
  movimiento.paso(mundo.campo, dt);
  vehiculo.paso(mundo.campo, dt, mundo.war);   // + VEH
  rueda.paso(mundo.campo, dt);                 // + WHL
  minador.paso(mundo.campo, dt, mundo.war);    // + minador
}
