# Code Battle Lite / Codemageddon — Documento consolidado de decisiones de diseño

**Fecha:** 23 de noviembre de 2026  
**Propósito:** referencia de diseño antes del siguiente gran prototipo.  
**Ámbito:** campaña inicial, fabricación, programación, materiales, reciclaje, combate, destrucción, recuperación, presentación visual y rendimiento.  
**Naturaleza del documento:** registro de decisiones e hipótesis, **no** una orden de implementación ni una descripción garantizada del estado actual del repositorio.

> **Principio rector:** conseguir profundidad mediante **reglas bien definidas y combinaciones abiertas**, no mediante simulación física universal. Separar el estado lógico de los objetos, su apariencia y sus colisiones para permitir experimentar sin multiplicar innecesariamente los problemas de rendimiento y QA.

## Convenciones de estado

- **[Decidido]** Dirección de diseño expresada claramente y que debe preservarse salvo revisión posterior.
- **[Preferido]** Opción favorecida, pendiente de pruebas antes de fijarla como arquitectura definitiva.
- **[Propuesto]** Idea o ejemplo discutido, no cerrado ni implementado.
- **[Futuro]** Posibilidad deliberadamente no prioritaria para el siguiente prototipo.
- **[Pendiente]** Requiere cifra, prueba, decisión o inspección del código real.

**Importante:** cuando se citan cifras o fórmulas de ejemplo, no representan parámetros finales de balance. Las decisiones visuales posteriores a los documentos del 7 y 10 de noviembre tienen prioridad donde haya discrepancias.

---

## 1. Visión de diseño y alcance

### 1.1. Naturaleza del juego

**[Decidido]** El corazón del proyecto es programar y coordinar **robots, máquinas estáticas, sensores, actuadores, transporte y producción**. Las fábricas no son decorados: sus procesos son parte del desafío de ingeniería y de estrategia.

**[Decidido]** La profundidad debe surgir de la combinación de unas pocas capacidades reutilizables:

- Materias primas y piezas con atributos consistentes.
- Máquinas que transforman entradas en salidas, con costes y subproductos.
- Sensores que leen el estado de la línea y actuadores programables.
- Robots que mueven recursos, ejecutan instrucciones y reaccionan a eventos.
- Armas que dañan componentes y dejan diferentes cantidades de material aprovechable.

**[Preferido]** Ofrecer **libertad de interconexión** entre sistemas compatibles, no una lista exhaustiva de recetas especiales para cada combinación imaginable. Una invención del jugador debería ser una consecuencia de reglas existentes, no necesariamente una habilidad programada de forma exclusiva.

### 1.2. Libertad frente a control

**[Decidido]** «Reglas cerradas, combinaciones abiertas»:

1. Las transformaciones y restricciones de cada máquina son concretas y comprobables.
2. Los resultados de las interacciones son reproducibles para la misma entrada y el mismo estado.
3. El jugador puede reorganizar el flujo de recursos y reutilizar equipos de formas no previstas.
4. La representación física puede ser aproximada siempre que la lógica sea coherente.

**Ejemplo guía:** un cañón electromagnético diseñado para pernos o tornillos puede acabar alimentándose de fragmentos metálicos procedentes de una trituradora. Si el sistema acepta esos proyectiles de acuerdo con propiedades generales, aparece una «ametralladora de chatarra» sin haber escrito una receta exclusiva para ella. La viabilidad depende de reglas de alimentación, masa, geometría, compatibilidad, energía y cadencia. No presupone física exacta para cada fragmento.

**[Decidido]** No adoptar una simulación de propósito general que obligue a calcular deformaciones, tensiones, colisiones y roturas exactas de cada objeto. Su coste de mantenimiento y QA sería desproporcionado para la fase actual.

---

## 2. Contexto de la campaña inicial y bucle de juego

### 2.1. Fábrica de partida

**[Decidido]** La campaña debe introducir progresivamente una fábrica que hay que **poner en funcionamiento y ampliar**, en lugar de empezar con toda la infraestructura desbloqueada. El progreso se apoya en objetivos comprensibles y en aprender procesos industriales mediante programación.

**Elementos discutidos para la infraestructura inicial:**

- Arma defensiva básica por defecto, para no exigir una cadena industrial enorme antes del primer contacto con el combate.
- Generador básico y presupuesto inicial limitado.
- Bahía o zona de descarga y recursos de entrada.
- Transporte por cintas; las cintas subterráneas pueden ser una solución más cara.
- Robots sencillos para manipulación y desplazamiento.
- Máquinas que el jugador instala libremente, con imagen fantasma de colocación, evitando tarimas o depósitos fijos arbitrarios.

**[Preferido]** La primera línea significativa se orienta a **munición básica de nivel 1**, antes de exigir montajes mecánicos complejos. El jugador debe entender qué entra, qué sale, qué se desperdicia y qué podría automatizar.

**[Pendiente]** Orden exacto de objetivos, infraestructura ya disponible, economía inicial y estado implementado en la rama de campaña. No confundir los conceptos de este documento con funcionalidades ya presentes en el código.

### 2.2. Máquinas y procesos ya discutidos

