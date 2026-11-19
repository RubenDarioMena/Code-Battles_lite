"""Exporta el vehículo tubular de tubular.py como un GLB de juego con tres niveles de detalle (LOD).

Sin ventana:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python arte/blender/vehiculo-tubular/exportar_tubular.py -- \
        "Prototypes/Rocket Launcher/modelos/vehiculo_tubular.glb"

Misma convención que exportar_t1.py: cada nivel es una raíz L0_/L1_/L2_VehiculoTubular con los
mismos pivotes y una malla rígida por pivote, sin esqueleto ni animaciones. El juego pone la pose.

Pivotes que se animan desde el juego (rotaciones y desplazamientos en ejes locales):
- `torreta` (giro en Z), `arma` (elevación en X) y `boca` (zócalo del fogonazo, en la punta).
- `rueda_dd/di/td/ti` (giro en X), `direccion_d/i` (Z) y `plataforma_aro` (aro, cruceta y torreta).
- `portamangueta_XX` (recorrido vertical de la esquina) y `motor`.
El resto de pivotes de la suspensión siguen a esos con reglas sencillas. Cada uno lleva en sus
extras de glTF `rig` (JSON): restricciones (`DAMPED_TRACK`, `STRETCH_TO`, `LOCKED_TRACK`) con el
pivote objetivo y su eje, y drivers (canal, índice, expresión y la propiedad del mando que leen).
Los mandos (`esquina_XX.recorrido`, `raiz.flotacion_aro/cabeceo/balanceo`, `motor.oscilacion`,
`direccion_X.direccion`, `rueda_XX.giro`) van como extras numéricos, y la raíz lleva sus rangos en
`controles`. Con eso, un solucionador pequeño en el juego reproduce la suspensión de Blender.

- L0: sin soldaduras, tornillería, nervios, roscas ni piezas menores de 2 cm; biseles de 1 segmento
  solo en piezas de 15 cm o más.
- L1: además sin tacos, nervios, roscas ni aletas; sin biseles y curvas a baja resolución.
- L2: solo silueta: chasis, ruedas lisas, aro, amortiguadores, motor y torreta; sin curvas.
Cada pieza se decima por separado ANTES de unirla (conserva su forma mejor que decimar la malla
unida del pivote), y se quitan familias enteras de detalle en vez de forzar el decimado.
Los materiales se exportan planos con el color de la PALETA (el juego los pasa a Lambert); las
variantes `_canto` se funden con su pintura y `led`/`piloto` llevan emisión.
"""
import json
import math
import os
import re
import sys

import bmesh
import bpy
from mathutils import Matrix

RAIZ = os.path.dirname(os.path.abspath(__file__))
g = {"__name__": "tubular_cbl"}
exec(open(os.path.join(RAIZ, "tubular.py"), encoding="utf8").read(), g)

# nivel: (tamaño mínimo de pieza en m, segmentos de bisel (0 = sin bisel), resolución de curvas
#         (None = sin curvas), proporción de decimado por pieza, triángulos de pieza a partir de los
#         que se decima, familias de piezas que no se exportan)
_L0 = r"cordon|uña_|perilla|perno|remache|bulon|tornillo|anclaje_|tapon|eslabon|puerto_|tuerca|valvula|" \
      r"nervio|rosca|laminilla"
_L1 = _L0 + r"|taco|nervio|rosca|aleta|abrazadera|lamina|fuelle|laminilla|asiento_|collarin|lente_led_"
_L2 = _L1 + r"|resorte|dentado|protector|disco|mordaza|pastilla|beadlock|colector|admision|cinta|" \
            r"cartela|pestaña|refuerzo|camisa|ventilador|radiador|uniball|heim|ojo|rayo|piñon"
NIVELES = {0: (0.02, 1, (6, 2), .40, 60, _L0),
           1: (0.05, 0, (3, 1), .22, 40, _L1),
           2: (0.12, 0, None, .16, 24, _L2)}
BISEL_MINIMO = .15  # las piezas menores no llevan bisel en ningún nivel (los tacos, sobre todo)
# Pivotes que mueve el juego aunque en Blender no tengan driver (los posa la animación).
ANIMABLES = {"raiz", "plataforma_aro", "torreta", "arma", "boca", "motor"}


def movil(o):
    return bool(o.constraints) or bool(o.animation_data and o.animation_data.drivers)


def base(nombre):
    return re.sub(r"\.\d+$", "", nombre)


