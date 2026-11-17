/** Se serializa con page.evaluate: toda la medida rAF y la inyección viven en página.
 * @param {{segundos: number, escenario: string, vista: string, ritmo?: number}} opciones */
export async function medirPagina({ segundos, escenario, vista, ritmo = 120 }) {
  const B = window.__banco;
  const iniciar = () => {
    const programa = B.RETOS[1].inicial['LAU-01'].join('\n');
    B.elegirReto(0); B.fijarSemilla(7); B.turbo(1);
    B.programas['LAU-01'] = programa; delete B.fuentes['LAU-01'];
    B.abrirPrograma('LAU-01'); B.ejecutar();
  };
  iniciar();
  const selector = /** @type {HTMLElement} */ (document.querySelector(`[data-vista="${vista}"]`));
  selector.click();
  if (selector.getAttribute('aria-pressed') !== 'true') throw Error(`La vista ${vista} no está disponible (WebGL)`);
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c3d'));
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  const gpu = gl ? { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
    rendererReal: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    vendorReal: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null } : null;
  const entorno = { gpu, ventana: { ancho: innerWidth, alto: innerHeight }, devicePixelRatio,
    campo: document.getElementById('campo').getBoundingClientRect().toJSON(),
    canvas: { ancho: canvas.width, alto: canvas.height }, reducido: matchMedia('(prefers-reduced-motion: reduce)').matches };
  const intervalos = [], muestras = [];
  let inicio = performance.now(), ultimo = inicio, medicion = null;
  let vivasMax = 0, cuota = 0, secuencia = 0, inyectados = 0, reinicios = 0, pasosMax = 0;
  let ultimoLatido = inicio, animacion, esperaMs = 0;
  B.medirEfectos(m => {
    if (medicion === null) return;
    if (m.vista !== vista) throw Error(`Se dibuja ${m.vista}, se pidió ${vista}`);
    muestras.push({ particulasMs: m.particulasMs, dibujarMs: m.dibujarMs });
    vivasMax = Math.max(vivasMax, m.vivas);
  });
  try {
    return await new Promise((resolve, reject) => {
      // También termina con un error legible si rAF deja de llegar en una ventana oculta.
      const vigia = setInterval(() => {
        if (performance.now() - ultimoLatido > 10000) {
          clearInterval(vigia); cancelAnimationFrame(animacion); reject(Error('Sin requestAnimationFrame durante 10 s'));
        }
      }, 1000);
      function fotograma(ahora) {
        try {
          ultimoLatido = ahora;
          const delta = ahora - ultimo;
          if (medicion !== null) intervalos.push(delta);
          ultimo = ahora;
          pasosMax = Math.max(pasosMax, B.partida.pasoActual);
          // Para ventanas largas se repite el mismo reto/semilla/programa, y se declara.
          if (B.fin) { iniciar(); reinicios++; }
          if (escenario === 'saturacion') {
            // 120 tríos/s real: 360 sucesos/s, mismo caudal en TODOS los niveles.
            // El derribo desconocido se resuelve por la explosión posterior de ese paso/lanzador.
            cuota += delta * ritmo / 1000;
            const lista = [], paso = Math.round(B.mundo.t / .05);
            while (cuota >= 1) {
              cuota--;
              const i = secuencia++, x = 5 + (i % 24), y = 2 + ((i * 7) % 14);
              lista.push({ paso, tipo: 'disparo', unidad: 'LAU-01', datos: { x, y } },
                { paso, tipo: 'derribo', unidad: `carga-${i}`, datos: { tipo: 'drone', por: 'LAU-01' } },
                { paso, tipo: 'explosion', unidad: 'LAU-01', datos: { x, y, z: 1, golpe: 1, misil: i + 1 } });
            }
            inyectados += lista.length;
            B.sucesosVistas(lista);
          }
          // Dos segundos de calentamiento independientes de la ventana de medida. En la partida real,
          // además, la ventana empieza con la primera explosión (en el reto 1 llega hacia los 17 s).
          const combate = escenario !== 'real' || B.mundo.explosiones.length > 0;
          if (medicion === null && ahora - inicio >= 2000 && combate) {
            medicion = ahora; esperaMs = ahora - inicio; inyectados = 0; reinicios = 0;
          }
          if (medicion !== null && ahora - medicion >= segundos * 1000) {
            clearInterval(vigia);
            resolve({ intervalos, muestras, vivasMax, inyectados, reinicios, pasosMax,
              duracionMs: ahora - medicion, esperaMs, ritmo, entorno, simulacionT: B.mundo.t, fin: B.fin });
          } else animacion = requestAnimationFrame(fotograma);
        } catch (error) { clearInterval(vigia); reject(error); }
      }
      animacion = requestAnimationFrame(fotograma);
    });
  } finally { cancelAnimationFrame(animacion); B.medirEfectos(null); }
}