| Elemento | Dirección de diseño | Estado |
|---|---|---|
| **Fundidora** | Crisol dosificador elevado → vertido en molde → pieza sólida. Se planteó corregir el desnivel entre crisol y mesa, reduciendo parte de esta última. | [Decidido en concepto visual] |
| **Prensa** | Herramienta superior de forma circular o semiesférica; base de apoyo de apariencia maciza. | [Decidido en concepto visual] |
| **Corte** | Sierras mecánicas disponibles desde antes; láseres como alternativa tecnológica de mayor velocidad y consumo energético. | [Decidido en dirección] |
| **Montaje de ejes** | Máquina específica aplazada; podría terminar produciendo directamente un conjunto de dos ejes unidos, no cada eje por separado. | [Futuro] |
| **Montacargas** | Mueve unidades de carga y materias primas entre estaciones; puede representarse con piezas encima de las uñas. | [Decidido en concepto visual] |
| **Obrero básico** | Robot compacto con un brazo de manipulación; animaciones cortas para leer tareas. | [Decidido en concepto visual] |

**[Decidido]** Las máquinas estáticas también son programables. Pueden configurarse manualmente para fabricar un producto o reaccionar a piezas/datos de entrada. Un mismo dispositivo sensor/actuador puede resolver operaciones como separación y unión de flujos mediante código, en vez de tener una variante distinta por cada función.

**[Pendiente]** Definir cómo se representa la variante de producto en cada máquina: evitar dibujar una animación o sprite completamente independiente por cada pieza; favorecer moldes, siluetas y componentes visuales intercambiables.

**[Preferido]** Los productos de montaje robótico deben conservar una silueta reconocible de la unidad de destino, para que el jugador identifique piezas al inspeccionar cintas y almacenes.

### 2.3. Programación y capacidad interna

**[Decidido]** Sensores, entradas/salidas, buffers internos, programación por máquina y coordinación de robots forman parte del juego. Los buffers son importantes para evitar que una línea adaptable cambie de receta continuamente o se bloquee al recibir materiales mezclados.

**[Propuesto]** Un controlador puede decidir entre fabricar, esperar, devolver una pieza, alimentar otra máquina o derivar material a reciclaje según demanda, capacidad y estado.

**[Pendiente]** API de scripting, límites de ejecución, errores, semántica de las colas, manejo de entradas nulas, cantidad de ciclos tolerados y lenguaje principal. Anteriormente se valoró Python; la elección y su integración efectiva no deben darse por cerradas sin revisar el proyecto.

---

## 3. Caso de estudio: fabricación de la torreta esférica

### 3.1. Diseño mecánico de referencia

**[Decidido en concepto]** La referencia CAD es una torreta aproximadamente esférica, de **diámetro próximo a 1 metro**, con movimiento en ejes mecánicos y anillos dentados. Se han explorado dos ejes ortogonales, un punto/tornillo Allen central y un tercer eje de orientación en la base. Otra evolución conceptual mantiene los engranes perpendiculares y añade un anillo exterior concéntrico dentado: un círculo dentado dentro de otro círculo dentado.

**[Pendiente]** No tratar la configuración CAD como pieza definitiva de fabricación, ni fijar número de dientes, espesores, tolerancias, carga de motor o masa sin modelo validado.

### 3.2. Cadena propuesta de fabricación de la carcasa

**[Decidido como dirección de proceso]**

1. Producir u obtener una **placa metálica**.
2. Colocarla en una **prensa** con forma de media esfera.
3. Deformar la placa para conformar la **semiesfera**.
4. Recortar el perímetro sobrante mediante **sierra** o **láser**.
5. Enviar la semiesfera útil a la siguiente operación o montaje.
6. Separar los **recortes de metal** como subproducto de fabricación.
7. Reenviar esos recortes a **fundición**, donde pueden convertirse en material para nuevas placas.

**[Decidido]** Los recortes **no son piezas defectuosas**: son un subproducto previsto de un proceso normal. El circuito de reciclaje se basa en el material sobrante al dar forma a una pieza útil, no en asumir que las máquinas producen errores aleatorios.

**[Preferido]** Registrar entradas y salidas en masa, composición y forma aproximada sin ejecutar una simulación de deformación plástica por elementos finitos. La animación muestra prensado y recorte; los datos de la pieza los determina la receta y la geometría aproximada.

### 3.3. Ejemplo contable (ilustrativo, no balance final)

| Flujo | Masa de ejemplo |
|---|---:|
| Placa original | 10 kg |
| Semiesfera terminada | 6 kg |
| Recortes de corte | 4 kg |
| Metal recuperado con rendimiento hipotético del 95 % | 3,8 kg |
| Pérdida de recuperación | 0,2 kg |

El objetivo es mostrar **conservación de material**, no fijar rendimientos industriales. El balance real puede incluir virutas, rebaba, material volatilizado, contaminación o metal que requiere purificación.

### 3.4. Por qué esta cadena es ideal para un primer experimento

- El material sobrante aparece naturalmente y se puede acumular sin forzar un error de fabricación.
- La misma línea admite rutas alternativas: fundición, almacén, procesamiento secundario o uso como insumo de otra industria.
- Se puede visualizar el intercambio **velocidad de fabricación ↔ consumo energético ↔ residuos**.
- Las máquinas y robots programables permiten automatizar decisiones de transporte.
- Las reglas son auditables sin depender de fracturas geométricas completas.

---

## 4. Residuos industriales, acumulación y descubrimiento tecnológico

### 4.1. Acumulación progresiva

