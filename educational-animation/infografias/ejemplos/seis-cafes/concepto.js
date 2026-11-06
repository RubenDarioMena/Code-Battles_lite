/* Seis cafés · break y continue dentro de un while (ejemplo propuesto por el usuario).
 *
 * Objetivo: ver que `continue` salta SOLO el resto de una vuelta y `break` termina el bucle entero;
 *           por eso se imprimen 6 cafés (vueltas 1–4 y 6–7).
 * Malentendidos a evitar: que `continue` termina el bucle; que el bucle acaba porque `< 10` se vuelve false
 *           (nunca ocurre: acaba por `break` en la vuelta 8); contar 7, 9 o 10 cafés.
 * Traza real (node y python3, verificada): vueltas 1–4 Café · 5 continue · 6–7 Café · 8 break · 9 y 10 no ocurren.
 * Paridad: mismo modelo en JS y Python. Cambian === ↔ ==, true/false ↔ True/False, console.log ↔ print,
 *          camelCase ↔ snake_case y llaves ↔ sangría (por eso todo se marca con anclas, no con números de línea). */
const CAFE = { icono: 'taza', texto: 'Café', tono: 'cobre' };
const cafeEn = (en) => ({ ...CAFE, en });

Infografia.montar('#infografia', {
  id: 'seis-cafes',
  lenguajes: ['js', 'py'],
  titulo: 'Seis cafés: break corta, continue salta',

  glosario: {
    var: { js: 'drinkCoffee', py: 'drink_coffee' },
    init: { js: 'let drinkCoffee = 0', py: 'drink_coffee = 0' },
    igual: { js: '===', py: '==' },
  },
  // Color = papel. Anclas del código, nodos y salidas comparten id → comparten color en todas las vistas.
  roles: {
    init: 'azul', cond: 'amarillo', 'e-entra': 'verde', suma: 'morado',
    ocho: 'rojo', brk: 'rojo', cinco: 'cian', cont: 'cian', 'e-cont': 'cian',
    cafe: 'cobre', 'e-vuelta': 'cobre', fin: 'rojo',
  },
  iconos: {
    taza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12v4.5A5.5 5.5 0 0 1 10.5 20h-1A5.5 5.5 0 0 1 4 14.5Z"/><path d="M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/></svg>',
  },

  escena: {
    areas: {
      horizontal: ['codigo flujo estado', 'vueltas vueltas vueltas'],
      vertical: ['codigo', 'flujo', 'estado', 'vueltas'],
    },
    columnas: { horizontal: '360px minmax(0, 1fr) 140px' },
    filas: { horizontal: 'minmax(0, 1fr) auto', vertical: 'auto auto auto auto' },
    paneles: [
      {
        tipo: 'codigo', id: 'codigo', archivo: { js: 'cafe.js', py: 'cafe.py' }, tamano: { horizontal: 13.5, vertical: 15 }, interlineado: { horizontal: 1.5, vertical: 1.45 }, cabecera: { vertical: false },
        fuente: {
          js: [
            '[[init|let drinkCoffee = 0]]',
            '',
            'while ([[cond|drinkCoffee < 10]]) {',
            '  [[suma|drinkCoffee = drinkCoffee + 1]]',
            '  ',
            '  if ([[ocho|drinkCoffee === 8]]) { [[brk|break]] }',
            '  if ([[cinco|drinkCoffee === 5]]) { [[cont|continue]] }',
            '',
            "  [[cafe|console.log('Café')]]",
            '}',
          ].join('\n'),
          py: [
            '[[init|drink_coffee = 0]]',
            '',
            'while [[cond|drink_coffee < 10]]:',
            '    [[suma|drink_coffee = drink_coffee + 1]]',
            '',
            '    if [[ocho|drink_coffee == 8]]:',
            '        [[brk|break]]',
            '    if [[cinco|drink_coffee == 5]]:',
            '        [[cont|continue]]',
            '',
            "    [[cafe|print('Café')]]",
          ].join('\n'),
        },
      },
      {
        tipo: 'flujo', id: 'flujo', hueco: 11, compacto: { vertical: true }, apretado: { horizontal: true },
        nodos: [
          { id: 'cond', titulo: 'Condición', detalle: '< 10', salida: { id: 'fin', texto: 'Fin del bucle', etiqueta: '{{false}} →' } },
          { id: 'suma', titulo: 'Suma 1', detalle: '{{var}} + 1' },
          { id: 'ocho', titulo: '¿Vale 8?', detalle: '{{igual}} 8', salida: { id: 'brk', texto: 'break', etiqueta: '{{true}} →' } },
          { id: 'cinco', titulo: '¿Vale 5?', detalle: '{{igual}} 5', salida: { id: 'cont', texto: 'continue', etiqueta: '{{true}} →' } },
          { id: 'cafe', titulo: 'Imprime', detalle: "{{imprimir}}('Café')" },
        ],
        aristas: [
          { id: 'e-entra', de: 'cond', a: 'suma', etiqueta: '{{true}} ↓' },
          { id: 'e-no8', de: 'ocho', a: 'cinco', etiqueta: '{{false}} ↓', tono: 'neutro' },
          { id: 'e-no5', de: 'cinco', a: 'cafe', etiqueta: '{{false}} ↓', tono: 'neutro' },
          { id: 'e-vuelta', de: 'cafe', a: 'cond', tipo: 'vuelta', carril: 0 },
          { id: 'e-cont', de: 'cinco', a: 'cond', tipo: 'vuelta', carril: 1 },
        ],
      },
      {
        tipo: 'fichas', id: 'estado', apilar: { horizontal: true },
        fichas: [
          { id: 'v-dc', etiqueta: '`{{var}}`', valor: '—' },
          { id: 'v-check', etiqueta: 'comprobación', valor: { texto: '—', tono: 'neutro' } },
          { id: 'v-cafes', etiqueta: 'cafés', valor: '0', tono: 'cobre' },
        ],
      },
      {
        tipo: 'fila', id: 'vueltas', estilo: 'vueltas', titulo: 'Vueltas · valor de `{{var}}` y lo que imprime',
        items: Array.from({ length: 10 }, (_, k) => ({
          id: `v${k + 1}`, titulo: String(k + 1), detalle: { icono: 'nada', tono: 'neutro' },
          tono: k + 1 === 5 ? 'cian' : k + 1 === 8 ? 'rojo' : k + 1 > 8 ? 'neutro' : 'cobre',
        })),
      },
    ],
  },

  pasos: [
    { // 1
      texto: '**Antes del bucle.** `{{init}}`{azul}: empezamos sin ningún café.',
      marca: ['init'], linea: 'init', valores: { 'v-dc': '0' },
    },
    { // 2
      texto: '**Condición.** Antes de cada vuelta se comprueba `{{var}} < 10`{amarillo}: `0 < 10` es `{{true}}`, así que entra.',
      foco: ['cond', 'e-entra'], marca: ['cond'], linea: 'cond',
      valores: { 'v-check': { texto: '0 < 10 ✓', tono: 'verde' } },
    },
    { // 3
      texto: '**Suma 1.** `{{var}} = {{var}} + 1`{morado} deja la variable en `1`: empieza la vuelta 1.',
      foco: ['suma', 'v1'], marca: ['suma'], linea: 'suma', valores: { 'v-dc': '1' },
    },
    { // 4
      texto: '**Dos comprobaciones.** `1 {{igual}} 8`{rojo} y `1 {{igual}} 5`{cian} son `{{false}}`: ni `break` ni `continue`.',
      foco: ['ocho', 'cinco', 'e-no8', 'e-no5'], marca: ['ocho', 'cinco'], linea: ['ocho', 'cinco'],
      valores: { 'v-check': [{ texto: '1 {{igual}} 8 ✗', tono: 'rojo', en: 0.3 }, { texto: '1 {{igual}} 5 ✗', tono: 'rojo', en: 1.6 }] },
    },
    { // 5
      texto: "**Imprime.** `{{imprimir}}('Café')`{cobre} muestra el primer café y vuelve a la condición.",
      foco: ['cafe', 'e-vuelta'], marca: ['cafe'], linea: 'cafe',
      valores: { v1: CAFE, 'v-cafes': '1' },
    },
    { // 6 · vueltas iguales, comprimidas: se encienden juntas las fases de una vuelta completa
      texto: '**Vueltas 2, 3 y 4.** Lo mismo: suma 1, ninguna comprobación se cumple y sale un café por vuelta.',
      foco: ['cond', 'suma', 'cafe', 'e-vuelta', 'v2', 'v3', 'v4'], hecho: ['v1'], marca: ['cond', 'suma', 'cafe'], linea: null,
      valores: {
        'v-dc': [{ texto: '2', en: 0.4 }, { texto: '3', en: 2.0 }, { texto: '4', en: 3.6 }],
        'v-check': [{ texto: '2 < 10 ✓', tono: 'verde', en: 0.2 }, { texto: '3 < 10 ✓', tono: 'verde', en: 1.8 }, { texto: '4 < 10 ✓', tono: 'verde', en: 3.4 }],
        v2: cafeEn(1.0), v3: cafeEn(2.6), v4: cafeEn(4.2),
        'v-cafes': [{ texto: '2', en: 1.0 }, { texto: '3', en: 2.6 }, { texto: '4', en: 4.2 }],
      },
    },
    { // 7 · predicción antes del caso especial
      texto: '**Vuelta 5.** `5 {{igual}} 8`{rojo} es `{{false}}`, pero `5 {{igual}} 5`{cian} es `{{true}}`. ¿Qué pasa ahora?',
      foco: ['cinco', 'v5'], hecho: ['v2', 'v3', 'v4'], marca: ['cinco'], linea: 'cinco',
      valores: { 'v-dc': '5', 'v-check': [{ texto: '5 {{igual}} 8 ✗', tono: 'rojo', en: 0.3 }, { texto: '5 {{igual}} 5 ✓', tono: 'verde', en: 1.5 }] },
      pregunta: { opciones: ['Otro café', 'Salta la vuelta', 'Sale del bucle'], correcta: 1, sobre: 'vueltas' },
    },
    { // 8
      texto: '**`continue`{cian}** salta el resto de la vuelta: no llega a `{{imprimir}}` y vuelve a la condición. Sin café.',
      foco: ['cinco', 'cont', 'e-cont'], marca: ['cont'], linea: 'cont',
      valores: { v5: { icono: 'saltar', texto: 'continue', tono: 'cian' } },
    },
    { // 9
      texto: '**Vueltas 6 y 7.** Las comprobaciones vuelven a dar `{{false}}`: salen el quinto y el sexto café.',
      foco: ['cond', 'suma', 'cafe', 'e-vuelta', 'v6', 'v7'], hecho: ['v5'], marca: ['cond', 'suma', 'cafe'], linea: null,
      valores: {
        'v-dc': [{ texto: '6', en: 0.4 }, { texto: '7', en: 2.0 }],
        'v-check': [{ texto: '6 < 10 ✓', tono: 'verde', en: 0.2 }, { texto: '7 < 10 ✓', tono: 'verde', en: 1.8 }],
        v6: cafeEn(1.0), v7: cafeEn(2.6),
        'v-cafes': [{ texto: '5', en: 1.0 }, { texto: '6', en: 2.6 }],
      },
    },
    { // 10 · segunda predicción: mismas opciones, distinta respuesta
      texto: '**Vuelta 8.** `{{var}}` vale `8` y `8 {{igual}} 8`{rojo} es `{{true}}`. ¿Qué pasa ahora?',
      foco: ['ocho', 'v8'], hecho: ['v6', 'v7'], marca: ['ocho'], linea: 'ocho',
      valores: { 'v-dc': '8', 'v-check': { texto: '8 {{igual}} 8 ✓', tono: 'verde', en: 0.3 } },
      pregunta: { opciones: ['Otro café', 'Salta la vuelta', 'Sale del bucle'], correcta: 2, sobre: 'vueltas' },
    },
    { // 11
      texto: '**`break`{rojo}** termina el bucle al instante: no imprime y las vueltas 9 y 10 nunca ocurren.',
      foco: ['ocho', 'brk'], marca: ['brk'], linea: 'brk',
      valores: {
        v8: { icono: 'parar', texto: 'break', tono: 'rojo' },
        v9: { icono: 'no', texto: 'no ocurre', tono: 'neutro', en: 1.0 },
        v10: { icono: 'no', texto: 'no ocurre', tono: 'neutro', en: 1.3 },
      },
    },
    { // 12 · regla general
      texto: '**6 cafés.** `continue`{cian} salta una vuelta; `break`{rojo} acaba el bucle, no la condición `< 10`{amarillo}.',
      foco: ['cont', 'brk', 'e-cont', 'v5', 'v8'], hecho: ['v8'], marca: ['cont', 'brk'], linea: null,
      valores: { 'v-check': { texto: 'acabó por break', tono: 'rojo' } },
    },
  ],
}, { teclado: 'documento' });
