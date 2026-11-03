# Visión de War Factory y Campaign

Decisiones, propuestas e ideas del autor para el juego que saldrá de unir Factory y War. Recoge el feedback del 2 de noviembre de 2026, ordenado el 3 de noviembre. Versión visual: [vision-campana.html](vision-campana.html).

**Nada de este documento se implementa todavía.** El trabajo técnico actual es la unificación de Factory y War, descrita en [`docs/PLAN-UNIFICACION.md`](../../PLAN-UNIFICACION.md). Este documento marca la ruta de lo que hay que probar de camino a Campaign y conserva las ideas para futuras iteraciones.

## Cómo leer este documento

| Estado | Significado |
| --- | --- |
| **Decidido** | Confirmado por el autor. Orienta el diseño. |
| **Dirección** | El sentido está confirmado; los detalles no. |
| **Propuesta** | Dirección preferida, sujeta a prototipos y pruebas. |
| **Exploración** | Idea que se conserva sin obligaciones técnicas. |
| **Pendiente** | Necesita una decisión, normalmente después de un prototipo. |

Las propuestas de los análisis de `docs/analisis/`, las recomendaciones de agentes y los ejemplos de este documento no son decisiones del autor. Los ejemplos de código son conceptuales, no sintaxis definitiva.

No fijar todavía: el tamaño del mapa, si Campaign será un mapa de casillas pequeñas o un mundo abierto, cantidades de unidades, límites de construcción, costes, resistencias ni recetas.

## 1. Principio central

**Un programa pequeño debe producir consecuencias grandes, visibles y comprensibles en el mundo del juego.** Es probablemente lo que más puede diferenciar a Code Battles Lite / War Factory.

El jugador no escribe código solo para dar órdenes. Observa cómo unas pocas líneas producen comportamientos complejos:

- robots que modifican sus rutas de suministro;
- fábricas que cambian su producción;
- torretas que cambian sus prioridades de ataque;
- grupos de máquinas que se coordinan;
- robots industriales que responden a una emergencia militar;
- sistemas enteros que se comportan distinto después de cambiar una función.

La relación causa-efecto entre código y simulación debe ser especialmente clara, y el juego debe seguir siendo legible aunque los sistemas crezcan. La programación es una herramienta poderosa que transforma el mundo, no una barrera artificial que impide jugar.

### Aprender por consecuencias

El juego nace como una experiencia de aprendizaje de programación. La enseñanza ocurre mediante consecuencias observables:

- un `await` cambia la temporalidad de una operación;
- un `while (true)` mantiene funcionando una máquina;
- un `if` provoca un cambio de comportamiento;
- una variable guarda información que después queda desactualizada;
- una función reutilizable puede gobernar varios robots;
- una decisión de producción afecta a la capacidad defensiva;
- un sensor diferente modifica la efectividad del mismo armamento.

La progresión permite descubrir estas relaciones sin exigir conocimientos avanzados desde el principio.

**Decidido:** los tutoriales enfatizan que `await` introduce temporalidad y sincronización, y distinguen las acciones que requieren esperar de las lecturas y los cambios de modo instantáneos.

## 2. Narrativa

Ninguna de estas visiones es todavía la historia definitiva.

### 2.1. Visión original de Codemageddon · exploración histórica

Una historia sobre las maneras en que una inteligencia artificial podría llegar a dominar a la humanidad. La progresión exploraría métodos:

- pacíficos o aparentemente beneficiosos;
- pasivos, ligados a la dependencia tecnológica;
- políticos, económicos y administrativos;
- coercitivos;
- abiertamente militares.

Se contemplaba un modelo básico de decisiones (provisionalmente, «tipo JEV») donde las respuestas del jugador, relativamente libres, se interpretarían para elegir el camino dentro de un árbol de decisiones controlado y predominantemente determinista. Estaba más centrada en política, gobernanza y consecuencias que en combate.

Sigue siendo interesante, pero su magnitud narrativa y técnica no encaja con los objetivos inmediatos. Se conserva como referencia.

### 2.2. Mundo poshumano · alternativa abierta

Los humanos ya no existen o han dejado de ser protagonistas. El mundo lo habitan organizaciones o facciones de robots; el jugador pertenece a una y desarrolla sus capacidades industriales y militares mientras compite o combate con otras.

