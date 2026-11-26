# P8 · Daño por componentes y recuperación

Fuente: la sección 13.B del [consolidado del 23-nov](../Vision/2026-11-23/DECISIONES-PREPROTOTIPO.md) («Un experimento aislado de daño y recuperación»), con sus secciones 7, 8.2 y 9.1 y las invariantes y casos de 12.2–12.3. Es la versión mínima sin vóxeles que el consolidado prefiere para empezar (8.2, 13.C-1). Los números son provisionales.

## Qué valida

Que dos trozos grandes de un tanque parcialmente corroído tengan cantidades de metal coherentes, y que el resultado no dependa del número de triángulos del modelo (13.B).

## Dónde está

| Pieza | Archivo |
| --- | --- |
| Reglas (puras, sin vista) | `paquetes/reglas-campaign-v2/danio/index.js`, exportadas como `danio` desde la entrada del paquete |
| Vehículo de prueba | `paquetes/reglas-campaign-v2/danio/vehiculos.js` |
| Vista 3D de los restos | `paquetes/vista-3d/cv2/restos.js` (`crearRestos3D`) |
| Banco visual | `Prototypes/Campaign-V2/danio.html` (menú de pruebas, «Daño y recuperación») |
| Prueba | `pruebas/campaign-v2-danio.mjs` |

## Modelo

**Oruga blindada de la B8** (77 kg), con 8 componentes y caja aproximada en metros:

| Componente | Tipo | Masa | Notas |
| --- | --- | ---: | --- |
| Proa | blindaje | 14 kg | |
| Chasis central | chasis | 12 kg | De él cuelgan las orugas y el arma. |
| Popa | blindaje | 14 kg | |
| Motor | motor | 10 kg | Más blando (dureza 0,8). |
| Oruga izquierda y derecha | transmisión | 9 kg cada una | |
| Arma | arma | 6 kg | |
| Electrónica | electrónica | 3 kg | Muy blanda (dureza 0,5). |

- **Uniones:** proa–centro, centro–popa, popa–motor, centro–orugas, centro–arma y proa–electrónica. Las orugas cuelgan del centro, así que si el centro se pierde, la proa y la popa quedan como dos fragmentos grandes (el caso 7.2).
- **Contabilidad:** cada componente lleva su masa en gramos enteros, su integridad (0–1) y lo que perdió como chatarra o como perdido. La suma de las cuatro categorías de 7.4 es siempre la masa original, sin redondeos que creen o borren materia.
- **Ataques** (perfiles de 7.1, no bonos fijos). La intensidad cae en línea con la distancia a la caja de cada componente:

| Perfil | Radio | Masa por unidad de intensidad | Función por unidad | Lo arrancado |
| --- | ---: | ---: | ---: | --- |
| Explosivo | 1,4 m | 50 % | 100 % | 60 % chatarra, 40 % perdido |
| Preciso | 0,3 m, solo el componente más cercano | 6 % | 120 % | todo perdido (el corte se volatiliza) |
| Corrosivo, por dosis | 0,7 m | 12 % | 20 % | 50 % chatarra, 50 % perdido |

- **Reglas de integridad:** nunca supera la fracción de masa que queda. Por debajo de 0,3 se rompen las uniones del componente, y por debajo de 0,5 deja de ser reutilizable. Un resto menor que el 2 % de la masa original se pierde entero, para que no queden astillas eternas.
- **Estado funcional por regla (7.3):** movilidad necesita el motor y las dos orugas enteros y en el mismo fragmento; fuego, el arma y la electrónica. Sin ninguna función, el vehículo queda fuera de combate.
- **Recogida (7.5):** los fragmentos, los reutilizables (si se funden) y el 75 % de la chatarra se agrupan en lotes de recortes de 4 kg, la masa de `scrap` en el catálogo de la fábrica. Lo que no llega a un lote queda en el campo, y la chatarra que no se recoge se pierde. Cada resto se recoge una sola vez.

## Resultados de referencia

| Caso | Resultado |
| --- | --- |
| Ácido en el centro | Fuera de combate en 4 dosis. Popa y motor, 20,1 kg; proa y electrónica, 14,6 kg. Se pierden 7,5 kg. |
| Disparos al motor y al arma | Fuera de combate perdiendo 1,1 kg. 18 lotes, que en la fundidora dan 6 placas. |
| Explosión en el centro | Fuera de combate y nada reutilizable. Se pierden 11,7 kg y otros 4,4 kg de chatarra no se recogen. 15 lotes. |
| Explosión leve (energía 0,5) | Sigue operativo, en un solo fragmento. |
| Láser en el borde de la electrónica | Solo ella se suelta (2,6 kg). Ya no dispara, pero sigue moviéndose. |

Del tanque a la fundidora: 1,11 kg perdidos en combate + 3,89 kg en el campo + 60 kg en placas + 12 kg de escoria = 77 kg.

## Vista

- **Máscara de daño en el color de los vértices**, calculada con el historial de golpes:
  - tizne del explosivo;
  - mancha verdosa del corrosivo, que pasa a óxido si insiste;
  - punto al rojo del preciso.
  
  Solo dice dónde y cuánto se golpeó (9.1). Qué función cayó lo marca el contorno rojo, que sale de la integridad lógica (rojo reservado para el daño, 9.2).
- **Masa:** escala cada bloque por la raíz cúbica de la masa que le queda. Sin masa, el bloque desaparece.
- **Fragmentos:** cada fragmento lógico cuelga de su propio grupo. El mayor se queda en su sitio; los demás se apartan y, si cuelgan, caen al suelo fuera de la huella del casco.
- **Chatarra:** un trozo en el suelo cada 2 kg, como mucho ocho (7.5).
- **Calidad alta o baja:** solo cambia la subdivisión de la máscara (10 o 2 cuadros por cara). El balance no cambia (12.2-7).

## Fuera de esta porción

- **Conectar las Batallas con la fábrica:** que las orugas derribadas en la B8 dejen restos según quién las derribó, y que la recogida llegue a la fundidora de H6. Las reglas ya lo permiten, pero hay que decidir:
  - qué perfil es un misil de torreta, una carga del minador o la rueda;
  - cuántos lotes puede traer una Batalla sin romper el equilibrio de H6.
- **Vóxeles internos (13.C):** solo si esta versión no da la fidelidad necesaria.
- **Química y láser como arma (5.2–5.4).**