**[Decidido]** En las primeras etapas, los residuos metálicos pueden **acumularse sin presentar inmediatamente al jugador una solución o tutorial evidente**. El problema se hace visible conforme ocupa espacio, interrumpe el flujo o evidencia desperdicio de material.

**[Decidido]** Ese problema práctico debe servir como motivación orgánica para explorar las tecnologías de **recuperación, fundición, separación y automatización** del árbol tecnológico. La progresión no depende exclusivamente de un mensaje arbitrario de «desbloqueo».

**[Preferido]** El jugador observa primero un inconveniente real y posteriormente identifica la utilidad económica de una máquina o tecnología. Deben existir señales legibles antes de que el atasco sea irreversible: capacidad ocupada, alerta de residuos, inventario, flujo bloqueado o coste perdido.

### 4.2. Reutilización emergente de sobrantes

**[Propuesto]** Conservar los recortes como objetos/lotes con propiedades, no reducirlos necesariamente a una cifra abstracta de «dinero reciclado». Posibles rutas:

- Refundirlos y producir otra placa.
- Clasificarlos y llevarlos a almacén.
- Cortar recortes adecuados en piezas pequeñas o fragmentos para fabricar otros componentes.
- Alimentar máquinas compatibles que no exijan una placa nueva.
- Usar fragmentos metálicos apropiados como munición no convencional para un dispositivo que los acepte.

No se necesita una receta especial para cada uso si el sistema distingue **tipo de material, masa, calidad y categoría de forma**. Una máquina no debería aceptar automáticamente cualquier cosa: han de existir dimensiones, interfaces, tolerancias y restricciones de capacidad.

### 4.3. Ruteo programable

**[Preferido]** Los robots o actuadores de transporte deciden destinos mediante reglas observables:

- Priorizar fundición si faltan placas.
- Almacenar recortes si la fundición está saturada.
- Enviar fragmentos a otra máquina si existe una demanda compatible.
- Pausar o desviar producción si no hay capacidad para el subproducto.

**[Pendiente]** Cómo representar inventarios a granel frente a piezas discretas, capacidades de contenedores, contaminación y rendimientos.

---

## 5. Árbol tecnológico: sierras, láseres y aplicaciones cruzadas

### 5.1. Dos herramientas para una misma operación

**[Decidido]** Plantear una elección clara:

| Aspecto | Sierras mecánicas | Láseres de corte |
|---|---|---|
| Disponibilidad | Herramientas existentes o relativamente tempranas | Desbloqueo tecnológico posterior |
| Velocidad | Menor | Mucho mayor |
| Consumo eléctrico | Más contenido | Elevado y sostenido |
| Uso estratégico | Ahorro energético; mayor tiempo de producción | Alto rendimiento industrial a cambio de infraestructura/energía |
| Otros posibles costes | Desgaste, reposición de hoja, contacto físico | Refrigeración, capacidad eléctrica, control del haz |

**[Pendiente]** Los otros costes de la tabla son candidatos, no restricciones ya acordadas. Definir en pruebas si corte de sierra/láser genera diferencias importantes en merma, precisión o calidad. No asumir sin modelar que un láser siempre recupera más metal.

### 5.2. Continuidad industrial y armamentística

**[Decidido]** Los láseres deben tener una progresión con aplicaciones conectadas:

**Corte industrial rápido → armas láser pequeñas → tecnologías láser superiores → superarma.**

La progresión debe sentirse como evolución de principios tecnológicos previamente conocidos por el jugador. La inversión energética que acelera la fábrica también puede abrir alternativas de combate. Las rutas no tienen por qué tener el mismo balance de coste, potencia o recursos recuperables.

### 5.3. Rama tecnoquímica

**[Decidido como dirección de diseño]** Existe otra familia tecnológica basada en **procesos químicos y corrosivos**, que puede evolucionar desde operaciones industriales hasta armamento especializado.

**[Propuesto]** Frente a tecnologías que exigen máquinas, materiales y fuentes energéticas muy costosas —por ejemplo, sistemas de altísima densidad, láseres extremos o armamento eléctrico avanzado—, una tecnología química sofisticada podría desplegarse mediante vehículos y distribuidores relativamente sencillos: conductos, depósitos, boquillas o mecanismos baratos. En la conversación se usaron «globos y mangueras» como imagen del contraste logístico, **no** como receta técnica ni diseño final de un arma.

**[Preferido]** Distinguir potencia del agente químico de sofisticación del sistema de lanzamiento, de modo que una rama tecnológica pueda competir por **coste de producción, facilidad de despliegue y volumen** en vez de únicamente por daño bruto.

### 5.4. Jugabilidad emergente química

**[Propuesto]** Definir materiales con susceptibilidad a corrosión y fluidos con propiedades abstractas como intensidad, consumo por contacto y compatibilidad. Un producto usado originalmente para tratar superficies o eliminar residuos industriales podría aplicarse, bajo las mismas reglas, a blindajes vulnerables durante el combate.

No se simulan moléculas ni reacciones completas. Se evalúan interacciones de un conjunto reducido de atributos, áreas de contacto y tiempo de exposición. El diseño exacto de la química queda abierto.

---

## 6. Modelo común de materiales y objetos

### 6.1. Separar identidad de geometría

**[Preferido]** Introducir una representación lógica compartida por fábrica, armas y restos:

