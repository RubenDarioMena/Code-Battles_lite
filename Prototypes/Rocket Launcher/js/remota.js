// Telemetría remota mínima (prueba con compañeros): entradas, retos abiertos e intentos con su código.
// Solo envía desde el sitio publicado; en local, githack o con el ajuste desactivado no sale nada.
// Identificador anónimo por navegador; `?quien=Nombre` en el enlace lo etiqueta (se recuerda).
(() => {
  "use strict";
  const DESTINO = "/api/t";
  const CLAVE = "cmg-banco03:remota";
  const MAX_CODIGO = 12000;
  const leer = (k, d) => { try { const v = localStorage.getItem(`${CLAVE}:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(`${CLAVE}:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const al = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""));

  const host = location.hostname;
  const local = location.protocol === "file:" || !host || host === "localhost" || /^127\.|^192\.168\.|^10\.|^\[?::1\]?$/.test(host) || /githack|github/.test(host);
  const url = new URLSearchParams(location.search);
  if (url.get("telemetria") === "0") escribir("activa", false);
  if (url.get("telemetria") === "1") escribir("activa", true);
  const quien = (url.get("quien") || "").trim().slice(0, 40);
  if (quien) escribir("quien", quien);

  let id = leer("id", null);
  if (!id) { id = al(); escribir("id", id); }
  const sesion = al();
  const activa = () => leer("activa", true) !== false && (!local || url.get("telemetria") === "1");

  function enviar(tipo, datos) {
    if (!activa()) return;
    const cuerpo = JSON.stringify({ tipo, id, sesion, quien: leer("quien", null), cuando: new Date().toISOString(), ...datos });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(DESTINO, new Blob([cuerpo], { type: "text/plain" }))) return;
    } catch { /* cae a fetch */ }
    try { fetch(DESTINO, { method: "POST", body: cuerpo, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {}); } catch { /* sin red */ }
  }

  const recorte = (c) => Object.fromEntries(Object.entries(c || {}).map(([k, v]) => [k, String(v).slice(0, MAX_CODIGO)]));

  window.addEventListener("cmg:intento", (ev) => {
    const t = ev.detail || {};
    enviar("intento", {
      reto: t.reto, titulo: t.titulo, intento: t.intento, resultado: t.resultado, motivo: t.motivo ?? null,
      mensaje: t.mensaje ? String(t.mensaje).slice(0, 300) : null, linea: t.linea ?? null, programa: t.programa ?? null,
      tiempoJuego: t.tiempoJuego ?? null, brechas: t.brechas ?? null, derribos: t.derribos ?? null, enemigos: t.enemigos ?? null,
      lineas: t.lineas ?? null, codigos: recorte(t.codigos),
    });
  });
  window.addEventListener("cmg:reto", (ev) => enviar("reto", { reto: ev.detail?.reto, titulo: ev.detail?.titulo }));

  const reto = (() => { try { return (JSON.parse(localStorage.getItem("cmg-banco03:reto")) | 0) + 1; } catch { return null; } })();
  enviar("entrada", {
    reto, pantalla: `${innerWidth}x${innerHeight}`, tactil: matchMedia("(pointer: coarse)").matches,
    idioma: navigator.language || null, desde: document.referrer ? new URL(document.referrer).hostname : null,
  });

  // Ajuste visible para quien prefiera no enviar nada.
  const caja = document.getElementById("ajustes-telemetria");
  if (caja) {
    caja.checked = leer("activa", true) !== false;
    caja.addEventListener("change", () => escribir("activa", caja.checked));
  }
  window.cmgRemota = { enviar, get activa() { return activa(); }, id };
})();