Ventajas: no hace falta representar sociedades humanas, los conflictos militares son fáciles de justificar, los enemigos pueden ser solo robóticos, hay libertad para tecnologías artificiales y la narrativa depende menos de política compleja. No se descarta.

### 2.3. Instalación industrial militar en una frontera · propuesta preferida

Una experiencia de escala moderada en un mundo donde dos grandes polos políticos mantienen un conflicto militar. El jugador administra una organización industrial y militar relativamente autónoma, posiblemente descentralizada del gobierno, con economía propia y posibles subsidios, contratos o recursos estatales. Su instalación está cerca de una frontera militar y tiene dos responsabilidades:

1. fabricar armamento, municiones, suministros y componentes;
2. usar esos recursos para proteger la instalación y responder a los ataques.

**La producción industrial y la defensa militar forman un mismo sistema jugable.** La fábrica no es un menú secundario ni un minijuego aparte: sostiene la capacidad de combate. La defensa tampoco es aislada: genera demanda de producción, mantenimiento y logística.

Por qué se prefiere:

- integra naturalmente Factory y War;
- permite narrativa sin una campaña gigantesca;
- justifica económicamente la fabricación de armas y da contexto a los costes;
- ofrece objetivos claros;
- reduce la variedad de entornos, enemigos y tecnologías que construir al principio;
- conserva algo de lo político de la visión original;
- facilita un mapa persistente y reconocible.

Una progresión posible, no aprobada: empezar cumpliendo contratos industriales, enfrentar ataques limitados y terminar administrando una instalación con más autonomía y responsabilidades militares.

### 2.4. Historia sin sobrecargar el desarrollo · dirección

El autor quiere seguir explorando la historia. No se elimina la posibilidad de conflictos políticos, decisiones narrativas o consecuencias ligadas a la autonomía de las máquinas. Se busca una narrativa con propósito, subordinada al alcance realista del proyecto. Puede bastar una historia de escala local que refleje tensiones mayores, sin representar el mundo entero.

## 3. Escala y mapa

**Propuesta:** una experiencia mucho más acotada que Factorio o Age of Empires. Ni mundo abierto gigantesco ni miles de unidades.

Tampoco se imponen las dimensiones de las demos: 9 × 7 (Factory) y 32 × 18 (War) son parámetros de los prototipos, probablemente pequeños para la campaña. Se piensa en una instalación compacta o moderada, con espacio para producción, almacenes, logística, defensas, murallas o perímetros, un frente de combate, y controladores y redes de comunicación.

**Pendiente:** dimensión definitiva, continuidad espacial y grado de persistencia del mapa. Se decide con prototipos.

## 4. Reglas ya decididas que afectan a Campaign

Estas reglas se aplican durante la unificación (ver el plan). Se repiten aquí porque condicionan todo lo demás.

- **Un mundo común** · decidido. Factory y War comparten una base de simulación; fábrica y defensa interactúan en el mismo mundo.
- **Encargos, modos y lecturas** · decidido. Los encargos consumen tiempo y se esperan; los modos se configuran al instante y siguen funcionando; las lecturas no avanzan el tiempo. Las máquinas siguen operando mientras su programa espera.
- **Victoria por metas del mundo** · decidido. Un `while (true)` no fracasa si las metas ya se cumplieron. Se quiere incentivar programas que mantengan operaciones continuas y eficientes; las máquinas industriales se benefician de bucles permanentes. Los límites contra bloqueos siguen y no son una penalización por continuidad.
- **`null` y `0`** · decidido conceptualmente. `0`: la máquina existe y no tiene material. `null`: la máquina fue destruida o ya no existe, por un ataque, una decisión del jugador o un error de gestión. En un sensor, `null` sigue siendo «no detectó nada». El significado se documenta por operación.
- **Destino lleno** · decidido. La carga se queda en el robot y el resultado dice que no se pudo entregar.
- **API en inglés** · decidido provisionalmente. Selector de idiomas más adelante. Máquinas referenciables por nombre o variable; una máquina que se programa a sí misma no escribe su nombre, `yo.` ni `self.`.
- **Azar industrial bajo** · dirección. La fábrica no obliga a resolver incidentes constantes. Una máquina puede tener una tendencia conocida a pedir mantenimiento tras cierto número de ciclos, pero las averías ordinarias son raras. En combate, los ataques sí dañan y destruyen instalaciones. La gestión de suministros no debe eclipsar la parte visualmente interesante de las batallas: la economía y la coordinación son el desafío, no las averías.
- **Economía relevante** · dirección. Costes de fabricación, suministro, recursos y mantenimiento como métricas. No se optimiza solo la velocidad: los retos mixtos valorarán la eficiencia económica, con fórmula pendiente. Sin mercado, monedas ni sistema financiero completo por ahora.
- **Percepción limitada y progresiva** · dirección. Primero consultas fáciles y fiables; después sensores con alcances y limitaciones distintos. La gestión avanzada de sensores es un reto añadido, no una exigencia de los primeros minutos.

