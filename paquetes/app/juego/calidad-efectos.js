// Preferencia independiente: no forma parte de partidas ni programas guardados.
export const CLAVE_EFECTOS = 'cmg-juego-efectos';
const valores = ['auto', 'alto', 'medio', 'bajo', 'no'];
export const normalizarEfectos = valor => valores.includes(valor) ? valor : 'auto';

/** Resolución pura; una URL inválida no sustituye una preferencia válida. */
export function resolverEfectos(url, guardado, reducido = false) {
  const elegido = valores.includes(url) ? url : normalizarEfectos(guardado);
  return { calidad: elegido === 'auto' ? (reducido ? 'bajo' : 'alto') : elegido,
    sinDestellos: reducido };
}

/** @param {{almacen?: {leer(clave: string): string | null}, search?: string, media?: any}} opciones */
export function crearCalidadEfectos({ almacen, search = '', media }) {
  let preferencia = 'auto', reducido = !!media?.matches;
  try { preferencia = normalizarEfectos(JSON.parse(almacen?.leer(CLAVE_EFECTOS) ?? 'null')); } catch { /* auto */ }
  const url = new URLSearchParams(search).get('vfx');
  const cambiarMovimiento = e => { reducido = !!e.matches; };
  media?.addEventListener('change', cambiarMovimiento);
  return {
    get preferencia() { return preferencia; },
    cambiar(valor) { preferencia = normalizarEfectos(valor); },
    leer: () => resolverEfectos(url, preferencia, reducido),
    destruir() { media?.removeEventListener('change', cambiarMovimiento); },
  };
}