| Atributo lógico | Para qué sirve |
|---|---|
| `material` / composición | Compatibilidad de procesos, reciclaje y resistencia a daño. |
| `mass` | Balance de materia, transporte, recuperación y coste. |
| `shapeClass` / dimensiones aproximadas | Determinar si cabe, se alimenta o puede transformarse en una máquina. |
| `state` / integridad | Distinguir pieza útil, dañada, fragmento, residuo y material perdido. |
| `quality` / contaminación | Diferenciar recuperación directa de material que necesita procesado. |
| `temperature` (opcional) | Solo si aporta una decisión jugable medible. |
| `components` / uniones | Permitir separar módulos sin resolver fractura física completa. |

**[Decidido]** No hacer que el aspecto visual de una pieza sea la única fuente de verdad para calcular sus recursos: un modelo de alta resolución o un efecto de corrosión visual no determina directamente la masa restante.

### 6.2. Conservación y pérdidas

Para un proceso de fabricación básico:

`masa_entrada = masa_producto + masa_subproducto + masa_perdida`

Para una operación de reciclaje:

`masa_recuperada = masa_residuo_entrante × rendimiento_del_proceso`

En destrucción, un balance análogo reparte cada componente entre **masa aprovechable**, **masa degradada que requiere tratamiento** y **masa perdida/no recuperable**. No se crean recursos por repetir el mismo golpe, recoger dos veces el mismo fragmento o procesar un mismo lote en dos máquinas.

**[Pendiente]** Precisar unidades, tolerancias de redondeo, materiales compuestos, descontaminación y límites mínimos de pieza manipulable. Los atributos deben añadirse por necesidad jugable, no como catálogo físico exhaustivo.

### 6.3. Interacciones, no recetas aisladas

**[Preferido]** Las máquinas indican qué *clases* de entrada aceptan, qué restricciones aplican y qué salidas producen. Una pieza de chatarra podría ser válida para una fundidora aunque no aparezca en una receta de «chatarra del tanque X». La legibilidad exige mensajes de rechazo explícitos: tamaño incompatible, material no permitido, capacidad insuficiente, etc.

---

## 7. Combate, daño y recuperación de material

### 7.1. Destrucción frente a botín

**[Decidido]** La potencia destructiva y la conservación de recursos deben tensionarse mutuamente:

- **Explosiones masivas:** eliminan grandes grupos con rapidez, pero pueden destruir, dispersar, quemar o inutilizar gran parte del material.
- **Ataques precisos, incluidos láseres bien dirigidos:** pueden incapacitar componentes concretos y dejar una proporción mayor de material útil.
- **Corrosivos:** pueden erosionar parcialmente objetos y dejar restos enteros, chatarra degradada o material perdido; ocupan un espacio intermedio dependiente de intensidad y exposición.

Estos son **perfiles de diseño, no bonos fijos obligatorios**. Un láser lo bastante potente para volatilizar una sección también debería ocasionar pérdidas importantes. Un ataque explosivo leve no destruye por definición toda la carga. Importa el daño aplicado, la localización y el material.

**[Decidido]** Los restos del campo de batalla deben poder alimentar el circuito industrial de reciclaje. Los sistemas de recuperación y los de fábrica **comparten modelo de materiales**, aunque las condiciones de recogida y tratamiento sean distintas.

### 7.2. Ejemplo: tanque parcialmente corroído

Escenario discutido:

1. Un tanque recibe ácido sobre una zona de la carrocería.
2. Una parte relativamente pequeña de metal se pierde o degrada por completo.
3. La estructura deja de ser una sola pieza funcional.
4. Quedan **dos fragmentos grandes**, que aún pueden transportarse o procesarse.
5. Debe calcularse cuánto material aprovechable permanece en cada fragmento.

El mismo problema aparece si un láser o explosión elimina parte de un vehículo. **La pregunta central no es cuántos triángulos dibuja la malla, sino cuánta materia lógica sigue existiendo y en qué estados.**

### 7.3. Componentes lógicos y daño funcional

**[Preferido]** Modelar un vehículo como un conjunto de componentes principales con masas, materiales, zonas aproximadas y uniones:

- Blindaje/carcasa.
- Chasis.
- Motores y transmisión.
- Electrónica y sensores.
- Depósitos/carga, cuando corresponda.

Un ataque puede dejar un módulo íntegro pero desconectado, deteriorarlo parcialmente o destruirlo. Si un motor queda inutilizado, el vehículo pierde movilidad por **regla funcional**, sin requerir simulación física de la avería real.

**[Pendiente]** Granularidad por tipo de unidad, qué piezas son reciclables directamente y cuándo las conexiones se rompen.

### 7.4. Estados de recuperación

**[Propuesto]** Tras un ataque, asignar masa a categorías trazables:

- **Reutilizable:** componente que conserva función o puede repararse.
- **Recuperable como fragmento:** pieza grande aprovechable como materia prima.
- **Chatarra:** material mezclado, deformado, quemado o corroído que requiere tratamiento.
- **Perdido:** materia destruida, disuelta, dispersada irrecuperablemente o excluida por reglas de recogida.

Se deben distinguir **destrucción de la unidad** y **desaparición del material**: un tanque puede quedar fuera de combate y aun así conservar casi toda su masa metálica.

### 7.5. Recolección física y logística

**[Futuro cercano]** Robots o transportadores pueden recuperar componentes del escenario después del combate; debe estudiarse cuándo se autoriza recoger, cuánto cargan, cómo detectan restos, qué riesgos afrontan y cómo se evita saturar el mapa con cientos de entidades.

