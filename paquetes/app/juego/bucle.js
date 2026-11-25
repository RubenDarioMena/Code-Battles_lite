/** instalarBucleJuego: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarBucleJuego(ctx) {
  // ---------- Bucle de juego ----------
  let ultimo = performance.now(), ultVivos = 0;
  function bucle(now) {
    const transcurrido = (now - ultimo) / 1000;
    const real = Math.min(0.25, transcurrido);
    ultimo = now;
    const sinAcumular = ctx.__banco?.alFotograma ? !!ctx.ejec && !ctx.pausa && ctx.algunoCorre() : false;
    ctx.invalidarEscena();
    if (ctx.ES_CAMPAIGN) ctx.cicloCampaign(now);
    if (ctx.ejec && !ctx.pausa) { if (!ctx.algunoCorre()) ctx.acum += real * ctx.velocidad * ctx.turbo; ctx.avanzar(); }
    else if (!ctx.ejec) ctx.acum = 0;
    const off = ctx.ejec && !ctx.pausa && !ctx.algunoCorre() ? Math.min(ctx.acum, ctx.DT) : 0;
    ctx.vistaActual().dibujar(null, ctx.escenaActual, off / ctx.DT, now);
    ctx.colocador?.pintar();
    ctx.moverFabrica?.pintar();
    ctx.pintarCapa(off, now);
    ctx.caducarAvisos(now);
    ctx.pintarHud();
    if (now - ultVivos > 200) { ultVivos = now; ctx.actualizarVivos(); }
    if (ctx.marcasSucias) ctx.pintarMarcasYa();
    if (ctx.eventosSucios) ctx.pintarEventosYa();
    ctx.editorPrograma.iniciarVistas();
    ctx.__banco?.alFotograma?.({ ahora: now, transcurrido, real, sinAcumular });
  requestAnimationFrame(bucle);
  }

  return {
    bucle
  };
}
