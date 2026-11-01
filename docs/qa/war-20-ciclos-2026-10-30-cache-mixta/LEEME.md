# Tanda con caché mixta · excluida de la verificación actual

Se conservan los 20 intentos de diagnóstico inicial: PC 1–10 cargó juego v13/editor v14; móvil 11–20 cargó HTML antiguo con juego v12/editor v13. Los contextos por intento en evidencia/resumen.json documentan las versiones. No contar los diez casos móviles como regresiones de las correcciones actuales.

Comprobación posterior: cmg.envolver.toString() tenía cuatro espacios de sangría y scripts v12/v13. Network.setCacheDisabled + reload cargó dos espacios y scripts v13/v14. Es un problema de validez de esta ejecución de QA; no demuestra un fallo de caché del producto publicado.

La tanda completa se repitió en ../war-20-ciclos-2026-10-30 con caché desactivada y comprobación de versión antes de cada intento. Aquí no se borró evidencia.
