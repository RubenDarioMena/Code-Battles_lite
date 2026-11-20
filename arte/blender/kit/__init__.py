"""Entrada pública para las máquinas. Importar el adaptador solo dentro de Blender."""
from .geometria import FAMILIAS, Malla, eje_gltf, regla_mando
from .estructura import caja, prisma, revolucion, tubo, manguera, chapa, cartela
from .tornilleria import tornillo, allen, tuerca, arandela, remache
from .dentados import engrane, corona, cremallera, sinfin, angulo_avance
from .mecanica import rodamiento, eje, cardan, heim, resorte, amortiguador, led
from .rodaje import rueda, oruga

PIEZAS = (caja, prisma, revolucion, tubo, manguera, chapa, cartela, tornillo,
          allen, tuerca, arandela, remache, engrane, corona, cremallera, sinfin,
          rodamiento, eje, cardan, heim, resorte, amortiguador, rueda, oruga, led)
