/* Liberación al retirar una vista; no interviene en el dibujo ni en sus gestos. */
export function liberarEscena(escena, renderer, extras = []) {
  const recursos = new Set(extras);
  escena.traverse(o => {
    if (o.geometry) recursos.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) recursos.add(m);
  });
  for (const recurso of recursos) {
    if (recurso?.isMaterial) for (const valor of Object.values(recurso)) if (valor?.isTexture) recursos.add(valor);
  }
  for (const recurso of recursos) recurso?.dispose?.();
  renderer.dispose();
  escena.clear();
}

export function escucharEn(canvas) {
  const oyentes = [];
  return {
    escuchar(tipo, fn, opciones = undefined) {
      canvas.addEventListener(tipo, fn, opciones);
      oyentes.push(() => canvas.removeEventListener(tipo, fn, opciones));
    },
    destruir() { oyentes.forEach(quitar => quitar()); oyentes.length = 0; },
  };
}
