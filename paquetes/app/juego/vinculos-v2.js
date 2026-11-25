// P2 conserva una fuente ejecutable por unidad. El grupo indica qué copias editar juntas.
export function crearVinculos(ctx) {
  let grupos = {};
  const grupo = id => grupos[id] ?? id;
  const miembros = id => Object.keys(ctx.programas).filter(u => grupo(u) === grupo(id));
  function copiar(origen, destino) {
    ctx.programas[destino] = ctx.programas[origen];
    if (ctx.fuentes[origen]) ctx.fuentes[destino] = { ...ctx.fuentes[origen] };
    else delete ctx.fuentes[destino];
  }
  function unir(ids, primero = ids[0]) {
    if (ids.length < 2) return;
    const todos = new Set(ids.flatMap(miembros));
    for (const id of todos) {
      grupos[id] = primero;
      if (id !== primero) copiar(primero, id);
    }
  }
  function preparar(ids) {
    if (ids.length < 2 || ids.every(id => grupo(id) === grupo(ids[0]))) return;
    // Las plantillas de lección incluyen el ID en un comentario. Los documentos del
    // jugador que ya difieren conservan el flujo mixto Add/Replace de trunk.
    const inicial = id => ctx.lenguajeDe(id) === 'js' && ctx.textoDe(id) === ctx.textoInicial(ctx.def, id);
    const propios = ids.filter(id => !inicial(id));
    const primero = propios[0] ?? ids[0];
    if (propios.some(id => ctx.lenguajeDe(id) !== ctx.lenguajeDe(primero) || ctx.textoDe(id) !== ctx.textoDe(primero))) return;
    unir(ids, primero);
    ctx.guardarProgramas();
  }
  function desvincular(id) {
    const otros = miembros(id).filter(u => u !== id);
    delete grupos[id];
    for (const u of otros) {
      if (otros.length === 1) delete grupos[u];
      else grupos[u] = otros[0];
    }
    ctx.seleccionar(id);
    ctx.guardarProgramas();
  }
  function sincronizar(ids) {
    for (const id of ids) for (const u of miembros(id)) if (id !== u) copiar(id, u);
  }
  return { preparar, unir, miembros, desvincular, sincronizar, get datos() { return { ...grupos }; },
    cargar(datos) { grupos = { ...datos }; } };
}
