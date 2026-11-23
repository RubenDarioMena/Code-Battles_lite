# Campaign en cartulina

[Panorama](previas/panorama.jpg) · [Frente sur](previas/frente-sur.jpg) · [Piezas](previas/piezas.jpg) · [Ribera](previas/ribera.jpg) · [Canto de la sierra](previas/canto-de-la-sierra.jpg)

El [visor estático](visor/index.html) abre el mapa de 400 × 208 m. Sirve esta carpeta por HTTP o HTTPS y abre `visor/`. Arrastra para orbitar, acerca con rueda o pellizco y desplaza con botón derecho o dos dedos. Los interruptores superponen el rectángulo del mapa antiguo y una cuadrícula de 10 m.

## Regeneración

Desde la raíz del repositorio en un equipo con Blender 5.2.2 y Node 22:

```sh
B="/Applications/Blender 5.2.app/Contents/MacOS/Blender"
"$B" -b --factory-startup --python-exit-code 1 --python arte/blender/papercraft/kit.py
"$B" -b --factory-startup --python-exit-code 1 --python arte/blender/papercraft/mapa.py
node arte/blender/papercraft/validar.mjs
```

En el entorno aislado, ejecuta los dos scripts mediante la cola de Blender indicada en el brief.
El primero genera las texturas y la biblioteca. El segundo genera las texturas, el terreno, las colocaciones y las cinco fotografías en EEVEE.
El validador comprueba los GLB, los pigmentos, las texturas compartidas, los límites por trozo, los tamaños y el grafo de módulos del visor.

## Reutilización

- `kit.blend` contiene diez objetos de malla marcados como assets. Activa la vista previa de materiales para ver las fibras. Cada archivo de `glb/kit/` contiene una pieza en su origen local y con el pie a altura cero.
- `mapa-ampliado.json` define la composición en metros. El origen está en la esquina noroeste, con x al este e y al sur. La altura cero corresponde al suelo nominal.
- `colocaciones.json` guarda la posición de cada pie. El giro está en radianes desde el este hacia el sur y la escala es uniforme. En Blender se usa (x, −y, z) con giro −giro sobre Z. En Three se usa (x, z, y) con −giro sobre Y.
- `glb/mapa/terreno-F-C.glb` ocupa la fila F y columna C, ambas desde cero. Sus vértices están en coordenadas absolutas. Los cortes conservan las UV para mantener la continuidad de la fibra entre trozos.
- `paleta.json` contiene tintas sRGB. COLOR_0 lleva el color lineal con oclusión y COLOR_1 el pigmento limpio. Para cambiar de tinta conservando la sombra, multiplica el nuevo RGB lineal por el cociente COLOR_0 / COLOR_1. Los GLB referencian los dos PNG de 1024 px mediante ../../texturas/. Conserva esta estructura al moverlos.
- `oclusion.py` proyecta rayos contra la malla del terreno y las piezas colocadas. Añade muestras de color al suelo junto a las huellas y al pie de los cantos antes de hornear.
- `estudio.json` fija las dos luces, la cámara de 30° y los encuadres. En vertical se abre sobre la curva de la muralla y se puede recorrer el resto con dos dedos.
- El visor distribuye Three.js r180 con licencia MIT en `visor/vendor/`. Se sirve desde esta carpeta y utiliza instancias para las piezas repetidas.
