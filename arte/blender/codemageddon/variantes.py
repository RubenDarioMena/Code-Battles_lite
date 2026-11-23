"""Variantes de aspecto sin tocar codemageddon.py (orquestador).

Blender -b --factory-startup --python variantes.py -- --salida <carpeta> [--previa] \
    [--luz STOPS] [--rojo_mm MM] [--emision X] [--galv bajo|medio|alto] [--cepillado suave|medio|marcado]

Carga codemageddon.py, aplica los cambios al código o a sus diccionarios y renderiza --muestra.
"""
import sys
import types
from pathlib import Path

AQUI = Path(__file__).resolve().parent
argv = sys.argv[sys.argv.index('--') + 1:]
def opcion(nombre, defecto=None):
    return argv[argv.index(nombre) + 1] if nombre in argv else defecto

luz = float(opcion('--luz', 0))
rojo_mm = opcion('--rojo_mm')
emision = float(opcion('--emision', 1))
galv = opcion('--galv', 'medio')
cep = opcion('--cepillado', 'medio')

fuente = (AQUI / 'codemageddon.py').read_text()
def cambiar(a, b):
    global fuente
    assert a in fuente, f'No encuentro: {a}'
    fuente = fuente.replace(a, b)

GALV = {'bajo': ('.64,.67', '.19,.21'), 'medio': ('.625,.685', '.178,.222'), 'alto': ('.59,.72', '.14,.27')}
gris, rug = GALV[galv]
cambiar('gris = rango(t,grano,0,1,.625,.685)', f'gris = rango(t,grano,0,1,{gris})')
cambiar('rango(t,grano,0,1,.178,.222)', f'rango(t,grano,0,1,{rug})')
CEP = {'suave': ('.20,.25', '.08'), 'medio': ('.18,.276', '.16'), 'marcado': ('.13,.33', '.34')}
bandas, fuerza = CEP[cep]
cambiar('rango(t,bandas,.25,.75,.18,.276)', f'rango(t,bandas,.25,.75,{bandas})')
cambiar("('Distance',.000013),('Strength',.16)", f"('Distance',.000013),('Strength',{fuerza})")

cm = types.ModuleType('codemageddon')
cm.__file__ = str(AQUI / 'codemageddon.py')
sys.modules['codemageddon'] = cm
exec(compile(fuente, cm.__file__, 'exec'), cm.__dict__)

for k, (pos, dest, w, lados, rgb) in list(cm.LUCES.items()):
    cm.LUCES[k] = (pos, dest, w * 2 ** luz, lados, rgb)
if rojo_mm:
    cm.LETRA['tapa_m'] = float(rojo_mm) / 1000
cm.LETRA['emision'] *= emision

sys.argv = [sys.argv[0], '--', '--salida', opcion('--salida'), '--muestra'] + (['--previa'] if '--previa' in argv else [])
try:
    cm.main()
except RuntimeError as e:      # comprobaciones de animación: no afectan a la muestra
    print('AVISO', e)
