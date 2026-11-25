"""Vehículo tubular para Blender 5.2. Coordenadas de diseño en metros, frente +Y."""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

DIM = {
    "aro_r": .696, "aro_tubo": .075, "cruceta_r": .035, "centro_r": .26, "centro_h": .03,
    "rueda_x": .88, "rueda_y": 1.45, "rueda_r": .40, "rueda_ancho": .30,
    "hombro_llanta": .025, "rin_r": .245, "rin_pared": .013, "rayo_r": .020,
    "buje_r": .075, "tapa_r": .042, "tuerca_r": .010, "circulo_tuercas": .055,
    "disco_r": .177, "disco_x": .858, "mordaza": (.045, .065, .054),
    "kingpin_x": .805, "bisel": .012, "espira_r": .055, "alambre_r": .007,
    "motor": (.62, .48, .38), "tapa_motor": (.55, .39, .055), "escape_r": .026,
    "escape_l": .38, "filtro_r": .105, "filtro_alto": .055,
    "fija": (.34, .24, .05), "movil": (.31, .21, .04),
    "base_r": .31, "base_alto": .03, "pedestal_r": .07,
    "pedestal_h": .70-.08*1.4, "pitch_h": .70, "horquilla_x": .087,  # v5: +0.25 m de torreta
    "placa": (.034, .105, .15), "puente": (.208, .105, .035), "eje_r": .038,
    "cajon": (.14, .55, .16), "cajon_y": -.09, "canon_r": .022, "canon_largo": .65,
    "camisa_r": .035, "camisa_pared": .004, "municion": (.12, .22, .16),
    "municion_y": -.18, "agarre_r": .022, "agarre_x": .058,
    "agarre_atras": .075, "agarre_alto": .17,
    "suelo_lado": 200, "distancia_camara": 9,
}
VISTAS = ("34", "frente", "lateral", "superior")

# La base sigue la pista móvil. La elevación del eje viene fijada por el rig.
for clave in ("base_alto", "pedestal_r", "horquilla_x", "placa", "puente", "eje_r",
              "cajon", "cajon_y", "canon_r", "canon_largo", "camisa_r", "camisa_pared",
              "municion", "municion_y", "agarre_r", "agarre_x", "agarre_atras", "agarre_alto"):
    valor = DIM[clave]
    DIM[clave] = tuple(1.4*v for v in valor) if isinstance(valor, tuple) else valor*1.4
CLIP_X, CLIP_Y, CLIP_Z = .30, .95, .75
distancia = math.hypot(CLIP_X, CLIP_Y)
ax, ay = CLIP_X*DIM["aro_r"]/distancia, CLIP_Y*DIM["aro_r"]/distancia
DIM["aro_z"] = CLIP_Z + distancia - DIM["aro_r"]
DIM["placa_z"] = DIM["aro_z"] + DIM["cruceta_r"]
DIM["yaw_z"] = (DIM["placa_z"] + DIM["centro_h"]/2 + DIM["fija"][2]
                + DIM["movil"][2] + DIM["base_alto"]/2)
DIM["pitch_z"] = DIM["yaw_z"] + DIM["pitch_h"]
DIM["pedestal_z"] = DIM["yaw_z"] + DIM["pedestal_h"]

PALETA = {
    "grafito": ("464B53", .12, .45), "acero": ("A9ADB1", .95, .36),
    "goma": ("26272B", 0, .85), "naranja": ("D35C38", .12, .50),
    "crema": ("E7DFCE", .12, .46), "rol": ("2E8C93", .84, .34),
    "aro_satinado": ("A9ADB1", 1, .28), "cromo": ("DBE1E5", 1, .05),
    "pavonado": ("373D46", .94, .31), "laton": ("B89956", .94, .32),
    "aluminio_fundido": ("A9ADB1", .83, .49), "bloque_motor": ("D35C38", .12, .50),
    "led": ("F2F5FF", 0, .22), "piloto": ("FF3827", 0, .26),
    "suelo": ("C8A97A", 0, .91),
}