**Pendiente:** qué pasa con las referencias, los programas y las consultas cuando una máquina es destruida o desmontada.

## 5. Armas, sensores y proyectiles

### 5.1. Sistema actual de War · decidido conservar

Los misiles tienen origen, destino, velocidad, tiempo de vuelo, explosión al llegar y radio de daño. `autoTarget()` predice la posición futura de un enemigo con su movimiento conocido, pero el misil mantiene un destino fijo una vez lanzado. Los impactos se evalúan por la distancia de los enemigos al punto de explosión, sin resolver colisiones durante el vuelo. Es la base actual; no se implementa un motor físico complejo.

### 5.2. Sensores y armamento diferenciables · propuesta aprobada

Distintos sensores y tecnologías de disparo sobre una misma plataforma, sin una clase de robot nueva para cada combinación. Sensor, velocidad de actualización y tipo de arma son sistemas separables. Ejemplos:

- torreta económica con sensor estándar y proyectiles convencionales;
- torreta con sensor de actualización más rápida;
- torreta con percepción que conserva la identidad del objetivo;
- disparo láser de impacto prácticamente instantáneo;
- armamento avanzado con seguimiento o predicción más sofisticados.

### 5.3. Dos niveles de seguimiento · dirección conceptual

- **Por posición**: para enemigos lentos o de velocidad estándar. El sensor entrega coordenadas y el disparo va hacia ellas. El jugador aprende que una posición puede quedar desactualizada.
- **Por identidad**: para enemigos ágiles, robots articulados o unidades que esquivan. El sistema conserva la identidad del objetivo y actualiza su posición, respetando alcance y limitaciones de percepción: conocer un identificador no da visión perfecta.

**Pendiente:** las tecnologías concretas para implementarlo.

### 5.4. Cinemática inversa y físicas · exploración

Cinemática inversa (IK) para las extremidades de robots articulados, sobre todo cuadrúpedos ágiles: locomoción convincente y reacciones visualmente comprensibles sin un simulador físico sofisticado. No se ha decidido cuánto debe avanzar la física. IK no implica física de cuerpos rígidos, colisiones complejas ni dinámica avanzada. Se evaluará con pruebas gráficas y jugables.

## 6. Programación, reutilización y Control Maestro

### 6.1. Programación local · dirección

Cada máquina programable puede tener su propio programa y, desde su editor, invoca sus funciones directamente, sin referenciarse a sí misma.

### 6.2. Reutilización de programas · propuesta preferida

Evitar que el jugador copie y pegue el mismo código en varios robots. Los programas podrían tener nombre y reutilizarse como funciones, plantillas o comportamientos asignables a otras unidades.

```js
// Comportamiento definido una vez (sintaxis no definitiva)
async function recogerCobre() {
  await recoger(ENT_1, "cobre");
  await entregar(FUN);
}

// Un controlador lo asigna a un grupo
grupoCobre.recogerCobre();
```

Una sola modificación debe poder alterar el funcionamiento de varias máquinas.

### 6.3. Control Maestro físico · propuesta preferida para Campaign

Una unidad del mundo, provisionalmente «Control Maestro», no un editor global invisible. Un edificio o dispositivo con:

- alcance de comunicación inalámbrica;
- conexión posible por fibra óptica y enlaces físicos entre instalaciones;
- capacidad para coordinar máquinas y grupos;
- posibles límites de concurrencia o capacidad;
- vulnerabilidad ante ataques.

Tender fibra podría ser una construcción sencilla, comparable a colocar postes de energía en Factorio, sin copiar su representación. El jugador podría tener un controlador o una red de controladores.

### 6.4. Disponibilidad y progresión · propuesta

- El primer controlador es accesible pronto.
- Más concurrencia, redundancia y cobertura cuestan más.
- Los ataques al controlador llegan cuando el jugador ya pudo desarrollar recursos o respaldos. Perderlo no debe ser devastador antes de haber enseñado a protegerlo.

