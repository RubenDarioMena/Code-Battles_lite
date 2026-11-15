# Casos de fronteras

Árbol mínimo de fuentes correctas e infracciones intencionadas; no ejecutarlas.
`pruebas/fronteras-autoprueba.mjs` copia este árbol a un temporal y comprueba
exactamente los diagnósticos por archivo y regla, incluidos sus recuentos.
Añade allí un error de sintaxis y un `node_modules` con sintaxis inválida que
debe ignorarse. El temporal se elimina al terminar.
Los casos quedan fuera del `paquetes/` raíz y del include de TypeScript.