**[Preferido]** Agrupar fragmentos pequeños en lotes o contenedores de chatarra cuando sea conveniente. Conservar unos pocos restos visibles grandes y una contabilidad precisa sin exigir una entidad física por viruta.

---

## 8. Arquitectura híbrida de destrucción

### 8.1. Tres capas, tres responsabilidades

**[Preferido]** No tratar malla visible, volumen lógico y colisionador como el mismo objeto mutable.

| Capa | Responsabilidad | Técnica candidata |
|---|---|---|
| **Visual** | Mostrar perforaciones, quemaduras, corrosión y roturas. | Malla 3D existente, máscaras de daño, intercambio de piezas, VFX. |
| **Estructural/material** | Decidir conexiones rotas, integridad y masa conservada. | Componentes y zonas; celdas volumétricas gruesas **solo si aportan precisión**. |
| **Colisión/navegación** | Resolver movimiento e interacción con restos y obstáculos. | Primitivas simplificadas o colisionadores reconstruidos localmente. |

La simulación de daño genera un evento; el render lo representa. Las partículas y trozos decorativos nunca son la fuente contable del botín.

### 8.2. Versión mínima sin vóxeles

**[Preferido para comenzar]** Cada componente dispone de masa inicial, material, integridad y zonas de ataque. El golpe calcula pérdida de masa y/o rotura de uniones según arma, energía, distancia, ángulo aproximado y tipo de material. Se producen **pocos fragmentos lógicos** y unas representaciones visuales seleccionadas.

Ejemplo: si un panel se divide en dos zonas conectadas y el ácido destruye la franja entre ambas, pueden aparecer dos fragmentos supervivientes, sin recalcular la topología de una malla CAD con operaciones booleanas complejas.

**Limitación reconocida:** esta aproximación no describe cortes arbitrarios con gran fidelidad geométrica. Puede necesitar información espacial adicional si los jugadores deben elegir exactamente dónde cortar o perforar.

### 8.3. Opción de vóxeles internos de baja resolución

**[Propuesto para investigación]** Usar vóxeles **invisibles**, en coordenadas locales del componente afectado, únicamente para estimar material presente y conexiones después de ataques localizados:

1. Precalcular ocupación o una distribución ponderada de material a partir del volumen/superficie de referencia.
2. Dividir el componente en celdas gruesas, cada una con cantidad de material y estado.
3. Aplicar un volumen de impacto o erosión a las celdas afectadas.
4. Restar la masa perdida/degradada de la contabilidad del componente.
5. Detectar regiones conectadas solo cuando sea necesario separar fragmentos lógicos.
6. Generar o seleccionar **pocas mallas y colisionadores simplificados** para los restos importantes.

**[Importante]** Vóxel **no** significa estética cúbica: las celdas internas pueden seguir ocultas detrás de una malla normal, como se ha contemplado para una muralla destructible. Sin embargo, una capa de vóxeles demasiado gruesa puede representar mal una chapa delgada; quizá se requieran pesos por celda, una representación de superficie o componentes separados.

**[Pendiente]** Resolución adecuada por tipo de objeto. Valores como `8³`, `16³` o `32³` celdas podrían servir para experimentos comparativos, **no** como presupuestos aprobados. La memoria bruta de datos no es necesariamente el cuello de botella: pesan también la actualización de conectividad, mallas, colisiones, navegación y cantidad de entidades simultáneas.

### 8.4. Vóxeles localizados, no un mundo completamente volumétrico

**[Preferido]** Activar detalle espacial solo en componentes que realmente reciben daño localizado o quedan en primer plano. Para unidades distantes o innumerables, mantener componentes y reglas agregadas.

- No simular cada tornillo, viruta o gota corrosiva.
- Limitar número de fragmentos lógicos y visibles por evento.
- Evitar reconstruir mallas y colisiones a cada fotograma de corrosión.
- Procesar erosión de forma incremental o por intervalos discretos.
- Separar el cálculo de botín del efecto gráfico y de los *ragdolls*.
- Conservar semillas/estados para repetir pruebas de ataques.

### 8.5. Relación con la muralla y el terreno

**[Propuesto]** Reutilizar el mismo principio de **volumen/celdas internas + superficie visible** en zonas destructibles de la muralla, pero adaptar granularidad y colisiones al tamaño de esa estructura. No convertir por ello toda la superficie del mapa en vóxeles.

**[Futuro]** La excavación libre de túneles es otro problema volumétrico distinto y más amplio. Se ha preferido investigarla con vóxeles por regiones y extracción de malla, pero **no forma parte del próximo prototipo**.

---

## 9. Visualización del daño y lenguaje artístico

### 9.1. Marcas y estados de daño

**[Preferido]** Empezar por **máscaras de daño** reutilizables y parametrizables. Permiten mostrar tizne, quemaduras, impactos y corrosión sin producir texturas completas nuevas por cada estado. Si el experimento lo requiere, combinar con unos pocos decals para daños significativos.

Como alternativa sencilla anterior se propusieron niveles de apariencia de `100 / 75 / 50 / 25 / 10 %`. No deben confundirse esos niveles visuales con particiones exactas de masa o integridad lógica.

**[Decidido]** El daño funcional permanece desacoplado de la apariencia: la máscara puede indicar gravedad del golpe, pero no determinar qué motor se detuvo ni cuánto metal es recuperable.