### 6.5. Prioridad entre programa local y maestro · pendiente de prototipo

Si un robot tiene programa local y recibe órdenes del maestro, hay que resolver los conflictos. Opciones a experimentar:

- el programa local tiene prioridad;
- el maestro tiene prioridad;
- el jugador elige la prioridad;
- el maestro envía señales y los programas locales reaccionan con condiciones;
- el maestro activa temporalmente una rutina alternativa.

Ejemplo: ante un ataque extraordinario, el controlador recluta robots industriales para defender una zona. No se decide si eso pausa, sustituye o interrumpe el programa local; el autor lo considera difícil de decidir sin una demostración jugable.

### 6.6. Señal visual del control remoto · propuesta

Un indicador reconocible cuando un robot está bajo control remoto, que permita distinguir robots autónomos, robots coordinados por un controlador y cambios de control. Referencia conceptual: la señal que distingue a los robots controlados centralmente en *I, Robot*. Sin diseño, color ni efectos definidos.

## 7. Logística industrial y abastecimiento militar

### 7.1. El suministro automático actual es temporal · decidido

La recarga automática de munición y la reparación autónoma de War son simplificaciones del prototipo y sus tutoriales. En Campaign, el jugador organiza producción, distribución y mantenimiento: la munición sale de almacenes e instalaciones industriales, y los reparadores (cuántos, qué tareas, cómo se comportan) son responsabilidad suya. El cambio pertenece a los escenarios mixtos y no debe romper los retos actuales de War.

### 7.2. Bandas transportadoras · decidido incluirlas, con limitaciones

Se pensó reducirlas o eliminarlas para diferenciarse de Factorio, pero su utilidad para llevar munición en grandes cantidades hace difícil justificar su ausencia. Se permiten, sin que sean la respuesta óptima a todo: son eficientes en rutas fijas; los robots aportan adaptabilidad, coordinación, reutilización de comportamientos y cambios de producción. No se castiga al jugador por construir bandas: se le dan motivos positivos para usar robots.

### 7.3. Primera limitación: vulnerabilidad militar · decidido conceptualmente

Las bandas convencionales pueden destruirse en un ataque y **no se reparan durante el mismo combate**. Las rutas fijas se vuelven puntos vulnerables: una fábrica que depende de una sola línea puede quedar inutilizada temporalmente. El jugador valora rutas alternativas, reservas de munición y abastecimiento más flexible.

### 7.4. Túneles reforzados · propuesta definida

Una cinta instalada bajo tierra, en un túnel reforzado tipo búnker. Se construye y despliega casi igual que una cinta normal, con un indicador visual claro de que la sección está excavada y reforzada. Sin sistema de excavación manual.

Propiedades propuestas:

- coste de construcción extremadamente alto;
- resistencia muy superior a los ataques comunes;
- destrucción posible, de forma excepcional, con ciertos proyectiles especializados;
- construcción sencilla desde la interfaz;
- identificación visual clara.

Debe ser poco viable para redes extensas. Su uso es proteger corredores críticos: munición para torretas, posiciones defensivas en murallas, unidades o instalaciones militares críticas. **Intención:** rutas prácticamente seguras cuyo coste haya que justificar; un problema económico y estratégico, no una prohibición arbitraria.

**Pendiente, sin inventar valores:** costes, resistencia, proyectiles capaces de destruirlos, sistema de construcción, reparación después del combate y daños parciales.

## 8. Segunda limitación: producción adaptable y no necesariamente lineal

**Exploración importante y deliberadamente abierta.**

La intención es que los robots y la programación avanzada sean claramente superiores a una fábrica hecha solo de rutas fijas y bandas cuando el proceso productivo necesita cambiar. Se contempla que las máquinas se configuren de formas distintas: cambiar la secuencia de operaciones, la combinación de materiales o la configuración final podría cambiar el producto.

El autor tiene reservas importantes. Una fabricación demasiado no lineal perjudica el realismo relativo que se quiere mantener: no es fácil justificar que cambiar arbitrariamente el orden de procesar materias primas produzca armas completamente distintas. No se aprueba una mecánica donde cualquier combinación dé resultados distintos. **La meta es favorecer la flexibilidad industrial programada sin convertir la fabricación en alquimia injustificada.**

### 8.1. Alternativa A · obsolescencia y contramedidas tecnológicas

