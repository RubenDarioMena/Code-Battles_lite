# Campaign-V2 · glosario (borrador)

Borrador del `CONTEXT.md` de la rama `Campaign-V2`. Se moverá a la raíz de esa rama cuando exista. Solo contiene términos resueltos en el grill (rondas 1 y 2); los pendientes están en `campaign-v2-ronda-3.html`.

## Estructura de la campaña

**Campaign-V2**
La campaña del juego, hecha desde el inicio como una sola experiencia que une fábrica y combate. Sustituye a la campaña H0–H5 y es la experiencia principal. War, Factory y la campaña H0–H5 quedan ocultas, solo para QA.
_Evitar_: «nivel 2 de Campaign», «War», «Factory».

**Nivel**
Una cadena de hitos sobre un mismo mundo. Campaign-V2 es una secuencia de niveles.

**Hito**
Un paso de un nivel con una meta concreta. Al cumplirla se guarda un checkpoint. Puede ser de fábrica o de batalla.

**Hito de fábrica**
Hito cuya meta es producir algo. En el Nivel 1, lo mínimo que se pide es munición básica.

**Munición básica**
El primer producto de la fábrica, con una cadena corta (por ejemplo, acero → prensa → munición). El misil compuesto (ojiva + motor) queda para hitos posteriores.

**Bodega**
El depósito de munición de la muralla. En el Nivel 1 abastece sola a las torretas mientras le quede munición; más adelante, el reparto lo harán robots programados.

**Batalla**
Hito de combate contra oleadas. Las cinco primeras replican los cinco retos de War y se alternan con hitos de fábrica. Durante una batalla, la fábrica sigue funcionando.
_Evitar_: «reto» (es el término de la serie War).

**Checkpoint**
Estado guardado al empezar un hito: la fábrica, la bodega, las torretas y los programas. La batalla no se guarda: se vuelve a montar desde su reto. Al perder una batalla se puede elegir a cuál volver, y el último aparece como opción por defecto; se vuelve con los programas actuales.

## Modos

**Modo campaña**
Jugar Campaign-V2 tal cual: la fábrica corre durante las batallas y cambia su cargador y su suministro.

**Modo paridad**
Jugar una batalla con los parámetros exactos de su reto de War, con el mismo resultado que War. Sirve para comprobar que la batalla no se ha desviado.

**Ensayo**
Una Batalla o un caso de mecánica abierto suelto desde el menú de pruebas, con las reglas del modo campaña pero sin progresión ni checkpoint. Sirve para probar algo sin jugar lo anterior y para probar mecánicas antes de incluirlas en un nivel.
_Evitar_: «laboratorio» (era la maqueta independiente, ya incorporada).

**Menú de pruebas**
Menú oculto (se abre por URL) para saltar a cualquier hito, entrar en modo paridad y abrir War, Factory y la campaña H0–H5. No forma parte de la experiencia del jugador.
_Evitar_: «selector de retos» (es la pantalla de War).

## Mundo y unidades

**Muralla**
La obra defensiva del mapa (diseño C · Traba + Cordón). En las primeras batallas es estática y su cara frontal es la línea de brechas.

**Bastión**
Saliente de la muralla donde va montada una torreta esfera.

**Marco de batalla**
El rectángulo del mapa donde ocurre una Batalla: el campo de War colocado frente a la muralla, una casilla por metro. Es también el campo por el que se mueven las unidades que salen de la muralla.

**Torreta esfera**
El lanzador de Campaign-V2: torreta esférica montada en un bastión. En las cinco primeras batallas (quizá solo las tres primeras) ya viene montada de serie. Apunta, abre la compuerta y dispara por el telescopio.
_Evitar_: «torreta de observación» (es el nombre del asset de arte, no el papel en el juego), «LAU» (es el término de War).

**Placeholder**
Una entidad que todavía no tiene modelo definitivo (dron, oruga, sensor, reparador) y se dibuja con la primitiva actual de War.

**Vista de combate**
Vista oscura sin texturas, con cuadrícula y líneas brillantes (estilo Tron). Se activa sola durante una batalla.

## Control directo

**Selección**
Las unidades marcadas en un momento dado. Es una sola: seleccionar en el mapa (clic izquierdo o arrastre) marca sus casillas en el árbol de unidades, y al revés. Programar y ordenar actúan sobre la selección.

**Orden puntual**
Una acción manual de una sola vez; por ejemplo, que la torreta seleccionada dispare a un punto. Nunca se repite sola: para que algo se repita hay que programarlo. Se da con clic derecho (en el móvil, manteniendo pulsado) sobre una unidad que no escucha clics, o siempre con apuntar arrastrando.
_Evitar_: «control manual» (suena a manejar la unidad de forma continua).

**Clic programado**
Un clic derecho (o mantener pulsado) sobre el mapa que llega al programa de una unidad seleccionada que escucha clics. Solo ocurre lo que ese programa diga; si no escucha, el mismo gesto es una orden puntual.
_Evitar_: «orden» (solo lo es si el programa la convierte en una), «aviso», «señal».

**Apuntar arrastrando**
Mantener pulsada una torreta propia y arrastrar hasta el objetivo, con una línea punteada hasta el dedo. Siempre es una orden puntual, aunque el programa escuche clics.

**Colocador**
El widget para situar torretas y máquinas, con confirmar, cancelar y bloquear para colocar varias veces. En el Nivel 1, las máquinas mínimas de la munición ya están colocadas desde el principio y el colocador puede moverlas, pero no añadir otras. Más adelante se podrán colocar máquinas nuevas libremente.

## Programas

**Editor**
La superficie de escritura de código: CodeMirror, modo sin teclado, paleta, sugerencias, seudocódigo y revisión. Es la misma que en trunk.

**Panel de código**
El marco que rodea al editor: árbol de unidades, Archivo y consola.
_Evitar_: llamarlo «editor».

**Árbol de unidades**
Lista plegable con las unidades agrupadas por tipo, con una casilla por unidad y por tipo, y otra para marcar todas. Sustituye a la tira de tarjetas, también en el móvil.

**Archivo**
La biblioteca de programas del jugador, con programas para distintas situaciones.

**Programa**
Texto de código guardado en el Archivo. Varias unidades pueden compartir un mismo programa; editarlo cambia el de todas.

**Programa de la lección**
El programa de partida que trae cada Batalla para su lección. Entre Batallas se conserva el programa del jugador; el de la lección se carga a petición con un botón, y el cambio se puede deshacer.

**Ejecución**
Un programa corriendo en una unidad concreta, con su propio estado. Las órdenes de una ejecución solo valen para su unidad.

**Desvincular**
Dar a una unidad su propia copia de un programa compartido, para que deje de cambiar con él.