### 9.2. Robots y maquinaria

**[Decidido para la dirección visual actual]** La **naturaleza** y los objetos ambientales estáticos pueden emplear **Gaussian Splats estáticos** con intención muy realista; los **robots y maquinaria activa** se representan mediante **modelos 3D animados**. Se evita animar splats por costes y complejidad.

**[Decidido]** En la representación 2D, los robots deben ser **iconos vectoriales muy legibles desde arriba**, sin obligación de estética retro/pixel art:

- **Obrero básico:** chasis azul y brazo robótico blanco, animación simple de extensión del brazo.
- **Montacargas:** cuerpo rojo con frontal recortado, dos uñas negras con reflejo gris, cuatro ruedas y base de ejes coherente; variante visual cuando transporta una pieza.
- **Estados:** ámbar = espera/inactivo; verde = ejecutando; azul = control maestro; rojo reservado para daño o ataque.

**[Decidido en exploración visual]** Para las **máquinas** es útil una inclinación isométrica ligera en vez de la misma vista estrictamente cenital de los robots: facilita entender prensas, moldes, crisoles, estructuras y entradas/salidas.

### 9.3. Naturaleza y destrucción ambiental

**[Decidido]** Splats **estáticos** para árboles, arbustos, pasto y rocas; no splats animados como base de fauna, robots o máquinas. Cuando un objeto natural se destruye: **ocultar/reemplazar**, generar VFX apropiados, actualizar la apariencia del suelo (quemado/alterado) y mantener una colisión lógica simple e invisible mientras corresponda.

Esta decisión es posterior al documento gráfico del 7 de noviembre, que aún dejaba sin decidir el bioma. **El recurso visual de naturaleza ultrarrealista está definido, pero no quedan fijados el bioma exacto, la distribución ambiental ni cada elemento del mapa.**

### 9.4. Construcción y combate táctico

**[Preferido]** Diferenciar el estado de construcción/producción de un combate táctico visualmente más abstracto: estética oscura tipo **Tron**, cuadrícula, líneas brillantes y reducción de decoración que distraiga. El cambio puede ser automático y debe conservar información de obstáculos y posiciones.

**Importante:** apagar colores por sí solo **no mejora necesariamente el rendimiento**. Para obtener ahorros reales hay que reducir trabajo de luces, sombras, transparencias, detalle ambiental o posprocesado y medirlo.

---

## 10. Terreno, mapas y edición (decisiones previas relevantes)

**[Preferido]** Mantener un **editor mínimo de terreno**, útil para unos pocos mapas de prueba; no convertirlo en una herramienta generalista que retrase el juego.

- Campo de alturas editable: elevar, bajar, suavizar y aplanar.
- Posibilidad de comparar superficies escalonadas e interpoladas.
- Pintura de materiales con máscaras o texturas exportables y reimportables.
- Fuente editable en JSON; imágenes PNG para alturas o materiales.
- Uso con mouse y, si es viable, stylus/S Pen; deshacer/rehacer y controles de cámara adecuados.
- Geometría visual y cuadrícula lógica independientes para controlar resolución.

**[Decidido previamente]** La estética *low-poly* no es un requisito permanente; es una opción de rendimiento y diseño. Los pocos mapas de prueba pueden incluir murallas, terreno elevado y zonas con características diferenciadas, pero el escenario final no se da por cerrado.

**[Futuro]** Túneles excavables, material por profundidad y navegación regional. La NavMesh se actualiza a partir del terreno, no es la geometría primaria ni sustituto de los datos volumétricos.

**[Nota de ingeniería]** El documento del 7 de noviembre evaluó un editor con licencia ISC como candidato de referencia y advirtió no copiar otro proyecto público sin licencia identificada. Mantener esta cautela si se reutilizan implementaciones externas.

---

## 11. VFX y tecnologías avanzadas: conservar sin bloquear el prototipo

### 11.1. Explosiones convencionales

**[Preferido]** Efectos híbridos económicos: destello, fuego y humo mediante shaders, flipbooks, partículas y geometrías instanciadas; variantes que compartan recursos. El objetivo es que las explosiones sean espectaculares, pero **repetibles y escalables**.

- Reutilizar instancias (*pooling*).
- Limitar transparencias y *overdraw*, no solo triángulos.
- Priorizar efectos importantes y reducir los secundarios según distancia y carga.
- Separar daño lógico de VFX.
- Medir escenas con una y muchas explosiones antes de fijar límites.

**[Decidido]** Los Gaussian Splats **estáticos de naturaleza** no implican utilizar splats animados para explosiones. Esta línea sigue pospuesta: no se ha demostrado que secuencias de splats sean más económicas que VFX convencionales.

### 11.2. Agujero negro y tecnologías extremas

**[Futuro; no bloqueante]** Mantener los conceptos avanzados como referencia de progresión tecnológica, no como dependencia de la primera línea de fabricación:

- Microagujero negro **diminuto**, eléctricamente cargado, flotando por repulsión frente al suelo cargado por un arma eléctrica.
- Poder que **crece de forma no lineal** al fusionar agujeros y absorber masa; riesgo de una condición crítica catastrófica.
- **Sin anillo de acreción estable** como decoración permanente (esta decisión posterior sustituye la propuesta de disco fijo del plan VFX del 10 de noviembre).
- Rayos eléctricos **escasos y discretos**, del núcleo al suelo, como en una lámpara de plasma.
- Posibilidad de **anillo transitorio de plasma** durante absorción de piezas, no disco persistente.
- Distorsión espacial visual y deformación/destrucción muy breve y simplificada, sin simulación relativista completa.
- Referencia conceptual a la radiación Hawking dentro de reglas de ciencia ficción explícitas.

