/** Sellos acotados: 16 niveles por canal, generados solo al dibujar.
 * crearLienzo se puede inyectar en Node; el import no requiere DOM.
 * @param {{T?: number, ox?: number, oy?: number,
 * proyectar?: (x: number,y: number,z: number) => {x:number,y:number},
 * crearLienzo?: (lado:number) => any, limiteCache?: number}} opciones */
export function crearDibujanteEfectos({ T = 24, ox = 0, oy = 0, proyectar,
  crearLienzo = lado => { const c = document.createElement('canvas'); c.width = c.height = lado; return c; },
  limiteCache = 256 } = {}) {
  const cache = new Map();
  function sello(p) {
    const canales = p.color.map(c => Math.round(Math.max(0, Math.min(1, c)) * 15) * 17);
    const clave = `${p.forma}/${canales.join(',')}`;
    if (cache.has(clave)) return cache.get(clave);
    const lienzo = crearLienzo(64), ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('No hay contexto 2D para el sello');
    const degradado = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    const rgba = a => `rgba(${canales.join(',')},${a})`;
    const paradas = p.forma === 'disco' ? [[0, 1], [.75, 1], [1, 0]]
      : (p.forma === 'humo' ? [[0, 1], [.5, .42], [1, 0]] : [[0, 1], [.25, .56], [.65, .12], [1, 0]]);
    for (const [pos, alfa] of paradas) degradado.addColorStop(pos, rgba(alfa));
    ctx.fillStyle = degradado; ctx.fillRect(0, 0, 64, 64);
    if (cache.size >= limiteCache) cache.delete(cache.keys().next().value);
    cache.set(clave, lienzo);
    return lienzo;
  }
  return {
    /** La proyección del plano ignora altura por defecto, igual que el juego.
     * @param {CanvasRenderingContext2D | any} ctx2
     * @param {import('../vfx/index.js').Particula[]} particulas */
    dibujar(ctx2, particulas) {
      ctx2.save();
      try {
        const orden = p => p.mezcla === 'suma' ? 2 : (p.forma === 'humo' ? 0 : 1);
        for (const p of [...particulas].sort((a, b) => orden(a) - orden(b))) {
          if (p.alfa <= 0 || p.tam <= 0) continue;
          const punto = proyectar ? proyectar(p.x, p.y, p.z) : { x: ox + p.x * T, y: oy + p.y * T };
          const tam = p.tam * T;
          ctx2.globalCompositeOperation = p.mezcla === 'suma' ? 'lighter' : 'source-over';
          ctx2.globalAlpha = p.alfa;
          ctx2.drawImage(sello(p), punto.x - tam / 2, punto.y - tam / 2, tam, tam);
        }
      } finally { ctx2.restore(); }
    },
    vaciarCache() { cache.clear(); },
    destruir() { cache.clear(); },
  };
}