def triangulos(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def materiales_planos():
    """Un material plano por color de la PALETA: el juego solo lee color y emisión."""
    planos = {}
    for nombre, (hexadecimal, metal, rugosidad) in g["PALETA"].items():
        m = bpy.data.materials.new("exp_" + nombre)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        color = g["lineal"](hexadecimal)
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rugosidad
        if nombre in ("led", "piloto"):
            bsdf.inputs["Emission Color"].default_value = color
            bsdf.inputs["Emission Strength"].default_value = 1
        planos[nombre] = m
    return planos


def material_plano(m, planos):
    nombre = base(m.name).removesuffix("_canto") if m else "grafito"
    return planos.get(nombre, planos["grafito"])


def reglas(o, final):
    """Restricciones y drivers del objeto, con los nombres finales de los pivotes."""
    salida = []
    for c in o.constraints:
        if not c.target:
            continue
        regla = dict(tipo=c.type, objetivo=final(c.target))
        for prop in ("track_axis", "lock_axis", "volume", "keep_axis"):
            if hasattr(c, prop):
                regla[prop] = getattr(c, prop)
        if c.type == "STRETCH_TO":
            regla["longitud_reposo"] = c.rest_length
        salida.append(regla)
    if o.animation_data:
        for d in o.animation_data.drivers:
            variables = [dict(nombre=v.name, mando=final(v.targets[0].id), ruta=v.targets[0].data_path)
                         for v in d.driver.variables if v.targets[0].id]
            salida.append(dict(tipo="DRIVER", canal=d.data_path, indice=d.array_index,
                               expresion=d.driver.expression, variables=variables))
    return salida


def objetivos(o):
    for c in o.constraints:
        if c.target:
            yield c.target
    if o.animation_data:
        for d in o.animation_data.drivers:
            for v in d.driver.variables:
                if isinstance(v.targets[0].id, bpy.types.Object):
                    yield v.targets[0].id


def mallas_de(o, dg):
    """Malla evaluada (modificadores y curvas) en coordenadas locales del objeto."""
    return bpy.data.meshes.new_from_object(o.evaluated_get(dg))


def unir(pivote, piezas, nombre, col, dg, planos):
    bm, mats = bmesh.new(), []
    inv = pivote.matrix_world.inverted()
    for o in piezas:
        me = mallas_de(o, dg)
        tmp = bmesh.new()
        tmp.from_mesh(me)
        bmesh.ops.transform(tmp, matrix=inv @ o.matrix_world, verts=tmp.verts)
        remap = []
        for m in (me.materials or [None]):
            plano = material_plano(m, planos)
            if plano not in mats:
                mats.append(plano)
            remap.append(mats.index(plano))
        for f in tmp.faces:
            f.material_index = remap[min(f.material_index, len(remap) - 1)]
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    u = bpy.data.objects.new(nombre, me)
    col.objects.link(u)
    u.parent = pivote
    return u


def aristas_vivas(o, angulo=30):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    vivas = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angulo)]
    bmesh.ops.split_edges(bm, edges=vivas)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(o.data)
    bm.free()


def limpiar_estado():
    g["CONTROLES"].clear()
    g["CAPAS"].clear()
    g["TRAMOS"].clear()


