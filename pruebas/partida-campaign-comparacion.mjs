/** Orden canónico de eventos simultáneos ENTRE unidades; conserva el FIFO de
 * cada unidad, todas las marcas t y todos los campos. No reordena bloques de t.
 * El navegador recibe mensajes de Workers independientes por orden de llegada;
 * ese intercalado no es parte de la simulación de paso fijo.
 * @param {any} resultado */
export function compararResultadoCampaign(resultado) {
  const eventos = [];
  for (let i = 0; i < resultado.eventos.length;) {
    let fin = i + 1;
    while (fin < resultado.eventos.length && resultado.eventos[fin].t === resultado.eventos[i].t) fin++;
    eventos.push(...resultado.eventos.slice(i, fin).sort((a, b) =>
      a.maquina < b.maquina ? -1 : a.maquina > b.maquina ? 1 : 0));
    i = fin;
  }
  return { ...resultado, eventos };
}

/** Aplica solo la excepción de intercalado a resultado y tramos para comparar.
 * Los resultados originales del anfitrión y del navegador no se modifican.
 * @param {any} partida */
export function compararCampaign(partida) {
  return { ...partida, resultado: compararResultadoCampaign(partida.resultado),
    tramos: partida.tramos.map(t => ({ ...t, resultado: compararResultadoCampaign(t.resultado) })) };
}