**[Futuro]** Materiales ultradensos y acelerador de partículas pueden ser rutas tecnológicas relacionadas. Los procedimientos detallados, costes y reglas de combate quedan para un diseño específico posterior.

### 11.3. Blender y cinemáticas

**[Futuro]** Geometry Nodes y efectos complejos de deformación, disolución o ácido pueden servir para **cinemáticas de desbloqueo**; no se asume su reproducción directa en tiempo real en el motor web.

### 11.4. Renderer

**[Preferido]** Conservar el juego funcional mientras se estudia una evolución gradual hacia **WebGPU**, con ruta de compatibilidad WebGL cuando sea viable. Revisar shaders, materiales y posprocesado antes de migrar; no declarar resuelta la compatibilidad sin inspección y pruebas.

---

## 12. QA, rendimiento y reproducibilidad

### 12.1. Motivo de la arquitectura contenida

**[Decidido]** Una simulación física de alta libertad puede romperse ante interacciones difíciles de prever: colisiones en esquinas, piezas que salen disparadas, geometría degenerada, pérdidas de sincronización, materiales duplicados o comportamientos absurdos. El volumen de QA crece al añadir sistemas interdependientes.

El objetivo no es eliminar descubrimientos sorprendentes, sino distinguir entre:

- **Interacción emergente legítima:** consecuencia reproducible de las reglas y restricciones.
- **Comportamiento inesperado aceptable:** resulta coherente y podría conservarse tras evaluarlo.
- **Exploit/defecto:** viola invariantes, genera recursos, ignora restricciones o depende de errores numéricos/colisiones.

**[Preferido]** Implementar pruebas de propiedades e interacciones reproducibles desde los primeros prototipos, no posponerlas hasta tener toda la física.

### 12.2. Invariantes de simulación

Pruebas que deberían poder automatizarse:

1. **Conservación de masa:** entrada = producto + subproducto + pérdidas registradas.
2. **No duplicación:** el mismo lote no puede retirarse o reciclarse dos veces.
3. **Inventarios válidos:** nunca hay masa negativa ni excedente silencioso sobre capacidad.
4. **Procesos compatibles:** ninguna máquina procesa material, forma o cantidad fuera de su contrato.
5. **Semilla fija:** el mismo estado y las mismas acciones dan el mismo resultado cuando el sistema declara ser determinista.
6. **Daño consistente:** las masas de componentes y fragmentos no superan las originales más cualquier adición explicada.
7. **Estado funcional y visual desacoplados:** desactivar VFX no cambia daño ni botín.
8. **Estabilidad:** repetir erosiones pequeñas o impactos sucesivos no corrompe mallas, colisionadores ni estados.

### 12.3. Casos de prueba específicos

- Prensa una placa → corta perímetro → devuelve sobrantes → refunde → crea otra placa.
- El depósito de sobrantes se llena: la fábrica responde con pausa, desvío o alerta, no desaparece material.
- Dos máquinas solicitan el mismo lote: solo una lo consume.
- Cambio entre sierra y láser: misma receta final, distinto tiempo/energía según parámetros.
- Tanque corroído en una zona: dos fragmentos grandes, masa contable y colisión funcional.
- Corte con láser en un borde pequeño: no aparecen velocidades o fragmentos absurdos.
- Destrucción total de un componente: no reaparece material por fallo de redondeo.
- Ataque repetido sobre un componente ya destruido: sin doble generación de botín.
- Explosión extensa frente a disparo preciso: diferencias coherentes de supervivencia y recuperación.
- Alternar calidad gráfica: mismo resultado de simulación.

### 12.4. Perfilado

**[Pendiente]** Medir prototipos representativos en hardware real; **no fijar presupuestos de unidades, vóxeles, fragmentos o FPS por intuición**.

Registrar, cuando sea posible: tiempo de simulación, tiempo de renderizado, percentiles de fotograma, número de entidades activas, partículas, actualizaciones de malla, colisionadores reconstruidos, inventario y memoria. Ejecutar pruebas con daño individual y ataques simultáneos, en cámara cercana y lejana.

**[Preferido]** Resolver el detalle donde importa: módulos afectados, fragmentos próximos, armas activas. Reducir efectos y representación a distancia sin modificar silenciosamente los resultados económicos.

---

## 13. Siguiente gran prototipo: corte vertical propuesto

Este apartado es una **propuesta de selección de alcance** basada en las decisiones anteriores; no constituye una instrucción para modificar el repositorio.

### A. Producción circular mínima

1. Una placa de metal con masa conocida.
2. Prensa que conforma una semiesfera.
3. Dos opciones de corte: sierra lenta/barata y láser rápido/caro en energía.
4. Salidas separadas: producto y recortes.
5. Almacén de recortes con acumulación visible.
6. Fundidora que convierte recortes en materia aprovechable.
7. Regreso del material a fabricación de nuevas placas.
8. Programación mínima para decidir destinos y evitar bloqueos.

**Validar:** el jugador entiende el subproducto, el coste energético, la acumulación y la utilidad del reciclaje sin necesitar física exacta.

