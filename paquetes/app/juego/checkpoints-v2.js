// Solo la frontera de hito se escribe aquí. Las ediciones se guardan bajo otra clave.
const CLAVE = 'campaign-v2-nivel-1';

/** ¿El checkpoint es del mismo nivel y revisión que `ref` (otro checkpoint o el propio nivel)?
 * @param {{ clave?: string, revision?: number } | undefined} cp
 * @param {{ clave: string, revision: number }} ref */
export const vigenteV2 = (cp, ref) => !!cp && cp.clave === ref.clave && cp.revision === ref.revision;

/** Quita del historial los checkpoints de otra revisión: ya no se pueden restaurar, y elegirlos llevaría a un H0
 * nuevo sin explicación. Devuelve cuántos quitó. */
export function purgarHistorialV2(historial, ref) {
  let quitados = 0;
  for (const [h, cp] of Object.entries(historial.hitos)) if (!vigenteV2(cp, ref)) { delete historial.hitos[h]; quitados++; }
  if (!historial.hitos[historial.ultimo]) historial.ultimo = null;
  return quitados;
}

/** El historial sin reglamento: la sesión de fábrica no compone las Batallas, pero escribe su checkpoint aquí. */
export function leerHistorialV2(almacen) {
  try { return JSON.parse(almacen.leer(CLAVE)) ?? { ultimo: null, hitos: {} }; } catch { return { ultimo: null, hitos: {} }; }
}
export function guardarHistorialV2(almacen, historial) {
  try { almacen.escribir(CLAVE, JSON.stringify(historial)); } catch { /* Sesión en memoria. */ }
}
export function escribirCheckpointV2(almacen, cp) {
  const historial = leerHistorialV2(almacen);
  purgarHistorialV2(historial, cp);
  historial.hitos[cp.hito] = cp;
  historial.ultimo = cp.hito;
  try { almacen.escribir(CLAVE, JSON.stringify(historial)); } catch { /* Sesión en memoria. */ }
}
export function elegirCheckpointV2(almacen, hito) {
  const historial = leerHistorialV2(almacen);
  if (!historial.hitos[hito]) return false;
  historial.ultimo = hito;
  try { almacen.escribir(CLAVE, JSON.stringify(historial)); } catch { /* Sesión en memoria. */ }
  return true;
}

export function abrirCheckpoints(config, almacen) {
  function leer(k, defecto) {
    try { return JSON.parse(almacen.leer(k)) ?? defecto; } catch { return defecto; }
  }
  function escribir(k, valor) {
    try { almacen.escribir(k, JSON.stringify(valor)); } catch { /* Sesión en memoria. */ }
  }
  let historial = leer(CLAVE, { ultimo: null, hitos: {} });
  let actuales = leer(CLAVE + '-programas', null);
  const ultimo = () => historial.hitos[historial.ultimo];
  const guardarActuales = datos => {
    actuales = JSON.parse(JSON.stringify(datos));
    escribir(CLAVE + '-programas', actuales);
  };
  function guardar(m, datos) {
    const cp = { ...config.reglas.serializar(m), ...datos };
    purgarHistorialV2(historial, cp);
    historial.hitos[cp.hito] = cp;
    historial.ultimo = cp.hito;
    escribir(CLAVE, historial);
    guardarActuales({ programas: cp.programas, fuentes: cp.fuentes, vinculos: cp.vinculos });
  }
  function volver(hito, conProgramas = false) {
    const c = historial.hitos[hito];
    if (!c) return false;
    if (conProgramas) guardarActuales({ programas: c.programas, fuentes: c.fuentes, vinculos: c.vinculos });
    if (historial.ultimo !== hito) {
      historial.ultimo = hito;
      escribir(CLAVE, historial);
    }
    return true;
  }
  const inicial = ultimo();
  let aviso = null;
  if (inicial) {
    const m = config.reglas.restaurar(inicial, 1, actuales ?? {});
    if (m.aviso) {
      aviso = m.aviso;
      historial = { ultimo: null, hitos: {} };
      guardar(m);
    } else if (purgarHistorialV2(historial, inicial)) {
      // El último vale, pero quedan checkpoints de una revisión anterior (guardados antes de que se purgaran al escribir).
      aviso = 'cv2.revision';
      escribir(CLAVE, historial);
    }
  }
  return { guardar, volver, ultimo, guardarActuales, aviso, get actuales() { return actuales; },
    get lista() { return Object.values(historial.hitos); } };
}

export function volverACheckpoint(ctx, hito, conProgramas) {
  if (!ctx.checkpointsV2.volver(hito, conProgramas)) return;
  // Los hitos de fábrica (hN) se juegan en su propia sesión: se abren recargando la página.
  if (/^h\d+$/.test(hito)) location.reload();
  else ctx.elegirReto(ctx.batallasV2.batallas.indexOf(hito));
}

// Se añade al diálogo de derrota existente. El último hito y los programas actuales son el valor inicial.
export function ofrecerCheckpoint(ctx) {
  const historial = ctx.checkpointsV2;
  const acciones = ctx.$('banner').querySelector('.acciones');
  const select = document.createElement('select');
  select.setAttribute('aria-label', ctx.ti18n('cv2.checkpoint'));
  for (const cp of historial.lista) {
    const opcion = document.createElement('option');
    opcion.value = cp.hito;
    opcion.textContent = cp.hito.toUpperCase();
    select.append(opcion);
  }
  select.value = historial.ultimo().hito;
  const etiqueta = document.createElement('label'), casilla = document.createElement('input');
  casilla.type = 'checkbox';
  etiqueta.append(casilla, ctx.ti18n('cv2.conProgramas'));
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'btn chico';
  volver.textContent = ctx.ti18n('cv2.checkpoint');
  volver.addEventListener('click', () => volverACheckpoint(ctx, select.value, casilla.checked));
  acciones.append(select, etiqueta, volver);
}
