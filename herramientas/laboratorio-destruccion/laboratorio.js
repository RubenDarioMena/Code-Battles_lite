import { escenario, demos, vientoDemo } from './escenas.js';
import { apuntar } from './punteria.js';
import { crearVista } from './vista.js';
import { es, en } from './textos.js';
export function iniciarLaboratorio(THREE) {
  const params = new URLSearchParams(location.search), tr = params.get('idioma') === 'en' ? en : es;
  /** @returns {any} */
  const $ = id => document.getElementById(id);
  document.documentElement.lang = tr === es ? 'es' : 'en'; document.title = tr.titulo + ' · Code Battle Lite';
  for (const el of document.querySelectorAll('[data-i]')) el.textContent = tr[el.getAttribute('data-i')];
  $('escena').setAttribute('aria-label', tr.escena); $('ritmo').setAttribute('aria-label', tr.velocidad);
  function opciones(id, claves) { for (const k of claves) $(id).add(new Option(tr[k], k)); }
  opciones('demo', ['libre', ...demos]); opciones('arma', ['cinetico', 'explosivo', 'laser', 'acido', 'granada', 'chorro', 'chorro-caotico']);
  opciones('salida', ['hundiendose', 'desvaneciendose']);
  $('demo').value = demos.includes(params.get('demo')) ? params.get('demo') : 'libre';
  const canvas = $('escena');
  let vista;
  try { vista = crearVista(THREE, canvas); } catch (error) { $('mensaje').textContent = String(error); throw error; }
  let sesion, pausa = false, ultimo = 0, acumulado = 0, msRayo = 0, msPaso = 0, tablaHecha = false;
  let indiceEvento = 0;
  function actualizarViento() {
    $('controlViento').hidden = $('arma').value !== 'chorro-caotico';
    $('valorViento').textContent = $('viento').value + ' m/s';
  }
  $('viento').value = String(vientoDemo);
  $('arma').onchange = actualizarViento; $('viento').oninput = actualizarViento;
  function fila(contenedor, valores) {
    const fila = contenedor.insertRow();
    for (const v of valores) fila.insertCell().textContent = v;
  }
  const cantidades = ms => ms.map(m => m.material + ' ' + m.cantidad.toFixed(2)).join(' · ');
  function tabla() {
    const b = sesion.mundo.botin(), panel = $('botin');
    const cuerpo = panel.querySelector('tbody'), pie = panel.querySelector('tfoot');
    cuerpo.replaceChildren(); pie.replaceChildren();
    const armas = new Map(sesion.mundo.estado().robots.map((r, i) => [r.id, ['cinetico', 'laser', 'acido'][i]]));
    const nombre = id => $('demo').value === 'comparar' ? id + ' (' + tr[armas.get(id)] + ')' : id;
    for (const r of b.restos) fila(cuerpo, [nombre(r.robot) + ' / ' + r.pieza + (r.fragmento ? ' #' + r.fragmento : ''),
    r.etiqueta, r.estado, cantidades(r.materiales), r.funcion ?? '—']);
    if (!b.restos.length) fila(cuerpo, [tr.libres]);
    const valores = obj => Object.entries(obj).map(([material, cantidad]) => ({ material, cantidad }));
    const modulos = obj => Object.entries(obj).map(([k, n]) => k + ' × ' + n).join(' · ') || '—';
    if ($('demo').value === 'comparar') for (const robot of armas.keys()) {
      const suma = new Map(), funciones = new Map();
      for (const r of b.restos.filter(r => r.robot === robot)) {
        for (const m of r.materiales) suma.set(m.material, (suma.get(m.material) ?? 0) + m.cantidad);
        if (r.funcion) funciones.set(r.funcion, (funciones.get(r.funcion) ?? 0) + 1);
      }
      fila(pie, [tr[armas.get(robot)], '', '', cantidades(valores(Object.fromEntries(suma))), modulos(Object.fromEntries(funciones))]);
    }
    fila(pie, [tr.total, '', '', cantidades(valores(b.total.materiales)), modulos(b.total.funciones)]);
    panel.hidden = false; tablaHecha = true;
  }
  function medirRayo(orden) {
    const t = performance.now(); sesion.mundo.raycast(orden); msRayo = performance.now() - t;
  }
  function avanzar() {
    const t = performance.now();
    sesion.avanzar((orden, informe) => vista.trazo(orden, informe, sesion.paso() / 60), medirRayo);
    msPaso = performance.now() - t;
  }
  function dibujar() {
    const e = sesion.mundo.estado();
    const eventos = sesion.mundo.sucesos(indiceEvento);
    indiceEvento += eventos.length;
    vista.dibujar(e, eventos);
    $('reloj').textContent = (e.terminada ? tr.normal : tr.batalla) + ' · ' + e.tiempo.toFixed(2) + ' s';
    $('coste').textContent = 'Raycast ' + msRayo.toFixed(3) + ' ms · ' + tr.paso + ' ' + msPaso.toFixed(3) + ' ms';
    const cuentas = new Map();
    for (const p of e.piezas) if (!['vuelo', 'en-pie'].includes(p.salida)) cuentas.set(p.salida, (cuentas.get(p.salida) ?? 0) + 1);
    $('restos').textContent = tr.restos + ' · ' + (Array.from(cuentas, ([s, n]) => s + ' ' + n).join(' / ') || '0');
    $('celdas').textContent = tr.celdas + ' · ' + e.piezas.map(p => p.robot + ' ' + p.id + (p.fragmento ? ' #' + p.fragmento : '') + ' ' + p.celdas + '/' + p.celdasIniciales
      + (p.puente ? ' (' + tr.seccion + ' ' + p.puente.seccion + ', ' + tr.razon + ' ' + p.puente.razon.toFixed(2)
        + ', ' + (p.puente.angulo * 180 / Math.PI).toFixed(1) + '°)' : '')).join(' · ');
    $('fin').disabled = $('pausa').disabled = e.terminada;
    $('pausa').textContent = pausa ? tr.seguir : tr.pausa;
    if (e.terminada) { pausa = true; if (!tablaHecha) tabla(); }
  }
  function reiniciar(captura = false) {
    const demo = $('demo').value;
    indiceEvento = 0; sesion = escenario(demo, () => Number($('viento').value)); vista.limpiar(); vista.encuadrar(demo);
    sesion.mundo.desaparicion($('salida').value);
    $('botin').hidden = true; tablaHecha = false; pausa = false; acumulado = 0; ultimo = 0; msPaso = msRayo = 0; $('mensaje').textContent = '';
    $('arma').value = ['acido', 'puente', 'tanque'].includes(demo) ? 'acido' : ['laser', 'corte'].includes(demo) ? 'laser' : 'cinetico';
    if (['granada', 'chorro', 'chorro-caotico'].includes(demo)) $('arma').value = demo;
    actualizarViento();
    if (captura && (params.has('t') || params.has('fin'))) {
      const t = Number(params.get('t'));
      const limite = params.has('fin') ? Math.max(sesion.finSecuencia, Math.floor(t * 60) || 0) : Math.floor(t * 60);
      if (Number.isFinite(limite)) for (let i = 0; i < limite; i++)avanzar();
      if (params.has('fin')) sesion.mundo.terminarBatalla();
      pausa = true;
    }
    dibujar();
  }
  $('demo').onchange = () => reiniciar(); $('reiniciar').onclick = () => reiniciar();
  $('fin').onclick = () => { sesion.mundo.terminarBatalla(); dibujar(); };
  $('pausa').onclick = () => { pausa = !pausa; acumulado = 0; dibujar(); };
  $('potencia').oninput = () => $('valor').textContent = $('potencia').value + '×';
  $('salida').onchange = () => { if (!tablaHecha) sesion.mundo.desaparicion($('salida').value); dibujar(); };
  let gesto = null;
  canvas.onpointerdown = e => { gesto = { x: e.clientX, y: e.clientY, dist: 0 }; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = e => {
    if (!gesto) return;
    const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
    gesto.x = e.clientX; gesto.y = e.clientY; gesto.dist += Math.hypot(dx, dy);
    if (gesto.dist > 4) { vista.girar(dx, dy); dibujar(); }
  };
  canvas.onpointerup = e => {
    if (gesto && gesto.dist <= 4 && !tablaHecha) {
      // El clic solo elige el punto. El disparo sale de un emisor a 6 m, a 1 m de altura, girado 35° respecto
      // a la cámara, para que el haz cruce la imagen en lugar de nacer en el ojo.
      const mira = vista.rayo(e.clientX, e.clientY), arma = $('arma').value;
      const balistica = ['granada', 'chorro', 'chorro-caotico'].includes(arma);
      let blanco = sesion.mundo.raycast(mira);
      if (balistica && mira.direccion[2] < 0) {
        const t = -mira.origen[2] / mira.direccion[2];
        if (t >= 0 && (!blanco || t < blanco.distancia)) blanco = { pos: mira.origen.map((v, i) => v + t * mira.direccion[i]) };
      }
      if (!blanco) { $('mensaje').textContent = tr.fallo; gesto = null; return; }
      const hacia = [mira.origen[0] - blanco.pos[0], mira.origen[1] - blanco.pos[1]], largo = Math.hypot(...hacia) || 1;
      const giro = .61, [c, s] = [Math.cos(giro), Math.sin(giro)];
      const lado = [(hacia[0] * c - hacia[1] * s) / largo, (hacia[0] * s + hacia[1] * c) / largo];
      const origen = [blanco.pos[0] + lado[0] * 6, blanco.pos[1] + lado[1] * 6, 1];
      const direccion = blanco.pos.map((v, i) => v - origen[i]);
      const potencia = Number($('potencia').value);
      const orden = balistica ? apuntar(arma, origen, blanco.pos, potencia, arma === 'chorro-caotico' ? Number($('viento').value) : 0)
        : { origen, direccion, arma, potencia };
      medirRayo(orden);
      const informe = sesion.mundo.disparar(orden);
      vista.trazo(orden, informe, sesion.paso() / 60);
      $('mensaje').textContent = informe.impacto ? informe.impacto.robot + ' / ' + informe.impacto.pieza : balistica ? tr[arma] : tr.fallo;
      dibujar();
    }
    gesto = null;
  };
  canvas.onpointercancel = () => { gesto = null; };
  canvas.onwheel = e => { e.preventDefault(); vista.zoom(e.deltaY); dibujar(); };
  window.addEventListener('resize', dibujar);
  function cuadro(ahora) {
    if (!pausa && ultimo) {
      acumulado += Math.min(.2, (ahora - ultimo) / 1000) * ($('ritmo').selectedIndex ? .25 : 1);
      if (acumulado >= 1 / 60) { while (acumulado >= 1 / 60) { avanzar(); acumulado -= 1 / 60; } dibujar(); }
    }
    ultimo = ahora; requestAnimationFrame(cuadro);
  }
  reiniciar(true); requestAnimationFrame(cuadro);
}
