// Menú de pruebas de Campaign-V2 (index.html?pruebas=1 redirige aquí). Cada inciso: enlace, qué mirar y, si hace falta,
// un programa de ejemplo para pegar en el editor. Los enlaces son relativos: funcionan en local y en raw.githack.
const war = '../Rocket%20Launcher/index.html';
const disparoB1 = `while (true) {
  regularShoot(autoTarget("crawler", "visual"));
  await esperar(0.5);
}`;
const secciones = [
  { titulo: 'Batallas del mapa nuevo', nota: 'Ensayos sueltos: cada Batalla con la UI nueva, la muralla y la torreta esfera.', items: [
    { titulo: 'B1 · Primer blanco', url: 'index.html?ensayo=b1', mirar: ['Seis orugas por un carril: con el programa de ejemplo en LAU-01 no cruza ninguna.', 'Botones 3D / Plano / Batalla arriba.'], ejemplo: disparoB1, para: 'LAU-01' },
    { titulo: 'B2 · Prioridades', url: 'index.html?ensayo=b2', mirar: ['Orugas lentas y después drones a 2,5 m.', 'Ejemplo: primero orugas y, si no hay, drones.'],
      ejemplo: `while (true) {
  const objetivo = autoTarget("crawler", "visual") ?? autoTarget("drone", "visual");
  regularShoot(objetivo);
  await esperar(0.3);
}`, para: 'LAU-01' },
    { titulo: 'B3 · Niebla', url: 'index.html?ensayo=b3', mirar: ['La cámara ve 4,5 casillas y el térmico 7.', 'Prueba autoTarget(tipo, "thermal").'] },
    { titulo: 'B4 · Enjambre', url: 'index.html?ensayo=b4', mirar: ['Dos enjambres de 18 drones: a 1 disparo/s no alcanza.', 'Prueba burstFire(objetivo) y vigila el atasco.'] },
    { titulo: 'B5 · Dos lanzadores', url: 'index.html?ensayo=b5', mirar: ['Un enjambre por el norte y otro por el sur.', 'Cada lanzador con su programa (pestañas LAU-01 y LAU-02).'] },
  ] },
  { titulo: 'Mecánicas nuevas', nota: 'Cada ensayo trae su programa de ejemplo cargado: basta con pulsar Ejecutar.', items: [
    { titulo: 'Salida · vehículo VEH y tirador', url: 'index.html?ensayo=salida', mirar: ['VEH-01 sale por la puerta, llega a su puesto y dispara a los drones.', 'Si el tirador lo destruye, el árbol lo muestra en gris con cuenta atrás y reaparece.'] },
    { titulo: 'Rueda · WHL kamikaze', url: 'index.html?ensayo=rueda', mirar: ['WHL-01 espera en el carril; con una oruga a menos de 2 m llama a detonate().', 'Desaparece, reaparece en casa a los 6 s y su programa vuelve a empezar.', 'La lectura nearest da los metros hasta la oruga más cercana.'],
      ejemplo: `moveTo({x: 224, y: 81.5});
await arrive();
while (nearest === null || nearest > 2) {
  await esperar(0.1);
}
detonate();`, para: 'WHL-01' },
    { titulo: 'Minador · cargas y onDetonation', url: 'index.html?ensayo=minador', mirar: ['MIN-01 siembra cuatro cargas (puntos sobre el carril) y vuelve tras la muralla.', 'Cada carga que estalla escribe «¡Carga! N enemigos» en la consola.', 'charges cuenta las cargas que le quedan.'],
      ejemplo: `onDetonation(carga => log("¡Carga!", carga.enemigos, "enemigos"));
for (const x of [222, 220, 218, 216]) {
  moveTo({x, y: 81.5});
  await arrive();
  drop();
}
moveTo({x: 205.5, y: 81.5});`, para: 'MIN-01' },
  ] },
  { titulo: 'Cámara y móvil', nota: 'Lo de la última entrega: zoom sin tope falso y mando táctil.', items: [
    { titulo: 'Cámara en PC', url: 'index.html?ensayo=b1', mirar: ['La rueda del ratón aleja hasta 1,5 veces el encuadre inicial y acerca hacia el cursor.', 'Sin bordes del mapa al alejarte (se cargan las teselas de alrededor).', 'Rueda pulsada y arrastrar: orbitar · botón derecho y arrastrar: desplazar.'] },
    { titulo: 'Mando táctil en PC', url: 'index.html?ensayo=b1&mando=1', mirar: ['Joystick abajo a la izquierda: desplaza la cámara.', 'Zona «Ratón» a la derecha: mueve el cursor; L selecciona, R da una orden puntual (con el programa en marcha).', 'L mantenido + arrastrar en la zona: recuadro de selección.'] },
    { titulo: 'Mando sin mando', url: 'index.html?ensayo=b1&mando=0', mirar: ['Fuerza el mando oculto incluso en el teléfono (el botón 🕹 lo vuelve a mostrar).'] },
  ] },
  { titulo: 'Campaña y paridad', items: [
    { titulo: 'Campaña desde el principio', url: 'index.html', mirar: ['Empieza en H0 (la fábrica es un marcador provisional) y sigue a B1 al cumplirlo.', 'Para empezar de cero, usa «Borrar el progreso» abajo.'] },
    { titulo: 'Paridad B1–B5', url: 'index.html?modo=paridad&batalla=b1', mirar: ['Cada Batalla con los parámetros exactos de War.', 'Cambia batalla=b2…b5 en la dirección.'] },
  ] },
  { titulo: 'Otros prototipos', items: [
    { titulo: 'War', url: war + '?serie=war', mirar: ['La serie original de los retos de las Batallas.'] },
    { titulo: 'Factory', url: war + '?serie=factory', mirar: ['La serie Factory sobre la base canónica.'] },
    { titulo: 'Campaign (trunk, H0–H5)', url: war + '?serie=campaign', mirar: ['La campaña de fábrica de la que sale el motor compartido.'] },
  ] },
];