### B. Un experimento aislado de daño y recuperación

1. Un vehículo sencillo dividido en pocos componentes con masas definidas.
2. Tres perfiles abstractos de ataque: explosivo, preciso y corrosivo.
3. Resultado lógico: unidad dañada, componentes supervivientes, fragmentos y pérdidas.
4. Una máscara visual de daño y pocos restos visibles grandes.
5. Recuperación y envío a fundición usando el **mismo modelo de material** que el proceso industrial.

**Validar:** dos trozos grandes de un tanque parcialmente erosionado tienen cantidades de metal coherentes y el resultado no depende del número de triángulos del modelo.

### C. Comparación técnica limitada

1. Primera versión por **componentes/zonas sin vóxeles**.
2. Solo si falla la fidelidad necesaria: comparación con **vóxeles internos gruesos por componente**.
3. Pruebas de tiempo, memoria, colisiones, conectividad y facilidad de QA.
4. No generalizar a todas las unidades antes de tener mediciones.

**Validar:** el incremento de complejidad compra una mejora visible/jugable, no solamente precisión teórica.

### D. Lectura visual

1. Modelos 3D de maquinaria y robots; iconos 2D claros.
2. Residuos distinguibles de productos útiles.
3. Daño visual coherente con la contabilidad lógica.
4. Naturaleza estática y efectos bajo presupuesto medido, si el mapa de prueba lo requiere.
5. Comparar una vista de operación normal con la lectura táctica cuando aplique.

### Fuera de este corte vertical

Simulación molecular, deformación real por elementos finitos, fractura 3D de resolución arbitraria, túneles excavables, producción de todas las ramas tecnológicas, singularidades completas y animación volumétrica de splats. Documentar su compatibilidad conceptual sin bloquear la iteración actual.

---

## 14. Registro resumido de decisiones y preguntas abiertas

| Tema | Criterio actual | Pregunta que falta resolver |
|---|---|---|
| Jugabilidad emergente | Reglas cerradas + combinaciones abiertas | ¿Qué tipos de entrada/salida deben ser universales? |
| Fabricación de carcasa | Placa → prensa → corte → semiesfera + recortes | ¿Masas, espesores y clases de forma? |
| Reciclaje | Subproducto normal, acumulación y retorno a fundición | ¿Rendimientos y restricciones logísticas? |
| Campaña inicial | Mostrar el problema antes de ofrecer solución tecnológica | ¿Cuándo se vuelve evidente sin frustrar? |
| Sierras/láseres | Sierra lenta y de bajo consumo frente a láser rápido y de alto consumo | ¿Curva de coste y otras diferencias de proceso? |
| Árbol láser | Herramienta industrial → armamento → superarma | ¿Desbloqueos y dependencias exactas? |
| Química | Reglas de corrosión reutilizables en industria y combate | ¿Atributos y alcance mínimo de sustancias? |
| Botín de guerra | Daño preciso favorece supervivencia; destrucción extrema reduce recuperación | ¿Fórmulas y tratamientos para cada material? |
| Fragmentación | Componentes + pocos fragmentos visibles | ¿Cuándo se necesita geometría más libre? |
| Vóxeles | Opción interna local, no requisito universal | ¿Resolución y beneficio frente a zonas lógicas? |
| Naturaleza | Gaussian Splats **estáticos** | ¿Coste y tamaño real de los recursos? |
| Robots/máquinas | 3D animado + iconos 2D vectoriales | ¿Plantillas reutilizables y lectura a escala? |
| QA | Invariantes, semillas y pruebas de interacción | ¿Conjunto mínimo automatizado para cada mecánica? |
| Rendimiento | Medir antes de fijar presupuestos | ¿Cuántos elementos simultáneos admite el objetivo de hardware? |

> **Síntesis para el prototipo:** una fábrica capaz de **fabricar, generar sobrantes, reciclar y decidir rutas mediante programación**; un sistema de combate capaz de **dañar componentes y conservar/destruir cantidades coherentes de material**. La misma contabilidad conecta ambos entornos. La libertad jugable se concentra en cómo se combinan los sistemas, no en simular cada deformación física.

---

## 15. Referencias internas y precedencia de decisiones

Este documento consolida las conversaciones de diseño hasta el **23 de noviembre de 2026** y toma como antecedentes:

- `Code_Battle_Lite_vision_grafica_y_decisiones_2026-11-07.md` — terreno, modo táctico, daño, botín y alcance del editor.
- `plan_vfx_explosiones_black_hole.md` (10-nov-2026) — arquitectura modular VFX, WebGPU y planificación de explosiones, **con correcciones posteriores** al aspecto del agujero negro.
- Conversaciones posteriores sobre sprites de obrero y montacargas, prensa/fundición, naturaleza con Gaussian Splats estáticos y fabricación de la torreta esférica.
- Conversación de diseño actual sobre subproductos, ramas tecnológicas, física simplificada, reciclaje del campo de batalla y vóxeles internos.

**Precedencia:** decisiones posteriores explícitas prevalecen sobre propuestas anteriores. Así, la naturaleza con splats **estáticos** sustituye las dudas visuales previas sobre el tratamiento del escenario natural; y el agujero negro **sin disco de acreción estable** sustituye su representación como anillo fijo en el plan VFX antiguo. Las dudas de implementación se mantienen como tales hasta inspección o prueba.