def nivel(n, col, planos):
    minimo, segs, curvas, proporcion, umbral, familias = NIVELES[n]
    fuera = re.compile(familias)
    limpiar_estado()
    raiz, _ = g["construir"]()
    controles = [dict(c) for c in g["CONTROLES"]]
    todos = [raiz] + list(raiz.children_recursive)
    bpy.context.view_layer.update()

    # Pivotes: lo que se mueve, lo que mueve el juego, los mandos y los objetivos de las reglas.
    pivotes = {o for o in todos if o.type == "EMPTY" and (movil(o) or o.keys())}
    pivotes |= {o for o in todos if base(o.name) in ANIMABLES or movil(o)}
    for o in list(pivotes):
        pivotes |= set(objetivos(o))
    pivotes.add(raiz)

    def final(o):
        nombre = "VehiculoTubular" if o == raiz else base(o.name)
        return f"L{n}_{nombre}"

    rig = {o: reglas(o, final) for o in pivotes}
    mundo = {o: o.matrix_world.copy() for o in todos}

    # Mallas que se exportan y su pivote (el ancestro más cercano que es pivote; uno mismo si lo es).
    piezas = {}
    for o in todos:
        if o.type not in ("MESH", "CURVE") or fuera.match(base(o.name)):
            continue
        if o.type == "CURVE":
            if curvas is None:
                continue
            o.data.resolution_u, o.data.bevel_resolution = curvas
        if o.type == "MESH":
            for md in o.modifiers:
                if md.type == "BEVEL":
                    md.segments = max(segs, 1)
                    md.show_render = md.show_viewport = segs > 0 and max(o.dimensions) >= BISEL_MINIMO
        if minimo and max(o.dimensions) < minimo and not any(h.type == "MESH" for h in o.children):
            continue
        p = o
        while p not in pivotes:
            p = p.parent
        piezas.setdefault(p, []).append(o)

    # Las mallas que son pivote (motor, piñón) se sustituyen por un Empty con su transformación.
    for o in [p for p in pivotes if p.type != "EMPTY"]:
        e = bpy.data.objects.new(o.name + "__piv", None)
        col.objects.link(e)
        e.parent = o.parent
        e.matrix_world = mundo[o]
        for h in o.children:
            h.parent = e
            h.matrix_world = mundo[h]
        for k in o.keys():
            e[k] = o[k]
        nombre = o.name
        o.name = nombre + "__malla"
        e.name = nombre
        mundo[e], rig[e] = mundo[o], rig.pop(o)
        pivotes.discard(o)
        pivotes.add(e)
        if o in piezas:
            piezas.setdefault(e, []).extend(piezas.pop(o))
        if o == raiz:
            raiz = e

    dg = bpy.context.evaluated_depsgraph_get()
    # Decimado por pieza, como último modificador: cada pieza conserva su propia silueta.
    for lista in piezas.values():
        for o in lista:
            if o.type == "MESH":
                me = mallas_de(o, dg)
                if triangulos(me) > umbral:
                    o.modifiers.new("decimar", "DECIMATE").ratio = proporcion
                bpy.data.meshes.remove(me)
    dg = bpy.context.evaluated_depsgraph_get()
    unidas = [unir(p, lista, f"{final(p)}_malla", col, dg, planos) for p, lista in piezas.items()]
    for u in unidas:
        aristas_vivas(u)
    total = sum(triangulos(u.data) for u in unidas)

    # Congela la pose de reposo: sin restricciones ni drivers; cada pivote cuelga del pivote
    # ancestro más cercano con la misma transformación de mundo.
    orden = sorted(pivotes, key=lambda o: len(list(g["padres"](o))))
    for o in orden:
        o.constraints.clear()
        o.animation_data_clear()
    for o in orden:
        if o is raiz:
            continue
        p = o.parent
        while p is not None and p not in pivotes:
            p = p.parent
        o.parent = p
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_world = mundo[o]
        bpy.context.view_layer.update()
    for u in unidas:
        bpy.context.view_layer.update()
    for o in todos:
        if o not in pivotes and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.name.endswith("__malla"):
            bpy.data.objects.remove(o, do_unlink=True)
    # Nombres finales, colección y extras.
    for o in pivotes:
        o.name = final(o)
        for c in o.users_collection:
            if c != col:
                c.objects.unlink(o)
        if o.name not in col.objects:
            col.objects.link(o)
        if rig.get(o):
            o["rig"] = json.dumps(rig[o], ensure_ascii=False)
    raiz["controles"] = json.dumps(
        [dict(c, objeto=f"L{n}_" + ("VehiculoTubular" if c["objeto"] == "raiz" else c["objeto"]))
         for c in controles], ensure_ascii=False)
    print(f"LOD{n}: {len(pivotes)} pivotes, {len(unidas)} mallas, {total} triángulos")
    return dict(pivotes=len(pivotes), mallas=len(unidas), triangulos=total)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ruta = os.path.abspath(argv[0] if argv else "vehiculo_tubular.glb")
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    esc = bpy.context.scene
    planos = materiales_planos()
    resumen = {}
    for n in NIVELES:
        col = bpy.data.collections.new(f"LOD{n}")
        esc.collection.children.link(col)
        resumen[f"L{n}"] = nivel(n, col, planos)
    for m in list(bpy.data.materials):
        if not m.name.startswith("exp_"):
            bpy.data.materials.remove(m)
    for m in bpy.data.materials:
        m.name = m.name.removeprefix("exp_")
    bpy.ops.export_scene.gltf(filepath=ruta, export_format="GLB", export_yup=True, export_apply=True,
                              export_animations=False, export_extras=True)
    resumen["bytes"] = os.path.getsize(ruta)
    print("EXPORTADO", ruta, json.dumps(resumen))


main()
