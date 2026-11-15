/** Primera diferencia estructural, sin serializar objetos completos.
 * @param {any} juego @param {any} sinPantalla @param {string} [ruta]
 * @returns {{ruta: string, juego: any, sinPantalla: any}|null} */
export function primeraDiferencia(juego, sinPantalla, ruta = '') {
  if (juego === sinPantalla) return null;
  const diferencia = () => ({ ruta, juego, sinPantalla });
  if (juego === null || sinPantalla === null || typeof juego !== 'object' || typeof sinPantalla !== 'object')
    return diferencia();
  if (Array.isArray(juego) !== Array.isArray(sinPantalla)) return diferencia();
  if (Array.isArray(juego)) {
    for (let i = 0; i < Math.min(juego.length, sinPantalla.length); i++) {
      const d = primeraDiferencia(juego[i], sinPantalla[i], `${ruta}[${i}]`);
      if (d) return d;
    }
    return juego.length === sinPantalla.length ? null
      : { ruta: `${ruta}.length`, juego: juego.length, sinPantalla: sinPantalla.length };
  }
  for (const clave of [...new Set([...Object.keys(juego), ...Object.keys(sinPantalla)])].sort()) {
    const campo = ruta ? `${ruta}.${clave}` : clave;
    if (!Object.hasOwn(juego, clave) || !Object.hasOwn(sinPantalla, clave))
      return { ruta: campo, juego: Object.hasOwn(juego, clave) ? juego[clave] : '<ausente>',
        sinPantalla: Object.hasOwn(sinPantalla, clave) ? sinPantalla[clave] : '<ausente>' };
    const d = primeraDiferencia(juego[clave], sinPantalla[clave], campo);
    if (d) return d;
  }
  return null;
}

const recortar = (texto, max) => texto.length <= max ? texto : texto.slice(0, max - 1) + '…';
const corto = valor => {
  // Resume contenedores; nunca vuelca los eventos, programas o instantáneas enteros.
  if (Array.isArray(valor)) return `[array: ${valor.length}]`;
  if (valor && typeof valor === 'object') return `{${Object.keys(valor).slice(0, 4).join(', ')}…}`;
  return recortar(JSON.stringify(valor) ?? 'undefined', 85);
};

/** Diagnóstico compartido: primera diferencia del resultado y de cada tramo.
 * Devuelve hasta 19 líneas de 300 caracteres: la línea resumen del caso es la 20.ª.
 * @param {{juego: any, sinPantalla: any, errores?: string[], primerPasoDistinto?: number|null,
 * registroJuego?: string, registroSinPantalla?: string}} datos */
export function diagnosticoPartida({ juego, sinPantalla, errores = [], primerPasoDistinto = null,
  registroJuego, registroSinPantalla }) {
  const diferencias = [];
  const agregar = (a, b, ruta) => { const d = primeraDiferencia(a, b, ruta); if (d) diferencias.push(d); };
  agregar(juego.hash, sinPantalla.hash, 'hash');
  agregar(juego.pasos, sinPantalla.metricas?.pasos ?? sinPantalla.pasos, 'pasos');
  diferencias.push({ ruta: 'primerPasoDistinto', juego: primerPasoDistinto, sinPantalla: primerPasoDistinto });
  if (primerPasoDistinto !== null) agregar(registroJuego, registroSinPantalla, `registros[${primerPasoDistinto}]`);
  agregar(juego.resultado, sinPantalla.resultado, 'resultado');
  const a = juego.tramos ?? [], b = sinPantalla.tramos ?? [];
  agregar(a.length, b.length, 'tramos.length');
  for (let i = 0; i < Math.min(a.length, b.length); i++) agregar(a[i], b[i], `tramos[${i}]`);
  // Conserva errores de página incluso cuando hay demasiados tramos distintos.
  const lineas = diferencias.slice(0, Math.max(1, 18 - Math.min(errores.length, 8))).map(d =>
    recortar(`${recortar(d.ruta, 90)} · juego=${corto(d.juego)} · sin pantalla=${corto(d.sinPantalla)}`, 300));
  for (const [i, error] of errores.entries()) {
    if (lineas.length >= 18) break;
    lineas.push(`errores[${i}] · juego=${recortar(JSON.stringify(String(error).slice(0, 300)), 240)} · sin pantalla=[]`);
  }
  const omitidas = diferencias.length + errores.length - lineas.length;
  if (omitidas > 0) lineas.push(`diagnostico.omitidas · juego=${omitidas} · sin pantalla=0`);
  return lineas;
}
