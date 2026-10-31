# Personajes (StykAnimate)

Fuente: proyectos `.styk` en esta carpeta (p. ej. `stickman-wait.styk`). **Nunca conservar solo la exportación.**

## Exportar para las composiciones

1. En StykAnimate: exportar **secuencia PNG** (conserva alfa; el WebM del editor web es opaco).
2. Guardar en `exports/png-sequence/<nombre>/` con nombres `0001.png`, `0002.png`, … y conservar el manifiesto que genera StykAnimate (dimensiones, FPS, nº de fotogramas).
3. `pnpm remotion` copia `exports/` a `compositions/remotion/public/characters/` (sync-assets).
4. En las props de la composición, cambiar el personaje de `vector` a `png`:

```json
"characters": {
  "busy": {"mode": "png", "dir": "characters/png-sequence/busy-polling", "frames": 48, "fps": 24, "width": 360, "height": 420, "loop": true},
  "async": {"mode": "vector"}
}
```

El origen de la imagen es el **centro inferior** (entre los pies), igual que el stickman vectorial.

## Mientras no haya `.styk`

`shared/stickman.ts` dibuja un stickman provisional con el mismo origen y escala (~330 px de alto). Sirve para ajustar tiempos y composición; la actuación final debe venir de StykAnimate.

Nota: StykAnimate declara un destino macOS sin probar; usar el editor web (https://stykanimate.com/) o Electron en Windows/Linux. Los MCPs de StykAnimate son recientes y sin estabilidad acreditada (ver `docs/INFORME-STYKANIMATE.md`).
