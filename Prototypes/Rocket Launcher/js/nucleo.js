/* Reloj compartido: el mundo avanza en pasos fijos cuando todos los programas esperan. */
(() => {
  "use strict";
  const DT = 0.05;
  function avanzar(acum, mundo, { algunoCorre, despertarProgramas, paso }) {
    while (acum >= DT && mundo.activo && !mundo.fin && !algunoCorre()) {
      if (despertarProgramas()) break;
      paso(DT); acum -= DT;
    }
    return acum;
  }
  window.NUCLEO = { DT, avanzar };
})();
