# Pantalla · <nombre>

Estado: borrador | aprobada · Revisada contra: `<rama>@<commit corto>` · Fecha: AAAA-MM-DD

Propósito en una frase.

## Índice de palabras clave
Para buscar sin leer todo. Cada clave apunta a una sección de esta spec, a archivos o a un término para `grep`.

| Clave | Dónde |
| --- | --- |
| `clave` | sección / `ruta/archivo.js` (`grep: término`) |

## Features
Checklist de lo que la pantalla **debe** hacer hoy. ID estable: `<PANT>-F01`. No incluyas roadmap aquí.

- [x] `<PANT>-F01` · Descripción comprobable.
- [ ] `<PANT>-F02` · Feature acordada pero todavía sin verificar.

## Límites intencionales
Comportamientos que parecen bugs pero son decisiones. Evita que un revisor los reporte.

## Partes conectadas
| Parte | Archivo o documento | Versión vigente |
| --- | --- | --- |
| … | `ruta` | rama o commit de referencia |

## Método de QA
1. **Nivel 1 · gratis, repetible:** clicker o suites. Comando exacto e invariantes que comprueba.
2. **Nivel 2 · escenarios:** recorridos guionados sacados de las features (`<PANT>-F..`).
3. **Nivel 3 · juicio:** qué debe mirar un modelo o una persona en capturas. Solo si 1 y 2 pasan.

## Roadmap (no requerido)
Ideas futuras, separadas de las features para que nadie las trate como obligatorias.