Las primeras armas pierden utilidad conforme avanza el conflicto:

- al principio, proyectiles y munición convencional;
- después, armas láser;
- el enemigo desarrolla contramedidas contra los láseres;
- el jugador vuelve a combinar armamento convencional y tecnológico;
- la fábrica adapta su producción a las nuevas necesidades.

Atractiva porque justifica los cambios con una evolución tecnológica creíble y evita que la mejor arma sustituya para siempre a las anteriores. Favorece combinaciones de tecnologías sobre progresiones lineales. *Exploración.*

### 8.2. Alternativa B · materias primas comunes y tecnologías finales variadas

Varias clases de armas comparten casi toda la cadena de materias primas; las diferencias aparecen en las etapas finales. Una cadena inicial produce componentes metálicos, electrónicos o energéticos usados por muchas armas, y solo las máquinas finales cambian ensamblaje, configuración o integración. Fábrica relativamente realista, mucha variedad de productos, sin construir cadenas completas para cada arma nueva. El reto pasa a ser distribuir materiales comunes hacia distintas tecnologías finales. *Exploración, especialmente compatible con el realismo deseado.*

### 8.3. Alternativa C · restricciones de tamaño de fábrica

El espacio disponible como límite que favorezca máquinas multifunción y robots: en poca superficie no cabe una línea independiente por arma. No termina de convencer: el jugador podría sentir que se le impide construir en lugar de descubrir una alternativa superior. La programación debe parecer poderosa, no las bandas artificialmente castigadas. Puede combinarse con otras mecánicas, pero no debería ser la justificación principal. *Exploración con reservas.*

### 8.4. Alternativa D · mercado y demanda variable

El mundo demanda distintas armas y componentes; precios y contratos cambian según las necesidades militares, la disponibilidad o la evolución del conflicto. Ejemplo: una instalación fabrica proyectiles, pero un contrato hace más rentable producir sensores o componentes para drones; en lugar de reconstruir la línea, el jugador reorganiza con robots y programas reutilizables. Conecta la flexibilidad industrial con la economía, uno de los enfoques principales de War Factory, y permite eventos narrativos y decisiones sin un sistema político complejo. *Exploración.*

### 8.5. Alternativa E · materiales o elementos fantásticos

Deliberadamente especulativa: algo semejante a combinar cuatro elementos fundamentales, donde combinaciones y secuencias producen armas con propiedades únicas (daño, alcance, efectos, comportamiento). Gran potencial jugable porque incentiva experimentar constantemente con la producción. Es la que menos convence en coherencia con el mundo: su componente fantástico choca con el realismo relativo. No es la dirección elegida, pero se conserva por sus ventajas para el diseño de sistemas. *Exploración de baja preferencia narrativa y alto potencial mecánico.*

## 9. El objetivo real: superioridad de los robots por programación

**Principio central.** Una de las ideas más importantes del proyecto.

La superioridad de los robots frente a una fábrica rígida debe manifestarse cuando el jugador puede **cambiar radicalmente su producción modificando solo unas cuantas líneas de código**.

Una fábrica tradicional que quiere fabricar algo distinto puede necesitar nuevas bandas, cambios de distribución, maquinaria dedicada y una reconstrucción parcial del flujo. Con una fábrica intensiva en robots programables, el jugador podría modificar uno o varios programas del Control Maestro para producir un arma completamente distinta, o pasar de un solo producto a varios tipos de armamento en cantidades más equilibradas, sin reconstruir grandes secciones. El cambio debería ser tan sencillo como modificar una función, unos parámetros o la asignación de grupos de robots.

Un cambio pequeño en el software puede reorganizar a muchos robots, modificar rutas, reasignar materiales y cambiar los productos finales. Por ejemplo: un grupo de robots fabrica proyectiles convencionales; llega la información de que el enemigo desarrolló defensas contra ese armamento; en lugar de parar y construir otra fábrica, el jugador modifica el programa maestro para dedicar parte de los robots a un producto nuevo. El mismo sistema podría ajustar la proporción de fabricación según las condiciones del mundo.

No se pretende eliminar las bandas ni las máquinas especializadas. Una banda puede ser extremadamente eficiente cuando el flujo es constante y predecible. **La diferencia está en la adaptabilidad**: las bandas pueden ser superiores en producción estable de gran volumen; los robots, cuando hay que cambiar productos, prioridades, rutas o procesos. Pueden coexistir: bandas para grandes cantidades de materiales comunes, robots para operaciones variables o redistribución.

