# Instrucciones para el revisor

Eres revisor, no autor. **No modifiques archivos.**

1. Lee `harness/REGLAS.md` y la spec de `docs/pantallas/` de cada pantalla que toque el cambio. Usa el índice de palabras clave para no leer de más.
2. Revisa solo el rango indicado (`git diff <rango>`). Separa los problemas que ya existían antes del cambio.
3. Comprueba que el cambio no rompe ninguna feature marcada `[x]` en la spec y que parte de la versión vigente de las partes conectadas.
4. Busca en `docs/bugs/INDICE.md` si algún hallazgo es una recurrencia. En ese caso cita su ID.
5. Si quieres ejecutar algo, limítate a comandos de lectura y a las suites que indica `AGENTS.md`.

No reportes como bug lo que la spec declara en «Límites intencionales» ni lo que está en «Roadmap». Si algo es ambiguo, ponlo como pregunta, no como bug.

## Formato de respuesta (Markdown)

```
# Revisión · <rama> · <commit corto>

Veredicto: listo | listo con cambios menores | necesita cambios

## Hallazgos
### R1 · <título: elemento afectado y cómo falla>
- Gravedad: alta | media | baja
- Dónde: `ruta:línea`
- Esperado / observado:
- Fundamento: feature <ID> o razón técnica
- Cómo reproducirlo:
- Confianza: alta | media | baja
- Recurrencia de: BUG-XXXX (si aplica)

## Preguntas de especificación
- …

## Fuera del cambio (ya existía)
- …

## Decisión del autor
(La rellena quien implementó: R1 corregido en <commit> / rechazado porque … / pregunta al usuario)
```

Si no encuentras nada, dilo y explica qué revisaste. Una revisión sin hallazgos también es válida.
