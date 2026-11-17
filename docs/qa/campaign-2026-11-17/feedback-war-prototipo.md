# Feedback · War actual vs prototipo

## Desktop · Juego · editor

## Section 1:
La pantalla superior llevara 3 secciones, De Izquierda a derecha: 
*⁠  ⁠selector de unidad: sera similar a un selector de carpetas con los robots divididos por el tipo de unidad. Tanto los tipos como los robots individuales tendran un checkbox para seleccionar Justo a los robots que el usuario desee. cuando se marque un robot se debe iluminar en el mapa Y la camara abarcará todos los robots marcados. Todos los control maestros ademas Tienen un sistema de pestañas que empieza con un simbolo de + que abre un sistema de carpetas donde puede guardar Toda clase programas 
* Pegado al lado izquierdo junto a los 3 puntos vendrá el modo no-keyboard. Funcionará básicamente igual a como funciona hoy en día en War. Solo que los pictogramas ahora ocuparan 2 lineas en lugar de una y saldrá otro menu con tipografias comunes de escribir codigo y el modo mouse, ambos en la zona inferior.
*⁠  ⁠selector de pantalla, icono de 3 puntos.: Muchas pantallas pueden Ocupar el espacio de code. Por ejemplo. cuando se quiera ver más información de la unidad apareceran las especificaciones completas de la maquina. 
** En la version de desktop, ademas del icono 2D, se mostrara una version 3D de la maquina. Ese menu además tendra una flecha en la esquina superior izquierda para regresar, y ese regresar llevará a un menu extendido del menu de maquinas que esta en el numero 5 de la imagen del prototipo. Dicho menu tambien podrá ser accedido desde maquinas (5 rojo). En el menu de maquinas tambien se podrá ver lo que se sabe de las maquinas enemigas y se puede invertir energia, dinero y recursos de investigación en hacer ingeniería inversa a las unidades enemigas. Estas se desbloquean para ser construidas luego de un determinado tiempo y recursos gastados.
** En este menu tambien se podrá acceder a otras cosas como historial, arbol de investigación, interaccion con mundo (parte del modo historia, aun por definir) y settings.
## Section 2: Aqui apareceran primeramente objetivo, Specs del robot que se está programando y consola/logs.
##  Section 3,4,5: Estos cambiaran radicalmente, esconderemos los checkpoints en la pantalla de derrota. Y tambien se le dejara al jugador una opción de guardado manual de multiples slots. Donde esta el boton de checkpoint irá el boton de maquinas.
* Toda la barra superior desaparece, pero se mantendrá un boton de mision con un signo de admiración donde se explican los objetivos. Dicho menu será minimal y tiene la opcion de "ver mas" o algo parecido y si se da click, se abrira la explicación completa en el menu de codigo, incluyendo misiones anteriores. Estos te podrán dar pistas solo si el jugador lo quiere. Dicho boton tendrá el mismo estilo que el de los binoculares y settings, los cuales se mantienen en la esquina superior derecha del mapa.
* En las selecciones de "3D, plano, batalla" plano cambiara a 2D y batalla se elimina. La vista sin texturas de mapa es exclusiva de cuando hay un combate o practica de combate y se activa sola. Este conjunto de botones pasa a estar al centro en el mapa en la parte superior.
* Los objetivos que son numeros concretos como  en el caso de conseguir x piezas, plantar x maquinas aparecen en forma de lista vertical en la parte superior derecha abajo del boton de objetivo. Usualmente acompañados de SVG de la pieza o maquina que se busca conseguir. Los recursos siguen la misma logica del lado derecho.
## section 6: Nos quedamos con este widget cuando se selecciona una maquina singular.
Nota adicional. Durante casi todo el juego mantendremos una conveción de controles de mouse bastante similar a age of empires. Click izquierdo para seleccionar con click o con multiseleccion. Click derecho para ordenar. Se puede recoger material manualmente pero el robot no entrara en ciclo/bucle a menos que el jugador lo programe.

## Smartphone · Juego · editor

Nada del prototipo se queda. Nos quedamos completamente con la versión anterior. Ademas de dejar por defecto el modo fullscreen (punto 4) que no aparece en el prototipo.
Como detalle adicional. Si tanto el modo fullscreen como el no-keyboard estan activados al mismo tiempo, los pictogramas grises ocupan dos lineas en lugar de una, principalmente en devices de gran pantalla como los samsung ultra y tablets.

## Desktop · Ficha de unidad

el 1 de la original es completamente removido. Además, durante el modo batalla, se incluira un boton en la parte superior a lado de los googles que mostrara la vida de varias de tus unidades de forma ordenada 
Detalle adicional: para arrastrar unidades de cualquier menu de maquinas,además se agregara un pequeño widget, similar al de shapez 1, el cual tendrá las opciones de confirmar(verde), girar, cancelar(rojo) y lock, para poner varias veces la misma cosa.

## Smartphone · Ficha de unidad

Un problema es que el nuevo prototipo no respeto el modo pantalla completa. Si no esta activado dicho modo, la tarjeta esta bien que ocupe el mapa, pero si esta activado, las specs del robot deberian aparecer en el menu de logs dando facil acceso, además de tener la opcion de plegar/esconder ese menu por completo.

## Desktop · Selector de retos / hitos

Ambos serán sustituidos por una version simplificada en el mapa. La version explicada será más parecida a lo del prototipo, pero enriqueciendo el texto para que los objetivos en el texto se encuentren destacados con colores y quizá imagenes cuando se haga hover/hold sobre el nombre de alguna unidad.

## Smartphone · Selector de retos / hitos

Se fusionará prácticamente todo. Quiza solo se deje war y factory aparte en un menu por fuera de la campaña y para alguna demo pero eventualmente pero la UI planeada actualmente será todo campaña de cara al launch.

## Desktop · Ajustes

nos quedaremos con los settings del prototipo. Ademas cosas como el lenguaje del codigo (py/JS) se seleccionara aquí en lugar de en la UI principal. Lo mismo con tamaño de letra y similares.