El jugador debe sentir que programar es una ventaja tecnológica real. No se le obliga a reemplazar bandas por robots con restricciones arbitrarias: descubre que puede hacer mucho más con la misma infraestructura cuando sabe programarla.

Enlaza con la visión educativa (unas pocas líneas con consecuencias grandes, visibles y comprensibles) y con la fantasía de progreso tecnológico: una fábrica simple, con procesos manuales o poco flexibles, evoluciona hacia un sistema industrial coordinado, adaptable y parcialmente autónomo. **El jugador no solo mejora la velocidad o el coste de su producción: mejora la inteligencia organizativa de su fábrica.**

### Preguntas abiertas

- Qué productos podrán fabricarse.
- Cuántos procesos industriales compartidos existirán.
- Qué máquinas podrán cambiar sus operaciones.
- Qué cambios productivos serán físicamente plausibles.
- Qué ventajas cuantitativas tendrán los robots.
- Cuándo conviene usar bandas y cuándo robots.
- Cuánto podrá automatizar el Control Maestro.
- Qué partes de la fabricación seguirán siendo especializadas.
- Cómo cambiará la demanda durante la campaña.
- Si los cambios de producción ocurrirán también durante los combates.

Se abordarán con prototipos jugables.

## 10. Alcance de la campaña y control de complejidad

### 10.1. Campaña compacta · dirección preferida

Suficientemente pequeña para desarrollarse con recursos limitados. Cada mecánica con consecuencias claras. No hacen falta muchos enemigos ni decenas de escenarios: los enemigos ganan profundidad combinando sensores, locomoción, armamento, comportamiento y estrategia; la fábrica gana complejidad con nuevas funciones y programas, sin pedir constantemente nuevas clases de máquinas.

### 10.2. Escenario mixto de validación · propuesta para una fase posterior

Una instalación industrial sencilla que produce munición, almacena materiales, abastece defensas, usa robots logísticos y resiste una oleada. Sirve para ver si las dos mecánicas son interesantes cuando comparten recursos. En fases posteriores podría sumar un controlador maestro, una banda vulnerable o una orden de emergencia, **nunca todo a la vez en la primera implementación**.

## 11. Ruta de pruebas hacia Campaign

**Propuesta de orden, no decisión del autor.** Cada prueba aísla una pregunta, se construye sobre la base común de la unificación y decide algo antes de pasar a la siguiente. Varias pueden explorarse en paralelo como maquetas o laboratorios, igual que el laboratorio de VFX; las que cambian reglas van en orden.

| # | Prueba | Pregunta que responde | Qué decide |
| --- | --- | --- | --- |
| 0 | **Base común** (plan de unificación) | ¿Corren War y Factory en un mismo mundo con las reglas aprobadas? | Requisito de todo lo demás |
| 1 | **Abastecer un lanzador**: un robot lleva munición de un almacén a un lanzador, sin recarga automática, contra una oleada | ¿Es interesante el transporte como cuello de botella? ¿Se lee bien en el mapa? ¿Cuándo compensa una ráfaga? | Si el suministro explícito sustituye la recarga gratuita en Campaign; primeras cantidades |
| 2 | **Máquina destruible** | ¿Qué pasa con las referencias, los programas y las consultas cuando una máquina deja de existir? ¿Se entiende `null`? | Semántica de destrucción y desmontaje |
| 3 | **Un comportamiento, varios robots** | ¿Un cambio en una función compartida cambia visiblemente a todo un grupo? ¿Cómo se nombra y asigna? | Modelo de reutilización y grupos |
| 4 | **Control Maestro mínimo**: un edificio con alcance y una orden de emergencia que recluta robots industriales | ¿Qué prioridad entre programa local y maestro se entiende mejor? ¿Se reconoce el control remoto? | Regla de prioridad; señal visual; si el maestro es vulnerable desde el principio |
| 5 | **Banda frente a robots**: misma producción con una banda vulnerable y con robots; después, un túnel reforzado | ¿Es la banda eficiente pero frágil, sin parecer castigada? ¿Compensa el túnel en un corredor crítico? | Papel de las bandas; coste relativo del túnel |
| 6 | **Cambiar la producción con pocas líneas**: maqueta de las alternativas B y A (D como contexto) | ¿Se siente como ventaja real reorganizar una fábrica cambiando un programa? ¿Es plausible? | Modelo de producción adaptable |
| 7 | **Sensores y armas intercambiables**; seguimiento por identidad contra un enemigo ágil | ¿Se distinguen las configuraciones? ¿El seguimiento por identidad respeta la percepción limitada? | Catálogo inicial de tecnologías de combate |
| 8 | **Laboratorio gráfico de IK**: un cuadrúpedo con cinemática inversa, sin física de cuerpos rígidos | ¿Basta IK para una locomoción convincente y legible? | Cuánta física hace falta |
| 9 | **Maqueta de instalación** de tamaño moderado | ¿Caben producción, almacenes, logística, defensas, frente y redes sin perder legibilidad? | Tamaño y persistencia del mapa |
| 10 | **Arco narrativo corto** | ¿Qué visión (frontera, poshumana, original) sostiene mejor las pruebas anteriores? | Dirección narrativa |

