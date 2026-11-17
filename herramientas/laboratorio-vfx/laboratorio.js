import { es, en } from './textos.js';
import { crearEfectos, crearRecetasWar, recetaWar } from '../../paquetes/vfx/index.js';
import { MISIL } from '../../paquetes/reglas-war/index.js';
import { muestra } from './escenarios.js';
import { crearVisores } from './visores.js';

const idioma = new URLSearchParams(location.search).get('idioma') === 'en' ? en : es;
export const texto = (clave, params = {}) => idioma[clave].replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
/** @returns {any} */
const $ = id => document.getElementById(id);
document.documentElement.lang = idioma === en ? 'en' : 'es';
document.title = texto('titulo');
for (const nodo of document.querySelectorAll('[data-texto]')) nodo.textContent = texto(nodo.getAttribute('data-texto'));
const recetas = crearRecetasWar({ radioDanio: MISIL.radio });
const nombres = Object.keys(recetas), instantes = [.04, .1, .2, .35, .6, 1, 1.4];
const estilos = getComputedStyle(document.documentElement);
const tokens = ['suelo', 'edge', 'grid-2', 'explosion', 'misil', 'enemigo', 'enemigo-frio', 'bad', 'ok', 's-vibra', 'ink', 'bg'];
const colores = Object.fromEntries(tokens.map(t => [t, estilos.getPropertyValue('--' + t).trim()]));
const gestor = crearEfectos({ recetas, recetaDe: recetaWar, dt: .05 });
const select = $('receta'), calidad = $('calidad'), barra = $('tiempo');
for (const nombre of nombres) select.add(new Option(nombre, nombre));
const params = new URLSearchParams(location.search);
if (params.has('captura')) document.body.classList.add('captura');
if (nombres.includes(params.get('receta'))) select.value = params.get('receta');
if (['alto', 'medio', 'bajo', 'no'].includes(params.get('calidad'))) calidad.value = params.get('calidad');
let tv = 0, pausado = false, ultimo = null, visores;
let error = null;
try { visores = crearVisores(globalThis.THREE, $('tres'), $('plano'), colores, texto); }
catch (e) { error = String(e); $('estado').textContent = texto('fallo', { error }); }

function anotar() { gestor.vaciar(); gestor.anotar(muestra(select.value)); }
function calcular(t) {
  const inicio = performance.now();
  const particulas = gestor.particulas(t, { colores, calidad: calidad.value });
  return { particulas, ms: performance.now() - inicio };
}
function dibujar(t) {
  const { particulas, ms } = calcular(t);
  visores?.dibujar(particulas);
  $('contador').textContent = texto('contador', { t: t.toFixed(3), n: particulas.length, ms: ms.toFixed(3) });
  barra.value = String(t);
}
function hoja() {
  if (!visores) return;
  const ctx = $('contactos').getContext('2d');
  ctx.fillStyle = colores.bg; ctx.fillRect(0, 0, 1540, 440);
  ctx.font = '14px sans-serif'; ctx.fillStyle = colores.ink;
  $('titulo-hoja').textContent = texto('tituloHoja', { receta: select.value, calidad: texto(calidad.value), radio: MISIL.radio });
  for (let i = 0; i < instantes.length; i++) {
    const t = instantes[i]; anotar();
    const { particulas } = calcular(t); visores.dibujar(particulas);
    const centro = visores.proyectar(16, 9, 0);
    const plano = visores.centroPlano;
    ctx.drawImage($('tres'), centro.x - 110, centro.y - 110, 220, 180, i * 220, 28, 220, 180);
    // Etiqueta por encima de VFX, igual que las etiquetas HTML del juego.
    ctx.fillStyle = colores.ink; ctx.fillText(`${t.toFixed(2)} s · 3D`, i * 220 + 8, 20);
    ctx.fillText(texto('testigo'), i * 220 + 75, 90);
    ctx.drawImage($('plano'), plano.x - 110, plano.y - 90, 220, 180, i * 220, 250, 220, 180);
    ctx.fillText(texto('muestraPlano', { t: t.toFixed(2), n: particulas.length }), i * 220 + 8, 240);
  }
  anotar(); dibujar(tv);
}
function configurar(nombre = select.value, nivel = calidad.value) {
  if (!nombres.includes(nombre) || !['alto', 'medio', 'bajo', 'no'].includes(nivel)) throw new Error('Receta o calidad desconocida');
  select.value = nombre; calidad.value = nivel; tv = 0; pausado = true; ultimo = null;
  $('pausa').textContent = texto('continuar'); anotar(); hoja(); dibujar(tv);
}
function medir(nombre, nivel) {
  configurar(nombre, nivel);
  let maxParticulas = 0, maxMs = 0, suma = 0, muestras = 0;
  // Calentamiento y barrido de 161 tiempos; cada medición vuelve a anotar para
  // separar el coste del evaluador del coste de reconstruir la muestra.
  for (let i = 0; i < 5; i++) { anotar(); calcular(.1); }
  for (let i = 0; i <= 160; i++) {
    anotar(); const { particulas, ms } = calcular(i / 100);
    maxParticulas = Math.max(maxParticulas, particulas.length);
    maxMs = Math.max(maxMs, ms); suma += ms; muestras++;
  }
  anotar(); dibujar(tv);
  return { maxParticulas, maxMs, mediaMs: suma / muestras, muestras };
}
// API explícita de automatización; no depende de la partida ni de localStorage.
globalThis.laboratorioVfx = { listo: Boolean(visores), error, nombres, instantes,
  configurar, hoja, medir, ir(t) {
    pausado = true; $('pausa').textContent = texto('continuar');
    tv = Math.max(0, Math.min(1.6, t)); anotar(); dibujar(tv);
  } };
select.addEventListener('change', () => configurar());
calidad.addEventListener('change', () => configurar());
barra.addEventListener('input', () => globalThis.laboratorioVfx.ir(Number(barra.value)));
$('pausa').addEventListener('click', () => { pausado = !pausado; $('pausa').textContent = pausado ? texto('continuar') : texto('pausa'); });
$('reproducir').addEventListener('click', () => { tv = 0; anotar(); pausado = false; $('pausa').textContent = texto('pausa'); });
if (visores) {
  configurar(); $('estado').textContent = texto('listo');
  if (!params.has('captura')) { pausado = false; $('pausa').textContent = texto('pausa'); }
  function fotograma(ahora) {
    if (ultimo !== null && !pausado) {
      tv += Math.min(.1, (ahora - ultimo) / 1000) * Number($('velocidad').value);
      if (tv > 1.6) { tv = 0; anotar(); }
    }
    ultimo = ahora; dibujar(tv); requestAnimationFrame(fotograma);
  }
  requestAnimationFrame(fotograma);
}
addEventListener('pagehide', () => visores?.destruir(), { once: true });