def lineal(hexadecimal):
    rgb = [int(hexadecimal[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)


PINTURAS = ("grafito", "crema", "naranja", "bloque_motor")


def acabado(mat, nombre, base, metal, rugosidad, canto=False):
    """canto=True: variante para las caras que crea el bisel, donde la pintura se gasta."""
    arbol = mat.node_tree
    nuevo = arbol.nodes.new
    def conectar(entrada, valor):
        if isinstance(valor, bpy.types.NodeSocket):
            arbol.links.new(valor, entrada)
        else:
            entrada.default_value = valor

    def operacion(tipo, a, b):
        nodo = nuevo("ShaderNodeMath")
        nodo.operation = tipo
        conectar(nodo.inputs[0], a)
        conectar(nodo.inputs[1], b)
        return nodo.outputs[0]

    def mezclar(factor, a, b):
        nodo = nuevo("ShaderNodeMixRGB")
        for entrada, valor in zip(nodo.inputs, (factor, a, b)):
            conectar(entrada, valor)
        return nodo.outputs[0]

    def ruido(vector, escala):
        nodo = nuevo("ShaderNodeTexNoise")
        conectar(nodo.inputs["Vector"], vector)
        nodo.inputs["Scale"].default_value = escala
        return nodo.outputs["Fac"]

    def rango(valor, inicio, fin, bajo=0., alto=1.):
        nodo = nuevo("ShaderNodeMapRange")
        for entrada, v in zip(nodo.inputs, (valor, inicio, fin, bajo, alto)):
            conectar(entrada, v)
        return nodo.outputs[0]

    bsdf = next(n for n in arbol.nodes if n.type == "BSDF_PRINCIPLED")
    color = base
    if nombre in ("led", "piloto"):
        conectar(bsdf.inputs["Emission Color"], base)
        bsdf.inputs["Emission Strength"].default_value = 3

    posicion = nuevo("ShaderNodeNewGeometry").outputs["Position"]
    xyz = nuevo("ShaderNodeSeparateXYZ")
    conectar(xyz.inputs[0], posicion)
    local = nuevo("ShaderNodeTexCoord").outputs["Object"]
    grano = ruido(local, 185)
    manchas = ruido(local, 11)
    relieve = grano
    if nombre == "suelo":
        # Dos bandas suaves se prolongan detrás de las ruedas hacia -Y.
        distancia = operacion("ABSOLUTE", xyz.outputs["X"], 0)
        distancia = operacion("ABSOLUTE", operacion("SUBTRACT", distancia, DIM["rueda_x"]), 0)
        banda = operacion("MULTIPLY", rango(distancia, .17, .065),
                          rango(xyz.outputs["Y"], -1.25, -1.7))
        onda = operacion("SINE", operacion("MULTIPLY", xyz.outputs["Y"], 61), 0)
        rodada = operacion("MULTIPLY", banda, rango(onda, -1, 1, .38, .9))
        color = mezclar(manchas, lineal("A98B60"), lineal("D8BE94"))
        # La escena estática trae huellas de entrada. En animación las dibujan las ruedas.
        activar = nuevo("ShaderNodeValue")
        activar.name = "huellas_estudio"
        activar.outputs[0].default_value = 1.
        rodada = operacion("MULTIPLY", rodada, activar.outputs[0])
        color = mezclar(rodada, color, lineal("A88A60"))
        relieve = operacion("SUBTRACT", grano, operacion("MULTIPLY", rodada, 3))
    else:
        atributo = nuevo("ShaderNodeVertexColor")
        atributo.layer_name = "Acabado"
        canales = nuevo("ShaderNodeSeparateColor")
        conectar(canales.inputs[0], atributo.outputs["Color"])
        borde, cavidad, calor = canales.outputs[:3]
        # El atributo «borde» vale 1 en todos los vértices de una malla de pocos vértices y
        # se interpola a toda la cara; por eso el desgaste vive solo en las caras del bisel.
        if canto and nombre in PINTURAS:
            escala = nuevo("ShaderNodeVectorMath")
            escala.operation = "MULTIPLY"
            conectar(escala.inputs[0], local)
            escala.inputs[1].default_value = (500, 38, 370)
            desgaste = rango(ruido(escala.outputs[0], 1), .42, .6, .35, 1)
            color = mezclar(desgaste, color, lineal("A9ADB1"))
            metal = rango(desgaste, 0, 1, metal, .96)
        if nombre == "bloque_motor":
            # Oclusión de las aletas contiguas en la pared del bloque, en espacio local.
            eje = nuevo("ShaderNodeSeparateXYZ")
            conectar(eje.inputs[0], local)
            costado = rango(operacion("ABSOLUTE", eje.outputs["X"], 0), .28, .307)
            h = operacion("ADD", eje.outputs["Z"], .14)
            vano = operacion("COSINE", operacion("MULTIPLY", h, math.tau/.036), 0)
            ranuras = operacion("MULTIPLY", costado, rango(vano, -.85, .9, .1, .95))
            cavidad = operacion("MAXIMUM", cavidad, ranuras)
        mugre = operacion("MULTIPLY", cavidad, manchas)
        color = mezclar(mugre, color, lineal("332D25"))
        if nombre == "bloque_motor":
            rugosidad = rango(mugre, 0, .65, rugosidad, .17)
        if nombre == "aro_satinado":
            tangente = nuevo("ShaderNodeTangent")
            tangente.direction_type, tangente.axis = "RADIAL", "Z"
            conectar(bsdf.inputs["Tangent"], tangente.outputs[0])
            bsdf.inputs["Anisotropic"].default_value = .55
            color = mezclar(operacion("MULTIPLY", calor, .24), color,
                            mezclar(manchas, lineal("798BA8"), lineal("B5A078")))
        altura = rango(xyz.outputs["Z"], 0, DIM["aro_z"], 1, 0)
        polvo = operacion("MULTIPLY", altura, rango(manchas, .22, .75, .16, .92))
        if nombre != "goma":
            polvo = operacion("MULTIPLY", polvo, .50)
        color = mezclar(polvo, color, lineal("C8A97A"))
        # La película de arena cubre también el reflejo del sustrato.
        limpio = operacion("SUBTRACT", 1, polvo)
        metal = operacion("MULTIPLY", metal, limpio)
        rugosidad = operacion("ADD", operacion("MULTIPLY", rugosidad, limpio),
                              operacion("MULTIPLY", polvo, .91))
    bump = nuevo("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .22 if nombre == "suelo" else .09
    bump.inputs["Distance"].default_value = .009 if nombre == "suelo" else .0003
    conectar(bump.inputs["Height"], relieve)
    for clave, valor in (("Normal", bump.outputs[0]), ("Base Color", color),
                         ("Metallic", metal), ("Roughness", rugosidad)):
        conectar(bsdf.inputs[clave], valor)


def materiales():
    for nombre, (hexadecimal, metal, rugosidad) in PALETA.items():
        mat = bpy.data.materials.new(nombre)
        if not mat.node_tree:
            mat.use_nodes = True
        mat.diffuse_color = lineal(hexadecimal)
        acabado(mat, nombre, lineal(hexadecimal), metal, rugosidad)
        if nombre in PINTURAS:
            canto = bpy.data.materials.new(nombre + "_canto")
            if not canto.node_tree:
                canto.use_nodes = True
            canto.diffuse_color = lineal(hexadecimal)
            acabado(canto, nombre, lineal(hexadecimal), metal, rugosidad, canto=True)


def preparar_superficie(datos, nombre):
    # Ángulo diedro firmado, independiente del tamaño y del modo de la interfaz.
    bm = bmesh.new()
    bm.from_mesh(datos)
    bm.normal_update()
    capa = bm.verts.layers.float_color.new("Acabado")
    for v in bm.verts:
        angulos = [e.calc_face_angle_signed(0.) for e in v.link_edges if e.is_manifold]
        borde = max([0.] + angulos)
        cavidad = -min([0.] + angulos)
        calor = 0.
        if nombre == "aro":
            distancia = math.hypot(abs(v.co.x)-ax, abs(v.co.y)-ay)
            calor = math.exp(-(distancia/.105)**2)
        v[capa] = (min(1., borde/.95), min(1., cavidad/.95), calor, 1.)
    for cara in bm.faces:
        cara.smooth = True
    for e in bm.edges:
        e.smooth = e.is_manifold and e.calc_face_angle(0.) < math.radians(30)
    bm.to_mesh(datos)
    bm.free()



def objeto(nombre, padre, centro, datos=None):
    """Centros expresados en el sistema del vehículo, convertidos al espacio del padre."""
    obj = bpy.data.objects.new(nombre, datos)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = padre
    obj.location = Vector(centro)
    ancestro = padre
    while ancestro:
        obj.location -= ancestro.location
        ancestro = ancestro.parent
    if datos is None:
        obj.empty_display_size = DIM["pedestal_r"]
    return obj


def malla(nombre, padre, centro, mat, vertices, caras):
    datos = bpy.data.meshes.new(nombre)
    datos.from_pydata(vertices, [], caras)
    datos.materials.append(bpy.data.materials[mat])
    datos.update()
    preparar_superficie(datos, nombre)
    return objeto(nombre, padre, centro, datos)


def caja(nombre, padre, centro, tam, mat):
    x, y, z = (v / 2 for v in tam)
    vertices = [(i*x, j*y, k*z) for k in (-1, 1) for i, j in
                ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    caras = [(3, 2, 1, 0), (4, 5, 6, 7)]
    caras.extend((i, (i+1)%4, 4+(i+1)%4, 4+i) for i in range(4))
    return biselar(malla(nombre, padre, centro, mat, vertices, caras), .0015)


def revolucion(nombre, padre, centro, eje, perfil, mat, cerrado=False, n=48,
               perforar=False):
    """Perfil (radio, distancia axial). Las ventanas comparten bordes con su pared interior."""
    direccion = Vector(eje).normalized()
    guia = Vector((0, 0, 1)) if abs(direccion.z) < .9 else Vector((1, 0, 0))
    u = (guia - direccion * guia.dot(direccion)).normalized()
    v = direccion.cross(u)
    vertices = []
    for radio, altura in perfil:
        for i in range(n):
            a = math.tau*i/n
            vertices.append(direccion*altura + radio*(u*math.cos(a) + v*math.sin(a)))
    caras = []
    filas = len(perfil)
    for k in range(filas if cerrado else filas-1):
        for i in range(n):
            j = (i+1)%n
            a, b = k*n, ((k+1)%filas)*n
            if perforar and k in (1, 3, 7, 9) and i%8 in (1, 2, 3):
                # Dos hileras de ventanas. Cerrar sus cuatro cantos desde la piel exterior.
                if k in (1, 3):
                    c, d = (filas-1-k)*n, (filas-2-k)*n
                    caras.extend([(a+i, a+j, c+j, c+i), (b+j, b+i, d+i, d+j)])
                    if i%8 == 1:
                        caras.append((b+i, a+i, c+i, d+i))
                    if i%8 == 3:
                        caras.append((a+j, b+j, d+j, c+j))
                continue
            caras.append((a+i, a+j, b+j, b+i))
    if not cerrado:
        caras.extend([tuple(reversed(range(n))), tuple(range((filas-1)*n, filas*n))])
    return malla(nombre, padre, centro, mat, vertices, caras)


def tubo(nombre, padre, inicio, fin, radio, mat="grafito", n=24):
    inicio, fin = Vector(inicio), Vector(fin)
    eje = fin-inicio
    h = eje.length/2
    perfil = [(radio, -h), (radio, h)]
    if mat == "grafito" and h > 2*radio:
        # Acotar la interpolación del desgaste de los cantos a los extremos.
        margen = min(.012, radio/2)
        perfil[1:1] = [(radio, margen-h), (radio, h-margen)]
    pieza = revolucion(nombre, padre, (inicio+fin)/2, eje, perfil, mat, n=n)
    if nombre.startswith(("torre_", "larguero_", "travesaño_", "cruceta_", "soporte_cremallera",
                          "soporte_diferencial", "puente_tope_", "rama_", "orejeta_", "tirante_motor_")):
        for i,(ext,dir_) in enumerate(((inicio,eje.normalized()),(fin,-eje.normalized()))):
            soldadura(f"{nombre}_{i}",pieza,ext+dir_*min(.026,h*.45),dir_,radio,"estructura")
            if nombre.startswith("travesaño_"):
                tapa = revolucion(f"tapon_{nombre}_{i}",pieza,ext,dir_,
                                  [(radio*.90,-.004),(radio*.97,0)],"grafito",n=12)
                detalle(tapa,"estructura")
    return pieza


def prisma(nombre, padre, centro, contorno, espesor, mat):
    # Contorno antihorario visto desde la punta del vector espesor.
    n = len(contorno)
    vertices = [Vector(p) + signo * Vector(espesor)/2 for signo in (-1, 1) for p in contorno]
    caras = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    caras.extend((i, (i+1)%n, n+(i+1)%n, n+i) for i in range(n))
    return biselar(malla(nombre, padre, centro, mat, vertices, caras), .0015)


def bloque(nombre, padre, centro, tam, mat):
    x, y, z = (v/2 for v in tam)
    b = DIM["bisel"]
    perfil = [(-x+b,-y), (x-b,-y), (x,-y+b), (x,y-b),
              (x-b,y), (-x+b,y), (-x,y-b), (-x,-y+b)]
    return prisma(nombre, padre, centro, [(a,b,0) for a,b in perfil], (0,0,2*z), mat)


def biselar(obj, ancho):
    if ancho and obj.type == "MESH":
        bisel = obj.modifiers.get("Bisel de fabricación") or obj.modifiers.new("Bisel de fabricación", "BEVEL")
        bisel.limit_method = "ANGLE"
        bisel.width, bisel.segments = ancho, 1
        mats = obj.data.materials
        if len(mats) == 1 and mats[0] and mats[0].name in PINTURAS:
            gastado = bpy.data.materials.get(mats[0].name + "_canto")
            if gastado:
                mats.append(gastado)
                bisel.material = 1
        if not any(m.type == "WEIGHTED_NORMAL" for m in obj.modifiers):
            normales = obj.modifiers.new("Normales ponderadas", "WEIGHTED_NORMAL")
            normales.keep_sharp = True
    return obj


def detalle(obj, zona, ancho=.001):
    obj["zona_detalle"] = zona
    return biselar(obj, ancho)


def tornillo(nombre, padre, p, eje, radio, zona):
    p, eje = Vector(p), Vector(eje).normalized()
    return detalle(tubo(nombre, padre, p-eje*.002, p+eje*radio*.65,
                        radio, "acero", 6), zona)


def curva(nombre, padre, puntos, radio, mat, zona, cerrada=False):
    datos = bpy.data.curves.new(nombre, "CURVE")
    datos.dimensions = "3D"
    datos.resolution_u = 4
    datos.bevel_depth, datos.bevel_resolution = radio, 1
    datos.use_fill_caps = not cerrada
    spline = datos.splines.new("POLY" if cerrada else "BEZIER")
    puntos = [Vector(p) for p in puntos]
    if cerrada:
        spline.points.add(len(puntos)-1)
        for n, p in zip(spline.points, puntos):
            n.co = (*tuple(p-puntos[0]), 1)
    else:
        spline.bezier_points.add(len(puntos)-1)
        for n, p in zip(spline.bezier_points, puntos):
            n.co = p-puntos[0]
            n.handle_left_type = n.handle_right_type = "AUTO"
    spline.use_cyclic_u = cerrada
    datos.materials.append(bpy.data.materials[mat])
    return detalle(objeto(nombre, padre, puntos[0], datos), zona)


def pestana(nombre,padre,p,eje):
    # Oreja con cara perpendicular al bulón y un pie que entra en el soporte.
    eje = Vector(eje).normalized()
    oreja = detalle(tubo("pestaña_"+nombre,padre,p-eje*.006,p+eje*.006,
                         .032,"grafito",12),"estructura")
    tornillo("bulon_"+nombre,oreja,p+eje*.006,eje,.013,"estructura")


def soldadura(nombre, padre, p, eje, radio, zona):
    eje = Vector(eje).normalized()
    u = eje.cross(Z if abs(eje.z)<.9 else Y).normalized()
    v = eje.cross(u)
    puntos = []
    for i in range(24):
        t = math.tau*i/24
        r = radio+.0012*math.cos(8*t)
        puntos.append(p+r*(u*math.cos(t)+v*math.sin(t))+eje*.001*math.sin(8*t))
    curva("cordon_"+nombre, padre, puntos, .0035, "acero", zona, True)


def chapa_calada(nombre, padre, a, b, normal, ancho, zona):
    # Dos celdas achaflanadas, cada una con un ojal pasante. Comparten la costura central.
    eje = (b-a).normalized()
    normal = Vector(normal).normalized()
    lateral = normal.cross(eje).normalized()
    normal = eje.cross(lateral)
    largo = (b-a).length
    verts, caras, indices = [], [], {}
    def vert(p):
        clave = tuple(round(v,7) for v in p)
        if clave not in indices:
            indices[clave] = len(verts)
            verts.append(p)
        return indices[clave]
    for j in range(2):
        c = eje*largo*(.25+.5*j)
        capas = []
        for h in (-.004,.004):
            borde, hueco = [], []
            for i in range(8):
                t = math.tau*i/8
                x,y = math.cos(t), math.sin(t)
                escala = max(abs(x),abs(y))
                borde.append(vert(c+eje*(x/escala*largo/4)+lateral*(y/escala*ancho/2)+normal*h))
                hueco.append(vert(c+(eje*x+lateral*y)*min(ancho*.32,largo*.09)+normal*h))
            capas.append((borde,hueco))
        (inf,hi),(sup,hs) = capas
        for i in range(8):
            k = (i+1)%8
            caras.extend(((sup[i],sup[k],hs[k],hs[i]),(inf[k],inf[i],hi[i],hi[k]),
                          (hi[i],hs[i],hs[k],hi[k])))
            if i not in ((7,0) if j==0 else (3,4)):
                caras.append((inf[i],inf[k],sup[k],sup[i]))
    return detalle(malla(nombre,padre,a,"grafito",verts,caras),zona)


def flexible_entre(nombre, fijo, movil, radio, panza, zona):
    # +Y local se orienta y estira exactamente de racor a racor en cada pose.
    guia = seguir("guia_"+nombre,fijo,movil,True)
    p = origen(fijo)
    dy = Y*(origen(movil)-p).length
    return curva(nombre,guia,[p,p+.30*dy+panza,p+.72*dy+panza,p+dy],radio,"goma",zona)


def engrane(nombre,padre,p,n,raiz,punta,alto,fase=0):
    perfil = []
    for i in range(n):
        for f,r in ((-.5,raiz),(-.34,raiz),(-.18,punta),(.18,punta),(.34,raiz)):
            t = fase+math.tau*(i+f)/n
            perfil.append((r*math.cos(t),r*math.sin(t),0))
    # El alma anular conserva la abertura de la pista.
    interior = raiz-.012
    verts, caras = [], []
    m = len(perfil)
    for radio,h in ((None,-alto/2),(None,alto/2),(interior,alto/2),(interior,-alto/2)):
        for x,y,_ in perfil:
            k = radio/math.hypot(x,y) if radio else 1
            verts.append((x*k,y*k,h))
    for j in range(4):
        for i in range(m):
            k = (i+1)%m
            caras.append((j*m+i,j*m+k,(j+1)%4*m+k,(j+1)%4*m+i))
    return detalle(malla(nombre,padre,p,"grafito",verts,caras),"aro",.0006)


def rueda(suf, padre, sx, y):
    d = DIM
    x, r, h = sx*d["rueda_x"], d["rueda_r"], d["rueda_ancho"]/2
    b, rin = d["hombro_llanta"], d["rin_r"]
    piel = r-.018
    perfil = [(rin,-h), (piel-b,-h), (piel,-h+b), (piel,h-b), (piel-b,h), (rin,h)]
    eje = (sx,0,0)
    giro = objeto("rueda_"+suf, padre, (x,y,r))
    control(giro,"giro",-36000,36000,"grados")
    conducir(giro,"delta_rotation_euler",0,giro,"giro","v*pi/180")
    giro.lock_rotation = (False, True, True)
    revolucion("neumatico_"+suf, giro, (x,y,r), eje, perfil, "goma", True)
    # Sectores con canto inclinado. La primera fila tiene una arista en el contacto.
    for fila in range(2):
        for i in range(22):
            t = math.tau*(i+fila/2)/22
            # La laminilla atraviesa la banda y termina dentro de la goma de la carcasa.
            for mitad,(inicio,fin) in enumerate(((0,.074),(.081,.155))):
                verts = []
                for radio in (piel-.006,r):
                    for lateral, fase in ((.006,0),(.130,.04)):
                        for ancho in (inicio,fin):
                            a = t+fase+ancho
                            verts.append(((2*fila-1)*lateral,radio*math.sin(a),-radio*math.cos(a)))
                caras = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
                if fila == 1:
                    caras = [f[::-1] for f in caras]
                taco = malla(f"taco_{suf}_{fila}_{i}_{mitad}", giro, (x,y,r), "goma", verts, caras)
                if mitad:
                    detalle(taco,"ruedas",.0006)
    frente = Vector((x+sx*h,y,r))
    detalle(revolucion("protector_"+suf,giro,frente,eje,
            [(.264,-.003),(.278,.004),(.287,.001),(.292,-.004)],"goma",True,48),"ruedas")
    for i in range(22):
        a = math.tau*i/22
        def flanco(rad,t):
            return frente+Vector((0,rad*math.cos(t),rad*math.sin(t)))
        nervio = tubo(f"nervio_{suf}_{i}",giro,flanco(.29,a),flanco(.351,a+.12),.0035,"goma",6)
        detalle(nervio,"ruedas",.0006)
    valvula = frente+Vector((-sx*.015,.234,0))
    detalle(tubo("valvula_rin_"+suf,giro,valvula,valvula+Vector((sx*.017,-.012,0)),
                 .0045,"goma",10),"ruedas")
    tornillo("tuerca_central_"+suf,giro,frente-Vector((sx*.008,0,0)),eje,.021,"ruedas")
    interior = rin-d["rin_pared"]
    aro = revolucion("rin_"+suf, giro, (x,y,r), eje,
                     [(rin,-h),(rin,h),(interior,h),(interior,-h)], "acero", True)
    cara = x+sx*h*.70
    tubo("buje_"+suf, giro, (sx*d["kingpin_x"],y,r), (cara,y,r), d["buje_r"], "grafito")
    tubo("tapa_"+suf, giro, (cara,y,r), (x+sx*h*.95,y,r), d["tapa_r"], "rol")
    for i in range(6):
        c, s = math.cos(math.tau*i/6), math.sin(math.tau*i/6)
        tubo(f"rayo_{suf}_{i}", aro, (cara-sx*d["rayo_r"],y,r),
             (x+sx*h*.50,y+rin*c,r+rin*s), d["rayo_r"], "acero", 8)
        cy, cz = y+d["circulo_tuercas"]*c, r+d["circulo_tuercas"]*s
        tubo(f"tuerca_{suf}_{i}", giro, (cara,cy,cz), (cara+sx*d["tuerca_r"],cy,cz),
             d["tuerca_r"], "acero", 6)
    borde = x+sx*(h-.008)
    revolucion("beadlock_"+suf,giro,(borde,y,r),eje,
               [(rin+.016,-.006),(rin+.016,.006),(rin-.01,.006),(rin-.01,-.006)],"rol",True)
    for i in range(12):
        a = math.tau*i/12
        cy,cz = y+(rin+.003)*math.cos(a), r+(rin+.003)*math.sin(a)
        tubo(f"perno_{suf}_{i}",giro,(borde,cy,cz),(borde+sx*.008,cy,cz),.008,"acero",6)
    dx, dh = sx*d["disco_x"], .011
    radio, hueco = d["disco_r"], d["buje_r"]-.012
    for i,signo in enumerate((-1,1)):
        revolucion(f"disco_{suf}_{i}",giro,(dx+signo*.008,y,r),eje,
                   [(radio,-.003),(radio,.003),(hueco,.003),(hueco,-.003)],"acero",True,32)
    for i in range(12):
        a = math.tau*i/12
        tubo(f"aleta_disco_{suf}_{i}",giro,(dx,y+.085*math.cos(a),r+.085*math.sin(a)),
             (dx,y+.168*math.cos(a+.16),r+.168*math.sin(a+.16)),.006,"grafito",6)
    # Dos pastillas a los lados del rotor y un puente por encima de su canto.
    w, l, h = d["mordaza"]
    pastilla = (w/2-dh)*.85
    for i, signo in enumerate((-1,1)):
        caja(f"pastilla_{suf}_{i}", padre, (dx+signo*(w-pastilla)/2,y,r+d["disco_r"]),
             (pastilla,l,h), "naranja")
    tubo("soporte_mordaza_"+suf,padre,(sx*d["kingpin_x"],y,r+.09),
         (dx-sx*w/2,y,r+d["disco_r"]),.009,"grafito",12)
    caja("mordaza_"+suf, padre, (dx,y,r+d["disco_r"]+h/2), (w,l,h/3), "naranja")


def resorte(nombre, padre, abajo, arriba, vueltas):
    d = DIM
    eje = (arriba-abajo).normalized()
    u = eje.cross(Vector((1,0,0))).normalized()
    v = eje.cross(u)
    pasos, lados = vueltas*14, 6
    vertices, caras = [], []
    for i in range(pasos+1):
        f = i/pasos
        a = math.tau*vueltas*f
        radial = u*math.cos(a)+v*math.sin(a)
        centro = (arriba-abajo)*f + radial*d["espira_r"]
        tangente = (arriba-abajo) + math.tau*vueltas*d["espira_r"]*eje.cross(radial)
        normal = tangente.normalized().cross(radial)
        for j in range(lados):
            t = math.tau*j/lados
            vertices.append(centro+d["alambre_r"]*(radial*math.cos(t)+normal*math.sin(t)))
            if i < pasos:
                k, l = i*lados+j, i*lados+(j+1)%lados
                caras.append((k,l,l+lados,k+lados))
    caras.extend([tuple(reversed(range(lados))), tuple(range(pasos*lados,(pasos+1)*lados))])
    malla(nombre, padre, abajo, "naranja", vertices, caras)


# Las piezas axiales se dibujan en +Y local, el eje longitudinal de Stretch To.
Y = Vector((0,1,0))
Z = Vector((0,0,1))
CONTROLES, CAPAS, TRAMOS = [], {}, []


def control(obj, prop, bajo, alto, unidad):
    obj[prop] = 0.0
    obj.id_properties_ui(prop).update(min=bajo, max=alto, default=0.0)
    CONTROLES.append(dict(objeto=obj.name, propiedad=prop, rango=[bajo,alto], unidad=unidad))


def conducir(obj, canal, indice, mando, prop, expresion):
    driver = obj.driver_add(canal, indice).driver
    driver.type = "SCRIPTED"
    var = driver.variables.new()
    var.name = "v"
    var.targets[0].id = mando
    var.targets[0].data_path = f'["{prop}"]'
    driver.expression = expresion


def origen(obj):
    # Coordenadas de construcción, antes de evaluar las restricciones.
    return sum((o.location for o in padres(obj)), Vector((0,0,0)))


def padres(obj):
    while obj:
        yield obj
        obj = obj.parent


def seguir(nombre, a, b, elastico=False, longitud_reposo=None):
    base = origen(a)
    longitud = longitud_reposo if longitud_reposo is not None else (origen(b)-base).length
    # Heredar sólo el punto del anclaje evita transmitir la escala del trapecio
    # al cilindro rígido y permite orientar el resorte en espacio mundial.
    soporte = next(o for o in padres(a) if o.name.startswith("clip_") or o.name=="raiz")
    marco = objeto(nombre, soporte, base)
    marco.constraints.new("COPY_LOCATION").target = a
    c = marco.constraints.new("STRETCH_TO" if elastico else "DAMPED_TRACK")
    c.target = b
    if elastico:
        c.rest_length = longitud
        c.volume = "NO_VOLUME"
        TRAMOS.append((marco, longitud, b))
    else:
        c.track_axis = "TRACK_Y"
    return marco


def ojo(nombre, ancla, radio):
    centro = origen(ancla)
    for material, r, hueco, ancho in (("acero",radio,.76*radio,.55*radio),
                                       ("goma",.76*radio,.32*radio,.64*radio)):
        revolucion(nombre+"_"+material,ancla,centro,Y,
                   [(r,-ancho),(r,ancho),(hueco,ancho),(hueco,-ancho)],material,True,16)
    if nombre.startswith(("ojo_sup_puntal","ojo_inf_puntal")):
        perfil = [(radio*.53*math.cos(t),radio*.86*math.sin(t))
                  for t in (-1.2,-.8,-.4,0,.4,.8,1.2)]
        revolucion(nombre+"_rotula",ancla,centro,Y,perfil,"acero",n=16)
    tubo(nombre+"_pasador",ancla,centro-Y*radio*.73,centro+Y*radio*.73,.32*radio,"rol",12)


def heim(nombre,padre,p,eje,r):
    for suf,perfil,mat in (
        ("ojo",[(r,-.38*r),(r,.38*r),(.65*r,.38*r),(.65*r,-.38*r)],"grafito"),
        ("bola",[(.53*r,-.54*r),(.71*r,0),(.53*r,.54*r),(.27*r,.54*r),(.27*r,-.54*r)],"acero")):
        detalle(revolucion(nombre+"_"+suf,padre,p,eje,perfil,mat,True,16),"suspension")
    detalle(tubo(nombre+"_eje",padre,p-eje*r*.72,p+eje*r*.72,.28*r,"acero",10),"suspension")
    tornillo(nombre+"_cabeza",padre,p+eje*r*.69,eje,.44*r,"suspension")


def telescopio(nombre, inferior, superior, tipo):
    bajo, alto = origen(inferior), origen(superior)
    largo = (alto-bajo).length
    cuerpo = seguir("guia_cuerpo_"+nombre, superior, inferior)
    vastago = seguir("guia_vastago_"+nombre, inferior, superior)
    radio = {"coilover":.039,"bypass":.045,"puntal":.041}[tipo]
    camisa, barra = (.65*largo, .64*largo)
    despeje = radio*.72 if tipo=="coilover" else 0
    tubo("cuerpo_"+nombre,cuerpo,alto+Y*despeje,alto+Y*camisa,radio,"rol",20)
    tubo("vastago_"+nombre,vastago,bajo+Y*despeje,bajo+Y*barra,radio*.52,"cromo",16)
    for lado,ancla,guia,p in (("inf",inferior,vastago,bajo),("sup",superior,cuerpo,alto)):
        if tipo!="puntal":
            pestana(lado+"_"+nombre,ancla,p+Y*.032,Y)
        if tipo=="coilover":
            # Ojo transversal a la barra. La carcasa y la bola siguen al mismo extremo.
            heim("heim_"+lado+"_"+nombre,guia,p,Z,radio)
        else:
            ojo("ojo_"+lado+"_"+nombre,ancla,radio)
    if tipo == "bypass":
        # Tres circuitos externos con puertos radiales y reguladores hexagonales.
        for i in range(3):
            t = i*math.tau/3
            radial = Vector((math.cos(t),0,math.sin(t)))
            p = alto+Y*camisa*(.12+.05*i)
            q = alto+Y*camisa*(.88-.05*i)
            offset = radial*(radio+.013)
            tubo(f"circuito_{nombre}_{i}",cuerpo,p+offset,q+offset,.008,"acero",10)
            for j,ext in enumerate((p,q)):
                tubo(f"puerto_{nombre}_{i}_{j}",cuerpo,ext+radial*.038,ext+offset,.012,"grafito",10)
                tubo(f"valvula_{nombre}_{i}_{j}",cuerpo,ext+offset,ext+offset+radial*.009,.014,"rol",6)
                detalle(tubo(f"perilla_{nombre}_{i}_{j}",cuerpo,ext+offset+radial*.009,
                             ext+offset+radial*.019,.011,"naranja",8),"suspension")
    else:
        if tipo=="coilover":
            # Los dos platos extremos apoyan en piezas rígidas. Sólo se estira
            # el vano que queda entre ellos, incluso en el tope de compresión.
            asiento_bajo = bajo+Y*.044
            asiento_alto = alto+Y*.092
            pie = objeto("plato_inferior_"+nombre,vastago,asiento_bajo)
            cabeza = objeto("plato_superior_"+nombre,cuerpo,asiento_alto)
            vano = largo-.044-.092
            flexible = seguir("guia_resorte_"+nombre,pie,cabeza,True,vano)
            origen_espira,fracciones = asiento_bajo,(0,.55,1)
        else:
            flexible = seguir("guia_resorte_"+nombre,inferior,superior,True)
            origen_espira,vano,fracciones = bajo,largo,(.22,.74)
        for j,f in enumerate(fracciones):
            centro = origen_espira+Y*vano*f
            marco = flexible
            if tipo=="coilover" and f in (0,1):
                marco,centro = (pie,asiento_bajo) if f==0 else (cabeza,asiento_alto)
            tubo(f"asiento_{nombre}_{j}",marco,centro-Y*.006,centro+Y*.006,.064,"acero",16)
        for j,(f,g) in enumerate(zip(fracciones,fracciones[1:])):
            resorte(f"resorte_{nombre}_{j}",flexible,origen_espira+Y*vano*f,origen_espira+Y*vano*g,5)
        if tipo=="puntal":
            tubo("tubo_inferior_"+nombre,vastago,bajo,bajo+Y*largo*.20,.035,"rol",16)
            tubo("casquillo_"+nombre,cuerpo,alto+Y*largo*.24,alto+Y*largo*.37,.045,"acero",16)
            perfil = [(.034 if j%2 else .046, largo*(.07+.14*j/8)) for j in range(9)]
            revolucion("fuelle_"+nombre,flexible,bajo,Y,perfil,"goma",n=16)
        else:
            perfil = []
            for j in range(15):
                h = .040+j*.007
                perfil.extend(((radio,h),(radio+.0028,h+.002),(radio,h+.004)))
            detalle(revolucion("rosca_"+nombre,cuerpo,alto,Y,perfil,"acero",n=16),"suspension",0)
            h = .072
            for j in range(8):
                a = math.tau*j/8
                centro = alto+Y*h+Vector((.041*math.cos(a),0,.041*math.sin(a)))
                detalle(tubo(f"uña_collarin_{nombre}_{j}",cuerpo,centro,centro+Y*.014,
                             .008,"rol",8),"suspension")
            detalle(tubo("collarin_"+nombre,cuerpo,alto+Y*h,alto+Y*(h+.014),.045,"rol",24),"suspension")
            offset = Vector((.09,0,0))
            p,q = alto+Y*.055,alto+Y*camisa*.8
            tubo("deposito_"+nombre,cuerpo,p+offset,q+offset,.026,"rol",14)
            curva("manguera_"+nombre,cuerpo,[p,p-Y*.043,p+offset-Y*.041,p+offset],
                  .007,"goma","suspension")
            for j,ext in enumerate((p,p+offset)):
                tornillo(f"union_manguera_{nombre}_{j}",cuerpo,ext,-Y,.013,"suspension")
            for j,ext in enumerate((p,q)):
                tubo(f"racor_{nombre}_{j}",cuerpo,ext,ext+offset,.012,"acero",10)
    capa = "brazos_del_aro" if tipo=="puntal" else "suspension_de_esquina"
    CAPAS.setdefault(capa,[]).append(dict(nombre=nombre,tipo=tipo,inferior=inferior.name,
        superior=superior.name,cuerpo_m=camisa,vastago_m=barra))


def esquina(clip, suf, sx, sy):
    def p(x,y,z):
        return Vector((sx*x,sy*y,z))
    k = DIM["kingpin_x"]
    centro = p(k,1.45,.40)
    mando = objeto("esquina_"+suf,clip,centro)
    control(mando,"recorrido",-.18,.22,"m")
    carro = objeto("portamangueta_"+suf,mando,centro)
    conducir(carro,"location",2,mando,"recorrido","v")
    pivotes_inf = (1.32,1.57)
    for nivel,x,z,radio in (("inf",.30,.29,.030),("sup",.37,.53,.025)):
        base, punta = p(x,1.45,z), p(k,1.45,z)
        rotula = objeto("rotula_"+nivel+"_"+suf,carro,punta)
        brazo = objeto("trapecio_"+nivel+"_"+suf,clip,base)
        c = brazo.constraints.new("DAMPED_TRACK")
        c.track_axis = "TRACK_X" if sx==1 else "TRACK_NEGATIVE_X"
        c.target = rotula
        # La corredera radial recoge la variación de radio del guiado vertical.
        luz = k-x
        conducir(brazo,"scale",0,mando,"recorrido",f"sqrt(1+(v/{luz})**2)")
        pivotes = pivotes_inf if nivel=="inf" else (1.22,1.57)
        for i,y in enumerate(pivotes):
            inicio = p(x,y,z)
            pivote = objeto(f"pivote_{nivel}_{suf}_{i}",clip,inicio)
            ojo(pivote.name,pivote,.045)
            tubo(f"rama_{nivel}_{suf}_{i}",brazo,inicio,punta,radio,"acero",16)
        a,b = (p(x,y,z).lerp(punta,.55) for y in pivotes)
        puntos = [a-punta,b-punta,Vector((0,0,0))]
        if (b-a).cross(punta-a).z < 0:
            puntos.reverse()
        prisma("refuerzo_"+nivel+"_"+suf,brazo,punta,puntos,(0,0,.016),"grafito")
        tubo("perno_rotula_"+nivel+"_"+suf,carro,punta-Z*.017,punta+Z*.017,.034,"rol",12)
        heim("uniball_"+nivel+"_"+suf,rotula,punta,Z,.025)
        for i,y in enumerate(pivotes):
            base_p = p(x,y,z)
            tornillo(f"anclaje_{nivel}_{suf}_{i}",clip,base_p+Y*.032,Y,.018,"suspension")
            detalle(caja(f"pestaña_{nivel}_{suf}_{i}",clip,base_p+Y*.029,
                        (.073,.009,.068),"grafito"),"estructura")
        if nivel=="inf":
            inferior = brazo
    torre = p(.396,1.37,1)
    for i,base in enumerate((p(.30,.95,.75),p(.37,1.57,.55),p(.30,1.22,.29))):
        tubo(f"torre_{suf}_{i}",clip,base,torre,.031,"grafito",16)
    for tipo,y in (("coilover",1.57),("bypass",pivotes_inf[0])):
        nombre = tipo+"_"+suf
        bajo = p(.30,y,.29).lerp(p(k,1.45,.29),.52)
        alto = torre+p(0,.085 if tipo=="coilover" else -.085,0)
        tubo("orejeta_"+nombre,clip,torre,alto,.031,"rol",16)
        telescopio(nombre,objeto("pie_"+nombre,inferior,bajo),objeto("torre_"+nombre,clip,alto),tipo)
    # La almohadilla está en un puente entre las dos ramas inferiores.
    f = .26
    a,b = (p(.30,y,.29).lerp(p(k,1.45,.29),f) for y in pivotes_inf)
    medio = (a+b)/2
    tubo("puente_tope_"+suf,inferior,a,b,.021,"acero",12)
    pad = objeto("almohadilla_"+suf,clip,medio)
    conducir(pad,"location",2,mando,"recorrido",f"{pad.location.z}+{f}*v")
    tubo("goma_tope_"+suf,pad,medio,medio+Z*.024,.038,"goma",16)
    asiento = medio+Z*.137
    tubo("soporte_tope_"+suf,clip,p(.37,1.22,.53),asiento,.025,"grafito",12)
    tubo("tope_hidraulico_"+suf,clip,asiento-Z*.051,asiento+Z*.023,.031,"rol",16)
    piston = objeto("piston_tope_"+suf,clip,medio+Z*.059)
    conducir(piston,"location",2,mando,"recorrido",f"{piston.location.z}+max(0,{f}*v-.035)")
    tubo("embolo_tope_"+suf,piston,medio+Z*.059,medio+Z*.111,.022,"acero",12)
    CAPAS["suspension_de_esquina"].append(dict(nombre="tope_hidraulico_"+suf,tipo="tope"))
    portador = carro
    if sy==1:
        portador = objeto("direccion_"+suf[-1],carro,centro)
        control(portador,"direccion",-30,30,"grados")
        conducir(portador,"delta_rotation_euler",2,portador,"direccion","v*pi/180")
        portador.lock_rotation = (True,True,False)
        palanca = p(.78,1.36,.43)
        tubo("palanca_"+suf,portador,centro,palanca,.021,"rol",12)
        a = objeto("rack_"+suf,clip,p(.29,1.34,.43))
        b = objeto("terminal_"+suf,portador,palanca)
        guia = seguir("guia_bieleta_"+suf,a,b,True)
        tubo("bieleta_"+suf,guia,origen(a),origen(a)+Y*(palanca-origen(a)).length,.014,"acero",12)
    bloque("mangueta_"+suf,portador,p(k,1.45,.41),(.058,.07,.24),"grafito")
    a = objeto("salida_dif_"+suf,clip,p(.07,1.25,.40))
    b = objeto("junta_buje_"+suf,carro,centro)
    guia = seguir("guia_palier_"+suf,a,b,True)
    inicio = origen(a)
    fin = inicio+Y*(centro-inicio).length
    tubo("palier_"+suf,guia,inicio,fin,.019,"acero",12)
    for j,(ext,dir_) in enumerate(((inicio,Y),(fin,-Y))):
        perfil = [(.048-i*.002 if i%2==0 else .032,.008*i) for i in range(10)]
        revolucion(f"fuelle_cv_{suf}_{j}",guia,ext,dir_,perfil,"goma",n=14)
        # En el extremo exterior, retranquear la banda respecto del vaso
        # del buje también con la dirección en su tope.
        for i,k_ in enumerate((6,9) if j else (2,8)):
            h = .008*k_
            r = perfil[k_][0]+.001
            detalle(tubo(f"abrazadera_{suf}_{j}_{i}",guia,ext+dir_*(h-.002),
                         ext+dir_*(h+.002),r,"acero",14),"suspension")
    fin_freno = p(DIM["disco_x"],1.45,.40+DIM["disco_r"]+.027)
    flexible_entre("latiguillo_"+suf,objeto("racor_chasis_"+suf,clip,p(.37,1.42,.55)),
                   objeto("racor_freno_"+suf,portador,fin_freno),.004,Z*.045,"suspension")
    rueda(suf,portador,sx,sy*DIM["rueda_y"])


def chasis(raiz, plataforma, motor):
    d = DIM
    z,radio = d["aro_z"],d["aro_r"]
    perfil = [(radio+d["aro_tubo"]*math.cos(i*math.tau/16),d["aro_tubo"]*math.sin(i*math.tau/16))
              for i in range(16)]
    revolucion("aro",plataforma,(0,0,z),(0,0,1),perfil,"aro_satinado",True,96)
    for i,(x,y) in enumerate(((radio,0),(0,radio))):
        tubo(f"cruceta_{i}",plataforma,(-x,-y,z),(x,y,z),d["cruceta_r"])
    h = d["centro_h"]/2
    tubo("placa_central",plataforma,(0,0,d["placa_z"]-h),(0,0,d["placa_z"]+h),d["centro_r"],"acero",48)
    angulos = {}
    for sy,pref in ((1,"d"),(-1,"t")):
        clip = objeto("clip_"+pref,raiz,(0,sy*1.17,.5))
        for i,(x,y,zclip) in enumerate(((.30,.95,.75),(.37,1.57,.55),(.30,1.57,.29),(.30,.95,.25))):
            tubo(f"travesaño_{pref}_{i}",clip,(-x,sy*y,zclip),(x,sy*y,zclip),.035,n=16)
        dif = Vector((0,sy*1.25,.4))
        revolucion("diferencial_"+pref,clip,dif,(1,0,0),
                   [(.066,-.095),(.11,-.056),(.11,.056),(.066,.095)],"rol",n=20)
        tubo("soporte_diferencial_"+pref,clip,(0,sy*1.57,.29),dif,.041,n=16)
        salida = objeto("salida_motor_"+pref,motor,(0,sy*.23,.48))
        entrada = objeto("entrada_dif_"+pref,clip,dif)
        cardan = seguir("guia_cardan_"+pref,salida,entrada,True)
        inicio = origen(salida)
        tubo("cardan_"+pref,cardan,inicio,inicio+Y*(dif-inicio).length,.03,"acero",16)
        for i,ancla in enumerate((salida,entrada)):
            p = origen(ancla)
            tubo(f"junta_{pref}_{i}",ancla,p-Vector((.047,0,0)),p+Vector((.047,0,0)),.037,"rol",12)
        if sy==1:
            tubo("cremallera",clip,(-.31,1.34,.43),(.31,1.34,.43),.035,"grafito",16)
        for sx,lado in ((1,"d"),(-1,"i")):
            suf = pref+lado
            puntos = [Vector((sx*x,sy*y,h)) for x,y,h in
                      ((.30,.95,.75),(.37,1.22,.55),(.37,1.57,.55),(.30,1.57,.29),
                       (.30,1.22,.29),(.30,.95,.25))]
            for i,p in enumerate(puntos):
                tubo(f"larguero_{suf}_{i}",clip,p,puntos[(i+1)%len(puntos)],.035,n=16)
            chapa_calada("cartela_"+suf,clip,puntos[0].lerp(puntos[1],.34),
                         puntos[0].lerp(puntos[-1],.34),(sx,0,0),.052,"estructura")
            if sy==1:
                tubo("soporte_cremallera_"+lado,clip,puntos[1],(sx*.28,1.34,.43),.024,n=12)
            fin = puntos[0]
            inicio = Vector((sx*ax,sy*ay,z))
            nombre = "puntal_"+suf
            telescopio(nombre,objeto("pie_"+nombre,clip,fin),
                       objeto("cabeza_"+nombre,plataforma,inicio),"puntal")
            for j,signo in enumerate((-1,1)):
                p = inicio+Y*signo*.035-Z*.040
                placa = detalle(caja(f"brida_{suf}_{j}",plataforma,p,(.098,.008,.128),"aro_satinado"),"aro",.0012)
                soldadura(placa.name,placa,p-Z*.015,Y,.044,"aro")
                tornillo("bulon_"+placa.name,placa,p-Z*.047+Y*signo*.004,Y*signo,.018,"aro")
            delta = fin-inicio
            angulos[nombre] = round(math.degrees(math.atan2(-delta.z,math.hypot(delta.x,delta.y))),4)
            esquina(clip,suf,sx,sy)
    return angulos


def motorizacion(raiz, plataforma):
    d = DIM
    z = .72
    motor = bloque("motor",raiz,(0,0,z-d["motor"][2]/2),d["motor"],"bloque_motor")
    biselar(motor,.016).modifiers[0].segments = 3
    t = d["tapa_motor"][2]
    bloque("tapa_valvulas",motor,(0,0,z+t/2),d["tapa_motor"],"grafito")
    for lado in (-1, 1):
        for j, y in enumerate((-.17, 0, .17)):
            tornillo(f"tornillo_culata_{lado}_{j}",motor,(lado*.258,y,z+t),Z,.011,"motor")
    tubo("filtro",motor,(0,0,z+t),(0,0,z+t+d["filtro_alto"]),d["filtro_r"],"acero")
    for sx in (-1,1):
        for sy in (-1,1):
            suf = ("d" if sy==1 else "t")+("d" if sx==1 else "i")
            base = Vector((sx*.28,sy*.19,.68))
            arriba = Vector((sx*.55,sy*math.sqrt(d["aro_r"]**2-.55**2),d["aro_z"]-.05))
            pie = objeto("pie_motor_"+suf,motor,base)
            cabeza = objeto("cabeza_motor_"+suf,plataforma,arriba)
            guia = seguir("guia_tirante_"+suf,cabeza,pie)
            largo = (arriba-base).length-.14
            tubo("tirante_motor_"+suf,guia,arriba,arriba+Y*largo,.021,"acero",12)
            tope = objeto("extremo_tirante_"+suf,guia,arriba+Y*largo)
            # El extremo está en coordenadas del tirante ya orientado al evaluarse.
            goma = objeto("soporte_motor_"+suf,pie,base)
            estirar = goma.constraints.new("STRETCH_TO")
            estirar.target, estirar.rest_length, estirar.volume = tope,.14,"NO_VOLUME"
            TRAMOS.append((goma,.14,tope))
            tubo("elastomero_"+suf,goma,base,base+Y*.14,.046,"goma",16)
            guia_placa = seguir("guia_placa_motor_"+suf,pie,tope)
            for j,(ancla,centro) in enumerate(((guia_placa,base),(guia,arriba+Y*largo))):
                tubo(f"placa_soporte_{suf}_{j}",ancla,centro-Y*.005,centro+Y*.005,.055,"acero",16)
                for k,signo in enumerate((-1,1)):
                    p = centro+Vector((signo*.039,.005,0))
                    tornillo(f"bulon_soporte_motor_{suf}_{j}_{k}",ancla,p,Y,.007,"motor")
            CAPAS.setdefault("motor",[]).append(dict(nombre=goma.name,tipo="soporte_elastico"))
        for j in range(4):
            y = -.15+.10*j
            p = Vector((sx*.30,y,.60))
            q = Vector((sx*.225,-.36,.56))
            curva(f"colector_escape_{sx}_{j}",motor,
                  [p,p+Vector((sx*.053,-.028,-.012)),q+Vector((sx*.025,.055,0)),q],
                  .014,"grafito","motor")
            curva(f"admision_{sx}_{j}",motor,[(sx*.085,y,.774),(sx*.18,y,.79),
                  (sx*.254,y,.756)],.018,"acero","motor")
        detalle(tubo(f"plenum_{sx}",motor,(sx*.085,-.19,.774),(sx*.085,.18,.774),
                     .033,"grafito",16),"motor")
        detalle(tubo(f"silenciador_{sx}",motor,(sx*.225,-.35,.56),(sx*.225,-.55,.56),
                     .048,"acero",20),"motor")
        detalle(tubo(f"cola_escape_{sx}",motor,(sx*.225,-.54,.56),(sx*.225,-.61,.55),
                     .022,"grafito",12),"motor")
        for j in range(7):
            detalle(caja(f"aleta_motor_{sx}_{j}",motor,(sx*.307,0,.39+j*.036),
                        (.050,.414,.009),"aluminio_fundido"),"motor")
    control(motor,"oscilacion",-.03,.03,"m")
    conducir(motor,"location",2,motor,"oscilacion",f"{motor.location.z}+v")
    return motor


def accesorios_clips(motor):
    frente,trasero = (bpy.data.objects["clip_"+s] for s in ("d","t"))
    for i in range(4):
        p = Vector((.10+.016*i,.23,.59))
        q = Vector((.22+.012*i,.95,.75))
        flexible_entre(f"cable_motor_{i}",objeto(f"conector_motor_{i}",motor,p),
                       objeto(f"conector_clip_{i}",frente,q),.004,-Z*.085,"motor")
    caja_led = detalle(caja("barra_led",frente,(0,1.588,.55),(.51,.058,.057),"grafito"),"luces")
    for i in range(12):
        detalle(caja(f"lente_led_{i}",caja_led,((i-5.5)*.040,1.618,.55),
                     (.035,.008,.032),"led"),"luces")
    for sx in (-1,1):
        piloto = detalle(caja(f"carcasa_piloto_{sx}",trasero,(sx*.29,-1.59,.55),
                             (.092,.052,.052),"grafito"),"luces")
        detalle(caja(f"lente_piloto_{sx}",piloto,(sx*.29,-1.618,.55),
                     (.079,.010,.038),"piloto"),"luces")
    radiador = detalle(caja("radiador",trasero,(0,-1.565,.434),(.41,.045,.224),"acero"),"motor")
    for i in range(17):
        detalle(caja(f"lamina_radiador_{i}",radiador,((i-8)*.023,-1.590,.434),
                     (.006,.016,.210),"grafito"),"motor")
    centro = Vector((0,-1.607,.434))
    detalle(revolucion("carcasa_ventilador",radiador,centro,Y,
            [(.108,-.018),(.108,.018),(.098,.018),(.098,-.018)],"grafito",True,32),"motor")
    detalle(tubo("buje_ventilador",radiador,centro-Y*.017,centro+Y*.024,.029,"rol",16),"motor")
    for i in range(7):
        t = math.tau*i/7
        radial = Vector((math.cos(t),0,math.sin(t)))
        lateral = radial.cross(Y)
        perfil = [radial*.023,radial*.094+lateral*.003,radial*.088+lateral*.032,
                  radial*.031+lateral*.016]
        detalle(prisma(f"aspa_{i}",radiador,centro,perfil,-Y*.007,"grafito"),"motor")


def corona(nombre, padre, medidas, bajo):
    ext, interior, altura = medidas
    h = altura/2
    perfil = [(ext,-h),(ext,h),(interior,h),(interior,-h)]
    return revolucion(nombre, padre, (0,0,bajo+h), (0,0,1), perfil, "acero", True, 64)


def montaje(raiz):
    d = DIM
    yaw, pitch = d["yaw_z"], d["pitch_z"]
    asiento = d["placa_z"] + d["centro_h"]/2
    corona("corona_fija", raiz, d["fija"], asiento)
    torreta = objeto("torreta", raiz, (0, 0, yaw))
    torreta.lock_rotation = (True, True, False)
    corona("corona_movil", torreta, d["movil"], asiento+d["fija"][2])
    nivel = asiento+d["fija"][2]
    for i in range(24):
        a = math.tau*(i+.5)/24
        tornillo(f"perno_corona_{i}",raiz,(.333*math.cos(a),.333*math.sin(a),nivel),
                 Z,.0055,"aro")
    engrane("dentado_corona",torreta,(0,0,nivel+.020),60,.308,.320,.023)
    p = Vector((.3768,0,nivel+.020))
    pinon = engrane("piñon",raiz,p,12,.0568,.0688,.022,math.pi/12)
    driver = pinon.driver_add("rotation_euler",2).driver
    giro = driver.variables.new()
    giro.name = "yaw"
    giro.targets[0].id = torreta
    giro.targets[0].data_path = "rotation_euler[2]"
    driver.type,driver.expression = "SCRIPTED","-5*yaw"
    detalle(caja("soporte_reductor",raiz,(.3768,0,d["aro_z"]+.038),
                 (.119,.106,.026),"grafito"),"aro")
    detalle(tubo("motor_giro",raiz,(p.x,0,d["aro_z"]+.043),p-Z*.018,.041,"rol",20),"aro")
    detalle(tubo("eje_piñon",raiz,p-Z*.027,p+Z*.015,.051,"acero",16),"aro")
    h = d["base_alto"]/2
    tubo("base", torreta, (0, 0, yaw-h), (0, 0, yaw+h), d["base_r"], "crema", 64)
    z = d["pedestal_z"]
    tubo("pedestal", torreta, (0, 0, yaw+h), (0, 0, z), d["pedestal_r"], "crema")
    # El puente termina bajo las placas. El muñón sobresale de ambas caras.
    apoyo = z+d["puente"][2]/2
    px, py, pz = d["placa"]
    alto = pz-d["puente"][2]/2
    horquilla = caja("horquilla", torreta, (0, 0, z), d["puente"], "rol")
    for lado, s in (("i", -1), ("d", 1)):
        caja("placa_"+lado, horquilla, (s*d["horquilla_x"], 0, apoyo+alto/2), (px,py,alto), "crema")
    hx = d["puente"][0]/2
    tubo("eje_pitch", horquilla, (-hx-.005, 0, pitch), (hx+.005, 0, pitch), d["eje_r"], "acero", 48)
    arma = objeto("arma", torreta, (0, 0, pitch))
    arma.lock_rotation = (False, True, True)
    caja("cajon", arma, (0, d["cajon_y"], pitch), d["cajon"], "crema")
    largo = d["canon_largo"]
    y = d["cajon_y"] + d["cajon"][1]/2
    tubo("cañón", arma, (0, y, pitch), (0, y+largo-.052, pitch), d["canon_r"], "pavonado")
    objeto("boca", arma, (0, y+largo, pitch))
    h = largo/4
    estaciones = [-h, -.8*h, -.18*h, .18*h, .8*h, h]
    perfil = [(d["camisa_r"], t) for t in estaciones]
    perfil += [(d["camisa_r"]-d["camisa_pared"], t) for t in reversed(estaciones)]
    revolucion("camisa", arma, (0, y+h, pitch), (0, 1, 0), perfil, "pavonado", True, perforar=True)
    x = -(d["cajon"][0]+d["municion"][0])/2
    caja("municion", arma, (x, d["municion_y"], pitch), d["municion"], "rol")
    # Accesorios exteriores de atrezo en el espacio de elevación del arma.
    techo = pitch+d["cajon"][2]/2
    tapa = detalle(caja("tapa_alimentador",arma,(0,-.15,techo+.008),
                       (.175,.27,.016),"grafito"),"torreta")
    detalle(tubo("bisagra",tapa,(-.09,-.285,techo),(.09,-.285,techo),.013,"acero",14),"torreta")
    curva("asa",tapa,[(0,-.24,techo+.014),(0,-.21,techo+.072),
                     (0,-.10,techo+.072),(0,-.07,techo+.014)],.009,"grafito","torreta")
    curva("palanca_carga",arma,[(.091,-.19,pitch+.03),(.14,-.19,pitch+.033),
                              (.15,-.229,pitch+.037)],.009,"acero","torreta")
    detalle(caja("alza",arma,(0,-.334,techo+.010),(.058,.016,.022),"grafito"),"torreta")
    for lado in (-1,1):
        detalle(caja(f"oreja_alza_{lado}",arma,(lado*.020,-.334,techo+.031),
                     (.012,.016,.026),"grafito"),"torreta")
    detalle(caja("punto_mira",arma,(0,y+.40,pitch+.055),(.012,.019,.041),"grafito"),"torreta")
    punta = y+largo
    estaciones = [-.078,-.067,-.040,-.033,-.010,0]
    perfil = [(.042,h) for h in estaciones]+[(.029,h) for h in reversed(estaciones)]
    detalle(revolucion("apagallamas",arma,(0,punta,pitch),Y,perfil,"pavonado",True,32,
                       perforar=True),"torreta")
    # Accesorios de superficie del modelo de presentación.
    costado = d["cajon"][0]/2
    atras = d["cajon_y"]-d["cajon"][1]/2
    for lado in (-1, 1):
        lateral = Vector((lado, 0, 0))
        for j, cy in enumerate((-.46, .154)):
            placa = caja(f"panel_cajon_{lado}_{j}",arma,(lado*(costado+.003),cy,pitch),
                        (.006,.085,.15),"crema")
            detalle(placa,"torreta")
            for k, (dy,dz) in enumerate(((-.03,-.059),(.03,-.059),(-.03,.059),(.03,.059))):
                tornillo(f"remache_panel_{lado}_{j}_{k}",placa,
                         (lado*(costado+.006),cy+dy,pitch+dz),lateral,.005,"torreta")
    # Receso entre dos labios en relieve sobre el panel derecho.
    detalle(caja("ranura_expulsion",arma,(costado+.001,-.09,pitch+.025),
                 (.003,.107,.026),"pavonado"),"torreta")
    for k in (-1,1):
        detalle(caja(f"labio_expulsion_{k}",arma,(costado+.005,-.09,pitch+.025+k*.015),
                     (.011,.116,.005),"crema"),"torreta")
    detalle(caja("grupo_gatillo",arma,(0,atras-.009,pitch-.051),
                 (.076,.032,.062),"grafito"),"torreta")
    curva("gatillo_ornamental",arma,[(0,atras-.022,pitch-.041),(0,atras-.044,pitch-.052),
          (0,atras-.049,pitch-.071)],.005,"pavonado","torreta")
    # La caja original está pegada al cajón. La cinta rodea su esquina trasera
    # y atraviesa el vano libre hasta la mejilla izquierda del alimentador.
    borde_y = d["municion_y"]-d["municion"][1]/2
    inicio = Vector((x-.034,borde_y-.006,pitch+.052))
    fin = Vector((-costado-.007,borde_y-.036,pitch+.076))
    detalle(caja("boca_caja_cinta",arma,inicio,(.066,.014,.024),"pavonado"),"torreta")
    detalle(caja("entrada_alimentador",arma,fin,(.014,.063,.026),"pavonado"),"torreta")
    puntos_cinta = []
    for j in range(15):
        f = j/14
        # Tangente inicial hacia atrás, tangente final hacia el costado.
        q = inicio.lerp(fin, f)
        q.x = inicio.x+(fin.x-inicio.x)*f*f
        q.y -= .064*math.sin(math.pi*f)*(1-f)
        q.z -= .071*math.sin(math.pi*f)**2
        puntos_cinta.append(q)
    for j,p in enumerate(puntos_cinta):
        t = puntos_cinta[min(j+1,14)]-puntos_cinta[max(0,j-1)]
        eje = Z.cross(t).normalized()
        detalle(tubo(f"cartucho_cinta_{j}",arma,p-eje*.019,p+eje*.019,
                     .005,"laton",8),"torreta",0)
        detalle(revolucion(f"eslabon_{j}",arma,p,eje,
                [(.0068,-.007),(.0068,.007),(.005,.007),(.005,-.007)],
                "laton",True,10),"torreta",0)
    curva("cinta",arma,puntos_cinta,.004,"grafito","torreta")
    for lado, s in (("i", -1), ("d", 1)):
        x = s*d["agarre_x"]
        tubo("empuñadura_"+lado, arma, (x, atras, pitch),
             (x, atras-d["agarre_atras"], pitch+d["agarre_alto"]), d["agarre_r"], "crema")


def estudio(escena):
    motores = escena.render.bl_rna.properties["engine"].enum_items
    candidatos = [m.identifier for m in motores if "EEVEE" in m.identifier]
    # RNA puede exponer solo los elementos estáticos de un enum dinámico.
    for motor in dict.fromkeys(candidatos + ["BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"]):
        try:
            escena.render.engine = motor
            break
        except (TypeError, ValueError):
            continue
    else:
        raise RuntimeError("EEVEE no está disponible")
    s = DIM["suelo_lado"]/2
    malla("suelo", None, (0, 0, 0), "suelo", [(-s,-s,0), (s,-s,0), (s,s,0), (-s,s,0)], [(0,1,2,3)])
    sol = bpy.data.lights.new("sol", "SUN")
    elevacion, azimut = math.radians(35), math.radians(56)
    direccion = Vector((math.cos(azimut)*math.cos(elevacion),
                        math.sin(azimut)*math.cos(elevacion), math.sin(elevacion)))
    sol.energy, sol.angle = 2.6, math.radians(4)
    if hasattr(sol, "use_shadow_jitter"):
        sol.use_shadow_jitter = True
    objeto("sol", None, (0,0,0), sol).rotation_euler = (-direccion).to_track_quat("-Z","Y").to_euler()
    eevee = escena.eevee
    eevee.use_raytracing = True
    eevee.use_fast_gi = True
    eevee.ray_tracing_options.trace_max_roughness = .4
    # Los identificadores de enum cambian entre versiones: se leen, no se escriben a mano.
    metodos = eevee.bl_rna.properties["fast_gi_method"].enum_items.keys()
    eevee.fast_gi_method = next((m for m in ("GLOBAL_ILLUMINATION", "AMBIENT_OCCLUSION_ONLY")
                                 if m in metodos), eevee.fast_gi_method)
    if hasattr(eevee, "use_shadow_jitter_viewport"):
        eevee.use_shadow_jitter_viewport = True
    escena.view_settings.view_transform = "AgX"
    escena.view_settings.exposure = -.45
    mundo = escena.world or bpy.data.worlds.new("estudio")
    escena.world = mundo
    if not mundo.node_tree:
        mundo.use_nodes = True
    fondo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
    cielo = mundo.node_tree.nodes.new("ShaderNodeTexSky")
    modelos = cielo.bl_rna.properties["sky_type"].enum_items
    cielo.sky_type = next(x for x in ("MULTIPLE_SCATTERING","NISHITA") if x in modelos.keys())
    cielo.sun_elevation, cielo.sun_rotation = elevacion, azimut
    cielo.sun_disc = False
    mundo.node_tree.links.new(cielo.outputs[0], fondo.inputs["Color"])
    fondo.inputs["Strength"].default_value = .24
    cam = bpy.data.cameras.new("camara")
    cam.type = "ORTHO"
    escena.camera = objeto("camara", None, (0,0,0), cam)
    escena.render.resolution_x, escena.render.resolution_y = 1280, 720
    escena.render.resolution_percentage = 100
    escena.render.image_settings.file_format = "PNG"


def vista(camara, nombre):
    direcciones = {"34": (1.35, 1, .92), "frente": (0,1,0), "lateral": (1,0,0), "superior": (0,0,1)}
    eje = Vector(direcciones[nombre]).normalized()
    camara.rotation_euler = (-eje).to_track_quat("-Z", "Y").to_euler()
    if nombre == "superior":
        camara.rotation_euler = (0,0,math.pi/2)
    limites = bpy.data.objects["raiz"]
    piezas = [o for o in limites.children_recursive if o.type == "MESH"]
    puntos = [o.matrix_world @ Vector(v) for o in piezas for v in o.bound_box]
    rot = camara.rotation_euler.to_matrix()
    local = [rot.transposed() @ p for p in puntos]
    bajo = Vector(tuple(min(p[i] for p in local) for i in range(3)))
    alto = Vector(tuple(max(p[i] for p in local) for i in range(3)))
    camara.location = rot @ ((alto+bajo)/2) + DIM["distancia_camara"]*eje
    render = bpy.context.scene.render
    aspecto = render.resolution_x/render.resolution_y
    camara.data.ortho_scale = max(alto.x-bajo.x,(alto.y-bajo.y)*aspecto)/.84


def vistas_detalle(escena, destino):
    # Situar el objetivo del motor dentro del clip deja libre la visual bajo el aro.
    tomas = {
        "esquina": ((.89,2.68,.56),(.61,1.44,.58),32),
        "torreta": ((-1.42,1.12,2.51),(0,.19,DIM["pitch_z"]),34),
        "motor": ((.47,-1.06,.19),(0,-.08,.56),31),
        "aro": ((1.18,-1.18,DIM["aro_z"]+1.67),(.07,-.07,DIM["aro_z"]+.10),53),
    }
    cam = escena.camera
    cam.data.type = "PERSP"
    for nombre,(pos,objetivo,lente) in tomas.items():
        cam.location = pos
        cam.rotation_euler = (Vector(objetivo)-Vector(pos)).to_track_quat("-Z","Y").to_euler()
        cam.data.lens = lente
        escena.render.filepath = str(destino/f"detalle_{nombre}.png")
        bpy.ops.render.render(write_still=True)
    cam.data.type = "ORTHO"


def presentacion(escena, destino, heroes, orbita):
    cam = escena.camera
    escena.render.resolution_x, escena.render.resolution_y = 1920, 1080
    cam.data.type, cam.data.lens = "PERSP", 48
    objetivo = Vector((0,0,1.04))
    radio = 7.7
    inicial = math.atan2(1, 1.35)
    altura = objetivo.z + radio*.92/math.hypot(1.35, 1)

    def toma(angulo, z, ruta):
        cam.location = (radio*math.cos(angulo),radio*math.sin(angulo),z)
        cam.rotation_euler = (objetivo-cam.location).to_track_quat("-Z","Y").to_euler()
        escena.render.filepath = str(ruta)
        bpy.ops.render.render(write_still=True)

    if heroes:
        toma(inicial, altura, destino/"heroe_34.png")
        toma(math.radians(53), .18, destino/"heroe_bajo.png")
    if orbita:
        carpeta = destino/"turntable"
        carpeta.mkdir(exist_ok=True)
        escena.render.fps, escena.render.fps_base = 24, 1
        escena.frame_start, escena.frame_end = 1, 120
        for i in range(120):
            escena.frame_set(i+1)
            toma(inicial+math.tau*i/120, altura, carpeta/f"{i+1:04d}.png")


def comprobar_pose(raiz):
    piezas = list(raiz.children_recursive)
    torreta, arma = (bpy.data.objects[n] for n in ("torreta", "arma"))
    originales = {o: o.matrix_world.copy() for o in piezas}
    torreta.rotation_euler.z = math.pi/2
    arma.rotation_euler.x = math.radians(-15)
    bpy.context.view_layer.update()
    piezas_arma, piezas_torreta = set(arma.children_recursive), set(torreta.children_recursive)
    for o in piezas:
        grupo = arma if o in piezas_arma else torreta if o in piezas_torreta else raiz
        if o in (arma, torreta):
            # El centro de ambos pivotes permanece en su eje.
            assert (o.matrix_world.translation-originales[o].translation).length < 1e-5
            continue
        esperado = originales[o]
        if o.name=="piñon":
            esperado = esperado @ Matrix.Rotation(-5*torreta.rotation_euler.z,4,"Z")
        elif grupo != raiz:
            esperado = grupo.matrix_world @ originales[grupo].inverted() @ esperado
        assert all(abs(a-b)<1e-5 for fila, ref in zip(o.matrix_world, esperado) for a,b in zip(fila, ref)), o.name
    torreta.rotation_euler.z = arma.rotation_euler.x = 0
    bpy.context.view_layer.update()


ESQUINAS = ("dd","di","td","ti")
POSES = {
    "compresion": ((.20,)*4,-.05),
    "extension": ((-.16,)*4,.05),
    "articulacion": ((.20,-.16,-.16,.20),0,3),
}


def asignar(obj, prop, valor):
    obj[prop] = float(valor)
    obj.update_tag()


def posar(recorridos=(0,)*4, flotacion=0, balanceo=0, cabeceo=0, oscilacion=0):
    objs = bpy.data.objects
    for suf,v in zip(ESQUINAS,recorridos):
        asignar(objs["esquina_"+suf],"recorrido",v)
    for prop,v in (("flotacion_aro",flotacion),("cabeceo",cabeceo),("balanceo",balanceo)):
        asignar(objs["raiz"],prop,v)
    asignar(objs["motor"],"oscilacion",oscilacion)
    bpy.context.view_layer.update()


def interferencias():
    # Fase amplia por cajas y fase estrecha sobre las caras transformadas.
    from mathutils.bvhtree import BVHTree
    objs = bpy.data.objects
    piezas = [o for o in objs["raiz"].children_recursive if o.type=="MESH"]
    cajas, arboles = {}, {}
    for o in piezas:
        pts = [o.matrix_world @ Vector(v) for v in o.bound_box]
        cajas[o] = [(min(p[i] for p in pts),max(p[i] for p in pts)) for i in range(3)]
    def arbol(o):
        if o not in arboles:
            arboles[o] = BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices],
                                              [tuple(f.vertices) for f in o.data.polygons])
        return arboles[o]
    choques = []
    for suf in ESQUINAS[:2]:
        rueda = set(objs["rueda_"+suf].children_recursive)
        for a in rueda:
            for b in piezas:
                if b in rueda or any(x[1]<y[0] or y[1]<x[0] for x,y in zip(cajas[a],cajas[b])):
                    continue
                # La junta CV, la mangueta y la palanca comparten el centro del buje.
                if a.name=="buje_"+suf and b.name in ("palanca_"+suf,"mangueta_"+suf,
                                                      "palier_"+suf,"fuelle_cv_"+suf+"_1"):
                    continue
                if arbol(a).overlap(arbol(b)):
                    choques.append([a.name,b.name])
    return choques


def medir_anclajes():
    objs = bpy.data.objects
    def posicion(o):
        return o.matrix_world.translation
    separaciones = []
    errores = [(marco.matrix_world @ (Y*largo)-posicion(fin)).length
               for marco,largo,fin in TRAMOS]
    solapes = []
    for capa in CAPAS.values():
        for m in capa:
            if "vastago_m" not in m:
                continue
            a,b = (posicion(objs[m[key]]) for key in ("inferior","superior"))
            for pref,ext,dest in (("cuerpo",b,a),("vastago",a,b)):
                matriz = objs["guia_"+pref+"_"+m["nombre"]].matrix_world
                errores.extend(((matriz.translation-ext).length,
                    (matriz @ (Y*(dest-ext).length)-dest).length))
            solapes.append(m["cuerpo_m"]+m["vastago_m"]-(a-b).length)
    for suf in ESQUINAS:
        for pref in ("pie_","torre_"):
            separaciones.append((posicion(objs[pref+"coilover_"+suf])
                                 -posicion(objs[pref+"bypass_"+suf])).length)
        sx = 1 if suf[-1]=="d" else -1
        for nivel,x in (("inf",.30),("sup",.37)):
            brazo = objs[f"trapecio_{nivel}_{suf}"]
            punta = brazo.matrix_world @ Vector((sx*(DIM["kingpin_x"]-x),0,0))
            errores.append((punta-posicion(objs[f"rotula_{nivel}_{suf}"])).length)
    return dict(error_anclaje_m=max(errores),solape_min_m=min(solapes),
                           separacion_anclajes_min_m=min(separaciones))


def verificar_suspension():
    objs = bpy.data.objects
    pruebas = dict(POSES)
    for signo in (-1,1):
        for pitch in (-4,4):
            for roll in (-4,4):
                pruebas[f"limite_{signo}_{pitch}_{roll}"] = (
                    ((-.18 if signo<0 else .22),)*4,signo*.06,roll,pitch,-signo*.03)
    medidas = {}
    for nombre,pose in pruebas.items():
        posar(*pose)
        medidas[nombre] = medir_anclajes()
        m = medidas[nombre]
        assert m["separacion_anclajes_min_m"] >= .07
        assert m["error_anclaje_m"] < .005 and m["solape_min_m"] > 0, (nombre,m)
    giros = {}
    for angulo in (-30,30):
        for lado in ("d","i"):
            asignar(objs["direccion_"+lado],"direccion",angulo)
        posar((.22,)*4)
        giros[str(angulo)] = interferencias()
        assert not giros[str(angulo)], (angulo,giros)
    for lado in ("d","i"):
        asignar(objs["direccion_"+lado],"direccion",0)
    posar()
    return dict(poses=medidas, choques_ruedas_delanteras=giros)


BACHES = ((2.65,.68,.20),(5.85,.80,.17))
AVANCE = .10
SESGO = .17


def perfil_bache(u, radio, altura):
    return altura*(1+math.cos(math.pi*u/radio))/2 if abs(u)<radio else 0.


def recorridos_demo(t):
    valores = []
    for suf in ESQUINAS:
        x = DIM["rueda_x"]*(1 if suf[-1]=="d" else -1)
        y = DIM["rueda_y"]*(1 if suf[0]=="d" else -1)
        # Envolvente de rodadura longitudinal y desfase lateral de la cresta.
        altura = 0.
        r = DIM["rueda_r"]
        for j in range(-20,21):
            dy = r*j/20
            u = t*AVANCE+y+dy-SESGO*x
            piso = sum(perfil_bache(u-c,w,h) for c,w,h in BACHES)
            altura = max(altura,piso+math.sqrt(max(0,r*r-dy*dy))-r)
        valores.append(altura)
    return valores


def demo(escena,destino):
    carpeta = destino/"demo_suspension"
    carpeta.mkdir(exist_ok=True)
    pista = objeto("pista_demo",None,(0,0,0))
    for i,(c,w,h) in enumerate(BACHES):
        vertices,caras = [],[]
        for j in range(65):
            u = w*(j/32-1)
            for x in (2.4,-2.4):
                vertices.append((x,c+u+SESGO*x,perfil_bache(u,w,h)))
            if j:
                k = 2*j
                caras.append((k-2,k,k+1,k-1))
        malla(f"bache_{i}",pista,(0,0,0),"suelo",vertices,caras)
    escena.render.fps, escena.frame_end = 24,96
    historial = [recorridos_demo(t) for t in range(96)]
    def respuesta(t,retardo):
        t -= retardo
        if t<0:
            return 0.
        # Respuesta a cada variación de carga: componente inmediata más cola decreciente.
        media = lambda i: sum(historial[i])/4 if i>=0 else 0.
        return media(t)+sum((media(t-j)-media(t-j-1))*.48*math.exp(-j/5)*math.sin(j*.68)
                             for j in range(min(t+1,36)))
    for t,local in enumerate(historial):
        escena.frame_set(t+1)
        pista.location.y = -AVANCE*t
        for suf in ESQUINAS:
            asignar(bpy.data.objects["rueda_"+suf],"giro",-math.degrees(t*AVANCE/DIM["rueda_r"]))
        atras = historial[t-3] if t>=3 else (0,)*4
        dd,di,td,ti = atras
        posar(local,.46*respuesta(t,3),5*(di+ti-dd-td),8*(dd+di-td-ti),.23*respuesta(t,5))
        escena.render.filepath = str(carpeta/f"{t+1:04d}.png")
        bpy.ops.render.render(write_still=True)


def reporte(escena, raiz, angulos):
    bpy.context.view_layer.update()
    comprobar_pose(raiz)
    puntos = []
    grupos = dict(centro=0, esquinas=0, torreta=0)
    contactos, nuevas = {}, {}
    usos = {nombre: set() for nombre in PALETA}
    usos.update({nombre + "_canto": set() for nombre in PINTURAS})
    usos["suelo"].add("escenario")
    deps = bpy.context.evaluated_depsgraph_get()
    for o in raiz.children_recursive:
        assert all(abs(s-1)<1e-6 for s in o.scale)
        if o.type in ("MESH","CURVE"):
            zona = o.get("zona_detalle")
            if zona:
                nuevas[zona] = nuevas.get(zona,0)+1
            evaluado = o.evaluated_get(deps)
            mesh = evaluado.to_mesh()
            vertices = [evaluado.matrix_world @ v.co for v in mesh.vertices]
            puntos.extend(vertices)
            ancestros = []
            padre = o
            while padre:
                ancestros.append(padre.name)
                padre = padre.parent
            for nombre in ancestros:
                if nombre.startswith("rueda_"):
                    contactos[nombre] = min(contactos.get(nombre, 1), round(min(v.z for v in vertices),6))
            grupo = ("esquinas" if any(n.startswith("clip_") for n in ancestros)
                     else "torreta" if "torreta" in ancestros else "centro")
            familia = zona
            if not familia:
                if any(n.startswith("rueda_") for n in ancestros):
                    familia = "ruedas"
                elif any(n.startswith(("guia_cuerpo_", "guia_vastago_", "guia_resorte_"))
                         for n in ancestros):
                    familia = "amortiguadores"
                elif o.name == "aro":
                    familia = "aro"
                elif "motor" in ancestros:
                    familia = "motor"
                else:
                    familia = grupo
            for material in mesh.materials:
                usos[material.name].add(familia)
            mesh.calc_loop_triangles()
            grupos[grupo] += len(mesh.loop_triangles)
            evaluado.to_mesh_clear()
    triangulos = sum(grupos.values())
    bajo = [round(min(p[i] for p in puntos), 6) for i in range(3)]
    alto = [round(max(p[i] for p in puntos), 6) for i in range(3)]
    tam = [round(b-a, 6) for a,b in zip(bajo, alto)]
    assert abs(bajo[2]) < 1e-5 and abs(tam[0]-2.06)<.02 and abs(tam[1]-3.70)<.02
    limites_v3 = ((-1.03,-1.85,0),(1.03,1.85,1.911675))
    # Huella (X, Y) fija desde la v3; la altura (Z) puede crecer con la torreta (v5).
    assert max(abs(v-ref) for lado,base in zip((bajo,alto),limites_v3)
               for v,ref in zip(lado[:2],base[:2])) <= .03
    assert abs(tam[2]-2.16) <= .02, tam
    assert triangulos < 260000, triangulos
    assert len(contactos) == 4 and all(abs(z) < 1e-5 for z in contactos.values())
    assert len(angulos) == 4 and all(44 <= a <= 46 for a in angulos.values())
    return {
        "objetos": [dict(nombre=o.name, tipo=o.type, padre=o.parent.name if o.parent else None)
                    for o in sorted(escena.objects, key=lambda o: o.name)],
        "materiales": [dict(nombre=n, grupos=sorted(g)) for n,g in usos.items()],
        "controles": CONTROLES, "amortiguadores_por_capa": CAPAS,
        "pruebas_suspension": verificar_suspension(),
        "aro_z": DIM["aro_z"],
        "contacto_ruedas_z": contactos,
        "pivotes": [dict(nombre=o.name, eje=eje, centro=list(o.matrix_world.translation))
                    for o in sorted(raiz.children_recursive, key=lambda o: o.name)
                    for eje, bloqueo in (("X",(False,True,True)), ("Z",(True,True,False)), ("Y",(True,False,True)))
                    if tuple(o.lock_rotation) == bloqueo] + [
            dict(nombre="boca", eje=None, centro=list(bpy.data.objects["boca"].matrix_world.translation))],
        "bbox_global_m": dict(min=bajo, max=alto, dimensiones=tam),
        "triangulos_por_grupo": grupos, "triangulos_totales": triangulos, "angulo_descendente_grados": angulos,
        "piezas_nuevas_por_zona": nuevas,
        "alcance_medicion": "Geometría evaluada en reposo, incluidas curvas y modificadores",
    }



# Unidades del guion: cuadros inclusivos, metros y grados. +Y es avance.
FPS = 24
GUION = dict(avance=(1,60), frenada=(61,92), bloqueo=(65,70), rebote=(93,120),
             giro=(105,140), rafagas=((141,6),(165,8),(193,6)), cadencia=2,
             alto=(211,240), corte=101)
DINAMICA = dict(subpasos=12, velocidad=10., entrada_freno=9,
                # frecuencia (Hz), razón de amortiguamiento, ganancia
                altura=(2.4,.52,.85), pitch=(1.8,.23,3.62), roll=(2,.55,1.),
                aro_z=(1.65,.32,.95), aro_x=(1.55,.34,.65), aro_y=(1.6,.32,.85),
                motor=(2.1,.36,.17), retardo_aro=3, retardo_motor=5, golpe=10.)


def limitar(v, bajo, alto):
    return max(bajo,min(alto,v))


def suave(t):
    t = limitar(t,0.,1.)
    return t*t*(3-2*t)


def marcha(f):
    ini,fin = GUION["frenada"]
    v = DINAMICA["velocidad"]
    t = limitar(f-ini+1,0,fin-ini+1)
    r = DINAMICA["entrada_freno"]
    a = v/(fin-ini+1-r/2)
    u = min(t,r)
    w = t-u
    perdida = a*(u**3/(6*r)+u*w/2+w*w/2)
    y = (v*(min(f,fin)-GUION["avance"][0])-perdida)/FPS
    return y, a*FPS*u/r if ini-1 < f <= fin else 0.


def centro_blanco(distancia=14.):
    a = math.radians(110)
    return distancia*math.sin(a), marcha(GUION["frenada"][1])[0]+distancia*math.cos(a)


def terreno(x,y):
    onda = .013*math.sin(math.tau*(y+.25*x)/4.7)+.007*math.sin(math.tau*(x-.28*y)/3.9)
    tx,ty = centro_blanco(24.)  # Posición de la duna aprobada en la tarea 07.
    duna = .65*math.exp(-((x-tx)/3.1)**2-((y-ty)/2.4)**2)
    return onda+duna+sum(perfil_bache(y-c-.16*x,w,h) for c,w,h in
                         ((7.8,1.32,.064),(19.4,1.55,.079)))


def esquina_xy(s):
    return (DIM["rueda_x"]*(1 if s[-1]=="d" else -1),
            DIM["rueda_y"]*(1 if s[0]=="d" else -1))


def disparos():
    return [f+i*GUION["cadencia"] for f,n in GUION["rafagas"] for i in range(n)]


def perfiles():
    estados = {}
    historia = []
    pasos = DINAMICA["subpasos"]
    dt = 1/(FPS*pasos)
    def muelle(k,entrada,impulso=0.):
        p,v = estados.get(k,(0.,0.))
        hz,zeta,g = DINAMICA[k]
        w = math.tau*hz
        v += impulso+dt*(w*w*(g*entrada-p)-2*zeta*w*v)
        estados[k] = (p+v*dt,v)
        return estados[k][0]
    resultado = {}
    eventos = set(disparos())
    for f in range(1,GUION["alto"][1]+1):
        for j in range(1,pasos+1):
            t = f-1+j/pasos
            y,a = marcha(t)
            dd,di,td,ti = (terreno(x,y+dy) for x,dy in map(esquina_xy,ESQUINAS))
            piso = (dd+di+td+ti)/4
            z = muelle("altura",piso-.012*a/9)
            p = muelle("pitch",a/9 + math.degrees((td+ti-dd-di)/(4*DIM["rueda_y"]))/DINAMICA["pitch"][2])
            r = muelle("roll",math.degrees((di+ti-dd-td)/(4*DIM["rueda_x"])))
            historia.append((z,p,r))
            az,ap,ar = historia[max(0,len(historia)-1-pasos*DINAMICA["retardo_aro"])]
            mz,mp,_ = historia[max(0,len(historia)-1-pasos*DINAMICA["retardo_motor"])]
            golpe = DINAMICA["golpe"] if f in eventos and j==1 else 0.
            aro = (muelle("aro_z",az-z+.004*ap),muelle("aro_x",-ap,golpe),
                   muelle("aro_y",-ar))
            motor = muelle("motor",mz-z+.021*mp)
        resultado[f] = (y,z,p,r,*aro,motor)
    return resultado


def clave(o,canal,valor,f):
    setattr(o,canal,valor)
    o.keyframe_insert(data_path=canal,frame=f)


def mando(o,nombre,valor,f):
    asignar(o,nombre,valor)
    o.keyframe_insert(data_path=f'["{nombre}"]',frame=f)


def preparar_cuerpo(raiz):
    veh = objeto("vehiculo",None,(0,0,0))
    raiz.parent = veh
    for k,a,b in (("altura_cuerpo",-.10,.08),("cabeceo_cuerpo",-5,5),
                  ("balanceo_cuerpo",-5,5),("calor_frenos",0,1),("calor_canon",0,1)):
        control(veh,k,a,b,"grados" if "ceo" in k else "m" if "altura" in k else "factor")
    # T(P) R T(-P), P=(0,0,.55). Mantiene intactos los orígenes de construcción.
    for canal,i,expr in (("rotation_euler",0,"-p*pi/180"),("rotation_euler",1,"r*pi/180"),
            ("location",0,"-.55*sin(r*pi/180)*cos(p*pi/180)"),
            ("location",1,"-.55*sin(p*pi/180)"),
            ("location",2,"h+.55*(1-cos(r*pi/180)*cos(p*pi/180))")):
        drv = raiz.driver_add(canal,i).driver
        for var,prop in (("p","cabeceo_cuerpo"),("r","balanceo_cuerpo"),("h","altura_cuerpo")):
            v = drv.variables.new()
            v.name = var
            v.targets[0].id = veh
            v.targets[0].data_path = f'["{prop}"]'
        drv.expression = expr
    return veh


def pista_accion():
    suelo = bpy.data.objects["suelo"]
    # Más resolución donde están las ruedas y la duna.
    xs = [-100]+[i*.25 for i in range(-32,137)]+[100]
    ys = [-100]+[i*.125 for i in range(-56,337)]+[100]
    puntos = [(x,y,terreno(x,y)) for y in ys for x in xs]
    n = len(xs)
    caras = [(i,i+1,i+n+1,i+n) for j in range(len(ys)-1)
             for i in range(j*n,(j+1)*n-1)]
    suelo.data.clear_geometry()
    suelo.data.from_pydata(puntos,[],caras)
    suelo.data.update()


def banda_contacto(rueda):
    # Sólo los tacos alcanzan el radio exterior. Una muestra por vértice evaluado
    # de su envolvente, conservando ambas filas y la fase real de la laminilla.
    deps = bpy.context.evaluated_depsgraph_get()
    puntos = set()
    inv = rueda.matrix_world.inverted()
    for o in rueda.children:
        if o.name.startswith("taco_"):
            e = o.evaluated_get(deps)
            m = inv @ e.matrix_world
            for v in e.data.vertices:
                x,y,z = m @ v.co
                if math.hypot(y,z) > DIM["rueda_r"]-.0015:
                    puntos.add((round(x,5),round(y,5),round(z,5)))
    return [Vector(p) for p in puntos]


def apoyar(f,bandas,recortes):
    objs = bpy.data.objects
    eje = objs["raiz"].matrix_world.to_3x3() @ Z
    resultado = {}
    for s,(rueda,banda) in bandas.items():
        esquina = objs["esquina_"+s]
        # La matriz puede contener el recorrido interpolado del cuadro anterior.
        base = rueda.matrix_world.copy()
        anterior = esquina["recorrido"]
        candidatos = [base @ v for v in banda]
        zmin = min(v.z for v in candidatos)
        candidatos = [v-eje*anterior for v in candidatos if v.z<zmin+.035]
        d = anterior
        for _ in range(3):
            hueco = min(v.z+eje.z*d-terreno(v.x+eje.x*d,v.y+eje.y*d) for v in candidatos)
            d -= hueco/eje.z
        real = limitar(d,-.18,.22)
        if real!=d:
            recortes.append(dict(cuadro=f,esquina=s,solicitado=d))
        mando(esquina,"recorrido",real,f)
        resultado[s] = real
    return resultado


def material_fx(nombre,color,emision=0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = lineal(color)
    p.inputs["Emission Color"].default_value = lineal(color)
    p.inputs["Emission Strength"].default_value = emision
    return m


def calor(veh,prop,nombres,color,factor):
    objs = bpy.data.objects
    mat = objs[nombres[0]].data.materials[0].copy()
    mat.name = prop
    for n in nombres:
        objs[n].data.materials[0] = mat
    p = next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    p.inputs["Emission Color"].default_value = lineal(color)
    d = p.inputs["Emission Strength"].driver_add("default_value").driver
    v = d.variables.new()
    v.name = "calor"
    v.targets[0].id = veh
    v.targets[0].data_path = f'["{prop}"]'
    d.expression = f"calor*{factor}"


def visible(o,ini,fin=None):
    for f,oculto in [(ini-1,True),(ini,False)]+([(fin+1,True)] if fin is not None else []):
        for canal in ("hide_render","hide_viewport"):
            clave(o,canal,oculto,f)


def fogonazo(boca,rng,eventos):
    destello = objeto("destello",None,(0,0,0))
    destello.parent = boca
    for j in range(3):
        # Tres lenguas dentadas dan cuerpo al destello desde los dos costados.
        perfil = [(0,0),(-.125,.04),(-.052,.13),(-.095,.29),(-.035,.23),
                  (0,.46),(.048,.19),(.102,.27),(.067,.12),(.125,.043)]
        a = j*math.pi/3
        vertices = [(x*math.cos(a),y,x*math.sin(a)) for x,y in perfil]
        malla("llama_cruzada",destello,origen(destello),"llama",vertices,[tuple(range(len(perfil)))])
    revolucion("nucleo",destello,origen(destello),Y,[(.046,0),(.075,.08),(.001,.34)],"nucleo",n=12)
    disco = revolucion("halo_ranura",None,(0,0,0),(1,0,0),
                       [(.001,-.23),(.061,-.095),(.03,0),(.061,.095),(.001,.23)],"llama",n=12)
    disco.parent = boca
    disco.location.y = -.038
    for o in (destello,disco):
        clave(o,"scale",(0,0,0),1)
    for f in eventos:
        a = rng.uniform(0,math.tau)
        clave(destello,"rotation_euler",(0,a,0),f)
        for o in (destello,disco):
            for t,k in ((f-1,0 if f-2 not in eventos else .23),(f,1),(f+1,.23),(f+2,0)):
                clave(o,"scale",(k,k,k),t)


def material_nube(nombre,color,alto,densidad):
    # Esfera cerrada con densidad volumétrica radial, modulada por ruido local y
    # por el alfa del objeto. Un solo material compartido por todo el emisor.
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    n,link = m.node_tree.nodes,m.node_tree.links.new
    n.remove(next(v for v in n if v.type=="BSDF_PRINCIPLED"))
    tc = n.new("ShaderNodeTexCoord").outputs["Generated"]
    dist = n.new("ShaderNodeVectorMath")
    dist.operation = "DISTANCE"
    dist.inputs[1].default_value = (.5,.5,.5)
    link(tc,dist.inputs[0])
    grad = n.new("ShaderNodeMapRange")
    grad.inputs["From Max"].default_value = .5
    grad.inputs["To Min"].default_value = densidad
    grad.interpolation_type = "SMOOTHERSTEP"
    grad.inputs["To Max"].default_value = 0
    link(dist.outputs["Value"],grad.inputs[0])
    ruido = n.new("ShaderNodeTexNoise")
    ruido.inputs["Scale"].default_value = 3.7
    link(tc,ruido.inputs[0])
    contraste = n.new("ShaderNodeMapRange")
    contraste.inputs["From Min"].default_value = .30
    contraste.inputs["From Max"].default_value = .68
    contraste.interpolation_type = "SMOOTHERSTEP"
    link(ruido.outputs["Fac"],contraste.inputs[0])
    salida = grad.outputs[0]
    for entrada in (contraste.outputs[0],n.new("ShaderNodeObjectInfo").outputs["Alpha"]):
        prod = n.new("ShaderNodeMath")
        prod.operation = "MULTIPLY"
        link(salida,prod.inputs[0])
        link(entrada,prod.inputs[1])
        salida = prod.outputs[0]
    vol = n.new("ShaderNodeVolumePrincipled")
    z = n.new("ShaderNodeSeparateXYZ")
    link(tc,z.inputs[0])
    tono = n.new("ShaderNodeMixRGB")
    tono.inputs[1].default_value = lineal(color)
    tono.inputs[2].default_value = lineal(alto)
    link(z.outputs["Z"],tono.inputs[0])
    link(tono.outputs[0],vol.inputs["Color"])
    link(salida,vol.inputs["Density"])
    link(vol.outputs[0],next(v for v in n if v.type=="OUTPUT_MATERIAL").inputs["Volume"])
    return m


def nube(pool,mat,f,p,deriva,tam,vida,inicial=.18,arrastre=0.):
    # Los intervalos que no se solapan comparten objeto y datablock.
    libres = pool.setdefault(mat.name,[])
    for i,(fin,obj) in enumerate(libres):
        if fin < f-1:
            break
    else:
        if libres:
            obj = objeto(mat.name,None,(0,0,0),libres[0][1].data)
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2)
            obj = bpy.context.object
            obj.name = mat.name
            obj.data.materials.append(mat)
        i = len(libres)
        libres.append(None)
    libres[i] = (f+vida,obj)
    visible(obj,f,f+vida)
    for u,k,alpha in ((0,inicial,.90),(.23,.61,.8),(.62,.89,.33),(1,1,0)):
        t = f+vida*u
        pos = p+deriva*u+Z*(tam*.28*math.sin(math.pi*u))
        pos.y += arrastre*u*(1-.30*u)
        clave(obj,"location",pos,t)
        clave(obj,"scale",(tam*k*1.15,tam*k,tam*k*.83),t)
        clave(obj,"color",(1,1,1,alpha),t)


def marcas():
    """Cuatro tiras sobre la propia arena. La máscara mezcla color y hunde el relieve."""
    mat = bpy.data.materials["suelo"]
    n,link = mat.node_tree.nodes,mat.node_tree.links.new
    n["huellas_estudio"].outputs[0].default_value = 0.

    def op(tipo,a,b):
        nodo = n.new("ShaderNodeMath")
        nodo.operation = tipo
        for entrada,valor in zip(nodo.inputs,(a,b)):
            if isinstance(valor,bpy.types.NodeSocket):
                link(valor,entrada)
            else:
                entrada.default_value = valor
        return nodo.outputs[0]

    pos = n.new("ShaderNodeNewGeometry").outputs["Position"]
    xyz = n.new("ShaderNodeSeparateXYZ")
    link(pos,xyz.inputs[0])
    x,y = xyz.outputs[:2]
    ruido = n.new("ShaderNodeTexNoise")
    ruido.inputs["Scale"].default_value = 2.7
    link(pos,ruido.inputs[0])
    fase = op("ADD",op("MULTIPLY",y,53),op("MULTIPLY",ruido.outputs["Fac"],8))
    rizado = op("MULTIPLY",op("SINE",fase,0),.0024)
    mascara = 0.
    avances = {}
    for s in ESQUINAS:
        cx,cy = esquina_xy(s)
        avance = n.new("ShaderNodeValue").outputs[0]
        avances[s] = avance
        distancia = op("ABSOLUTE",op("SUBTRACT",x,cx),0)
        borde = n.new("ShaderNodeMapRange")
        borde.interpolation_type = "SMOOTHERSTEP"
        borde.inputs["From Min"].default_value = .088
        borde.inputs["From Max"].default_value = .155
        borde.inputs["To Min"].default_value = 1
        borde.inputs["To Max"].default_value = 0
        link(distancia,borde.inputs[0])
        tramo = op("MULTIPLY",op("GREATER_THAN",y,cy),op("LESS_THAN",y,avance))
        marca = op("MULTIPLY",tramo,borde.outputs[0])
        if s[0]=="d":
            a,b = GUION["bloqueo"]
            derrape = op("MULTIPLY",op("GREATER_THAN",y,marcha(a-1)[0]+cy),
                         op("LESS_THAN",y,marcha(b)[0]+cy))
            marca = op("MULTIPLY",marca,op("ADD",.73,op("MULTIPLY",derrape,.47)))
        mascara = op("MAXIMUM",mascara,marca)
    p = next(v for v in n if v.type=="BSDF_PRINCIPLED")
    mezcla = n.new("ShaderNodeMixRGB")
    link(p.inputs["Base Color"].links[0].from_socket,mezcla.inputs[1])
    mezcla.inputs[2].default_value = lineal("816749")
    link(op("MULTIPLY",mascara,.72),mezcla.inputs[0])
    link(mezcla.outputs[0],p.inputs["Base Color"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 1.
    link(p.inputs["Normal"].links[0].from_socket,bump.inputs["Normal"])
    link(op("SUBTRACT",rizado,op("MULTIPLY",mascara,.012)),bump.inputs["Height"])
    link(bump.outputs[0],p.inputs["Normal"])
    return avances


def bordes_pista(fin):
    rng = random.Random(8071)
    material_fx("piedra","917E65")
    material_fx("pasto_seco","AC945F")
    material_fx("madera","786047")
    for i in range(22):
        x = (-1 if i%2 else 1)*rng.uniform(2.0,3.9)
        y = fin*(i+rng.random())/22
        if x<0 and y>fin-7:  # entre las cámaras y el vehículo parado
            continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
        o = bpy.context.object
        o.name = "piedra"
        o.data.materials.append(bpy.data.materials["piedra"])
        o.scale = (rng.uniform(.12,.36),rng.uniform(.12,.29),rng.uniform(.08,.17))
        o.rotation_euler.z = rng.uniform(0,math.tau)
        o.location = (x,y,terreno(x,y)+.03)
        if i%3:
            x += .38
            base = Vector((x,y,terreno(x,y)))
            for _ in range(6):
                punta = base+Vector((rng.uniform(-.16,.16),rng.uniform(-.16,.16),rng.uniform(.14,.34)))
                tubo("tallo",None,base,punta,.007,"pasto_seco",4)
    for i in range(8):
        x = (-1 if i%2 else 1)*rng.uniform(2.5,3.3)
        y = fin*(i+.35)/8
        if x<0 and y>fin-7:
            continue
        z = terreno(x,y)
        tubo("estaca",None,(x,y,z),(x,y,z+.61),.026,"madera",8)
        verts = [(dx,dy,h+dz) for dx,dy,dz in ((0,0,0),(.19,.035,-.02),(.36,-.02,-.09))
                 for h in (.49,.57)]
        malla("cinta",None,(x,y,z),"naranja",verts,[(0,2,3,1),(2,4,5,3)])


def punteria(f):
    a,b = GUION["giro"]
    u = suave((f-a)/(b-a))
    yaw = 113*suave((f-a)/(b-a-6))-3*suave((f-b+6)/6)
    anterior = 0
    for (ini,n),(sig,_),cor in zip(GUION["rafagas"],GUION["rafagas"][1:],(.35,-.25)):
        fin = ini+(n-1)*GUION["cadencia"]
        yaw += (cor-anterior)*suave((f-fin)/(sig-fin))
        anterior = cor
    a,b = GUION["alto"]
    return yaw+5*suave((f-a)/(b-a)),6*u


def camaras(escena,poses,eventos):
    cam1 = escena.camera
    cam1.data.type,cam1.data.lens = "PERSP",40
    cam2 = objeto("camara_hombro",None,(0,0,0),bpy.data.cameras.new("hombro"))
    cam2.data.lens = 37
    corte = GUION["corte"]
    for f,cam in ((1,cam1),(corte,cam2)):
        escena.timeline_markers.new(cam.name,frame=f).camera = cam
    for f,(y,*_) in poses.items():
        if f<corte:
            cam = cam1
            parada = poses[GUION["frenada"][1]][0]
            u = suave((f-1)/(corte-2))
            pos = Vector((-4.8+.35*u,parada+4.75,.60))
            objetivo = Vector((0,y,1.03))
        else:
            cam = cam2
            u = suave((f-corte)/(GUION["alto"][0]-corte))
            pos = Vector((-6.25+.65*u,y-6.15+.48*u,1.22))
            objetivo = Vector((1.10,y-.52,1.22))
            temblor = sum(math.exp(-(f-t)*.95)*math.cos((f-t)*2.6)
                          for t in eventos if 0<=f-t<=5)
            objetivo.z += .013*temblor
            pos.y += .011*temblor
        clave(cam,"location",pos,f)
        clave(cam,"rotation_euler",(objetivo-pos).to_track_quat("-Z","Y").to_euler(),f)
    escena.camera = cam1
    return cam1,cam2


def medir_planos(escena,cams,piezas,placa,vuelos):
    """Encuadra con una sola óptica por plano. Proyecta las cajas de cada pieza evaluada."""
    deps = bpy.context.evaluated_depsgraph_get()
    # Las cajas de las curvas (cables, escapes, latiguillos) miden ~4 m: inflaban el encuadre.
    vehiculo = [o for o in piezas if o.type=="MESH"]
    cuadros = {}
    def limites(puntos):
        xs,ys = zip(*puntos)
        return min(xs),min(ys),max(xs),max(ys)

    def union(cajas):
        return (min(c[0] for c in cajas),min(c[1] for c in cajas),
                max(c[2] for c in cajas),max(c[3] for c in cajas))

    def proyectar(vista,objetos):
        puntos = []
        for obj in objetos:
            e = obj.evaluated_get(deps)
            local = vista @ e.matrix_world
            for vert in e.bound_box:
                v = local @ Vector(vert)
                if v.z>=-cam.data.clip_start:
                    raise ValueError(f"{obj.name} cruza la cámara en el cuadro {f}")
                puntos.append((v.x/-v.z,v.y/-v.z))
        return limites(puntos)

    def ventana(cam):
        return limites((v.x/-v.z,v.y/-v.z) for v in cam.data.view_frame(scene=escena))

    resumen = {}
    for plano,cam in enumerate(cams,1):
        primero,ultimo = ((1,GUION["corte"]-1) if plano==1 else (GUION["corte"],GUION["alto"][1]))
        cajas = []
        for f in range(primero,ultimo+1):
            escena.frame_set(f)
            vista = cam.matrix_world.inverted()
            fila = {"vehiculo":proyectar(vista,vehiculo)}
            if plano==2:
                fila["placa"] = proyectar(vista,[placa])
                vainas = [v["obj"] for v in vuelos if v["lado"]>0 and v["inicio"]<=f<=v["fin"]]
                if vainas:
                    fila["vainas"] = proyectar(vista,vainas)
            cajas.extend(fila.values())
            if plano==2 and any(t<=f<=t+(n-1)*GUION["cadencia"] for t,n in GUION["rafagas"]):
                boca = bpy.data.objects["boca"].matrix_world
                fila["error_angular_grados"] = math.degrees((boca.to_3x3() @ Y).angle(
                    placa.matrix_world.translation-boca.translation))
            cuadros[f] = fila

        iz,ab,de,ar = union(cajas)
        x0,y0,x1,y1 = ventana(cam)
        fraccion = .83 if plano==1 else .90
        cam.data.lens *= fraccion/max((de-iz)/(x1-x0),(ar-ab)/(y1-y0))
        x0,y0,x1,y1 = ventana(cam)
        # Sensor horizontal a 16:9. Ambos desplazamientos se expresan en anchos.
        cam.data.shift_x += ((de+iz)-(x0+x1))/(2*(x1-x0))
        cam.data.shift_y += ((ar+ab)-(y0+y1))/(2*(x1-x0))
        x0,y0,x1,y1 = ventana(cam)
        peor,cuadro_peor = 1.,primero
        margen_placa,error = 1.,0.
        for f in range(primero,ultimo+1):
            fila = cuadros[f]
            for nombre in ("vehiculo","placa","vainas"):
                if nombre not in fila:
                    continue
                a,b,c,d = fila[nombre]
                a,c = (a-x0)/(x1-x0),(c-x0)/(x1-x0)
                b,d = (b-y0)/(y1-y0),(d-y0)/(y1-y0)
                fila[nombre] = [a,b,c,d]
                margen = min(a,b,1-c,1-d)
                if nombre=="vehiculo" and f>=60 and margen<peor:
                    peor,cuadro_peor = margen,f
                if nombre=="placa":
                    margen_placa = min(margen_placa,margen)
            error = max(error,fila.get("error_angular_grados",0))
        datos = dict(margen_min_vehiculo=peor,cuadro_peor=cuadro_peor,lente_mm=cam.data.lens)
        datos["aceptado"] = peor>=(.08 if plano==1 else .04)
        if plano==2:
            datos.update(margen_min_placa=margen_placa,error_angular_max_grados=error)
            datos["aceptado"] &= margen_placa>=0 and error<2
        resumen[plano] = datos
    return dict(orden_bbox=["xmin","ymin","xmax","ymax"],planos=resumen,cuadros=cuadros,
                aceptado=all(v["aceptado"] for v in resumen.values()))


def eyeccion(nombre,origen_mundo,lado,f,rng,o=None):
    """Atrezo en el espacio del mundo, con una sola restitución en la arena."""
    eslabon = lado<0
    radio,largo = (.009,.017) if eslabon else (.009,.039)
    # La salida izquierda queda al exterior de la caja de cinta.
    p = origen_mundo @ Vector((-.30 if eslabon else .137,-.09,.025))
    eje = origen_mundo.to_3x3() @ Vector((lado,0,0))
    v = eje*(rng.uniform(2.6,3.45) if eslabon else rng.uniform(3.7,4.5))+Vector((0,rng.uniform(-.18,.18),rng.uniform(2.55,3.45)))
    if o is None:
        o = revolucion(nombre,None,(0,0,0),Y,
                       [(radio,-largo/2),(radio,largo/2),(.72*radio,largo/2),
                        (.72*radio,-largo/2)],"pavonado" if eslabon else "laton_vaina",True,12)
    else:
        o.animation_data_clear()
    visible(o,f)
    omega = Vector(tuple(rng.uniform(-14,14) for _ in range(3)))
    giro = Vector((0,0,0))
    rebotes = 0
    minimo = math.inf
    # Una envolvente esférica conserva el despeje incluso entre orientaciones.
    envolvente = math.hypot(radio,largo/2)
    for t in range(f,GUION["alto"][1]+1):
        if t>f:
            for _ in range(8):
                dt = 1/(FPS*8)
                v.z -= 9.81*dt
                p += v*dt
                giro += omega*dt
                piso = terreno(p.x,p.y)+envolvente*1.02
                if p.z<=piso:
                    p.z = piso
                    rebotes += 1
                    if rebotes==2:
                        giro.x = giro.z = 0
                        p.z = terreno(p.x,p.y)+radio+.001
                        break
                    v.x *= .42
                    v.y *= .42
                    v.z *= -.29
                    omega *= .44
        clave(o,"location",p,t)
        clave(o,"rotation_euler",giro,t)
        rot = o.rotation_euler.to_matrix()
        puntos = [p+rot @ vert.co for vert in o.data.vertices]
        minimo = min(minimo,min(q.z-terreno(q.x,q.y) for q in puntos))
        if rebotes==2:
            break
    return dict(obj=o,inicio=f,fin=t,origen=origen_mundo,lado=lado,minimo=minimo)


def cruces_eyecciones(escena,piezas,vuelos):
    """Fase amplia por cajas mundiales y fase estrecha entre mallas evaluadas."""
    from mathutils.bvhtree import BVHTree

    def arbol(o):
        e = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = e.to_mesh()
        try:
            return BVHTree.FromPolygons([e.matrix_world @ v.co for v in mesh.vertices],
                                        [tuple(p.vertices) for p in mesh.polygons])
        finally:
            e.to_mesh_clear()

    cruces = {}
    for f in range(min(v["inicio"] for v in vuelos),max(v["fin"] for v in vuelos)+1):
        activos = [v["obj"] for v in vuelos if v["inicio"]<=f<=v["fin"] and v["obj"] not in cruces]
        if not activos:
            continue
        escena.frame_set(f)
        # El vehículo está parado durante las ráfagas. Tras salir de su huella,
        # la trayectoria continúa hacia fuera y el objeto queda en el suelo.
        y = marcha(f)[0]
        activos = [o for o in activos if abs(o.location.x)<1.35 and abs(o.location.y-y)<1.95]
        centros = {o:o.matrix_world.translation for o in activos}
        arboles = {}
        for pieza in piezas:
            if not centros:
                break
            if pieza.type not in ("MESH","CURVE"):
                continue
            matriz = pieza.matrix_world
            pts = [matriz @ Vector(v) for v in pieza.bound_box]
            caja = [(min(p[i] for p in pts)-.026,max(p[i] for p in pts)+.026) for i in range(3)]
            cercanos = [o for o,p in centros.items() if all(a<=c<=b for (a,b),c in zip(caja,p))]
            if cercanos:
                superficie = arbol(pieza)
                for o in cercanos:
                    if o not in arboles:
                        arboles[o] = arbol(o)
                    if superficie.overlap(arboles[o]):
                        cruces[o] = dict(cuadro=f,pieza=pieza.name)
                        del centros[o]
    return cruces


def varilla_fx(pool,nombre,inicio,fin,radio,largo,mat,lados):
    libres = pool.setdefault(nombre,[])
    for i,(ultimo,o) in enumerate(libres):
        if ultimo<inicio-1:
            break
    else:
        o = revolucion(nombre,None,(0,0,0),Y,[(radio,-largo/2),(radio,largo/2)],mat,n=lados)
        i = len(libres)
        libres.append(None)
    libres[i] = (fin,o)
    return o


def impactos(tx,ty,altura,f,i,boca,rng,pool,arena,varillas):
    # La placa y las salpicaduras están coreografiadas en su propio plano.
    normal = Vector((tx,ty-marcha(GUION["frenada"][1])[0],0)).normalized()
    lateral = normal.cross(Z)
    fallo = i%7==4
    p = Vector((tx,ty,altura))+lateral*rng.uniform(-.54,.54)-normal*.054
    p.z += rng.uniform(-.38,.38)
    if fallo:
        p += lateral*1.08-normal*.52
        p.z = terreno(p.x,p.y)+.04
    origen_boca = boca.translation
    rumbo = (p-origen_boca).normalized()
    if i%3==2:
        tr = varilla_fx(varillas,"trazadora",f,f+1,.023,1.65,"nucleo",8)
        visible(tr,f,f+1)
        clave(tr,"rotation_euler",rumbo.to_track_quat("Y","Z").to_euler(),f)
        clave(tr,"location",origen_boca.lerp(p,.28),f)
        clave(tr,"location",p-rumbo*.84,f+1)
    if fallo:
        for j in range(5):
            nube(pool,arena,f+1,p,Vector((rng.uniform(-.38,.48),rng.uniform(-.3,.3),
                                         rng.uniform(.56,.80))),rng.uniform(.13,.24),15+j)
    else:
        cicatriz = revolucion("marca_impacto",None,p,normal,[(.036,0),(.034,.005)],"goma",n=12)
        visible(cicatriz,f+1)
        flash = varilla_fx(varillas,"destello_placa",f+1,f+1,.09,.085,"llama",8)
        clave(flash,"location",p,f+1)
        visible(flash,f+1,f+1)
        for j in range(rng.randint(15,25)):
            vel = lateral*rng.uniform(-2.9,2.9)-normal*rng.uniform(.5,2)+Z*rng.uniform(.9,3.1)
            vida = rng.randint(6,12)
            o = varilla_fx(varillas,"chispa",f+1,f+vida,.009,.22,"nucleo",5)
            visible(o,f+1,f+vida)
            for k in range(vida):
                t = k/FPS
                clave(o,"location",p+vel*t-Z*(4.905*t*t),f+1+k)
                clave(o,"rotation_euler",(vel-Z*(9.81*t)).to_track_quat("Y","Z").to_euler(),f+1+k)
                s = 1-k/vida
                clave(o,"scale",(s,s,s),f+1+k)


def polvo_rodadura(pool,mat,f,contactos,rng):
    ini,fin = GUION["frenada"]
    if f>fin:
        return
    frena = f>=ini
    if f%2:
        return
    anteriores = marcha(max(1,f-1))[0]
    inercia = 29*(marcha(f)[0]-anteriores)
    for s in ESQUINAS:
        delantera = s[0]=="d"
        if delantera and not frena:
            continue
        lado = 1 if s[-1]=="d" else -1
        deriva = Vector((lado*rng.uniform(.22,.46),
                         .98 if delantera else -rng.uniform(1.25,1.85),
                         rng.uniform(.54,.88)))
        nube(pool,mat,f,contactos[s]+Z*.10,deriva,.60,29,.25,inercia if delantera else 0.)


def preparar_movimiento(veh,raiz,poses,eventos):
    objs = bpy.data.objects
    arma,torreta = objs["arma"],objs["torreta"]
    reposo = arma.location.copy()
    calor_b = calor_c = 0.
    anteriores = dict.fromkeys(ESQUINAS,0.)
    for f,(y,z,p,r,az,ap,ar,mz) in poses.items():
        clave(veh,"location",(0,y,0),f)
        for obj,k,v in ((veh,"altura_cuerpo",z),(veh,"cabeceo_cuerpo",p),(veh,"balanceo_cuerpo",r),
                        (raiz,"flotacion_aro",az),(raiz,"cabeceo",ap),(raiz,"balanceo",ar),
                        (objs["motor"],"oscilacion",mz)):
            mando(obj,k,v,f)
        for s in ESQUINAS:
            if s[0]!="d" or not GUION["bloqueo"][0]<=f<=GUION["bloqueo"][1]:
                anteriores[s] += y-poses[max(1,f-1)][0]
            mando(objs["rueda_"+s],"giro",-math.degrees(anteriores[s]/DIM["rueda_r"]),f)
        yaw,elev = punteria(f)
        edad = min((f-t for t in eventos if t<=f),default=100)
        retroceso = -.025*(1-suave(edad/3))
        yaw += .23*math.exp(-edad)*math.cos(edad*2.7)
        clave(torreta,"rotation_euler",(0,0,-math.radians(yaw)),f)
        e = math.radians(elev)
        clave(arma,"rotation_euler",(e,0,0),f)
        clave(arma,"location",reposo+Vector((0,math.cos(e),math.sin(e)))*retroceso,f)
        calor_b = min(1.,calor_b*.978+.048*marcha(f)[1]/9)
        calor_c = min(1.,calor_c*.974+.108*(f in eventos))
        mando(veh,"calor_frenos",calor_b,f)
        mando(veh,"calor_canon",calor_c,f)


def contar_mallas(objetos):
    deps = bpy.context.evaluated_depsgraph_get()
    triangulos = 0
    for o in objetos:
        if o.type in ("MESH","CURVE"):
            e = o.evaluated_get(deps)
            mesh = e.to_mesh()
            mesh.calc_loop_triangles()
            triangulos += len(mesh.loop_triangles)
            e.to_mesh_clear()
    return dict(objetos=len(objetos),triangulos=triangulos)


def animacion(escena,raiz,destino,datos,args,intervalo):
    carpeta = destino/"animacion"
    carpeta.mkdir(exist_ok=True)
    fin = GUION["alto"][1]
    escena.frame_start,escena.frame_end = 1,fin
    escena.render.fps,escena.render.fps_base = FPS,1
    escena.render.resolution_x,escena.render.resolution_y = (960,540) if args.previa else (1280,720)
    if args.previa:
        escena.eevee.taa_render_samples = 12
    escena.render.use_motion_blur = True
    escena.render.motion_blur_shutter = .5
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    objs = bpy.data.objects
    veh = preparar_cuerpo(raiz)
    piezas = set(raiz.children_recursive)
    poses,eventos = perfiles(),disparos()
    rng = random.Random(7041)
    pista_accion()
    bandas = {s:(objs["rueda_"+s],banda_contacto(objs["rueda_"+s])) for s in ESQUINAS}
    calor(veh,"calor_frenos",[f"disco_{s}_{i}" for s in ESQUINAS[:2] for i in (0,1)],"FF3110",4.)
    calor(veh,"calor_canon",["apagallamas"],"FF4A0C",3.5)
    preparar_movimiento(veh,raiz,poses,eventos)
    cams = camaras(escena,poses,eventos)
    iniciales = set(escena.objects)
    material_fx("llama","FF8B31",19)
    material_fx("nucleo","FFF1B4",38)
    laton = material_fx("laton_vaina","F8CA73",.26)
    metal = next(n for n in laton.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    metal.inputs["Metallic"].default_value = .88
    metal.inputs["Roughness"].default_value = .19
    humo = material_nube("humo_calido","D4CAC0","EAE2D7",1.55)
    arena = material_nube("polvo_arena","C8A97A","EBD2AB",17.)
    tx,ty = centro_blanco()
    altura = DIM["pitch_z"]+14*math.tan(math.radians(6))
    poste = terreno(tx,ty)
    tubo("poste",None,(tx,ty,poste),(tx,ty,altura),.07,"grafito")
    placa = caja("blanco",None,(tx,ty,altura),(1.20,.09,.90),"acero")
    placa.rotation_euler.z = -math.radians(110)
    avances = marcas()
    bordes_pista(poses[fin][0])
    fogonazo(objs["boca"],rng,eventos)
    pool,recortes,recorridos,holguras = {},[],{},[]
    from mathutils.bvhtree import BVHTree
    deps = bpy.context.evaluated_depsgraph_get()
    superficie = BVHTree.FromObject(objs["suelo"],deps)
    errores = dict.fromkeys(ESQUINAS,0.)
    errores_malla = dict.fromkeys(ESQUINAS,0.)
    varillas = {}
    for f in poses:
        escena.frame_set(f)
        recorridos[f] = apoyar(f,bandas,recortes)
        bpy.context.view_layer.update()
        puntos = {}
        for s,(rueda,banda) in bandas.items():
            mat = rueda.matrix_world
            pts = [mat @ v for v in banda]
            bajo = min(v.z for v in pts)
            h,q = min(((v.z-terreno(v.x,v.y),v) for v in pts if v.z < bajo+.035),
                      key=lambda par:par[0])
            inferior = min(pts,key=lambda v:v.z)
            errores[s] = max(errores[s],abs(h),abs(bajo-terreno(inferior.x,inferior.y)))
            for taco in (inferior,q):
                piso = superficie.ray_cast(taco+Z,-Z,2.)[0]
                errores_malla[s] = max(errores_malla[s],abs(taco.z-piso.z))
            puntos[s] = q
            if f<=GUION["frenada"][1]:
                clave(avances[s],"default_value",rueda.matrix_world.translation.y,f)
        polvo_rodadura(pool,arena,f,puntos,rng)
        if f in eventos:
            i = eventos.index(f)
            boca = objs["boca"].matrix_world.copy()
            arma = objs["arma"].matrix_world.copy()
            for j in range(rng.randint(2,4)):
                direccion = boca.to_3x3() @ Y
                deriva = Vector((rng.uniform(.14,.42),rng.uniform(-.17,.17),rng.uniform(.5,.95)))
                nube(pool,humo,f,boca.translation+direccion*rng.uniform(.05,.09),
                     deriva-direccion*rng.uniform(.62,1.10),rng.uniform(.26,.30),42,.12)
            holguras.append(eyeccion("vaina",arma,1,f,rng))
            if i%2:
                holguras.append(eyeccion("eslabon_suelto",arma,-1,f,rng))
            impactos(tx,ty,altura,f,i,boca,rng,pool,arena,varillas)

    pendientes = holguras
    reintentos = 0
    for intento in range(5):
        cruces = cruces_eyecciones(escena,piezas,pendientes)
        if not cruces or intento==4:
            break
        pendientes = []
        for i,v in enumerate(holguras):
            o = v["obj"]
            if o in cruces:
                nuevo = eyeccion(o.name,v["origen"],v["lado"],v["inicio"],rng,o)
                holguras[i] = nuevo
                pendientes.append(nuevo)
                reintentos += 1
    despeje = min(v["minimo"] for v in holguras)
    extremos = {}
    for s in ESQUINAS:
        for elegir in (min,max):
            f = elegir(recorridos,key=lambda t:recorridos[t][s])
            if f not in extremos:
                escena.frame_set(f)
                extremos[f] = medir_anclajes()
    encuadre = medir_planos(escena,cams,piezas,placa,holguras)
    escena.frame_set(1)
    cuenta = contar_mallas(piezas)
    inicio,freno = GUION["frenada"]
    informe = dict(encuadre=encuadre,contacto_max_m=max(max(errores.values()),max(errores_malla.values())),
                   contacto_por_rueda_m=errores,contacto_malla_por_rueda_m=errores_malla,
                   recortes=recortes,recorridos_m={s:[min(v[s] for v in recorridos.values()),
                   max(v[s] for v in recorridos.values())] for s in ESQUINAS},
                   cabeceo_frenada_max_grados=max(poses[f][2] for f in range(inicio,freno+1)),
                   anclajes_extremos=extremos,despeje_min_eyecciones_m=despeje,
                   cruces_eyecciones={o.name:c for o,c in cruces.items()},reintentos_eyecciones=reintentos,
                   eventos=dict(disparos=eventos,frenada=GUION["frenada"],bloqueo=GUION["bloqueo"],
                                giro=GUION["giro"]),vehiculo=cuenta,
                   triangulos_originales=datos["triangulos_totales"],
                   vfx=contar_mallas(set(escena.objects)-iniciales),
                   objetos_nube={k:len(v) for k,v in pool.items()})
    informe["aceptado"] = (encuadre["aceptado"] and informe["contacto_max_m"]<.01 and not recortes and
                           3.5<=informe["cabeceo_frenada_max_grados"]<=4.5 and
                           max(m["error_anclaje_m"] for m in extremos.values())<.005 and
                           despeje>=0 and not cruces and cuenta["triangulos"]==datos["triangulos_totales"]
                           and len(pool[humo.name])<=120 and len(pool[arena.name])<=150)
    (destino/"animacion.json").write_text(json.dumps(informe,indent=2,ensure_ascii=False)+"\n",
                                          encoding="utf8")
    escena.render.filepath = "//animacion/####"
    bpy.ops.wm.save_as_mainfile(filepath=str(destino/"tubular_blockout.blend"))
    escena.frame_start,escena.frame_end = intervalo
    bpy.ops.render.render(animation=True)


def construir():
    """Vehículo completo con su rig, sin escena de render. Lo usa también el exportador."""
    materiales()
    raiz = objeto("raiz", None, (0,0,0))
    plataforma = objeto("plataforma_aro",raiz,(0,0,DIM["aro_z"]))
    for prop,limite,canal,i,expr,unidad in (
            ("flotacion_aro",.06,"location",2,f"{DIM['aro_z']}+v","m"),
            ("cabeceo",4,"rotation_euler",0,"v*pi/180","grados"),
            ("balanceo",4,"rotation_euler",1,"v*pi/180","grados")):
        control(raiz,prop,-limite,limite,unidad)
        conducir(plataforma,canal,i,raiz,prop,expr)
    motor = motorizacion(raiz,plataforma)
    angulos = chasis(raiz,plataforma,motor)
    accesorios_clips(motor)
    montaje(plataforma)
    return raiz, angulos


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--presentacion", action="store_true")
    parser.add_argument("--turntable", action="store_true")
    parser.add_argument("--detalle", action="store_true")
    parser.add_argument("--poses", action="store_true")
    parser.add_argument("--demo-suspension", action="store_true")
    parser.add_argument("--animacion", action="store_true")
    parser.add_argument("--previa", action="store_true")
    parser.add_argument("--cuadros", metavar="A-B")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    intervalo = (1,GUION["alto"][1])
    if (args.previa or args.cuadros) and not args.animacion:
        parser.error("--previa y --cuadros requieren --animacion")
    if args.cuadros:
        try:
            a,b = map(int,args.cuadros.split("-"))
            if not 1<=a<=b<=intervalo[1]:
                raise ValueError
        except ValueError:
            parser.error("--cuadros requiere A-B dentro de la animación")
        intervalo = a,b
    destino = args.salida.resolve()
    destino.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    escena = bpy.context.scene
    escena.unit_settings.system = "METRIC"
    raiz, angulos = construir()
    estudio(escena)
    datos = reporte(escena, raiz, angulos)
    vista(escena.camera, "34")
    escena.render.filepath = "//vista_34.png"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(destino/"tubular_blockout.blend"))
    (destino/"reporte.json").write_text(json.dumps(datos, indent=2, ensure_ascii=False)+"\n", encoding="utf8")
    if args.animacion and not any((args.detalle,args.poses,args.presentacion,args.turntable,args.demo_suspension)):
        animacion(escena,raiz,destino,datos,args,intervalo)
        return
    for nombre in VISTAS:
        vista(escena.camera, nombre)
        escena.render.filepath = str(destino/f"vista_{nombre}.png")
        bpy.ops.render.render(write_still=True)

    if args.detalle:
        vistas_detalle(escena,destino)
    if args.poses:
        vista(escena.camera,"34")
        # Margen fijo para las excursiones. En las poses de banco se ve el droop completo.
        escena.camera.data.ortho_scale *= 1.10
        suelo = bpy.data.objects["suelo"]
        suelo.location.z = -.18
        for nombre,valores in POSES.items():
            posar(*valores)
            escena.render.filepath = str(destino/f"pose_{nombre}.png")
            bpy.ops.render.render(write_still=True)
        posar()
        suelo.location.z = 0
    if args.presentacion or args.turntable:
        presentacion(escena,destino,args.presentacion,args.turntable)
    if args.demo_suspension:
        escena.render.resolution_x, escena.render.resolution_y = 1280, 720
        escena.camera.data.type = "ORTHO"
        vista(escena.camera,"34")
        escena.camera.data.ortho_scale *= 1.10
        demo(escena,destino)
    if args.animacion:
        if args.demo_suspension:
            pista = bpy.data.objects["pista_demo"]
            for o in list(pista.children)+[pista]:
                bpy.data.objects.remove(o,do_unlink=True)
            for s in ESQUINAS:
                asignar(bpy.data.objects["rueda_"+s],"giro",0)
            posar()
        animacion(escena,raiz,destino,datos,args,intervalo)


if __name__ == "__main__":
    main()
