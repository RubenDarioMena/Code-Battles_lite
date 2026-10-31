// Telemetría mínima de la prueba con compañeros (Netlify Functions + Netlify Blobs).
// POST /api/t            ← el juego envía un evento (entrada, reto, intento).
// GET  /api/t?clave=…    → eventos guardados; &desde=AAAA-MM-DD, &formato=csv o &resumen=1.
// La clave de lectura es la variable de entorno TELEMETRIA_CLAVE (sin ella, la lectura queda cerrada).
import { getStore } from "@netlify/blobs";

const TIPOS = new Set(["entrada", "reto", "intento"]);
const MAX_CUERPO = 64 * 1024;
const json = (d, s = 200) => new Response(JSON.stringify(d, null, 2), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function recibir(req, store, geo) {
  const txt = await req.text();
  if (txt.length > MAX_CUERPO) return new Response("demasiado grande", { status: 413 });
  let ev;
  try { ev = JSON.parse(txt); } catch { return new Response("json inválido", { status: 400 }); }
  if (!ev || !TIPOS.has(ev.tipo) || typeof ev.id !== "string" || ev.id.length > 64) return new Response("evento inválido", { status: 400 });
  const ahora = new Date();
  ev.recibido = ahora.toISOString();
  if (geo?.country?.code) ev.pais = geo.country.code;
  const clave = `${ev.recibido.slice(0, 10)}/${ev.recibido}-${crypto.randomUUID().slice(0, 8)}`;
  await store.setJSON(clave, ev);
  return new Response(null, { status: 204 });
}

export async function consultar(url, store, claveBuena) {
  if (!claveBuena || url.searchParams.get("clave") !== claveBuena) return new Response("no autorizado", { status: 401 });
  const desde = url.searchParams.get("desde") || "";
  const { blobs } = await store.list();
  const claves = blobs.map(b => b.key).filter(k => k >= desde).sort();
  const eventos = (await Promise.all(claves.map(k => store.get(k, { type: "json" })))).filter(Boolean);
  if (url.searchParams.get("resumen")) return json(resumir(eventos));
  if (url.searchParams.get("formato") === "csv") return csv(eventos);
  return json(eventos);
}

export function resumir(eventos) {
  const gente = {};
  for (const e of eventos) {
    const p = gente[e.id] ??= { quien: null, entradas: 0, primera: e.recibido, ultima: e.recibido, retosAbiertos: [], retos: {} };
    if (e.quien) p.quien = e.quien;
    p.ultima = e.recibido;
    if (e.tipo === "entrada") p.entradas++;
    if (e.tipo === "reto" && !p.retosAbiertos.includes(e.reto)) p.retosAbiertos.push(e.reto);
    if (e.tipo === "intento") {
      const r = p.retos[e.reto] ??= { titulo: e.titulo, intentos: 0, victorias: 0, fallos: 0, errores: 0, ultimoResultado: null };
      r.intentos++;
      if (e.resultado === "victoria") r.victorias++;
      else if (e.resultado === "fallo") r.fallos++;
      else r.errores++;
      r.ultimoResultado = e.resultado;
    }
  }
  return { eventos: eventos.length, personas: Object.keys(gente).length, gente };
}

function csv(eventos) {
  const cols = ["recibido", "tipo", "id", "quien", "sesion", "pais", "reto", "titulo", "intento", "resultado", "motivo", "mensaje", "linea", "programa", "tiempoJuego", "brechas", "derribos", "enemigos", "lineas", "pantalla", "tactil", "codigos"];
  const celda = (v) => { if (v == null) return ""; const s = typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const filas = [cols.join(","), ...eventos.map(e => cols.map(c => celda(e[c])).join(","))];
  return new Response("﻿" + filas.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=telemetria.csv", "Cache-Control": "no-store" } });
}

export default async (req, context) => {
  const store = getStore("telemetria");
  if (req.method === "POST") return recibir(req, store, context?.geo);
  if (req.method === "GET") return consultar(new URL(req.url), store, process.env.TELEMETRIA_CLAVE);
  return new Response("método no permitido", { status: 405 });
};

export const config = { path: "/api/t" };
