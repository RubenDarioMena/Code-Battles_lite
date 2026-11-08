**Veredicto final del ciclo 03: aceptar**, con el límite documentado.

Ejecuté únicamente los dos programas mediante `caso.cjs /dev/stdin`; ambos terminaron con código **0**.

- **Generadora reasignada:** consola `normal / fin`. La llamada muestra `[g()]`, «Ejecuta [g()].» y resultado `undefined`, sin enlazar al cuerpo original.
- **Generador async sin `await`:** la lectura explica que devuelve una promesa y continúa sin el valor. La traza conserva solicitud → espera interna → devolución de promesa → impresión de `fin` → `yield`.

Las dos afirmaciones falsas del turno anterior quedan corregidas. No amplié la verificación a otros casos.