const el = (tag, attrs = {}, ...hijos) => {
  const e = Object.assign(document.createElement(tag), attrs);
  e.append(...hijos);
  return e;
};
const raiz = document.getElementById('secciones');
for (const s of secciones) {
  const seccion = el('section', {}, el('h2', { textContent: s.titulo }));
  if (s.nota) seccion.append(el('p', { className: 'nota', textContent: s.nota }));
  for (const it of s.items) {
    const tarjeta = el('article', {},
      el('h3', {}, el('a', { href: it.url, textContent: it.titulo })),
      el('code', { className: 'url', textContent: it.url }),
      el('ul', {}, ...it.mirar.map(m => el('li', { textContent: m }))));
    if (it.ejemplo) {
      const copiar = el('button', { type: 'button', textContent: 'Copiar' });
      copiar.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(it.ejemplo); copiar.textContent = 'Copiado'; }
        catch { copiar.textContent = 'Selecciónalo y copia'; }
        setTimeout(() => { copiar.textContent = 'Copiar'; }, 1500);
      });
      tarjeta.append(el('details', {}, el('summary', { textContent: `Programa de ejemplo para ${it.para}` }),
        el('pre', { textContent: it.ejemplo }), copiar));
    }
    seccion.append(tarjeta);
  }
  raiz.append(seccion);
}

// Borra solo las claves de Campaign-V2 (progreso, programas, guardado en vivo, mando…), no las de las otras series.
document.getElementById('borrar').addEventListener('click', () => {
  if (!confirm('¿Borrar el progreso, los programas y los ajustes de Campaign-V2 en este navegador? No se puede deshacer.')) return;
  const claves = Object.keys(localStorage).filter(k => k.startsWith('campaign-v2'));
  for (const k of claves) localStorage.removeItem(k);
  document.getElementById('estado-borrar').textContent = `Borradas ${claves.length} claves.`;
});
