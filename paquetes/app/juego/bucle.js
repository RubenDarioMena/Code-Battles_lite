/** instalarBucleJuego: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarBucleJuego(ctx) {
  // ---------- Bucle de juego ----------
  let ultimo = performance.now(), ultVivos = 0;
  function bucle(now) {
    const real = Math.min(0.25, (now - ultimo) / 1000);
    ultimo = now;
    ctx.invalidarEscena();
    if (ctx.ES_CAMPAIGN) ctx.cicloCampaign(now);
    if (ctx.ejec && !ctx.pausa) { if (!ctx.algunoCorre()) ctx.acum += real * ctx.velocidad * ctx.turbo; ctx.avanzar(); }
    else if (!ctx.ejec) ctx.acum = 0;
    const off = ctx.ejec && !ctx.pausa && !ctx.algunoCorre() ? Math.min(ctx.acum, ctx.DT) : 0;
    ctx.vistaActual().dibujar(null, ctx.estadoVista.escena, off / ctx.DT, now);
    ctx.pintarCapa(off, now);
    ctx.caducarAvisos(now);
    ctx.pintarHud();
    if (now - ultVivos > 200) { ultVivos = now; ctx.actualizarVivos(); }
    if (ctx.marcasSucias) ctx.pintarMarcasYa();
    if (ctx.eventosSucios) ctx.pintarEventosYa();
    ctx.editorPrograma.iniciarVistas();
  requestAnimationFrame(bucle);
  }

  return {
    bucle
  };
}
