# Grill · Unificación trunk + assets 3D · Ronda 1 · respuestas

**Q1 · Rama base de la unificación:** B · Rama nueva desde origin/trunk + merge de origin/assets-3d
  - Nombre de la rama (déjalo vacío para usar el sugerido): Campaign-V2
**Q2 · ¿Qué es «campaign 1»?:** campaign-nivel-1
  - Nota: campaign es la unica implementacion de campaña actual, cosas como papercraft es como queremos que luzca en gran medida. Trunk nos da la arquitectura base o inicial que luego será cambiada y convertida, pero en el documento que esta por crearse se hará casi enteramente desde el inicio como una sola cosa, sin factory, ni war sino una campaña directamente, podremos saltar entre los retos de war adaptados solo por cuestiones de testing. / En el siguiente paso, en el wayfinder, luego de aclarar las cosas en grill te daré otras especificaciones de arquitectura.
**Q3 · ¿Qué son «las mecánicas de la fábrica»?:** A · La de Campaign (H0–H5)
  - Nota: Igualmente, aunque no se tenga directamente el seudo codigo (que creo que podría), la seccion especifica de codigo debe parecer más a trunk que campaign-nivel-1
**Q4 · ¿Cómo se conectan fábrica y batallas?:** D · Otro (en notas)
  - Nota: estos primero niveles se definen por hitos, así que es verdad la B, pero dicha factory seguirá su funcionamiento normal durante la batalla, eso es C. Además, unicamente por cuestiones de testing, estará el selector de misiones, para poder probar los escenarios rápidamente.
**Q5 · ¿Qué tan fiel es «replicar las 5 batallas»?:** A · Idénticas
  - Nota: A al principio. Segun requerimientos y nuevas mecanicas podría ser B o C
**Q6 · ¿War y Factory siguen existiendo por separado?:** C · Quedan solo para QA (ocultas)
  - Nota: Me gustaria irlo separando para entender como será la experiencia del usuario. Pero con posibilidad de entrar para testing. Al final podría volverse un modo aparte, tutoriales o demos.
**Q7 · ¿Qué asset 3D representa a cada entidad de War?:** 
  - LAU-01/02 · lanzador: torreta_observacion.glb
  - VIB-01 · sensor de vibración: otro (ver nota)
  - Robot reparador: otro (ver nota)
  - Oruga (y oruga blindada, 3 impactos): otro (ver nota)
  - Dron y dron frío: otro (ver nota)
  - Base / línea roja: otro (ver nota)
  - Nota: Las torretas esfera iran como la torretas de las primeras versiones de War, que irán en la muralla. Dron, reparador, sensor, oruga, dron, irán como blocking para indicar que son placeholders. Algunos elementos 3D no se verán implementados hasta fases posteriores.
**Q8 · ¿Dónde ocurren las batallas en 3D?:** B · Sección del mapa ampliado
  - Nota: Astra encontrará una forma de encuadrar el mapa que actualmente tenemos para que no se vea tan evidente como se corta en dichas distancias.
**Q9 · ¿Entra la muralla de vóxeles en estas batallas?:** A · Muralla estática
**Q10 · ¿Qué UI de campaign-nivel-1 entra?:** mision, metas, vista, ficha, ficha3d, vidas, guardado, maquinas, arbol, biblioteca, menu, aoe, shapez
**Q11 · Móvil:** A · La interfaz de trunk sin cambios
**Q12 · «Estructura de carpetas de campaign1»: ¿qué significa?:** otra
  - Nota: Las anteriores versiones mostraban los nombres de todos los robots en escena en varias tarjetas una detras de otra en una tira en la parte superior del codigo. Es una UI completamente insostenible para cualquier momento minimamente avanzado del juego. En lugar de eso, en la esquina superior izquiera en la parte plegable, habrá una lista de robots separada por tipos con checkboxs cada uno y con una checkbox para seleccionar todos. De los seleccionados. Esto para que se le pueda poner el mismo programa a varios, en el centro con un dropdown o quizá como otro menu, habrá un "archivo" con varios codigos diferentes para diferentes situaciones
**Q13 · Cambios de arquitectura permitidos para el 3D:** registro, material, rig, urls
  - Nota: No marque el nucleo ni lo de la muralla, tengo mis dudas de si se puede hacer lo del nucleo posteriormente, pero si se puede lo dejamos fuera de scope igual que la muralla rompible.
**Q14 · Precedencia entre las tres carpetas de Descargas:** A · Por fecha y commit del documento fuente
**Q15 · Primer hito entregable:** A · Batalla 1 «Primer blanco» con la UI nueva del mapa, los assets 3D y el escenario papercraft
**Q16 · Nombres: ¿cómo se llama cada cosa?:** C · Nivel 2 de la serie Campaign
  - Nombre del conjunto: Campaign-V2
  - Nota: titulos aun por decidir