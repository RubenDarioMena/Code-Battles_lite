// Traducción entre casillas locales (War, la fábrica de Campaign) y metros del mapa papercraft.
// Solo reglas-campaign-v2 la usa (ticket 09): las vistas reciben metros y las mecánicas no conocen el marco.

/** Pares de campos con coordenadas en las escenas de War y de la fábrica. */
const PARES = [['cx', 'cy'], ['bx', 'by'], ['x', 'y'], ['x0', 'y0'], ['x1', 'y1']];
/** Objetos anidados que también son lugares. */
const LUGARES = ['lugar', 'objetivo'];

function trasladar(dato, dx, dy) {
  if (Array.isArray(dato)) return dato.map(d => trasladar(d, dx, dy));
  if (!dato || typeof dato !== 'object') return dato;
  const copia = { ...dato };
  for (const [kx, ky] of PARES)
    if (Number.isFinite(copia[kx]) && Number.isFinite(copia[ky])) { copia[kx] += dx; copia[ky] += dy; }
  for (const k of LUGARES) if (copia[k] && typeof copia[k] === 'object') copia[k] = trasladar(copia[k], dx, dy);
  return copia;
}

const COLECCIONES = ['lanzadores', 'sensores', 'reparadores', 'maquinas', 'enemigos', 'misiles', 'explosiones',
  'puertas', 'robots', 'tarimas', 'tirador', 'unidades'];

/** Escena en casillas → escena en metros. `marco` acompaña a la escena para encuadrar. */
export function escenaEnMetros(escena, origen, tam = null) {
  const [dx, dy] = origen;
  const e = { ...escena };
  for (const k of COLECCIONES) if (Array.isArray(e[k])) e[k] = trasladar(e[k], dx, dy);
  if (e.deposito) e.deposito = trasladar(e.deposito, dx, dy);
  if (e.maquinas) e.porId = Object.fromEntries(e.maquinas.map(x => [x.id, x]));
  e.marco = { origen: [dx, dy], ...(tam ? { tam: [...tam] } : {}) };
  return e;
}

/** Punto en metros (clic, colocador) → casillas del marco. */
export function puntoEnMarco(punto, origen) {
  return { ...punto, x: punto.x - origen[0], y: punto.y - origen[1] };
}

/** Punto en casillas del marco → metros. */
export function puntoEnMetros(punto, origen) {
  return { ...punto, x: punto.x + origen[0], y: punto.y + origen[1] };
}
