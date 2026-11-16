/** instalarAyuda: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarAyuda(ctx) {
  // ---------- Órdenes (ayuda) ----------
  function pintarAyuda() {
    if (ctx.ES_CAMPAIGN) { ctx.$("v-ayuda").innerHTML = ctx.uiC.ayuda(); return; }
    if (ctx.ES_FACTORY) {
      ctx.$("v-ayuda").innerHTML = ctx.htmlInterfaz(`<h3>Robot de carga</h3><p><code>await pickUp(lugar, material)</code> lleva a R1 hasta una bodega y carga una pieza. <code>await deliver(lugar)</code> la lleva al destino. <code>await wait(segundos)</code> deja pasar tiempo mientras las máquinas trabajan.</p><p><code>count(lugar, material)</code> consulta las existencias sin avanzar el reloj.</p><p>Se gana al cumplir las metas, aunque el programa siga en un bucle. Usa await en los encargos: el robot tarda en viajar y operar; durante esa espera las máquinas siguen trabajando. Las lecturas no avanzan el reloj: 0 significa edificio vacío y null, edificio inexistente. Una entrega llena devuelve «lleno» y conserva la carga. Los nombres españoles y yo. siguen aceptados.</p>`);
      return;
    }
    const f = (firma, texto, cls = "") => `<div class="firma ${cls}"><code>${firma}</code><p>${texto}</p></div>`;
    const k = (tipo, t, ins) => ctx.tk(tipo, t, ins ?? t);
    ctx.$("v-ayuda").innerHTML = ctx.htmlInterfaz(`
      <h3>Cómo leer el inspector</h3>
      <ul>
        <li><b>Para tu código</b> (izquierda): el nombre de la máquina, lo que contiene y sus funciones. Es lo que más vas a escribir.</li>
        <li><b>Datos</b> (derecha): entradas, salidas, ritmo y propiedades que puedes leer para decidir, como <span class="tk-prop">failureRate</span>.</li>
        <li><b>Métricas</b> (abajo): cómo le fue a la máquina en este intento. No se usan en el código.</li>
        <li>Doble clic sobre cualquier palabra de color la inserta en el programa abierto. Las funciones llegan con huecos <span class="r">/* tipo de enemigo */</span> ya seleccionados: el siguiente doble clic en un valor los rellena.</li>
      </ul>
      <div class="leyenda-tk"><span class="tk-var">máquina</span><span class="tk-fn">función</span><span class="tk-prop">propiedad</span><span class="tk-num">número</span><span class="tk-str">texto</span></div>
      <h3>Editar sin teclado</h3>
      <ul>
        <li>El botón del teclado (junto a la letra en PC, al principio de la barra de edición en el teléfono) cambia a edición por bloques. Tachado y en rojo, el teclado del teléfono no se abre.</li>
        <li>Un toque elige un elemento entero: textos con sus comillas, comentarios completos, nombres y números. Una palabra clave o un signo eligen su construcción: el if, la llamada, la operación.</li>
        <li>Doble toque amplía hasta el siguiente límite: <span class="r">"oro"</span> → <span class="r">entregar("oro")</span> → <span class="r">yo.entregar("oro")</span> → el if que lo contiene.</li>
        <li>Arrastra un valor sobre un hueco, un argumento o dentro de ( ) o [ ]: se copia y el original se queda. Una línea completa se mueve; con Alt o Ctrl, se copia. Con el dedo, mantén pulsada la palabra antes de arrastrarla.</li>
        <li>Las líneas se agarran por su número o por el borde derecho; se elige en Ajustes.</li>
        <li>Al elegir un hueco <span class="r">/* … */</span> o un argumento aparecen los valores posibles de la máquina; en las condiciones, comprobaciones y operadores.</li>
        <li>Mantén pulsado un ladrillo con la esquina marcada para ver sus variantes: while, for, do … while y break; if, if / else y else if; operadores; let; los niveles de console.</li>
        <li>Seudocódigo (botón «Seudo»): el mismo programa como frases. Toca un valor para cambiarlo, toca un renglón para poner ahí el siguiente ladrillo y arrástralo para moverlo; soltado sobre la paleta se borra. Se guarda y ejecuta como JavaScript.</li>
      </ul>
      <h3>Funciones del lanzador</h3>
      <p class="leccion" style="margin:0">En el programa de un lanzador, lo suyo se escribe sin prefijo. Lo de otra máquina lleva su nombre: <span class="r">LAU_02.failureRate</span>. En pantalla los nombres llevan guion (LAU-01); en el código, guion bajo.</p>
      ${f(`${k("fn", "autoTarget")}(tipo, sensor) → posición | null`, `Mira con ese sensor, elige el enemigo de ese tipo más cercano a la base y calcula dónde estará cuando llegue tu próximo misil. Devuelve <span class="r">{x, y, z, id, tipo}</span> o <span class="r">null</span>. No gasta tiempo. Ignora a los que ya tienen misiles suficientes en el aire.`)}
      ${f(`${k("fn", "regularShoot")}(lugar) → "ok" | "sin_objetivo" | "sin_misiles" | "atascado"`, `Dispara 1 misil por segundo a ese lugar hasta que le des otra orden. Con <span class="r">null</span> deja de disparar y devuelve "sin_objetivo".`)}
      ${f(`${k("fn", "burstFire")}(lugar)`, `Igual, pero 2,2 misiles por segundo. Al entrar en ráfaga la probabilidad de fallo sube al 15 % y sigue subiendo 5 puntos por segundo. Fuera de ráfaga baja 6 puntos por segundo hasta el 2 %.`)}
      ${f(`${k("fn", "stopFire")}()`, `Deja de disparar.`)}
      <h3>Propiedades (solo lectura)</h3>
      ${f(`${k("prop", "failureRate")} · ${k("prop", "missiles")} · ${k("prop", "mode")} · ${k("prop", "jammed")} · ${k("prop", "fireRate")} · ${k("prop", "target")} · ${k("prop", "sensors")}`, `Probabilidad de que el próximo disparo falle (0 a 1) · misiles en el cargador · "idle", "regular" o "burst" · si está atascado · disparos por segundo · a dónde apunta · sensores montados.`, "prop")}
      <h3>Red de sensores</h3>
      ${f(`VIB_01.${k("fn", "detect")}(tipo) → posición | null · VIB_01.${k("prop", "count")}`, `El sensor de vibración oye a los enemigos de suelo en su radio, aunque haya niebla. Da dónde están ahora, sin predicción. No oye drones.`, "red")}
      <h3>Del programa</h3>
      ${f(`await ${k("fn", "esperar")}(segundos)`, `Deja pasar tiempo de juego. Mientras tu programa no espera, el reloj está quieto: cada vuelta de un bucle necesita una espera.`)}
      ${f(`console.log · info · warn · error`, `Mensajes de la máquina. En «Cómo se muestra cada console» eliges si salen como globo sobre la máquina, como aviso a pantalla con enlace a ella o solo en la consola.`)}
      <h3>Enemigos</h3>
      <div class="tabla-wrap"><table><thead><tr><th>Tipo</th><th>Vida</th><th>Velocidad</th><th>Altura</th><th>Lo ven</th></tr></thead><tbody>
        ${Object.entries(ctx.TIPOS).map(([t, d]) => `<tr><td>${k("str", `"${t}"`)} ${ctx.esc(d.nombre)}</td><td>${d.hp}</td><td>${d.vel} c/s</td><td>${d.z} m</td><td>cámara${d.frio ? "" : ", térmico"}${d.suelo ? ", vibración" : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>Reglas</h3>
      <ul>
        <li>El misil vuela a ${ctx.MISIL.vel} casillas/s y estalla en el lugar pedido, a su altura: daña lo que esté a ${ctx.MISIL.radio} m o menos. Una explosión en el suelo no alcanza a un dron a 2,5 m.</li>
        <li>Cada lanzador recibe ${ctx.LAU.suministro} misil/s del depósito hasta llenar su cargador.</li>
        <li>Un fallo atasca el lanzador y pierde el misil. El robot reparador va hasta él y tarda ${ctx.REP.tBase} s más ${ctx.REP.tPorFallo} s por cada punto de failureRate que tenía al fallar: con 0,04 son ${(ctx.REP.tBase + ctx.REP.tPorFallo * .04).toFixed(1)} s; con 0,35, ${(ctx.REP.tBase + ctx.REP.tPorFallo * .35).toFixed(1)} s.</li>
        <li>failureRate es la probabilidad media de fallo por disparo. En promedio falla 1 de cada 1/failureRate disparos, sin rachas extremas.</li>
        <li>Alcance: cámara ${ctx.SENSOR.visual.alcance} (niebla ${ctx.SENSOR.visual.niebla}), térmico ${ctx.SENSOR.thermal.alcance} (niebla ${ctx.SENSOR.thermal.niebla}).</li>
        <li>Coste: ₵ ${ctx.COSTE.misil} por misil y ₵ ${ctx.COSTE.reparacion} por reparación. El número a bajar es el coste por derribo.</li>
        <li>La semilla decide los fallos. Con la misma semilla, el mismo programa da el mismo resultado.</li>
      </ul>
      <h3>Ejemplo</h3>
<pre>while (true) {
  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");
  if (failureRate >= 0.25) {
    console.warn(failureRate);
  }
  if (failureRate >= 0.35) {
    regularShoot(pos);
  } else {
    burstFire(pos);
  }
  await esperar(0.4);
}</pre>`);
  }

  return {
    pintarAyuda
  };
}