## 12. Matriz de decisiones

| Tema | Estado | Dirección |
| --- | --- | --- |
| Unificar Factory y War | Decidido | Una base técnica compartida |
| War como base de migración | Decidido para el plan | Migración progresiva |
| `await` y temporalidad | Decidido | Enseñar claramente su función |
| `while (true)` y victoria | Decidido | Se gana al cumplir las metas del mundo |
| `null` y `0` | Decidido conceptualmente | No son equivalentes; significado según cada API |
| Carga ante destino lleno | Decidido | Permanece en el robot |
| Azar industrial | Dirección | Mínimo y comprensible |
| Economía | Dirección | Costes relevantes |
| Idioma principal de la API | Decidido provisionalmente | Inglés |
| Sensores limitados | Dirección | Progresión gradual |
| Proyectiles actuales | Decidido conservar | Simulación simplificada |
| Sensores y armas intercambiables | Propuesta aprobada | Separación de tecnologías |
| Seguimiento por identidad | Propuesta | Para unidades ágiles |
| Cinemática inversa | Exploración | Sin compromiso de físicas complejas |
| Programación local | Dirección | Cada máquina ejecuta su programa |
| Reutilización de funciones | Propuesta preferida | Código compartido y grupos |
| Control Maestro físico | Propuesta preferida | Redes, comunicaciones y redundancia |
| Prioridad local/remota | Pendiente | Necesita prototipo |
| Suministro automático actual | Decidido | Solo simplificación de War |
| Logística de campaña | Dirección | Gestionada por el jugador |
| Bandas transportadoras | Decidido conceptualmente | Permitidas, con limitaciones |
| Destrucción de bandas | Decidido conceptualmente | No reparables durante el combate |
| Túneles reforzados | Propuesta definida | Muy caros, muy resistentes |
| Producción adaptable | Exploración prioritaria | Evaluar alternativas |
| Cambiar producción por código | Principio central | Debe sentirse como ventaja real |
| Historia de frontera militar | Propuesta preferida | Narrativa local y acotada |
| Mundo poshumano | Alternativa abierta | No descartar |
| Historia original sobre IA | Antecedente abierto | Preservar como referencia |
| Tamaño definitivo del mapa | Pendiente | No fijar |
| Campaign completa | Fuera del alcance actual | Solo registrar la visión |

## 13. Declaración de intención

War Factory / Code Battles Lite enseña programación mediante máquinas cuyos comportamientos producen resultados visibles en una simulación. **La fábrica y la guerra son dos manifestaciones de un mismo principio: usar código para controlar sistemas que interactúan con un mundo.**

La visión contempla una instalación industrial militar parcialmente autónoma, probablemente en una frontera en conflicto, donde el jugador produce recursos, se defiende y mejora su capacidad de coordinación. No compite con la magnitud de Factorio o Age of Empires: su oportunidad está en demostrar cómo programas sencillos controlan procesos industriales y militares mucho más grandes que el código que los describe.

Las bandas seguirán siendo valiosas para transportar materiales, pero los robots destacan por su adaptabilidad. A largo plazo, modificar unas pocas funciones del Control Maestro debería transformar visiblemente la producción de toda una fábrica.

La prioridad inmediata no es construir ese juego, sino unificar bien Factory y War, conservar sus ventajas educativas y jugables y dejar una base estable desde la cual experimentar. La historia definitiva, la escala del mapa, la complejidad de la producción y la magnitud de las batallas permanecen intencionalmente abiertas.
