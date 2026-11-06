/* while, vuelta a vuelta · ejemplo de la receta (no es contenido del juego).
 * Objetivo: entender que while comprueba ANTES de cada vuelta y que algo del cuerpo debe acercarlo a false.
 * Malentendido a evitar: que la condición se evalúa una sola vez, o que el bucle "sabe" cuándo parar.
 * Paridad: el modelo (antes / condición / cuerpo / vuelve) es el mismo en JS y Python; cambian sintaxis y salida. */
Infografia.montar('#infografia', {
  id: 'while-cinta',
  lenguajes: ['js', 'py'],
  titulo: 'Así se repite un while, vuelta a vuelta',
  // {{true}}, {{false}} e {{imprimir}} vienen de serie; aquí, lo propio de este concepto.
  glosario: { inicio: { js: 'let cajas = 3', py: 'cajas = 3' } },
  // Color = papel. Las anclas del código y los nodos comparten id, así que comparten color.
  roles: { init: 'azul', cond: 'amarillo', 'e-true': 'verde', cuerpo: 'cian', resta: 'morado', 'e-vuelta': 'morado', fin: 'rojo' },

  escena: {
    areas: {
      horizontal: ['codigo flujo', 'estado flujo', 'consola flujo'],
      vertical: ['codigo', 'flujo', 'estado', 'consola'],
    },
    columnas: { horizontal: '1fr 1.05fr' },
    filas: { horizontal: 'auto auto 1fr', vertical: 'auto auto auto 1fr' },
    paneles: [
      {
        tipo: 'codigo', id: 'codigo', archivo: { js: 'cinta.js', py: 'cinta.py' },
        fuente: {
          js: '[[init|let cajas = 3;]]\nwhile ([[cond|cajas > 0]]) {\n  [[cuerpo|console.log(`Quedan ${cajas}`);]]\n  [[resta|cajas = cajas - 1;]]\n}\n[[fin|console.log("Cinta vacía");]]',
          py: '[[init|cajas = 3]]\nwhile [[cond|cajas > 0]]:\n    [[cuerpo|print(f"Quedan {cajas}")]]\n    [[resta|cajas = cajas - 1]]\n[[fin|print("Cinta vacía")]]',
        },
      },
      {
        tipo: 'fichas', id: 'estado',
        fichas: [
          { id: 'v-cajas', etiqueta: 'variable cajas', valor: '—' },
          { id: 'v-cond', etiqueta: 'condición', valor: { texto: '—', tono: 'neutro' } },
        ],
      },
      { tipo: 'consola', id: 'consola' },
      {
        tipo: 'flujo', id: 'flujo',
        nodos: [
          { id: 'init', titulo: 'Antes del bucle', detalle: '{{inicio}} · una sola vez' },
          { id: 'cond', titulo: 'Condición', detalle: 'cajas > 0 · antes de cada vuelta', salida: { id: 'fin', texto: 'Fin del bucle', etiqueta: '{{false}} →' } },
          { id: 'cuerpo', titulo: 'Cuerpo: muestra', detalle: { js: 'console.log(`Quedan …`)', py: 'print(f"Quedan …")' } },
          { id: 'resta', titulo: 'Cuerpo: descuenta', detalle: 'cajas = cajas - 1 · y vuelve' },
        ],
        aristas: [
          { id: 'e-true', de: 'cond', a: 'cuerpo', etiqueta: '{{true}} ↓' },
          { id: 'e-vuelta', de: 'resta', a: 'cond', tipo: 'vuelta' },
        ],
      },
    ],
  },

  pasos: [
    {
      texto: '**Antes del bucle.** `{{inicio}}`{azul} se ejecuta una sola vez: la cinta empieza con 3 cajas.',
      foco: ['init'], marca: 'init', linea: 'init', valores: { 'v-cajas': '3' },
    },
    {
      texto: '**Condición.** Antes de cada vuelta se comprueba `cajas > 0`{amarillo}: `3 > 0` es `{{true}}`, así que entra.',
      foco: ['cond', 'e-true'], marca: 'cond', linea: 'cond', valores: { 'v-cond': { texto: '3 > 0 ✓', tono: 'ok' } },
    },
    {
      texto: '**Cuerpo.** `{{imprimir}}`{cian} muestra `Quedan 3` en la consola.',
      foco: ['cuerpo'], marca: 'cuerpo', linea: 'cuerpo', consola: 'Quedan 3',
    },
    {
      texto: '**Descuenta.** `cajas = cajas - 1`{morado} deja 2 cajas y el programa vuelve a la condición.',
      foco: ['resta', 'e-vuelta'], marca: 'resta', linea: 'resta',
      valores: { 'v-cajas': '2', 'v-cond': { texto: '¿2 > 0?', tono: 'neutro' } },
    },
    {
      texto: 'Vuelve a comprobar: `2 > 0` es `{{true}}`. ¿Qué mostrará la consola en esta vuelta?',
      foco: ['cond', 'e-true'], marca: 'cond', linea: 'cond', valores: { 'v-cond': { texto: '2 > 0 ✓', tono: 'ok' } },
      pregunta: { opciones: ['`Quedan 3`', '`Quedan 2`', '`Cinta vacía`'], correcta: 1 },
    },
    {
      texto: '**Las vueltas siguen.** Muestra `Quedan 2` y `Quedan 1`; tras cada vuelta, `cajas` baja hasta `0`.',
      foco: ['cuerpo', 'resta', 'e-vuelta'], marca: 'cuerpo', linea: 'cuerpo',
      consola: [{ texto: 'Quedan 2', en: 0.4 }, { texto: 'Quedan 1', en: 1.9 }],
      valores: {
        'v-cajas': [{ texto: '1', en: 1.0 }, { texto: '0', en: 2.5 }],
        'v-cond': [{ texto: '1 > 0 ✓', tono: 'ok', en: 1.4 }, { texto: '¿0 > 0?', tono: 'neutro', en: 2.6 }],
      },
    },
    {
      texto: '**Condición falsa.** Con `cajas` en `0`, `0 > 0` es `{{false}}`: el bucle termina sin volver a entrar al cuerpo.',
      foco: ['cond', 'fin'], marca: 'cond', linea: 'cond', valores: { 'v-cond': { texto: '0 > 0 ✗', tono: 'bad' } },
    },
    {
      texto: '**Después del bucle.** El programa sigue en la línea siguiente y muestra `Cinta vacía`.',
      foco: ['fin'], marca: 'fin', linea: 'fin', consola: 'Cinta vacía',
    },
    {
      texto: '**En resumen:** `while` comprueba antes de cada vuelta. Si nada en el cuerpo lo acerca a `{{false}}`, no termina nunca.',
      foco: ['cond', 'resta'], marca: 'resta', linea: null,
    },
  ],
}, { teclado: 'documento' });
