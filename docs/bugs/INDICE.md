# Registro de bugs

Un archivo por bug (`BUG-NNNN-titulo.md`, formato en [la plantilla](../../harness/plantillas/bug.md)). Antes de crear uno, busca duplicados:

```bash
node harness/scripts/nuevo-bug.mjs --buscar clave1,clave2
```

Para crear uno nuevo:

```bash
node harness/scripts/nuevo-bug.mjs "Pantalla: elemento falla al …" --pantalla editor --claves clave1,clave2
```

Las claves son las del índice de palabras clave de la spec de la pantalla. Un bug cerrado no se borra: si vuelve, se añade una fila en su sección «Recurrencias».

| ID | Título | Pantalla | Claves | Estado | Fecha |
| --- | --- | --- | --- | --- | --- |
| [BUG-0001](BUG-0001-campaign-v2-el-encuadre-3d-inicial-corta-la-entrad.md) | Campaign-V2: el encuadre 3D inicial corta la entrada de la Batalla | mapa | camara, bastion, encuadre | corregido, QA visual pendiente | 2026-11-24 |
<!-- nuevas filas encima de esta línea -->
