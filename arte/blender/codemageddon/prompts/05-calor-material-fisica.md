# Tarea 05 · Calor del láser, metal real en las letras, física de caída y montaje más largo

Eres el ejecutor 3D. Haz SOLO esta tarea. Toca solo `codemageddon.py` y `README.md` de
`arte/blender/codemageddon/`. No toques `prompts/`, `referencias/`, `previas/`, `muestra_estilo.py`,
`variantes.py` ni `hoja_variantes.py`. Sin commits. No puedes abrir Blender: el orquestador renderiza
y comprueba. **No hagas pruebas extensas**: basta con que compile
(`python3 -m py_compile`) y una comprobación numérica rápida de la física con el Python de Blender
(`/Applications/Blender.app/Contents/Resources/5.3/python/bin/python3.13`).

Te llegan como imágenes las 5 notas del usuario sobre la previa (`nota-1..5`) y la hoja de cuadros
clave. Léelas: son el encargo. Prioridad del usuario: **(1) cambio de material por calor, (2) realismo
del metal en el centro de las letras, (3) simulación física.**

## Valores elegidos por el usuario (no los cambies)
`LUCES` × 2^−2.5, `LETRA['tapa_m']=.0030`, galvanizado y cepillado actuales, haz = una línea roja
fina sin aura (`Núcleo`, emisión 2.4), `GROSOR=.025`. El montaje del orquestador (`MONTAJE`,
`montaje()`, enfoque a pulso de D, deslizamientos de B y D, revelado de E) se conserva, adaptado a
los cuadros nuevos.

## 1. El láser calienta el metal (notas 3 y 4)
- Hoy el láser pasa, salen chispas, pero el metal no reacciona; y el contorno rojo de la O **se
  enciende entero de golpe**. El disparador de todo cambio de material debe ser **el paso del haz**.
- Cada punto del contorno guarda su instante de paso (ya tienes `arco_m` y `progreso`). A partir de
  ahí, en función de la edad desde el paso:
  - en el impacto, blanco-amarillo; detrás, se enfría por cuerpo negro (amarillo → naranja → rojo
    oscuro) con caída exponencial (usa `ShaderNodeBlackbody` con una temperatura que decae);
  - zona afectada por el calor de 1–2 mm a cada lado: el galvanizado se oscurece y deja **tinte de
    revenido** (pajizo → bronce → azul) que permanece;
  - la ranura de corte (kerf, ~0.2 mm) aparece oscura **detrás** del haz, nunca delante;
  - algo de humo o vapor muy tenue opcional, solo si no cuesta render.
- El rojo de marca de la pieza cortada nace **siguiendo al haz**: un punto del canto se vuelve rojo
  cuando el haz ha pasado por él, no antes. Nada se enciende de golpe.

## 2. Metal real en las letras (notas 1 y 5)
- La N que cae se ve negra en el centro con dos franjas rojas planas: «parece render, no algo real».
  El centro es negro porque refleja un mundo a 0.
- **Dale al metal algo que reflejar sin iluminar el fondo**: un entorno de estudio tenue (gradientes,
  tiras de softbox) que solo vean los rayos de reflexión. El fondo para la cámara sigue negro. En
  EEVEE, mira si basta con `Light Path → Is Camera Ray` en el mundo o necesitas planos de reflexión
  invisibles a cámara (`visible_camera=False`). Justifica lo que elijas.
- Laterales de la pieza: acero mecanizado por láser con estrías verticales finas, anisotropía y
  reflejos que se muevan al caer. Las bandas rojas superior e inferior siguen ahí, pero **no como
  franjas emisivas planas**: el rojo es metal caliente o teñido que **refleja igual que el acero**
  (color base y especular rojos, emisión moderada solo en la arista), con un paso al acero irregular y
  orgánico (ruido, no una recta) y algo de tinte de revenido en la transición.
- Cara superior de las letras encajadas: mismo criterio. El centro, acero claro pulido con reflejos
  vivos, no gris plano.

## 3. Física de caída y hundimiento (notas 2 y 5)
- El usuario nota que la pieza **desacelera** al caer y que la fricción del hundimiento es
  **demasiado uniforme**. Quiere una simulación física apuntalada.
- Simula con un integrador propio (numpy, paso fijo pequeño, semilla fija), horneado a fotogramas
  clave lineales. No uses rigid body de Bullet para entrar en el hueco de 0.05 mm de holgura.
- **Cámara lenta física**: escala de tiempo única por plano (p. ej. ×5) y **g constante**; en caída
  libre la aceleración es siempre 9.81 m/s² escalada, sin suavizados ni frenadas.
- **Propuesta del usuario, pruébala**: las letras caen sobre la placa **junto** a su hueco, rebotan un
  poco (restitución baja), **se deslizan** con fricción cinética hasta el hueco y se hunden. Diseña
  tú cómo llegan con velocidad lateral (por ejemplo, el bloque galvanizado algo desplazado y la pieza
  que bascula al soltarse por un lado). Debe ser creíble.
- **Hundimiento con fricción variable**: Coulomb con coeficiente estático > cinético (stick-slip),
  que varía con la profundidad y con ruido (contacto con las paredes desigual), y que **aumenta en el
  último tercio** (nota 2: «cuando esté hundido hasta este punto se podría notar un poco más de
  fricción»). Una leve inclinación que se corrige al entrar. Termina enrasada a z = 0 ± 0.01 mm.
- Guarda en `escena.json`: aceleración en caída libre por plano (debe dar g escalada ±2 %),
  velocidades al tocar, número de atascos y profundidad de cada uno.

## 4. Montaje y duración (sin límite de 8 s)
El usuario pide más tiempo. Orden y duraciones aproximadas a 24 fps (ajústalas si lo justificas):
1. **A · N** (~2.5 s): la N cae, desliza y se hunde.
2. **D · fresa** (**4 s**): tras encajar la N, el taladro termina la O de CODE. Que el cambio de foco
   placa → fresa → placa se aprecie. La fresa sube y se aparta al final de verdad (hoy, en el cuadro
   140, aún está abajo). Herramienta y pinza en acero claro; placa del plano D más oscura, no gris
   lavado.
3. **B · láser O** (~2.5 s): con el calor del punto 1.
4. **C · O cae** (~3 s): **ángulo nuevo**, más alto (3/4, 20–35° hacia abajo), para ver la caída, el
   deslizamiento y el hundimiento entero sin que el borde de la placa tape la pieza.
5. **E · palabra** (~2.5 s): revelado como ahora. MAGEDDON debe leerse **rojo**, no rosa; el soporte en
   T de la fresa no debe verse.
Actualiza `PLANOS`, `GUION`, comprobaciones (el total ya no es 192) y `montaje()`.

## Respuesta final
Breve: qué hiciste en cada punto, el método de la física (ecuaciones y parámetros), los cuadros
clave que debo mirar y las desviaciones con motivo.
