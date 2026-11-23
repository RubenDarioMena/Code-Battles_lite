"""Taller CODEMAGEDDON. Coordenadas de diseño y contornos en metros, Z arriba."""
import argparse
import ctypes as ct
import json
import sys
from contextlib import contextmanager
from time import perf_counter
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path
import numpy as np

PALABRA = "CODEMAGEDDON"
FUENTES = Path("/System/Library/Fonts/Supplemental")
HOLGURA = .00005
GROSOR = .025
Z_BLOQUE = .060
Z_CORTE = Z_BLOQUE + GROSOR
Z_HAZ = .90
F_MUESTRA, TAPA_MUESTRA = 178, .037
PLANOS = [('A',1,60,'cam_A_macro_N'), ('D',61,156,'cam_D_fresa'),
          ('B',157,216,'cam_B_laser_O'), ('C',217,288,'cam_C_macro_O'),
          ('E',289,348,'cam_E_palabra')]
FIN = PLANOS[-1][2]
GUION = {
    'N': dict(inicio=1, altura=Z_BLOQUE, duracion=60),
    'O': dict(inicio=217, altura=Z_CORTE, duracion=72),
    'exterior': (159,189), 'salto': (190,193), 'interior': (194,209),
    'retirada': (210,216),
}
LETRA = dict(tapa_m=.0030,  # usuario: hoja 1 C1
             banda_m=.0052,
             rojo=(.53,.002,.004), acero=(.34,.37,.40), rug_metal=.24, emision=.58)
ACERO = (.55,.58,.62)
# Orquestador · montaje pedido por el usuario (20 nov): deslizamiento lateral en los primeros planos
# de las herramientas, enfoque «a pulso» placa→fresa→placa en D, hundimiento desigual de la O con un
# leve empuje de cámara, y revelado de la palabra levantando el bloque galvanizado en E.
MONTAJE = dict(deslizar_B_m=.012, deslizar_D_m=.009, apertura_D=2.8, pulso_D_m=.00045,
               empuje_C_m=.018, subida_E=(291,324,(0,.16,.60)),
               empuje_E=.05)
LUCES = {  # posición, destino, vatios, lados del softbox en metros, RGB lineal
    'Contra fría': ((-.012,.343,.336), (-.012,0,.263), 4.8, (.664,.065), (.76,.88,1.)),
    'Rasante CODE': ((-.23,.052,.018),(-.148,0,-.002),1.9,(.084,.012),(.94,.97,1.)),
    'Rasante cálida': ((-.32,-.08,.085), (0,0,.025), 5., (.30,.10), (1.,.77,.56)),
    'Clave frontal': ((.16,-.34,.36), (.065,0,.04), 6., (.42,.30), (1.,.96,.91)),
    # Áreas de reflexión. Una cerca del horizonte para A/C y otra en la familia especular de B/D/E.
    'Tarjeta baja': ((.16,.20,.025), (.13,0,0), 1.2, (.42,.033), (.89,.94,1.)),
    'Tarjeta alta': ((-.128,.366,.227), (-.128,0,.149), 2.6, (.502,.094), (.90,.96,1.))}
# Usuario (20 nov, hojas 1 y 2 · C1): toda la luz −2.5 stops.
LUCES = {k:(p,d,w*2**-2.5,l,c) for k,(p,d,w,l,c) in LUCES.items()}
V = np.asarray
def caja(p):
    return np.array([np.min(p, axis=0), np.max(p, axis=0)])

def leer_fuente():
    """CoreText lee los outlines del TTF concreto. CGPathApply entrega líneas y Béziers."""
    ruta = next(p for p in (FUENTES/'Arial Black.ttf', FUENTES/'Impact.ttf') if p.is_file())
    def api(lib, nombre, resultado, *args):
        f = getattr(ct.CDLL(f'/System/Library/Frameworks/{lib}.framework/{lib}'), nombre)
        f.restype, f.argtypes = resultado, args
        return f
    ptr, dbl, ushort = ct.c_void_p, ct.c_double, ct.c_uint16
    class Elemento(ct.Structure):
        _fields_ = [('tipo', ct.c_int), ('puntos', ct.POINTER(dbl * 2))]
    callback = ct.CFUNCTYPE(None, ptr, ct.POINTER(Elemento))
    cg, core = 'CoreGraphics', 'CoreText'
    provider = api(cg,'CGDataProviderCreateWithFilename',ptr,ct.c_char_p)(bytes(ruta))
    fuente = api(cg,'CGFontCreateWithDataProvider',ptr,ptr)(provider)
    font = api(core,'CTFontCreateWithGraphicsFont',ptr,ptr,dbl,ptr,ptr)(fuente,1000,None,None)
    glyph = api(core,'CTFontGetGlyphsForCharacters',ct.c_bool,ptr,ct.POINTER(ushort),ct.POINTER(ushort),ct.c_long)
    path = api(core,'CTFontCreatePathForGlyph',ptr,ptr,ushort,ptr)
    recorrer = api(cg,'CGPathApply',None,ptr,ptr,callback)
    soltar = api('CoreFoundation','CFRelease',None,ptr)
    letras = {}
    for char in sorted(set(PALABRA)):
        gid, anillos = ushort(), []
        if not glyph(font, ct.byref(ushort(ord(char))), ct.byref(gid), 1):
            raise ValueError(f'Falta {char} en {ruta}')
        @callback
        def tramo(_, elemento):
            tipo = elemento.contents.tipo
            if tipo == 4:
                return
            puntos = [V(tuple(p)) for p in elemento.contents.puntos[:(1,1,2,3)[tipo]]]
            if tipo == 0:
                anillos.append([puntos[0]])
            elif tipo == 1:
                anillos[-1].extend(puntos)
            else:
                controles = [anillos[-1][-1], *puntos]
                for t in np.linspace(0,1,13)[1:]:
                    q = V(controles)
                    while len(q) > 1:
                        q = q[:-1]*(1-t) + q[1:]*t
                    anillos[-1].append(q[0])
        trazo = path(font,gid,None)
        recorrer(trazo,None,tramo)
        soltar(trazo)
        letras[char] = [p[np.linalg.norm(p-np.roll(p,1,axis=0),axis=1)>1e-8] for p in map(V,anillos)]
    for obj in (font,fuente,provider):
        soltar(obj)
    return str(ruta), letras

def area(p):
    return np.sum(p[:,0]*np.roll(p[:,1],-1) - p[:,1]*np.roll(p[:,0],-1))/2

@lru_cache(None)
def tipografia():
    ruta, letras = leer_fuente()
    escala_em = .030 / np.ptp(np.vstack(letras['E'])[:,1])
    avance, perfiles = 0., []
    for c in PALABRA:
        escala = min(escala_em, .03045/np.ptp(np.vstack(letras[c])[:,1]))
        a,b = caja(np.vstack(letras[c]))*escala
        anillos = sorted(letras[c], key=lambda p: -abs(area(p)))
        perfiles.append([(p if (area(p)>0)==(i==0) else p[::-1])*escala +
                         [avance-a[0],-.015] for i,p in enumerate(anillos)])
        avance += b[0]-a[0]+.004
    ancho = avance-.004
    return ruta, ancho, [[p-[ancho/2,0] for p in letra] for letra in perfiles]

def contorno_letra(indice):
    """Bucles XY mundiales abiertos (cierre implícito), exterior antihorario, vacíos horarios."""
    return tipografia()[2][indice]

def inset(p, distancia=HOLGURA):
    d = np.roll(p,-1,axis=0)-p
    n = d[:,::-1]*[-1,1] / np.linalg.norm(d,axis=1)[:,None]
    anterior = np.roll(n,1,axis=0)
    return p + distancia*(anterior+n)/(1+(anterior*n).sum(axis=1))[:,None]

def campo(anillos):
    """Distancia euclídea a segmentos en los centros de texel, con signo por paridad."""
    a,b = caja(np.vstack(anillos))
    paso = max(b-a)/248
    a = a-4*paso
    w,h = np.ceil((b+4*paso-a)/paso).astype(int)
    y,x = np.ogrid[:h,:w]
    x,y = a[0]+(x+.5)*paso, a[1]+(y+.5)*paso
    dist, dentro = np.full((h,w),np.inf), np.zeros((h,w),bool)
    for p in anillos:
        for (u,v),(s,t) in zip(p,np.roll(p,-1,axis=0)):
            dx,dy = s-u,t-v
            k = np.clip(((x-u)*dx+(y-v)*dy)/(dx*dx+dy*dy),0,1)
            dist = np.minimum(dist,(x-u-k*dx)**2+(y-v-k*dy)**2)
            if dy:
                dentro ^= ((v>y)!=(t>y)) & (x < u+(y-v)*dx/dy)
    return np.where(dentro,1,-1).astype('f')*np.sqrt(dist).astype('f'), a, paso*V([w,h])

@lru_cache(None)
def mapa_letra(i,reducida=False):
    return campo([inset(p) if reducida else p for p in contorno_letra(i)])

def ancho_tapa(maximo):
    # En los trazos más estrechos de Impact, reservar un núcleo de acero medible.
    return min(LETRA['tapa_m'],.96*maximo)

def nube(i, z, pieza=False):
    p = np.vstack([inset(q) if pieza else q for q in contorno_letra(i)])
    return np.vstack([np.column_stack((p,np.full(len(p),h))) for h in z])

def centro(i):
    return caja(contorno_letra(i)[0]).mean(axis=0)[0]

@lru_cache(None)
def camaras():
    configs = {}
    for key,i,dist,az in [('A',11,.275,0),('C',10,.325,18)]:
        a = np.deg2rad(az)
        foco = V([centro(i),0.,0.])
        h = .04 if key=='A' else .025+dist*np.tan(np.deg2rad(29))
        pos = foco + [-dist*np.sin(a),-dist*np.cos(a),h]
        mira = foco + [0,0,h-dist*np.tan(np.deg2rad(7.5 if key=='A' else 29))]
        configs[key] = (pos,mira,72 if key=='A' else 61,36.,8.,foco)
    for key,i,z,az,el,dist,f in [('B',10,Z_CORTE,19,25,.245,80),('D',1,0,12,42,.185,77),
                                 ('E',None,0,0,45,.80,59)]:
        # Mantener el encuadre si se usa la alternativa Impact, de dibujo más estrecho.
        dist *= (np.ptp(contorno_letra(i)[0][:,0])/.03051 if i is not None else tipografia()[1]/.39213)
        foco = V([centro(i) if i is not None else 0.,origen_troquel() if key=='B' else 0.,z])
        a,e = np.deg2rad([az,el])
        mira = foco + [0,0,{'B':-.009,'D':.005,'E':.001}[key]]
        if key=='B':
            dist = max(dist,.178)  # La altura y el espesor de Impact se mantienen a escala real.
        if key=='D' and dist<.138:
            dist,mira[2] = .138,.007
        pos = mira + dist*V([np.sin(a)*np.cos(e),-np.cos(a)*np.cos(e),np.sin(e)])
        configs[key] = (pos,mira,f,36.,{'B':9.,'D':3.5,'E':11}[key],foco)
    mira = V([.135,0.,.035])
    configs['muestra'] = (mira+[.15,-.42,.20],mira,52.,36.,4.,V([centro(11),0.,TAPA_MUESTRA]))
    return configs

def ejes(direccion):
    eje = direccion/np.linalg.norm(direccion)
    der = np.cross(eje,[0,0,1])
    der /= np.linalg.norm(der)
    return eje,der,np.cross(der,eje)

def proyeccion(cam,p,shift_y=0.):
    pos,mira,f,sensor,_,_ = cam
    eje,der,arriba = ejes(mira-pos)
    q = p-pos
    return V([.5,.5-shift_y*16/9]) + np.column_stack((q@der,q@arriba*16/9))*(f/sensor)/(q@eje)[:,None]

def rayos_camara(cam,uv,shift_y=0.):
    pos,mira,f,sensor,_,_ = cam
    eje,der,arriba = ejes(mira-pos)
    x,y = (V(uv)-.5).T
    return eje+(np.outer(x,der)+np.outer(y*9/16+shift_y,arriba))*sensor/f

def cobertura_placa(cam,desplazamiento,placa):
    esquinas_uv = ((0,0),(1,0),(0,1),(1,1))
    rayos = rayos_camara(cam,esquinas_uv,desplazamiento)
    resultado = []
    for rayo in rayos:
        if rayo[2]>=0:
            resultado.append('sobre horizonte')
        else:
            xy = (cam[0]-rayo*cam[0][2]/rayo[2])[:2]
            resultado.append('placa' if np.all((placa[0,:2]<=xy)&(xy<=placa[1,:2])) else 'fuera de placa')
    return resultado

def entrada_haz(cam,f):
    pie = V([*punta(f),Z_CORTE])
    # Plano que contiene la arista de imagen y=1. Intersección con la vertical del haz.
    eje,_,arriba = ejes(cam[1]-cam[0])
    plano = arriba-eje*cam[3]/cam[2]*9/32
    z = Z_CORTE-(pie-cam[0])@plano/plano[2]
    uv = proyeccion(cam,V([[*pie[:2],z]]))[0]
    return dict(x_uv=float(uv[0]),altura_m=float(z),entra=bool(0<uv[0]<1 and Z_CORTE<z<Z_HAZ))

def reflejos(cam,punto):
    # Rayo de espejo en una tapa plana. Misma orientación -Z/Y que las áreas de Blender.
    rayo = (cam[0]-punto)*[-1,-1,1]
    if rayo[2]<=0: return []
    vistos = []
    for n,(pos,dest,_,lados,_) in LUCES.items():
        normal,der,arriba = ejes(V(dest)-pos)
        cos = rayo@normal
        if cos>=-1e-9: continue
        t = (V(pos)-punto)@normal/cos
        delta = punto+t*rayo-pos
        if t>0 and all(abs(delta@v)<l/2 for v,l in zip((der,arriba),lados)): vistos.append(n)
    return vistos

def fase(f,a,b):
    return float(np.clip((f-a)/(b-a),0,1))

@lru_cache(None)
def simular(letra):
    """Z es la tapa sobre el punto más bajo del canto. SI y tiempo físico."""
    g = GUION[letra]
    gravedad, escala, subpasos = 9.81, 4.5, 64
    dt = 1/(24*escala*subpasos)
    rng = np.random.default_rng(501 if letra=='N' else 502)
    grano = rng.uniform(-.06,.06,48)
    niveles = np.linspace(0,1,len(grano))
    z, vz, vy = g['altura'], 0., 0.
    impulso, restitucion, mu = .16, .13, .22
    vuelo = np.sqrt(2*(z-GROSOR)/gravedad)
    libre = np.sqrt(2*max(0.,z-Z_BLOQUE)/gravedad)
    # Desplazamiento del troquel: vuelo restante + rebote + carrera de frenado.
    y = -impulso*(vuelo-libre+2*restitucion*vuelo)-impulso**2/(2*mu*gravedad)
    modo, angulo, relajacion = 'vuelo', 0., 1.
    estados, atascos, hitos = [], [], {}
    contacto = None
    for paso in range(g['duracion']*subpasos):
        cuadro = g['inicio']+paso/subpasos
        if paso%subpasos==0:
            estados.append((y,z,angulo))
        if modo in ('vuelo','rebote'):
            if z<=Z_BLOQUE and modo=='vuelo':
                vy = impulso  # impulso lateral al librar la cara inferior del troquel
            y += vy*dt
            z += vz*dt-.5*gravedad*dt**2
            vz -= gravedad*dt
            if z<=GROSOR:
                z = GROSOR
                if modo=='vuelo':
                    contacto = dict(vertical_m_s=vz,lateral_m_s=vy)
                    hitos['impacto'] = cuadro
                    vz, modo = -restitucion*vz, 'rebote'
                else:
                    vz, modo = 0., 'deslizamiento'
                    hitos['deslizamiento'] = cuadro
        elif modo=='deslizamiento':
            vy = max(0.,vy-mu*gravedad*dt)
            y = min(0.,y+vy*dt)
            if abs(y)<=HOLGURA or vy==0:
                if abs(y)>HOLGURA:
                    raise ValueError('La pieza se detuvo fuera de su alojamiento')
                y,vy,modo = 0.,0.,'entrada'
                hitos['boca'] = cuadro
        elif modo=='entrada':
            u = 1-z/GROSOR
            mu_k = .30+.12*u+.17*max(0.,3*u-2)+np.interp(u,niveles,grano)
            # Presión lateral por unidad de masa. Dos estrechamientos y amortiguación
            # de la entrada. En reposo la precarga del contacto se relaja.
            normal = 13.+sum(100*np.exp(-((u-c)/.045)**2) for c in (.48,.82))
            normal *= relajacion
            if vz==0 and mu_k*1.24*normal>=gravedad:
                if not atascos or atascos[-1]['profundidad_mm']!=1000*(GROSOR-z):
                    atascos.append(dict(cuadro=cuadro,profundidad_mm=1000*(GROSOR-z)))
                relajacion *= np.exp(-dt/.022)
            else:
                if vz==0 and relajacion<1.:
                    relajacion *= .32  # cede la asperidad al superar el umbral estático
                    normal *= .32
                vz = min(0.,vz+(-gravedad+mu_k*normal-34*vz)*dt)
                z = max(0.,z+vz*dt)
                relajacion += (1-relajacion)*min(1.,abs(vz)*dt/.008)
                if z==0:
                    modo,vz = 'asentada',0.
                    hitos['enrase'] = cuadro
        if modo=='rebote':
            angulo = .019*min(1.,(cuadro-hitos['impacto'])/2)
        elif modo=='deslizamiento':
            angulo = .0012+.0178*min(1.,abs(y)/.004)
        elif modo=='entrada':
            angulo = .0012*max(0.,1-(GROSOR-z)/.003)
        else:
            angulo = 0.
    estados = np.array(estados)
    n = int(hitos['impacto']-g['inicio'])+1
    aceleracion = float(-np.mean(np.diff(estados[:n,1],n=2))*24**2)
    medidas = dict(escala_lenta=escala,dt_s=dt,g_pantalla_m_s2=aceleracion,
                   g_esperada_m_s2=gravedad/escala**2,velocidad_contacto=contacto,
                   numero_atascos=len(atascos),atascos=atascos,hitos=hitos)
    return estados,medidas

def pose(letra,f):
    estados,_ = simular(letra)
    return estados[int(np.clip(f-GUION[letra]['inicio'],0,len(estados)-1))]

def altura(letra,f):
    return pose(letra,f)[1]

def origen_troquel():
    return float(pose('O',GUION['O']['inicio'])[0])

def extremos_z(letra,f):
    cima = altura(letra,f)
    return cima-GROSOR,cima

def franja(k):
    cam = camaras()[k]
    x = cam[5][0]
    dx,dy = (cam[1]-cam[0])[:2]
    return V([[x+y*dx/dy,y,0.] for y in (-.035,.035)])

def transformacion_pieza(i,f):
    y,z,angulo = pose(PALABRA[i],f)
    centro_xy = caja(contorno_letra(i)[0]).mean(axis=0)
    apoyo = centro_xy[1]-min(inset(contorno_letra(i)[0])[:,1])
    return np.r_[centro_xy+[0,y],z-GROSOR+apoyo*np.sin(angulo)],angulo

def nube_animada(i,f):
    pos,angulo = transformacion_pieza(i,f)
    local = nube(i,[0,GROSOR],True)-np.r_[caja(contorno_letra(i)[0]).mean(axis=0),0.]
    c,s = np.cos(angulo),np.sin(angulo)
    return local@V([[1,0,0],[0,c,s],[0,-s,c]])+pos

def shift(k,f):
    if k not in ('A','C'):
        return 0.
    puntos = nube_animada(11 if k=='A' else 10,f)
    uv = proyeccion(camaras()[k],puntos)[:,1]
    centro_fijo = proyeccion(camaras()[k],V([[centro(11 if k=='A' else 10),0.,.018]]))[0,1]
    return (.62*(uv.max()+uv.min())*.5+.38*centro_fijo-.50)*9/16

@lru_cache(None)
def pista(nombre):
    p = contorno_letra(10)[('exterior','interior').index(nombre)]
    xy = np.vstack((p,p[0]))
    arco = np.r_[0.,np.cumsum(np.linalg.norm(np.diff(xy,axis=0),axis=1))]
    return xy,arco

def sobre_pista(nombre,f):
    xy,arco = pista(nombre)
    s = arco[-1]*fase(f,*GUION[nombre])
    return V([np.interp(s,arco,v) for v in xy.T])

def punta(f):
    return punta_local(f)+[0,origen_troquel()]

def punta_local(f):
    ext,inter = GUION['exterior'],GUION['interior']
    pos = V([centro(10),.009])
    parque = pos+[min(.037,1.2*np.ptp(contorno_letra(10)[0][:,0])),.005]
    if f<ext[0]:
        k = fase(f,PLANOS[2][1],ext[0])
        return pos*(1-k)+pista('exterior')[0][0]*k
    if f<=ext[1]:
        return sobre_pista('exterior',f)
    if f<inter[0]:
        a,b = GUION['salto']
        k = fase(f,a-1,b+1)
        return pista('exterior')[0][-1]*(1-k)+pista('interior')[0][0]*k
    if f<=inter[1]:
        return sobre_pista('interior',f)
    k = fase(f,GUION['retirada'][0]-1,GUION['retirada'][1])
    return pista('interior')[0][-1]*(1-k)+parque*k

def claves_punta():
    # Una clave por vértice, incluso entre cuadros: nunca se ataja una curva.
    claves = [1,PLANOS[2][1],GUION['salto'][0]-1,GUION['salto'][1]+1,
              GUION['retirada'][0]-1,GUION['retirada'][1]]
    for n in ('exterior','interior'):
        _,s = pista(n)
        a,b = GUION[n]
        claves.extend(a+(b-a)*s/s[-1])
    return sorted(set(claves))

def eventos():
    ev = []
    for letra in ('N','O'):
        ev.append((GUION[letra]['inicio'],letra+' inicio'))
        ev.extend((round(f),letra+' '+n) for n,f in simular(letra)[1]['hitos'].items())
    for n in ('exterior','salto','interior','retirada'):
        a,b = GUION[n]
        ev.extend([(a,n+' inicio'),(b,n+' fin')])
    return [dict(cuadro=int(f),evento=n) for f,n in sorted(ev)]

def medir_animacion():
    datos = dict(eventos=eventos(),caidas={},contornos={},margen_B=1.,triangulos=None)
    for k,i,letra in [('A',11,'N'),('C',10,'O')]:
        cam,g = camaras()[k],GUION[letra]
        muestras = []
        for f in range(g['inicio'],next(b for n,_,b,_ in PLANOS if n==k)+1):
            puntos = nube_animada(i,f)
            z = puntos[:,2].min(), puntos[:,2].max()
            uv = caja(proyeccion(cam,puntos,shift(k,f)))
            banda = proyeccion(cam,franja(k),shift(k,f))[:,1]
            xy_mm = 1000*abs(pose(letra,f)[0])
            muestras.append(dict(cuadro=f,xy_mm=xy_mm,base_m=z[0],tapa_m=z[1],margen=min(uv[0].min(),1-uv[1].max()),
                                 franja=float(np.ptp(banda)),franja_dentro=bool(min(banda)>=0 and max(banda)<=1)))
        tapas = V([m['tapa_m'] for m in muestras])
        datos['caidas'][letra] = dict(muestras=muestras,xy_max_mm=max(m['xy_mm'] for m in muestras),
            fisica=simular(letra)[1],error_enrase_enteros_mm=1000*abs(tapas[-1]),
            base_min_m=min(m['base_m'] for m in muestras),margen_min=min(m['margen'] for m in muestras),
            franja_min=min(m['franja'] for m in muestras))
    vidas = [v for grupo in particulas() for v in grupo]
    vivas = [sum(a<=f<a+vida for a,vida,*_ in vidas) for n in ('exterior','interior')
             for f in range(GUION[n][0],GUION[n][1]+1)]
    datos['chispas'] = dict(vivas_min=min(vivas),vivas_max=max(vivas),semilla=202702,
                            vida_min=min(v[1] for v in vidas),vida_max=max(v[1] for v in vidas))
    for n in ('exterior','interior'):
        xy,s = pista(n)
        a,b = GUION[n]
        err = 0.
        for f in np.linspace(a,b,16*(b-a)+1):
            d = np.diff(xy,axis=0)
            q = punta_local(f)-xy[:-1]
            t = np.clip((q*d).sum(axis=1)/(d*d).sum(axis=1),0,1)
            err = max(err,np.linalg.norm(q-t[:,None]*d,axis=1).min())
        datos['contornos'][n] = dict(longitud_mm=1000*s[-1],velocidad_mm_cuadro=1000*s[-1]/(b-a),
                                     error_max_mm=1000*err)
    for f in range(PLANOS[2][1],PLANOS[2][2]+1):
        uv = proyeccion(camaras()['B'],np.vstack([nube_animada(10,f),[*punta(f),Z_CORTE]]))
        datos['margen_B'] = min(datos['margen_B'],uv.min(),1-uv.max())
    return datos

# Medidas de fabricación en metros. Las filas intermedias redondean cresta y valle.
PASADAS, PASO, BAJADA = 8, .00040, .00028
FRACCIONES = V([0., .14, .31, .55, .78, 1.])
PERFIL = V([0., -.035, .07, .56, .93, 1.])
NIVELES = PASO*np.r_[(np.arange(PASADAS)[:,None]+FRACCIONES[:-1]).ravel(), PASADAS]
RADIO_FRESA = .0015

def cota(d):
    u = np.clip(V(d)/PASO, 0, PASADAS)
    k = np.floor(u)
    return -BAJADA*np.maximum(0, k+np.interp(u-k,FRACCIONES,PERFIL))

def simplificar(p, tolerancia=.000006):
    """Douglas–Peucker en dos arcos abiertos del mismo bucle."""
    def arco(q):
        delta = q[-1]-q[0]
        t = np.clip((q-q[0])@delta/(delta@delta),0,1)
        dist = np.linalg.norm(q-q[0]-t[:,None]*delta,axis=1)
        i = int(dist.argmax())
        if dist[i]<=tolerancia: return q[:1]
        return np.vstack((arco(q[:i+1]),arco(q[i:])))
    j = int(np.linalg.norm(p-p[0],axis=1).argmax())
    return np.vstack((arco(p[:j+1]),arco(np.vstack((p[j:],p[:1])))))

def isolineas(d,xy,tris,nivel):
    # Un identificador por arista de la rejilla. Ambos triángulos vecinos comparten el cruce.
    v = d[tris]
    activos = tris[(v.min(axis=1)<nivel)&(v.max(axis=1)>=nivel)]
    aristas = np.stack((activos,np.roll(activos,-1,axis=1)),axis=-1)
    extremos = d[aristas]>=nivel
    pares = np.sort(aristas[extremos[:,:,0]!=extremos[:,:,1]],axis=1)
    ar,ind = np.unique(pares,axis=0,return_inverse=True)
    a,b = ar.T
    puntos = xy[a]+((nivel-d[a])/(d[b]-d[a]))[:,None]*(xy[b]-xy[a])
    vecinos = [[] for _ in puntos]
    for a,b in ind.reshape(-1,2):
        vecinos[a].append(b)
        vecinos[b].append(a)
    usados = set()
    bucles = []
    for ini in range(len(puntos)):
        if ini in usados: continue
        orden,prev,j = [],-1,ini
        while j not in usados:
            orden.append(j)
            usados.add(j)
            a,b = vecinos[j]
            prev,j = j,b if a==prev else a
        if j!=ini: raise ValueError('Isolínea abierta')
        bucles.append(simplificar(puntos[orden]))
    return bucles

@lru_cache(None)
def terrazas(i):
    img,a,ext = mapa_letra(i)
    h,w = img.shape
    y,x = np.indices((h,w))
    xy = a+(np.column_stack((x.ravel(),y.ravel()))+.5)*ext/(w,h)
    j = (y*w+x)[:-1,:-1].ravel()
    tris = np.vstack((np.stack((j,j+1,j+w+1),axis=1),np.stack((j,j+w+1,j+w),axis=1)))
    return [(0.,p) for p in contorno_letra(i)]+[
        (d,p) for d in NIVELES[1:] for p in isolineas(img.ravel(),xy,tris,d)]

@lru_cache(None)
def anillos_o():
    # Los dos polígonos de esta O son estrictamente convexos. Intersectar los
    # semiplanos desplazados con un abanico común da filas anidadas y caras sin pliegues.
    contornos = contorno_letra(1)
    centro_xy = caja(contornos[0]).mean(axis=0)
    ang = [np.arange(192)*2*np.pi/192]
    for p in contornos:
        q = p-centro_xy
        ang.append(np.arctan2(q[:,1],q[:,0])%(2*np.pi))
    ang = np.unique(np.round(np.concatenate(ang),12))
    rayos = np.column_stack((np.cos(ang),np.sin(ang)))
    filas = []
    for p,signo in zip(contornos,(1,-1)):
        e = np.roll(p,-1,axis=0)-p
        n = signo*e[:,::-1]*[1,-1]/np.linalg.norm(e,axis=1)[:,None]
        b = ((p-centro_xy)*n).sum(axis=1)
        if np.max((p-centro_xy)@n.T-b)>1e-10: raise ValueError('La O requiere bucles convexos')
        den = rayos@n.T
        den = np.where(den>1e-10,den,np.inf)
        filas.append(V([np.min(np.where(np.isfinite(den),(b-signo*d)/den,np.inf),axis=1)
                        for d in NIVELES]))
    exterior,interior = filas
    # Insertar filas en el fondo para resolver el borde de la última barrida de la bola.
    fondo = np.linspace(exterior[-1],interior[-1],7)[1:-1]
    radios = np.vstack((exterior,fondo,interior[::-1]))
    xy = centro_xy+radios[:,:,None]*rayos
    if not np.all(np.diff(radios,axis=0)<0): raise ValueError('Inversión radial en la O')
    profundidad = np.r_[NIVELES,np.full(len(fondo),NIVELES[-1]),NIVELES[::-1]]
    final = np.broadcast_to(cota(profundidad)[:,None],radios.shape)
    # La vertiente interior ya está pulida. El material pendiente ocupa la banda
    # exterior y se extingue en el fondo dentro del barrido del útil de 3 mm.
    u = np.clip(1-(exterior[-1]-radios)/.0012,0,1)
    stock = [np.maximum(final,-k*BAJADA)-final for k in (6,7)]
    return xy,final,stock[0]*u,stock[1]*u,profundidad

@lru_cache(None)
def recorridos_fresa():
    xy = anillos_o()[0]
    pistas = []
    for k in (7,8):
        fila = xy[np.argmin(abs(NIVELES-k*PASO))]
        q = np.vstack((fila,fila[:1]))
        s = np.r_[0.,np.cumsum(np.linalg.norm(np.diff(q,axis=0),axis=1))]
        pistas.append((q,s/s[-1]))
    return pistas

def punta_fresa(f):
    pistas = recorridos_fresa()
    def punto(i,u):
        q,s = pistas[i]
        return np.array([*(np.interp(u,s,v) for v in q.T),-(7+i)*BAJADA])
    inicio,fin = punto(0,0),punto(1,1)
    if f<61: return inicio+[0,0,.026*(1-fase(f,55,61))]
    if f<=93: return punto(0,fase(f,61,93))
    if f<95: return inicio+(punto(1,0)-inicio)*fase(f,93,95)
    if f<=127: return punto(1,fase(f,95,127))
    if f<=138: return fin+[0,0,.036*fase(f,127,138)]
    return fin+V([.045,.10,.045])*fase(f,138,150)+[0,0,.036]

def tiempos_fresa():
    return [a+32*s for a,(_,s) in zip((61,95),recorridos_fresa())]

def distancia_placa(i,p):
    img,a,ext = mapa_letra(i)
    u = (p-a)/ext
    if np.any((u<0)|(u>=1)):
        lo,hi = caja(contorno_letra(i)[0])
        return -np.linalg.norm(p-np.clip(p,lo,hi))
    x,y = (u*img.shape[::-1]).astype(int)
    return float(img[y,x])

@lru_cache(None)
def virutas():
    rng = np.random.default_rng(202704)
    chips = []
    for f in range(61,128):
        # Arranque en plena proyección; de tres a cinco cuadros hasta el contacto.
        for j in range(12 if f==61 else 4):
            radio = rng.uniform(.00015,.00032)
            largo = rng.uniform(.00050,.0018)
            z0 = radio+.00015
            vida = rng.uniform(3.2,5.0)
            t = vida/96  # inserto macro a 1/4 de velocidad
            # Elegir entre tangentes del filo giratorio que depositen el rizo entero
            # sobre acero a Z=0. La búsqueda sólo ocurre al fabricar cada viruta.
            for intento in range(64):
                az = rng.uniform(0,2*np.pi)
                radial = V([np.cos(az),np.sin(az)])
                origen = punta_fresa(f)[:2]+radial*RADIO_FRESA
                lateral = radial[::-1]*[-1,1]*rng.uniform(.16,.38)
                impacto = origen+lateral*t
                if all(distancia_placa(i,impacto)<-largo*.5-radio-.0002 for i in range(4)):
                    break
            else:
                # La normal exterior de la O siempre da salida durante el barrido.
                radial = origen-caja(contorno_letra(1)[0]).mean(axis=0)
                radial /= np.linalg.norm(radial)
                lateral = radial*.006/t
                origen = punta_fresa(f)[:2]+RADIO_FRESA*radial[::-1]*[1,-1]
            vel = V([*lateral,.5*9.81*t-.00015/t])
            # Un rizo tumbado sobre XY con toda su envolvente encima de la placa.
            chips.append((f,vida,np.r_[origen,z0],vel,radio,largo,az))
    return chips

def posicion_viruta(chip,f):
    nace,vida,p,v,radio,_,_ = chip
    t = np.clip(f-nace,0,vida)/96
    q = p+v*t
    q[2] = max(radio,q[2]-.5*9.81*t*t)
    return q

def piezas():
    """Cajas mundiales de fabricación. Los sólidos de revolución comparten eje Z."""
    ancho = tipografia()[1]
    iz, de = contorno_letra(4)[0][:,0].min()-.012, ancho/2+.012
    bloques = {'base': V([[-.70,-.39,-.05],[.70,.66,0.]]),
               'superior': V([[iz,-.03,Z_BLOQUE],[de,.03,Z_CORTE]])}
    partes = []
    def parte(g,n,xy,z,medidas,forma='caja',mat='grafito'):
        x,y = xy
        w,d = medidas
        partes.append((g,n,V([[x-w/2,y-d/2,z[0]],[x+w/2,y+d/2,z[1]]]),forma,mat))
    g = 'sujecion'
    for mano,x in [('izq',iz-.005),('der',de+.005)]:
        parte(g,'Mordaza '+mano,(x,.006),(Z_BLOQUE+.002,Z_CORTE-.001),(.010,.037))
        parte(g,'Brazo '+mano,(x,.060),(Z_BLOQUE+.012,Z_CORTE-.002),(.010,.075))
        parte(g,'Cilindro '+mano,(x,.095),(Z_BLOQUE+.009,Z_CORTE+.025),(.018,.018),'cil')
        for k in range(6):
            z = Z_BLOQUE+.003+k*.0034
            parte(g,f'Estría {mano} {k}',(x,-.0127),(z,z+.0006),(.009,.0006))
        for y in (.002,.017):
            parte(g,f'Allen {mano} {y}',(x,y),(Z_CORTE-.001,Z_CORTE+.001),(.005,.005),'allen')
    parte(g,'Travesaño prensa',((iz+de)/2,.095),(Z_CORTE+.025,Z_CORTE+.042),(de-iz+.035,.028))
    parte(g,'Columna prensa',((iz+de)/2,.122),(0,Z_CORTE+.042),(.042,.027))
    g,x,y,z = 'fresa',centro(1),.009,.010
    for n,a,b,d,forma,mat in [
            ('Bola carburo',.00023,.00277,.00254,'bola','herramienta'),('Vástago',.0015,.015,.00254,'cil','herramienta'),
            ('Pinza ER',.015,.023,.010,'cono','herramienta'),('Tuerca',.023,.029,.014,'hex','herramienta'),
            ('Portaherramientas',.029,.041,.017,'cil','herramienta'),('Husillo',.041,.087,.024,'cil','grafito')]:
        parte(g,n,(x,y),(z+a,z+b),(d,d),forma,mat)
    for j in range(3):
        h = z+.043+j*.002
        parte(g,f'Aleta husillo {j}',(x,y),(h,h+.001),(.025,.025),'cil')
    parte(g,'Carro fresa',(x,.037),(.081,.089),(.020,.062))
    x0,x1 = x-.048,min(x+.048,iz-.020)
    parte(g,'Guía X fresa',((x0+x1)/2,.065),(.074,.081),(x1-x0,.009))
    parte(g,'Retorno fresa',(x-.043,.068),(.067,.074),(.010,.015))
    parte(g,'Montante fresa',(x-.043,.071),(0,.067),(.012,.012))
    return bloques, partes

def esquinas(b):
    return V(list(product(*b.T)))

def oclusores(pos,objetivos,partes):
    """SAT entre cada caja de máquina y la envolvente convexa cámara–caja de letra."""
    tapan = set()
    for bb in objetivos:
        rayos = esquinas(bb)-pos
        # Normales de caras y productos de aristas con los tres ejes de la otra caja.
        ejes = np.vstack((np.eye(3),np.cross(rayos[:,None,:],np.eye(3)).reshape(-1,3))).T
        a,b = caja(np.vstack((rayos,[0,0,0]))@ejes)
        for _,nombre,parte,_,_ in partes:
            u,v = caja((esquinas(parte)-pos)@ejes)
            if not np.any((v<a-1e-12)|(u>b+1e-12)):
                tapan.add(nombre)
    return sorted(tapan)

def informe():
    fuente,ancho,perfiles = tipografia()
    bloques,partes = piezas()
    r = dict(fuente=fuente,ancho_m=ancho,bloques=bloques,letras=[],maquinas={},encuadres={},
             comprobaciones={},triangulos=None,planos=PLANOS,fps=24,holgura_por_canto_m=HOLGURA)
    def test(n,ok):
        r['comprobaciones'][n] = 'OK' if ok else 'FALLO'
    for i,anillos in enumerate(perfiles):
        b = caja(np.vstack(anillos))
        z = extremos_z(PALABRA[i],1) if i in (10,11) else (-GROSOR,0)
        letra = dict(indice=i,letra=PALABRA[i],caja_xy=b,altura_m=b[1,1]-b[0,1])
        if i>=4:
            letra['caja_pieza'] = caja(nube_animada(i,1) if i in (10,11) else nube(i,z,True))
            img,a,ext = mapa_letra(i,True)
            y,x = np.unravel_index(img.argmax(),img.shape)
            letra['centro_trazo_xy'] = a+ext*(V([x,y])+.5)/img.shape[::-1]
            letra['distancia_max_borde_mm'] = float(img.max()*1000)
            letra['tapa_metal_limpio_pct'] = 100*np.count_nonzero(img>=ancho_tapa(img.max()))/np.count_nonzero(img>=0)
            test(f'Centro de acero limpio {i}',letra['tapa_metal_limpio_pct']>0)
            test(f'Mapa de borde {i}', np.isfinite(img).all() and img.min()<0 and 0<img.max()<.03)
            for p in anillos:
                d = np.roll(p,-1,axis=0)-p
                # Ambos extremos de cada canto nuevo a la distancia normal solicitada.
                delta = inset(p)-p
                normal = d[:,::-1]*[-1,1]/np.linalg.norm(d,axis=1)[:,None]
                assert all(np.allclose((v*normal).sum(axis=1),HOLGURA,atol=1e-10)
                           for v in (delta,np.roll(delta,-1,axis=0)))
        r['letras'].append(letra)
    test('Alturas de mayúscula', all(abs(l['altura_m']-.030)<=.0005 for l in r['letras']))
    test('Separación 4 mm', all(abs(perfiles[i+1][0][:,0].min()-p[0][:,0].max()-.004)<.0002
                                for i,p in enumerate(perfiles[:-1])))
    test('Inset por canto y seis enrasadas',all(l['caja_pieza'][1,2]==0 for l in r['letras'][4:10]))
    # Cajas de diseño del grupo y su ubicación efectiva antes del revelado.
    partes = [(g,n,b+([0,origen_troquel(),0] if g=='sujecion' else 0),forma,mat)
              for g,n,b,forma,mat in partes]
    r['desplazamiento_troquel_y_m'] = origen_troquel()
    r['objetos_maquinas'] = {n:b for _,n,b,_,_ in partes}
    for g in ('sujecion','fresa'):
        r['maquinas'][g] = caja(np.vstack([b for grupo,_,b,_,_ in partes if grupo==g]))
    colisiones = []
    for (g,n,b,*_), (otro,n2,b2,*_) in combinations(partes+[('placa',n,b+[0,origen_troquel() if n=='superior' else 0,0]) for n,b in bloques.items()],2):
        if g!=otro and np.all(np.minimum(b[1],b2[1])-np.maximum(b[0],b2[0])>1e-8):
            colisiones.append([n,n2])
    r['cruces'] = colisiones
    test('Cajas sin penetración entre máquinas o placas',not colisiones)
    iz = r['objetos_maquinas']['Mordaza izq']
    r['separacion_fresa_mordaza_x_m'] = iz[0,0]-r['maquinas']['fresa'][1,0]
    anim = r['animacion'] = medir_animacion()
    for letra,d in anim['caidas'].items():
        test('Caída '+letra,d['xy_max_mm']>1 and d['fisica']['numero_atascos']>0 and
             abs(d['fisica']['g_pantalla_m_s2']/d['fisica']['g_esperada_m_s2']-1)<.02 and
             d['error_enrase_enteros_mm']<=.01 and d['base_min_m']>=-GROSOR)
        test('Margen durante la caída '+letra,d['margen_min']>=.03)
    test('Contornos del láser',all(d['error_max_mm']<.1 for d in anim['contornos'].values()))
    test('O y punta dentro de B',anim['margen_B']>0)
    ch = anim['chispas']
    test('Población y vida de las chispas',10<=ch['vivas_min']<=ch['vivas_max']<=25 and
         6<=ch['vida_min']<=ch['vida_max']<=12)
    for k,cam in camaras().items():
        indices,z = {'A':([11],extremos_z('N',1)), 'B':([10],[Z_CORTE]),
                     'C':([10],extremos_z('O',217)), 'D':([1],[0]), 'E':(range(12),[0]), 'muestra':([11],(TAPA_MUESTRA-GROSOR,TAPA_MUESTRA))}[k]
        f = next((a for key,a,_,_ in PLANOS if key==k),F_MUESTRA)
        puntos = np.vstack([nube(i,z,k in ('A','B','C','muestra')) for i in indices])
        if k in ('A','B','C'):
            puntos = nube_animada(indices[0],f)
        b = caja(proyeccion(cam,puntos,shift(k,f)))
        w,h = b[1]-b[0]
        objetivos = [caja(puntos)] if k in ('A','B','C') else [caja(nube(i,z)) for i in indices]
        presentes = [p for p in partes if k!='E' or p[0]!='fresa']
        tapan = oclusores(cam[0],objetivos,presentes)
        r['encuadres'][k] = dict(caja_uv=b,ancho=w,alto=h,oclusores_maquina=tapan,posicion=cam[0],
                                 mira=cam[1],focal_mm=cam[2],sensor_mm=cam[3],shift_y=shift(k,f))
        e = r['encuadres'][k]
        direccion = cam[0]-cam[1]
        e['inclinacion_grados'] = np.degrees(np.arctan2(direccion[2],np.linalg.norm(direccion[:2])))
        e['apertura'],e['foco_m'] = cam[4:]
        fin = next((b for key,_,b,_ in PLANOS if key==k),f)
        # Orden inferior izq./der., superior izq./der. Guardar sólo los cambios de cobertura.
        estados = {}
        ultimo = None
        for cuadro in range(f,fin+1):
            estado = cobertura_placa(cam,shift(k,cuadro),bloques['base'])
            if estado!=ultimo: estados[cuadro] = estado
            ultimo = estado
        e['esquinas_placa_desde_cuadro'] = estados
        e['placa_cubre_cuadro_completo'] = all(v==['placa']*4 for v in estados.values())
        if k not in ('A','C'): test('Placa sobrepasa cuatro lados '+k,e['placa_cubre_cuadro_completo'])
        e['reflejos_espejo_en_foco'] = reflejos(cam,V(cam[5]))
        if k=='C': test('Vista de tres cuartos C',20<=e['inclinacion_grados']<=35)
        if k=='A':
            test('Centro óptico e inclinación '+k,.025<=cam[0][2]<=.040 and 6<=e['inclinacion_grados']<=12)
        if k in ('B','muestra'):
            frames = ([F_MUESTRA] if k=='muestra' else
                      [n for pista_o in ('exterior','interior') for n in range(GUION[pista_o][0],GUION[pista_o][1]+1)])
            e['entradas_haz'] = {n:entrada_haz(cam,n) for n in frames}
            test('Haz entra por arriba '+k,all(p['entra'] for p in e['entradas_haz'].values()))
        if k=='B':
            tapa = nube(10,[Z_CORTE],True)+[0,origen_troquel(),0]
            test('Ancho O en B',.20<=np.ptp(proyeccion(cam,tapa)[:,0])<=.30)
        if k=='E': test('Inclinación E',40<=e['inclinacion_grados']<=50)
        test('Encuadre '+k,b.min()>=0 and b.max()<=1)
        test('Visibilidad frente a máquinas '+k,not tapan)
        if k in ('A','C'):
            test('Banda de 70 mm alrededor del alojamiento '+k,anim['caidas'][PALABRA[indices[0]]]['franja_min']>=.08)
        if k=='D':
            for nombre in ('Bola carburo','Pinza ER'):
                uv = caja(proyeccion(cam,esquinas(r['objetos_maquinas'][nombre])))
                r['encuadres'][k][nombre+'_uv'] = uv
                test(nombre+' entra en cuadro',np.all(uv[0]<1) and np.all(uv[1]>0))
        if k=='E':
            menor = min(np.ptp(proyeccion(cam,nube(i,[0]))[:,1]) for i in indices)
            r['encuadres'][k]['alto_min_letra'] = menor
            test('Lectura de la palabra',.75<=w<=.90 and menor>=.06)
    test('Grosor bloque y ocho piezas', all(abs(np.ptp(l['caja_pieza'][:,2])-GROSOR)<1e-9
        for l in r['letras'][4:]) and abs(np.ptp(bloques['superior'][:,2])-GROSOR)<1e-9)
    for k in ('muestra','E'):
        reflejadas = {}
        for i in range(4,12):
            z = (TAPA_MUESTRA if i==11 else Z_CORTE if i==10 else 0) if k=='muestra' else 0
            reflejadas[i] = reflejos(camaras()[k],V([*r['letras'][i]['centro_trazo_xy'],z]))
        r['encuadres'][k]['areas_en_reflejo_centro_de_trazo'] = reflejadas
        test('Reflejo geométrico en cada centro de trazo '+k,all(reflejadas.values()))
    r['grabado'] = dict(pasadas={c:PASADAS for c in 'CODE'},paso_mm=1000*PASO,
                        profundidad_max_mm=-1000*float(cota(NIVELES[-1])),
                        sectores_O=anillos_o()[0].shape[1],fin_pasadas=[93,127])
    r['limite_triangulos'] = 800_000
    r['objetivos_JPG'] = dict(media_cara_sRGB=[70,160],esquinas_sRGB_menor_que=15,
                              blanco_puro_no_emisivo_pct_menor_que=2)
    r['geometria_laser_proyectable'] = [n for g,n,*_ in partes if g=='laser']
    test('Sin geometría de cabezal, riel o carro láser',not r['geometria_laser_proyectable'])
    r['medidas_m'] = dict(grosor=GROSOR, profundidad_alojamiento=GROSOR, luz_bajo_bloque=Z_BLOQUE,
                          placa=bloques['base'][1]-bloques['base'][0])
    r['luces'] = {n:dict(posicion=p, destino=d, vatios=w, lados_m=size, rgb=c)
                  for n,(p,d,w,size,c) in LUCES.items()}
    r['muestra'] = dict(cuadro=F_MUESTRA,tapa_N_m=TAPA_MUESTRA,progreso_exterior=fase(F_MUESTRA,*GUION['exterior']),
                        encajadas='MAGEDD',centro_impacto_m=[*punta(F_MUESTRA),Z_CORTE])
    test(f'{FIN} cuadros a 24 fps', [i for _,a,b,_ in PLANOS for i in range(a,b+1)]==list(range(1,FIN+1)))
    return r

def material(nombre,color,metal=0,rug=.32):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for k,v in [('Base Color',(*color,1)),('Metallic',metal),('Roughness',rug)]:
        bs.inputs[k].default_value = v
    return m,bs

def nodo(tree,tipo,entradas=(),operacion=None):
    n = tree.nodes.new(tipo)
    if operacion: n.operation = operacion
    for key,value in entradas:
        if isinstance(value,bpy.types.NodeSocket):
            tree.links.new(value,n.inputs[key])
        else:
            n.inputs[key].default_value = value
    return n

def rampa(tree,senal,a,b):
    n = nodo(tree,'ShaderNodeValToRGB',[(0,senal)])
    for e,(pos,col) in zip(n.color_ramp.elements,(a,b)):
        e.position,e.color = pos,(*col,1)
    return n.outputs[0]

def escalar_xyz(t,coord,escala):
    return nodo(t,'ShaderNodeVectorMath',[(0,coord),(1,escala)],'MULTIPLY').outputs[0]

def ruido(t,coord,escala,detalle=2):
    return nodo(t,'ShaderNodeTexNoise',[('Vector',coord),('Scale',escala),('Detail',detalle)])

def rango(t,valor,a,b,c,d,suave=False):
    n = nodo(t,'ShaderNodeMapRange',[('Value',valor),('From Min',a),('From Max',b),
                                     ('To Min',c),('To Max',d)])
    if suave:
        n.interpolation_type = 'SMOOTHSTEP'
    return n.outputs['Result']

def mezclar(t,f,a,b,modo='MIX'):
    n = nodo(t,'ShaderNodeMix')
    n.data_type,n.blend_type = 'RGBA',modo
    for entrada,valor in zip((0,6,7),(f,a,b)):
        if isinstance(valor,bpy.types.NodeSocket):
            t.links.new(valor,n.inputs[entrada])
        else:
            n.inputs[entrada].default_value = valor
    return n.outputs[2]

def cepillado():
    m,bs = material('Acero · cepillado en X',ACERO,1)
    color = bs.inputs['Base Color']
    for f,factor in ((60,1.),(61,.12),(156,.12),(157,1.),(288,1.),(289,.068)):
        color.default_value = (*(v*factor for v in ACERO),1.)
        color.keyframe_insert(data_path='default_value',frame=f)
    t = m.node_tree
    bs.inputs['Anisotropic'].default_value = .80
    bs.inputs['Anisotropic Rotation'].default_value = .25
    tg = nodo(t,'ShaderNodeTangent')
    tg.direction_type,tg.axis = 'RADIAL','X'
    t.links.new(tg.outputs[0],bs.inputs['Tangent'])
    co = nodo(t,'ShaderNodeTexCoord').outputs['Object']
    satinado = ruido(t,escalar_xyz(t,co,(38,8400,4800)),1,1.5).outputs['Fac']
    bandas = ruido(t,escalar_xyz(t,co,(18,950,1200)),1).outputs['Fac']
    # Trazos sueltos: ruido estirado y umbral de cola, distintos de las bandas de laminado.
    marcas = ruido(t,escalar_xyz(t,co,(140,5700,3700)),1,1).outputs['Fac']
    surco = rango(t,marcas,.68,.78,0,1,True)
    velo = rango(t,ruido(t,co,39,3).outputs['Fac'],.52,.72,0,.023,True)
    rug = op(t,'ADD',rango(t,bandas,.25,.75,.18,.276),op(t,'ADD',velo,op(t,'MULTIPLY',surco,.021)))
    t.links.new(rug,bs.inputs['Roughness'])
    bump = nodo(t,'ShaderNodeBump',[('Height',op(t,'SUBTRACT',satinado,op(t,'MULTIPLY',surco,.6))),
                                     ('Distance',.000013),('Strength',.16)])
    t.links.new(bump.outputs[0],bs.inputs['Normal'])
    return m

def galvanizado():
    t = bpy.data.node_groups.new('Flor de cinc en metros','ShaderNodeTree')
    t.interface.new_socket(name='Superficie',in_out='OUTPUT',socket_type='NodeSocketShader')
    bs = nodo(t,'ShaderNodeBsdfPrincipled')
    nodo(t,'NodeGroupOutput',[(0,bs.outputs[0])])
    geo = nodo(t,'ShaderNodeNewGeometry')
    # Posición mundial en metros: el cinc continúa sobre la O y su isla mientras están en el troquel.
    pos = geo.outputs['Position']
    distorsion = ruido(t,pos,340,4).outputs['Color']
    co = nodo(t,'ShaderNodeVectorMath',[(0,pos),(1,escalar_xyz(t,distorsion,(.0021,)*3))],'ADD').outputs[0]
    def voronoi(tipo):
        v = nodo(t,'ShaderNodeTexVoronoi')
        v.feature = tipo
        v.inputs['Scale'].default_value = 105.
        t.links.new(co,v.inputs['Vector'])
        return v
    grano = nodo(t,'ShaderNodeSeparateColor',[(0,voronoi('F1').outputs['Color'])]).outputs[0]
    distancia = voronoi('DISTANCE_TO_EDGE').outputs['Distance']
    junta = rango(t,distancia,0,.030,1,0,True)
    # Crestas finas y discontinuas, acotadas a la periferia de cada cristal.
    veta = ruido(t,co,1580,2).outputs['Fac']
    cresta = rango(t,op(t,'ABSOLUTE',op(t,'SUBTRACT',veta,.5),0),0,.065,.43,0,True)
    ramas = op(t,'MULTIPLY',cresta,rango(t,distancia,.015,.09,1,0,True))
    junta = op(t,'MAXIMUM',junta,ramas)
    gris = rango(t,grano,0,1,.625,.685)
    # El límite dentado modifica la reflectancia, nunca la normal.
    color = op(t,'SUBTRACT',gris,op(t,'MULTIPLY',junta,.012))
    xyz = nodo(t,'ShaderNodeSeparateXYZ',[(0,pos)])
    x,y,z = xyz.outputs
    lo,hi = piezas()[0]['superior']
    def al_borde(v,a,b):
        return op(t,'MINIMUM',op(t,'ABSOLUTE',op(t,'SUBTRACT',v,a),0),
                  op(t,'ABSOLUTE',op(t,'SUBTRACT',v,b),0))
    lo,hi = lo+[0,origen_troquel(),0],hi+[0,origen_troquel(),0]
    dx,dy,dz = (al_borde(v,a,b) for v,a,b in zip((x,y,z),lo,hi))
    # Segunda distancia más pequeña a un plano límite: sólo las aristas del paralelepípedo.
    arista = op(t,'MINIMUM',op(t,'MAXIMUM',dx,dy),op(t,'MAXIMUM',dz,op(t,'MINIMUM',dx,dy)))
    oxido = op(t,'MULTIPLY',rango(t,arista,0,.0014,1,0,True),
               rango(t,ruido(t,pos,620,3).outputs['Fac'],.51,.74,0,.65,True))
    t.links.new(mezclar(t,oxido,color,(.78,.80,.78,1)),bs.inputs['Base Color'])
    rug = op(t,'ADD',rango(t,grano,0,1,.178,.222),op(t,'MULTIPLY',junta,.021))
    t.links.new(mezclar(t,oxido,rug,(.42,)*3+(1,)),bs.inputs['Roughness'])
    t.links.new(op(t,'SUBTRACT',1,oxido),bs.inputs['Metallic'])
    m,base = material('Galvanizado · flor de cinc',(.65,.67,.69),1)
    arbol = m.node_tree
    arbol.nodes.remove(base)
    grupo = nodo(arbol,'ShaderNodeGroup')
    grupo.node_tree = t
    arbol.links.new(grupo.outputs[0],salida_material(arbol))
    return m

def reflejo_estudio(t,bs,color,filo=0.):
    # Relleno especular analítico en coordenadas mundiales. El reflejo cambia al
    # girar la normal; el nivel bajo entre paneles da detalle en el metal en sombra.
    r = nodo(t,'ShaderNodeTexCoord').outputs['Reflection']
    intensidad = .14
    for eje,pico in (((-.80,-.54,.26),.34),((.62,.66,.42),.23)):
        proyeccion = nodo(t,'ShaderNodeVectorMath',[(0,r),(1,eje)],'DOT_PRODUCT').outputs['Value']
        panel = rango(t,proyeccion,.22,.98,0,pico,True)
        intensidad = op(t,'ADD',intensidad,panel)
    if isinstance(color,bpy.types.NodeSocket):
        t.links.new(color,bs.inputs['Emission Color'])
    else:
        bs.inputs['Emission Color'].default_value = (*color,1)
    t.links.new(op(t,'ADD',intensidad,filo),bs.inputs['Emission Strength'])

def materiales():
    corte,bs = material('Pared de corte · temple y estrías',(.17,.16,.15),1,.37)
    t = corte.node_tree
    pos = nodo(t,'ShaderNodeNewGeometry').outputs['Position']
    estria = ruido(t,escalar_xyz(t,pos,(5400,5400,45)),1,2).outputs['Fac']
    z = nodo(t,'ShaderNodeSeparateXYZ',[(0,pos)]).outputs['Z']
    d = op(t,'MINIMUM',op(t,'SUBTRACT',Z_CORTE,z),op(t,'SUBTRACT',z,Z_BLOQUE))
    temple = rampa(t,rango(t,d,0,.0017,0,1),(0,(.10,.13,.22)),(1,(.16,.15,.14)))
    temple.node.color_ramp.elements.new(.53).color = (.33,.24,.12,1)
    t.links.new(temple,bs.inputs['Base Color'])
    t.links.new(rango(t,estria,.2,.8,.32,.49),bs.inputs['Roughness'])
    t.links.new(nodo(t,'ShaderNodeBump',[('Height',estria),('Distance',.000030),('Strength',.24)]).outputs[0],
                bs.inputs['Normal'])
    graf,bs = material('Pavonado · mordazas y husillo',(.012,.014,.017),.86,.42)
    t = graf.node_tree
    gr = ruido(t,escalar_xyz(t,nodo(t,'ShaderNodeTexCoord').outputs['Object'],(240,240,3700)),1).outputs['Fac']
    t.links.new(rango(t,gr,.2,.8,.38,.52),bs.inputs['Roughness'])
    acero_util = (.76,.80,.84)
    punta,bs = material('Acero de herramienta pulido',acero_util,1,.26)
    reflejo_estudio(punta.node_tree,bs,acero_util)
    return dict(base=cepillado(),galvanizado=galvanizado(),grafito=graf,corte=corte,herramienta=punta)

def mapa_calor(i):
    campo_i,a,extension = mapa_letra(i,True)
    maximo = float(campo_i.max())
    h,w = campo_i.shape
    yy,xx = np.ogrid[:h,:w]
    x,y = a[0]+(xx+.5)*extension[0]/w,a[1]+(yy+.5)*extension[1]/h
    rgba = np.ones((h,w,4),'f')
    rgba[:,:,0] = np.clip(campo_i/maximo,0,1)
    if i==10:
        # Un reloj por texel en la UV solidaria a la pieza. Proyección sobre
        # segmentos (incluido el último); cada anillo tiene su propia ventana.
        mejor = np.full((h,w),np.inf)
        inicio,fin = GUION['exterior'][0],GUION['interior'][1]
        for nombre in ('exterior','interior'):
            q,arco = pista(nombre)
            a,b = GUION[nombre]
            for j,((cx,cy),(dx,dy)) in enumerate(zip(q,np.diff(q,axis=0))):
                u = np.clip(((x-cx)*dx+(y-cy)*dy)/(dx*dx+dy*dy),0,1)
                d2 = (x-cx-u*dx)**2+(y-cy-u*dy)**2
                gana = d2<mejor
                paso = a+(b-a)*(arco[j]+u*(arco[j+1]-arco[j]))/arco[-1]
                # Última llegada dentro del texel, redondeada hacia arriba
                # al empaquetar en 8 bits: el rojo nunca anticipa el paso.
                radio_texel = .5*np.linalg.norm(extension/[w,h])
                llegada = np.minimum(b,paso+radio_texel*(b-a)/arco[-1])
                canal = np.ceil(255*(llegada-inicio)/(fin-inicio))/255
                np.copyto(rgba[:,:,2],canal,where=gana)
                mejor = np.minimum(mejor,d2)
    return rgba,maximo

def textura(nombre,rgba):
    h,w = rgba.shape[:2]
    mapa = bpy.data.images.new(nombre,width=w,height=h,alpha=False)
    mapa.colorspace_settings.name = 'Non-Color'
    mapa.pixels.foreach_set(rgba.ravel())
    mapa.update()
    mapa.pack()
    return mapa

def op(t,operacion,a,b):
    return nodo(t,'ShaderNodeMath',[(0,a),(1,b)],operacion).outputs[0]

def salida_material(t):
    return next(n for n in t.nodes if n.type=='OUTPUT_MATERIAL').inputs['Surface']

def valor_controlado(t,obj,prop):
    v = nodo(t,'ShaderNodeValue').outputs[0]
    d = v.driver_add('default_value').driver
    d.type = 'AVERAGE'
    ref = d.variables.new()
    ref.name,ref.type = 'control','SINGLE_PROP'
    ref.targets[0].id = obj
    ref.targets[0].data_path = f'["{prop}"]'
    return v

def metal_letra(i,galv):
    cfg = LETRA
    rgba,maximo = mapa_calor(i)
    m,bs = material(f'Acero pulido · {PALABRA[i]} {i}',cfg['acero'],1,cfg['rug_metal'])
    t = m.node_tree
    uv = nodo(t,'ShaderNodeUVMap')
    uv.uv_map = 'Proyección XY'
    tex = nodo(t,'ShaderNodeTexImage',[('Vector',uv.outputs[0])])
    tex.image,tex.extension = textura(f'Distancias {i}',rgba),'EXTEND'
    canales = nodo(t,'ShaderNodeSeparateColor',[(0,tex.outputs['Color'])])
    d = op(t,'MULTIPLY',canales.outputs[0],maximo)
    co = nodo(t,'ShaderNodeTexCoord').outputs['Object']
    z = nodo(t,'ShaderNodeSeparateXYZ',[(0,co)]).outputs['Z']
    espesor = op(t,'MINIMUM',z,op(t,'SUBTRACT',GROSOR,z))
    estria = ruido(t,escalar_xyz(t,co,(7200,7200,110)),1,2).outputs['Fac']
    ondula = rango(t,ruido(t,co,720,2).outputs['Fac'],.2,.8,-.0008,.0008)
    lateral = rango(t,op(t,'ADD',espesor,ondula),.0002,cfg['banda_m'],1,0,True)
    tapa = rango(t,d,0,ancho_tapa(maximo),1,0,True)
    nz = nodo(t,'ShaderNodeSeparateXYZ',[(0,nodo(t,'ShaderNodeNewGeometry').outputs['True Normal'])]).outputs['Z']
    cara = rango(t,op(t,'ABSOLUTE',nz,0),.55,.85,0,1,True)
    calor = mezclar(t,cara,lateral,tapa)
    color = rampa(t,calor,(0,cfg['acero']),(1,cfg['rojo']))
    for v,rgb in ((.10,(.35,.36,.41)),(.20,(.20,.19,.30)),(.36,(.44,.22,.09)),(.54,cfg['rojo'])):
        color.node.color_ramp.elements.new(v).color = (*rgb,1)
    t.links.new(color,bs.inputs['Base Color'])
    t.links.new(color,bs.inputs['Specular Tint'])
    rug = mezclar(t,cara,rango(t,estria,.2,.8,.20,.34),(cfg['rug_metal'],)*3+(1,))
    t.links.new(rug,bs.inputs['Roughness'])
    bs.inputs['Anisotropic'].default_value = .66
    # Tangente local Z en las paredes. En la tapa se usa X.
    tangente = nodo(t,'ShaderNodeCombineXYZ',[('X',cara),('Z',op(t,'SUBTRACT',1,cara))])
    eje = nodo(t,'ShaderNodeVectorTransform',[(0,tangente.outputs[0])])
    eje.vector_type,eje.convert_from,eje.convert_to = 'VECTOR','OBJECT','WORLD'
    t.links.new(eje.outputs[0],bs.inputs['Tangent'])
    bump = nodo(t,'ShaderNodeBump',[('Height',estria),('Distance',.000018),
                                    ('Strength',op(t,'MULTIPLY',op(t,'SUBTRACT',1,cara),.23))])
    t.links.new(bump.outputs[0],bs.inputs['Normal'])
    emision = op(t,'MULTIPLY',rango(t,calor,.88,1,0,1,True),cfg['emision'])
    reflejo_estudio(t,bs,color,emision)
    if i==10:
        # Muestreo puntual de llegada para no interpolar el fin y el inicio
        # en la costura o entre pasadas. La distancia conserva su filtro lineal.
        tiempo = nodo(t,'ShaderNodeTexImage',[('Vector',uv.outputs[0])])
        tiempo.image,tiempo.extension,tiempo.interpolation = tex.image,'EXTEND','Closest'
        paso = nodo(t,'ShaderNodeSeparateColor',[(0,tiempo.outputs[0])]).outputs[2]
        # Reloj horneado en el material de la pieza móvil, con el mismo
        # origen y velocidad que el recorrido de los dos contornos.
        inicio,fin = GUION['exterior'][0],GUION['interior'][1]
        reloj = nodo(t,'ShaderNodeValue').outputs[0]
        for f in (inicio-1,FIN):
            reloj.default_value = f-inicio
            reloj.keyframe_insert(data_path='default_value',frame=f)
        edad = op(t,'SUBTRACT',reloj,op(t,'MULTIPLY',paso,fin-inicio))
        frente = op(t,'SUBTRACT',edad,op(t,'MULTIPLY',d,650))
        peso = rango(t,frente,0,.42,0,1,True)
        cinc = nodo(t,'ShaderNodeGroup')
        cinc.node_tree = next(n.node_tree for n in galv.node_tree.nodes if n.type=='GROUP')
        mezcla = nodo(t,'ShaderNodeMixShader',[(0,peso),(1,cinc.outputs[0]),(2,bs.outputs[0])])
        t.links.new(mezcla.outputs[0],salida_material(t))
    return m

def prisma(nombre,anillos,z,mat=None,uv=None,radio_canto=0.):
    from mathutils.geometry import delaunay_2d_cdt
    verts = [Vector(p) for anillo in anillos for p in anillo]
    cortes = np.cumsum([0]+list(map(len,anillos)))
    caras = [list(range(a,b)) for a,b in zip(cortes,cortes[1:])]
    xy,_,tris,_,_,_ = delaunay_2d_cdt(verts,[],caras,0,1e-9,False)
    puntos = V([tuple(p) for p in xy])[tris]
    x,y = puntos.mean(axis=1).T
    dentro = np.zeros(len(tris),bool)
    for p in anillos:
        for (u,v),(s,t) in zip(p,np.roll(p,-1,axis=0)):
            if t!=v: dentro ^= ((v>y)!=(t>y)) & (x<u+(y-v)*(s-u)/(t-v))
    tapas = [tuple(tri) for tri,usar in zip(tris,dentro) if usar]
    superficie = sum(area(tri) for tri in puntos[dentro])
    if not np.isclose(superficie, sum(map(area,anillos)),rtol=2e-5,atol=1e-12):
        raise ValueError(f'Triangulación incorrecta de {nombre}')
    n = len(xy)
    borde = set()
    for tri in tapas:
        for a,b in zip(tri,tri[1:]+tri[:1]):
            if (b,a) in borde: borde.remove((b,a))
            else: borde.add((a,b))
    caras = [t[::-1] for t in tapas]+[tuple(k+n for k in t) for t in tapas]
    caras += [(a,b,b+n,a+n) for a,b in sorted(borde)]
    origen_xy = caja(contorno_letra(uv)[0] if uv is not None else np.vstack(anillos)).mean(axis=0)
    mesh = bpy.data.meshes.new(nombre)
    mesh.from_pydata([(p.x-origen_xy[0],p.y-origen_xy[1],h) for h in (0,z[1]-z[0]) for p in xy],[],caras)
    mesh.update()
    obj = bpy.data.objects.new(nombre,mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (*origen_xy,z[0])
    if mat: mesh.materials.append(mat)
    if uv is not None:
        _,a,extension = mapa_letra(uv,True)
        capa = mesh.uv_layers.new(name='Proyección XY')
        for loop,coord in zip(mesh.loops,capa.data):
            coord.uv = (V(xy[loop.vertex_index%n])-a)/extension
    if radio_canto:
        peso = mesh.attributes.new('bevel_weight_edge','FLOAT','EDGE')
        cantos = {tuple(sorted(par)) for par in borde}
        for edge in mesh.edges:
            u,v = edge.vertices
            if (u<n)==(v<n) and tuple(sorted((u%n,v%n))) in cantos:
                peso.data[edge.index].value = 1.
        pulido = obj.modifiers.new('Radio del canto pulido','BEVEL')
        pulido.limit_method,pulido.width,pulido.segments = 'WEIGHT',radio_canto,2
    return obj

def bisel(obj,ancho):
    m = obj.modifiers.new('Radio mecanizado','BEVEL')
    m.width,m.segments = ancho,3
    m.harden_normals = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)

def solido(nombre,b,forma,mat):
    w,d,h = b[1]-b[0]
    pos = b.mean(axis=0)
    if forma=='caja':
        bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    elif forma=='bola':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.5,location=pos)
    else:
        lados = 6 if forma=='hex' else 32
        bpy.ops.mesh.primitive_cone_add(vertices=lados,radius1=.10 if forma=='cono' else .5,
                                        radius2=.5,depth=1,location=pos)
    o = bpy.context.object
    o.name = nombre
    o.data.transform(Matrix.Diagonal(Vector((w,d,h,1))))
    o.data.materials.append(mat)
    if forma=='bola':
        for f in o.data.polygons: f.use_smooth = True
    else:
        bisel(o,min(min(w,d,h)*.12,.0005))
    if forma=='allen':
        socket = solido('Útil hexagonal',V([pos+[-w*.25,-d*.25,0],pos+[w*.25,d*.25,h]]),'hex',mat)
        restar(o,socket)
    return o

def restar(obj,cortador):
    m = obj.modifiers.new('Mecanizado','BOOLEAN')
    m.operation,m.solver,m.object = 'DIFFERENCE','EXACT',cortador
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    mesh = cortador.data
    bpy.data.objects.remove(cortador,do_unlink=True)
    bpy.data.meshes.remove(mesh)

def propiedad(obj,nombre,claves):
    for f,v in claves:
        obj[nombre] = float(v)
        obj.keyframe_insert(data_path=f'["{nombre}"]',frame=f)

def visible(obj,intervalos):
    for clave in ('hide_render','hide_viewport'):
        for f,oculto in [(1,True)]+[(f,v) for a,b in intervalos for f,v in ((a,False),(b+1,True))]:
            setattr(obj,clave,oculto)
            obj.keyframe_insert(data_path=clave,frame=f)

def tira(nombre,p,d1,d2,z,mat,arco=None):
    # Costura duplicada: el último vértice recibe la longitud completa y el primero cero.
    bordes = [inset(p,d) for d in (d1,d2)]
    vertices = [(x,y,z) for par in zip(*bordes) for x,y in par]
    vertices.extend(vertices[:2])
    caras = [(j,j+2,j+3,j+1) for j in range(0,len(vertices)-2,2)]
    m = bpy.data.meshes.new(nombre)
    m.from_pydata(vertices,[],caras)
    m.update()
    if arco is not None:
        attr = m.attributes.new('arco_m','FLOAT','POINT')
        attr.data.foreach_set('value',np.repeat(arco,2).astype('f'))
    o = bpy.data.objects.new(nombre,m)
    bpy.context.collection.objects.link(o)
    m.materials.append(mat)
    return o

def pintura_luz(nombre,aditiva=False):
    m,bs = material(nombre,(0,0,0))
    t = m.node_tree
    t.nodes.remove(bs)
    luz = nodo(t,'ShaderNodeEmission')
    salida = luz.outputs[0]
    if aditiva:
        aire = nodo(t,'ShaderNodeBsdfTransparent').outputs[0]
        salida = nodo(t,'ShaderNodeAddShader',[(0,aire),(1,salida)]).outputs[0]
    t.links.new(salida,salida_material(t))
    return m,luz

def encajar(obj,i):
    g = GUION[PALABRA[i]]
    for f in range(g['inicio'],g['inicio']+g['duracion']):
        obj.location,angulo = transformacion_pieza(i,f)
        obj.rotation_euler.x = angulo
        obj.keyframe_insert(data_path='location',frame=f)
        obj.keyframe_insert(data_path='rotation_euler',index=0,frame=f)

def edad_corte(t,laser,paso):
    diferencia = op(t,'SUBTRACT',valor_controlado(t,laser,'progreso'),paso)
    return op(t,'MULTIPLY',diferencia,GUION['interior'][1]-GUION['exterior'][0])

def acabado_corte(t,edad,distancia):
    bs = nodo(t,'ShaderNodeBsdfPrincipled',[('Metallic',.88),('Roughness',.34)])
    d = rango(t,distancia,0,.0016,0,1)
    color = rampa(t,d,(0,(.021,.017,.016)),(1,(.42,.33,.20)))
    for v,rgb in ((.0625,(.023,.018,.016)),(.15,(.08,.095,.17)),(.48,(.23,.14,.085)),
                  (.82,(.45,.34,.17))):
        color.node.color_ramp.elements.new(v).color = (*rgb,1)
    t.links.new(color,bs.inputs['Base Color'])
    frio = op(t,'EXPONENT',op(t,'MULTIPLY',op(t,'MAXIMUM',0,edad),-.23),0)
    nucleo = op(t,'MULTIPLY',frio,rango(t,distancia,0,.00072,1,0,True))
    kelvin = op(t,'ADD',650,op(t,'MULTIPLY',nucleo,4050))
    bb = nodo(t,'ShaderNodeBlackbody',[(0,kelvin)])
    t.links.new(bb.outputs[0],bs.inputs['Emission Color'])
    t.links.new(op(t,'MULTIPLY',op(t,'POWER',nucleo,2),6),bs.inputs['Emission Strength'])
    return bs.outputs[0]

def sangria(laser,nombre,galv,soporte):
    p,s = pista(nombre)
    a,b = GUION[nombre]
    inicio,fin = GUION['exterior'][0],GUION['interior'][1]
    m = galv.copy()
    m.name = 'Zona de revenido · '+nombre
    t = m.node_tree
    cinc = next(n for n in t.nodes if n.type=='GROUP').outputs[0]
    arco = nodo(t,'ShaderNodeAttribute')
    arco.attribute_name = 'arco_m'
    paso = op(t,'ADD',(a-inicio)/(fin-inicio),
              op(t,'MULTIPLY',arco.outputs['Fac'],(b-a)/(s[-1]*(fin-inicio))))
    edad = edad_corte(t,laser,paso)
    ancho = nodo(t,'ShaderNodeAttribute')
    ancho.attribute_name = 'distancia_m'
    d = op(t,'ABSOLUTE',ancho.outputs['Fac'],0)
    peso = op(t,'MULTIPLY',op(t,'GREATER_THAN',edad,-.00001),rango(t,d,.00125,.0016,1,0,True))
    mezcla = nodo(t,'ShaderNodeMixShader',[(0,peso),(1,cinc),(2,acabado_corte(t,edad,d))])
    # Antes del paso, el cinc cubre también el bisel superior de la O.
    # Una vez abierto el corte sólo queda material del lado fijo del troquel.
    pasada = op(t,'GREATER_THAN',edad,-.00001)
    libre = op(t,'MULTIPLY',pasada,op(t,'GREATER_THAN',ancho.outputs['Fac'],0))
    ranura = nodo(t,'ShaderNodeMixShader',[(0,libre),(1,mezcla.outputs[0]),
                                           (2,nodo(t,'ShaderNodeBsdfTransparent').outputs[0])])
    t.links.new(ranura.outputs[0],salida_material(t))
    cubre_bisel = HOLGURA+.00014
    obj = tira('Huella '+nombre,p[:-1],-.0016,cubre_bisel,Z_CORTE+.000012,m,s)
    atributo(obj.data,'distancia_m',np.tile([-.0016,cubre_bisel],len(s)))
    obj.parent = soporte

def particulas():
    """Balística en metros. Tiempo de exposición a 1/4 de velocidad para el inserto macro."""
    rng = np.random.default_rng(202702)
    grupos = [[] for _ in range(25)]
    for nombre in ('exterior','interior'):
        a,b = GUION[nombre]
        for f in range(a,b+1):
            libres = [g for g in grupos if not g or g[-1][0]+g[-1][1]<=f]
            cantidad = min(len(libres),max(2,len(libres)-15))
            for g in libres[:cantidad]:
                vida = int(rng.integers(6,13))
                avance = sobre_pista(nombre,min(b,f+.05))-sobre_pista(nombre,max(a,f-.05))
                avance /= np.linalg.norm(avance)
                ang = rng.uniform(-1.20,1.20)
                atras = -avance*np.cos(ang)+avance[::-1]*[-1,1]*np.sin(ang)
                dt = 1/96
                v = V([*(atras*rng.uniform(.14,.43)),.5*9.81*vida*dt])
                g.append((f,vida,V([*punta(f),Z_CORTE+.00016]),v,rng.uniform(.0008,.0021),rng.uniform(.12,.85)))
    return grupos

def chispas(grupos):
    m,luz = pintura_luz('Chispa · metal caliente')
    t = m.node_tree
    t.links.new(nodo(t,'ShaderNodeObjectInfo').outputs['Color'],luz.inputs['Color'])
    luz.inputs['Strength'].default_value = 6
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.00013,depth=1)
    modelo = bpy.context.object
    modelo.data.materials.append(m)
    for j,vidas in enumerate(grupos):
        if not vidas:
            continue
        obj = modelo if j==0 else bpy.data.objects.new('Chispa',modelo.data)
        if j:
            bpy.context.collection.objects.link(obj)
        obj.name = f'Chispa {j:02}'
        visible(obj,[(f,f+vida-1) for f,vida,*_ in vidas])
        for f,vida,p,v,largo,offset in vidas:
            for edad in range(vida):
                t_seg = (edad+offset)/96
                u = (edad+offset)/vida
                obj.location = p+v*t_seg+[0,0,-.5*9.81*t_seg**2]
                vel = v+[0,0,-9.81*t_seg]
                obj.rotation_euler = Vector(vel).to_track_quat('Z','Y').to_euler()
                obj.scale.z = largo*(1-.65*u)
                obj.color = (1-.36*u,.81*(1-u)**2+.065,.42*(1-u)**3+.003,1)
                for dato in ('location','rotation_euler','scale','color'):
                    obj.keyframe_insert(data_path=dato,frame=f+edad)

def corte(laser,galv,soporte):
    for f in sorted(set(claves_punta()) | set(range(1,FIN+1))):
        laser.location = (*punta(f),Z_CORTE)
        laser.keyframe_insert(data_path='location',frame=f)
    ad = laser.animation_data
    for layer in ad.action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(ad.action_slot)
            for fc in bag.fcurves if bag else ():
                if fc.data_path=='location':
                    for key in fc.keyframe_points: key.interpolation = 'LINEAR'
                    fc.update()
    inicio,fin = GUION['exterior'][0],GUION['interior'][1]
    propiedad(laser,'progreso',[(inicio-1,-1/(fin-inicio)),(FIN,(FIN-inicio)/(fin-inicio))])
    intervalos = [GUION[n] for n in ('exterior','interior')]
    h = Z_HAZ-Z_CORTE
    for nombre,radio,z,alto,c,fuerza,aditiva in [
            # Usuario (20 nov): sin aura; solo la línea roja del láser. Emisión < umbral del Glare.
            ('Núcleo',.00022,h/2,h,(1,.02,.03),2.4,False),
            ('Punto de corte',.00080,.00016,.0010,(1,.82,.52),35,False)]:
        mat,luz = pintura_luz(nombre,aditiva)
        luz.inputs['Color'].default_value = (*c,1)
        if nombre=='Halo':
            # Integral aproximada a través del cilindro: el brillo se extingue en la silueta.
            t = mat.node_tree
            geo = nodo(t,'ShaderNodeNewGeometry')
            coseno = nodo(t,'ShaderNodeVectorMath',[(0,geo.outputs['Normal']),(1,geo.outputs['Incoming'])],
                          'DOT_PRODUCT').outputs['Value']
            perfil = op(t,'POWER',op(t,'ABSOLUTE',coseno,0),3.)
            t.links.new(op(t,'MULTIPLY',perfil,fuerza),luz.inputs['Strength'])
            mat.surface_render_method = 'BLENDED'
        else:
            luz.inputs['Strength'].default_value = fuerza
        if nombre=='Punto de corte':
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1)
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=1,depth=2, end_fill_type='NOTHING')
        o = bpy.context.object
        o.name,o.parent,o.location,o.scale = nombre,laser,(0,0,z),(radio,radio,alto/2)
        if nombre=='Halo':
            for cara in o.data.polygons: cara.use_smooth = True
        o.data.materials.append(mat)
        visible(o,intervalos)
    for n in ('exterior','interior'):
        sangria(laser,n,galv,soporte)
    chispas(particulas())

def malla_taller(nombre,vertices,caras,mat):
    m = bpy.data.meshes.new(nombre)
    m.from_pydata(vertices,[],caras)
    m.update()
    m.materials.append(mat)
    obj = bpy.data.objects.new(nombre,m)
    bpy.context.collection.objects.link(obj)
    return obj

def atributo(m,nombre,valores):
    attr = m.attributes.new(nombre,'FLOAT','POINT')
    attr.data.foreach_set('value',np.ascontiguousarray(valores,dtype='f').ravel())

def superficie_fresada(i,mat):
    from mathutils.geometry import delaunay_2d_cdt
    bucles = terrazas(i)
    xy = np.vstack([p for _,p in bucles])
    dist = np.concatenate([np.full(len(p),d) for d,p in bucles])
    aristas = []
    j = 0
    for _,p in bucles:
        aristas.extend((j+k,j+(k+1)%len(p)) for k in range(len(p)))
        j += len(p)
    # CDT en milímetros para conservar las crestas muy próximas en precisión simple.
    pts,_,tris,origen,_,_ = delaunay_2d_cdt([Vector(q) for q in xy*1000],aristas,[],0,1e-6,True)
    pts = V([tuple(q) for q in pts])*.001
    dist = dist[[ids[0] for ids in origen]]
    tris = V(tris)
    x,y = pts[tris].mean(axis=1).T
    dentro = np.zeros(len(x),bool)
    for p in contorno_letra(i):
        for (u,v),(s,t) in zip(p,np.roll(p,-1,axis=0)):
            if t!=v: dentro ^= ((v>y)!=(t>y)) & (x<u+(s-u)*(y-v)/(t-v))
    o = malla_taller('Grabado '+PALABRA[i],np.column_stack((pts,cota(dist))),tris[dentro].tolist(),mat)
    atributo(o.data,'distancia_m',dist)
    o.data.polygons.foreach_set('use_smooth',np.ones(len(o.data.polygons),bool))

def superficie_o(mat):
    xy,z,stock6,stock7,d = anillos_o()
    nr,ns = z.shape
    j = np.arange(nr*ns).reshape(nr,ns)
    sig = np.roll(j,-1,axis=1)
    caras = np.stack((j[:-1],sig[:-1],sig[1:],j[1:]),axis=-1).reshape(-1,4)
    o = malla_taller('O · sectores de fresado',np.dstack((xy,z)).reshape(-1,3),caras.tolist(),mat)
    atributo(o.data,'distancia_m',np.broadcast_to(d[:,None],z.shape))
    o.data.polygons.foreach_set('use_smooth',np.ones(len(caras),bool))
    # Dos espesores de material sobre una única piel soldada. Escalar Z hasta cero
    # en las columnas compartidas evita rendijas, caras coplanares y juntas radiales.
    t = bpy.data.node_groups.new('Últimas dos pasadas de la O','GeometryNodeTree')
    for io in ('INPUT','OUTPUT'):
        t.interface.new_socket(name='Geometry',in_out=io,socket_type='NodeSocketGeometry')
    geo = nodo(t,'NodeGroupInput').outputs['Geometry']
    reloj = nodo(t,'GeometryNodeInputSceneTime').outputs['Frame']
    def leer(nombre,datos):
        atributo(o.data,nombre,datos)
        n = nodo(t,'GeometryNodeInputNamedAttribute')
        n.data_type = 'FLOAT'
        n.inputs['Name'].default_value = nombre
        return n.outputs['Attribute']
    alto = 0.
    for k,espesor,llegada in zip((7,8),(stock6-stock7,stock7),tiempos_fresa()):
        fin = leer(f'llegada_{k}',np.broadcast_to(llegada[:-1],z.shape))
        pendiente = rango(t,op(t,'SUBTRACT',fin,reloj),0,.015,0,1)
        alto = op(t,'ADD',alto,op(t,'MULTIPLY',leer(f'espesor_{k}',espesor),pendiente))
    dz = nodo(t,'ShaderNodeCombineXYZ',[('Z',alto)]).outputs[0]
    geo = nodo(t,'GeometryNodeSetPosition',[('Geometry',geo),('Offset',dz)]).outputs[0]
    nodo(t,'NodeGroupOutput',[('Geometry',geo)])
    o.modifiers.new('Barrido de la bola','NODES').node_group = t

def grabar_code(base):
    m,bs = material('Acero fresado · fondo pulido',ACERO,1,.12)
    t = m.node_tree
    d = nodo(t,'ShaderNodeAttribute')
    d.attribute_name = 'distancia_m'
    fase_surco = op(t,'MULTIPLY',d.outputs['Fac'],2*np.pi/PASO)
    relieve = op(t,'SINE',fase_surco,0)
    normal = nodo(t,'ShaderNodeBump',[('Height',relieve),('Distance',.000007),('Strength',.33)])
    t.links.new(normal.outputs[0],bs.inputs['Normal'])
    for i in range(4):
        restar(base,prisma('Vaciado '+PALABRA[i],contorno_letra(i),(-.003,.001)))
        if i==1: superficie_o(m)
        else: superficie_fresada(i,m)

def animar_fresa(control,mat):
    # Filas de una hélice de tres labios; radio variable en la media bola del extremo.
    for labio in range(3):
        h = np.linspace(.000001,.010,56)
        r = np.sqrt(np.maximum(0,RADIO_FRESA**2-np.minimum(0,h-RADIO_FRESA)**2))
        ang = labio*2*np.pi/3+h*580
        xyz = [np.column_stack((factor*r*np.cos(ang+desfase),factor*r*np.sin(ang+desfase),h))
               for factor,desfase in ((.97,-.32),(1.,0),(.91,.16))]
        j = np.arange(len(h)-1)*3
        caras = [(int(k),int(k+3),int(k+4),int(k+1)) for k in np.r_[j,j+1]]
        o = malla_taller(f'Filo helicoidal {labio+1}',np.stack(xyz,axis=1).reshape(-1,3),caras,mat)
        o.parent = control
        visible(o,[(1,288)])
        for f in (1,156):
            o.rotation_euler.z = (f-1)*np.deg2rad(49)
            o.keyframe_insert(data_path='rotation_euler',index=2,frame=f)
    for f in sorted(set([1,55,138,150,156,*np.concatenate(tiempos_fresa())])):
        control.location = punta_fresa(f)
        control.keyframe_insert(data_path='location',frame=float(f))
    for j,chip in enumerate(virutas()):
        nace,vida,_,_,radio,largo,az = chip
        u = np.linspace(0,1,18)
        g = u*2*np.pi*1.45
        caras = [(k,k+2,k+3,k+1) for k in range(0,2*len(u)-2,2)]
        v = [(t*largo+b,radio*np.sin(a),radio*np.cos(a)) for t,a in zip(u-.5,g) for b in (-.00005,.00005)]
        o = malla_taller(f'Viruta {j:03}',v,caras,mat)
        visible(o,[(nace,FIN)])
        for edad in [*range(int(vida)+1),vida]:
            o.location = posicion_viruta(chip,nace+edad)
            o.rotation_euler.z = az+edad*.37
            for prop in ('location','rotation_euler'):
                o.keyframe_insert(data_path=prop,frame=nace+edad)

def taller(r):
    bloques,partes = piezas()
    mats = materiales()
    grupos = {}
    for g,pos in [('sujecion',(0,0,0)),('laser',(*punta(1),Z_CORTE)),('fresa',(centro(1),.009,.010))]:
        bpy.ops.object.empty_add(type='PLAIN_AXES',radius=.008,location=pos)
        grupos[g] = bpy.context.object
        grupos[g].name = g
    grupos['laser']['progreso'] = 0.
    base,sup = [solido(n,b,'caja',mats[m]) for (n,b),m in zip(bloques.items(),('base','galvanizado'))]
    sup.parent = grupos['sujecion']
    sup.data.materials.append(mats['corte'])
    for i in range(4,12):
        p = contorno_letra(i)
        restar(base,prisma('Alojamiento',p,(-GROSOR,.002)))
        restar(sup,prisma('Troquel',p[:1] if i==10 else p,(Z_BLOQUE-.002,Z_CORTE+.002)))
        if i==10:
            isla = prisma('Isla O fija',[p[1][::-1]],(Z_BLOQUE,Z_CORTE),mats['galvanizado'])
            isla.parent = grupos['sujecion']
            isla.data.materials.append(mats['corte'])
            for cara in isla.data.polygons:
                if abs(cara.normal.z)<.01: cara.material_index = 1
        acabado = metal_letra(i,mats['galvanizado'])
        obj = prisma(f'Pieza {i:02} {PALABRA[i]}',[inset(q) for q in p],
                     r['letras'][i]['caja_pieza'][:,2],acabado,i,radio_canto=.00010)
        if i in (10,11):
            encajar(obj,i)
    for f in sup.data.polygons:
        p = sup.matrix_world @ f.center
        if abs(f.normal.z)<.01 and abs(p.y)<.022 and bloques['superior'][0,0]+.005<p.x<bloques['superior'][1,0]-.005:
            f.material_index = 1
    grabar_code(base)
    for g,n,b,forma,mat in partes:
        obj = solido(n,b,forma,mats[mat])
        if g=='fresa': visible(obj,[(1,288)])
        if not n.startswith(('Guía X','Retorno','Montante')):
            obj.parent = grupos[g]
            obj.location -= obj.parent.location
    grupos['sujecion'].location.y = origen_troquel()
    animar_fresa(grupos['fresa'],mats['herramienta'])
    corte(grupos['laser'],mats['galvanizado'],grupos['sujecion'])

def ambiente(sc):
    sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs['Strength'].default_value = 0
    for n,(pos,dest,watts,size,rgb) in LUCES.items():
        bpy.ops.object.light_add(type='AREA',location=pos)
        o = bpy.context.object
        o.name = n
        o.rotation_euler = (Vector(dest)-o.location).to_track_quat('-Z','Y').to_euler()
        o.data.shape = 'RECTANGLE'
        o.data.size,o.data.size_y = size
        o.data.energy,o.data.color = watts,rgb
        o.data.use_shadow_jitter = True
        if n=='Rasante CODE': visible(o,[(61,156)])
        if n.startswith('Tarjeta'):
            o.data.diffuse_factor = 0.
    # En EEVEE las áreas entran directamente en el lóbulo especular, incluso
    # sin trazado de rayos. El panel frontal cubre la normal de los flancos.
    for nombre,pos,lados,vatios,rgb in (
            ('Panel frontal satinado',(.10,-.25,.045),(.86,.46),.84,(.82,.89,1.)),
            ('Tira vertical izquierda',(-.24,-.14,.080),(.15,.55),.60,(.89,.94,1.)),
            ('Tira vertical derecha',(.35,-.12,.09),(.20,.53),.68,(1.,.92,.82)),
            ('Techo de estudio',(.04,.18,.30),(.75,.48),.57,(.86,.92,1.))):
        bpy.ops.object.light_add(type='AREA',location=pos)
        panel = bpy.context.object
        panel.name = nombre
        panel.rotation_euler = (Vector((.06,0,.030))-panel.location).to_track_quat('-Z','Y').to_euler()
        luz = panel.data
        luz.shape,luz.size,luz.size_y = 'RECTANGLE',*lados
        luz.energy,luz.color = vatios,rgb
        luz.diffuse_factor,luz.volume_factor,luz.transmission_factor = 0.,0.,0.
    bpy.context.view_layer.use_pass_emit = True
    t = bpy.data.node_groups.new('Halación de las superficies incandescentes','CompositorNodeTree')
    t.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    sc.compositing_node_group = t
    capas = nodo(t,'CompositorNodeRLayers')
    emision = next(socket for socket in capas.outputs if socket.name in ('Emission','Emit'))
    glare = nodo(t,'CompositorNodeGlare',[('Image',emision),('Type','Fog Glow'),('Threshold',2.6)])
    resultado = mezclar(t,1.,capas.outputs['Image'],glare.outputs['Glare'],'ADD')
    nodo(t,'NodeGroupOutput',[('Image',resultado)])
    return 'Fog Glow · sólo pase de emisión · umbral 2.6'

def verificar_claves(sc,r):
    """Contraste independiente con mallas, jerarquía y matriz de proyección evaluadas."""
    deps = bpy.context.evaluated_depsgraph_get()
    anim = r['animacion']
    ev = anim['blender'] = dict(error_xy_mm=0.,error_z_mm=0.,error_punta_mm=0.,
                                margen={k:1. for k in 'ABC'},base_min_m=0.)
    for f in range(1,sc.frame_end+1):
        sc.frame_set(f)
        k,_,_,nombre = next(p for p in PLANOS if p[1]<=f<=p[2])
        cam = sc.camera.evaluated_get(deps)
        if sc.camera.name!=nombre:
            raise ValueError(f'Marcador de cámara incorrecto en {f}')
        proy = np.array(cam.calc_matrix_camera(deps,x=960,y=540) @ cam.matrix_world.inverted())
        def margen(puntos):
            clip = np.column_stack((puntos,np.ones(len(puntos)))) @ proy.T
            uv = .5+.5*clip[:,:2]/clip[:,3,None]
            return min(uv.min(),1-uv.max())
        for i in (10,11):
            letra = PALABRA[i]
            o = bpy.data.objects[f'Pieza {i:02} {letra}'].evaluated_get(deps)
            mat = np.array(o.matrix_world)
            esperada,angulo = transformacion_pieza(i,f)
            delta = np.linalg.norm(mat[:2,3]-esperada[:2])
            ev['error_xy_mm'] = max(ev['error_xy_mm'],1000*delta)
            coords = np.empty(3*len(o.data.vertices),'f')
            o.data.vertices.foreach_get('co',coords)
            mundo = coords.reshape(-1,3)@mat[:3,:3].T+mat[:3,3]
            bajo,alto = mundo[:,2].min(),mundo[:,2].max()
            ev['base_min_m'] = min(ev['base_min_m'],bajo)
            ev['error_z_mm'] = max(ev['error_z_mm'],1000*max(abs(mat[2,3]-esperada[2]), GROSOR*abs(mat[2,1]-np.sin(angulo))))
            if (k=='A' and i==11) or (k in 'BC' and i==10):
                ev['margen'][k] = min(ev['margen'][k],margen(mundo))
        impacto = V(bpy.data.objects['laser'].evaluated_get(deps).matrix_world.translation)
        error = 1000*np.linalg.norm(impacto-[*punta(f),Z_CORTE])
        if error>=ev['error_punta_mm']:
            ev.update(error_punta_mm=error,cuadro_error_punta=f)
        if k=='B':
            ev['margen'][k] = min(ev['margen'][k],margen(impacto[None,:]))
    sc.frame_set(1)
    ok = (ev['error_xy_mm']<.0001 and ev['error_z_mm']<.001 and ev['base_min_m']>=-GROSOR-.000001 and
          ev['error_punta_mm']<.1 and min(ev['margen'][k] for k in 'AC')>=.03 and ev['margen']['B']>0)
    r['comprobaciones'][f'Claves y cámaras evaluadas · {FIN} cuadros'] = 'OK' if ok else 'FALLO'

def suave(u):
    u = float(np.clip(u,0,1))
    return u*u*(3-2*u)

def montaje(sc):
    """Movimientos de cámara y revelado (orquestador)."""
    def eje(k):
        pos,mira = camaras()[k][:2]
        d = (mira-pos)/np.linalg.norm(mira-pos)
        derecha = np.cross(d,[0,0,1]); derecha /= np.linalg.norm(derecha)
        return pos,d,derecha
    def clave_loc(obj,f,p):
        obj.location = Vector(p); obj.keyframe_insert(data_path='location',frame=f)
    # Deslizamiento lateral lento y constante en los primeros planos de las herramientas.
    for k,m in (('B',MONTAJE['deslizar_B_m']),('D',MONTAJE['deslizar_D_m'])):
        _,a,b,n = next(p for p in PLANOS if p[0]==k)
        cam = bpy.data.objects[n]
        pos,_,derecha = eje(k)
        for f in range(a,b+1):
            clave_loc(cam,f,pos+derecha*m*(fase(f,a,b)-.5))
    # C: empuje suave hacia la O mientras se hunde (énfasis).
    g = GUION['O']; cam = bpy.data.objects['cam_C_macro_O']
    pos,d,_ = eje('C')
    hitos = simular('O')[1]['hitos']
    for f in range(g['inicio'],g['inicio']+g['duracion']):
        clave_loc(cam,f,pos+d*MONTAJE['empuje_C_m']*suave(fase(f,hitos['boca']-4,hitos['enrase'])))
    # D: enfoque a pulso placa → fresa → placa, con un temblor leve.
    cam = bpy.data.objects['cam_D_fresa']
    cam.data.dof.focus_object = None
    cam.data.dof.aperture_fstop = MONTAJE['apertura_D']
    pos,d,_ = eje('D')
    o = V([centro(1),0.,0.])
    hacia = (pos-o)*[1,1,0]; hacia /= np.linalg.norm(hacia)
    placa = float((o-.012*hacia-pos)@d)

    def foco(f):
        fresa = float((punta_fresa(min(f,127))+[0,0,.019]-pos)@d)
        ida = suave(fase(f,70,88)); vuelta = suave(fase(f,115,135))
        sobre = .08*np.sin(np.pi*fase(f,84,94))-.08*np.sin(np.pi*fase(f,130,141))
        x = ida-vuelta+sobre
        pulso = MONTAJE['pulso_D_m']*(np.sin(2*np.pi*f/7.3)+.6*np.sin(2*np.pi*f/3.1+1.))
        return placa+(fresa-placa)*x+pulso
    for f in range(61,157):
        cam.data.dof.focus_distance = foco(f)
        cam.data.dof.keyframe_insert(data_path='focus_distance',frame=f)
    # E: el brazo levanta el bloque galvanizado y la cámara se acerca despacio.
    a,b,dz = MONTAJE['subida_E']
    suj = bpy.data.objects['sujecion']
    for f in range(a,b+1):
        clave_loc(suj,f,V(dz)*suave(fase(f,a,b))+[0,origen_troquel(),0])
    cam = bpy.data.objects['cam_E_palabra']
    pos,d,_ = eje('E')
    dist = np.linalg.norm(camaras()['E'][1]-pos)
    for f in (289,FIN):
        clave_loc(cam,f,pos+d*dist*MONTAJE['empuje_E']*fase(f,289,FIN))

def ejecutar(args,r):
    global bpy,Vector,Matrix
    import bpy
    from mathutils import Vector,Matrix
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.use_raytracing = False  # Las áreas rectangulares ya se reflejan en el BRDF de EEVEE.
    sc.eevee.taa_render_samples = 16 if args.previa else 32
    sc.render.resolution_x,sc.render.resolution_y = (960,540) if args.previa else (1920,1080)
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 85 if args.previa else 94
    sc.view_settings.view_transform,sc.view_settings.look = 'AgX','AgX - Medium High Contrast'
    sc.view_settings.exposure = -.55
    sc.frame_start,sc.frame_end,sc.render.fps = 1,FIN,24
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    taller(r)
    r['bloom'] = ambiente(sc)
    for k,a,b,n in [*PLANOS,('muestra',F_MUESTRA,F_MUESTRA,'cam_muestra')]:
        pos,mira,f,sensor,apertura,foco = camaras()[k]
        bpy.ops.object.camera_add(location=pos)
        obj = bpy.context.object
        obj.name = n
        obj.rotation_euler = Vector(mira-pos).to_track_quat('-Z','Y').to_euler()
        cam = obj.data
        cam.lens,cam.sensor_fit,cam.sensor_width,cam.clip_start = f,'HORIZONTAL',sensor,.001
        cam.dof.use_dof = k!='E'
        axis = (mira-pos)/np.linalg.norm(mira-pos)
        cam.dof.focus_distance,cam.dof.aperture_fstop = float((foco-pos)@axis),apertura
        cam.dof.aperture_blades = 9
        if k=='D': cam.dof.focus_object = bpy.data.objects['fresa']
        if k in 'AC':
            for cuadro in range(a,b+1):
                i = 11 if k=='A' else 10
                centro_pieza = caja(nube_animada(i,cuadro)).mean(axis=0)
                centro_pieza[2] = max(0.,centro_pieza[2])
                empuje = 0.
                if k=='C':
                    hitos = simular('O')[1]['hitos']
                    empuje = MONTAJE['empuje_C_m']*suave(fase(cuadro,hitos['boca']-4,hitos['enrase']))
                cam.dof.focus_distance = float((centro_pieza-pos)@axis)-empuje
                cam.dof.keyframe_insert(data_path='focus_distance',frame=cuadro)
                cam.shift_y = shift(k,cuadro)
                cam.keyframe_insert(data_path='shift_y',frame=cuadro)
        if k!='muestra':
            sc.timeline_markers.new(k,frame=a).camera = obj
    montaje(sc)
    sc.frame_set(1)
    sc.camera = bpy.data.objects[PLANOS[0][3]]
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    r['triangulos'] = 0
    r['cajas_evaluadas'] = {}
    for o in sc.objects:
        if o.type!='MESH': continue
        ev = o.evaluated_get(deps)
        ev.data.calc_loop_triangles()
        r['triangulos'] += len(ev.data.loop_triangles)
        r['cajas_evaluadas'][o.name] = caja([tuple(ev.matrix_world @ Vector(p)) for p in ev.bound_box])
    base,sup = (r['cajas_evaluadas'][nombre] for nombre in ('base','superior'))
    r['medidas_evaluadas_m'] = dict(placa=base[1]-base[0],tapa_placa=base[1,2],
                                    bloque=sup[1]-sup[0],luz_bajo_bloque=sup[0,2])
    for nombre,medida in [('base',base),('superior',sup)]:
        esperada = r['bloques'][nombre]+[0,origen_troquel() if nombre=='superior' else 0,0]
        ok = np.allclose(medida,esperada,rtol=0,atol=2e-6)
        r['comprobaciones']['Cotas evaluadas '+nombre] = 'OK' if ok else 'FALLO'
    r['profundidades_evaluadas_m'] = {}
    for i in range(4,12):
        campo_i,a,ext = mapa_letra(i)
        # Sonda en el punto más interior del trazo para medir el fondo sin rozar la pared.
        iy,ix = np.unravel_index(np.argmax(campo_i),campo_i.shape)
        xy = a+ext*(V([ix,iy])+.5)/V(campo_i.shape[::-1])
        for nombre in ('base','superior'):
            ev = bpy.data.objects[nombre].evaluated_get(deps)
            pos = ev.matrix_world.inverted() @ Vector((xy[0],xy[1]+(origen_troquel() if nombre=='superior' else 0),.15))
            hit,p,_,_ = ev.ray_cast(pos,Vector((0,0,-1)))
            if nombre=='base':
                profundidad = -(ev.matrix_world @ p).z if hit else None
                r['profundidades_evaluadas_m'][i] = profundidad
                ok = hit and abs(profundidad-GROSOR)<2e-6
            else:
                ok = not hit
            r['comprobaciones'][f'Cavidad {nombre} {i}'] = 'OK' if ok else 'FALLO'
        medida = r['cajas_evaluadas'][f'Pieza {i:02} {PALABRA[i]}']
        ok = np.allclose(medida,r['letras'][i]['caja_pieza'],rtol=0,atol=2e-7)
        r['comprobaciones'][f'Dimensiones malla {i}'] = 'OK' if ok else 'FALLO'
    r['comprobaciones']['Triángulos < 800 k'] = 'OK' if r['triangulos']<r['limite_triangulos'] else 'FALLO'
    efectos_laser = {'Núcleo','Halo','Punto de corte'}
    r['mallas_inesperadas_en_laser'] = [o.name for o in bpy.data.objects['laser'].children_recursive
                                        if o.type=='MESH' and o.name not in efectos_laser]
    r['comprobaciones']['Emisor láser sin montura visible'] = 'FALLO' if r['mallas_inesperadas_en_laser'] else 'OK'
    r['animacion']['triangulos'] = r['triangulos']
    verificar_claves(sc,r)
    with toma(sc,'muestra',F_MUESTRA):
        pieza = bpy.data.objects['Pieza 11 N'].evaluated_get(deps)
        tapa = max((pieza.matrix_world @ Vector(v)).z for v in pieza.bound_box)
        r['muestra']['tapa_N_evaluada_m'] = tapa
        ok = sc.camera.name=='cam_muestra' and abs(tapa-TAPA_MUESTRA)<1e-5
        r['comprobaciones']['Pose independiente de la muestra'] = 'OK' if ok else 'FALLO'
    sc.frame_set(1)
    if args.guardar:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.salida/'codemageddon.blend'))
    cuadros = [(i,f'cuadro_{i:04}') for i in dict.fromkeys(args.cuadro)]
    if args.muestra:
        cuadros.append((F_MUESTRA,'muestra'))
    if args.planos:
        cuadros.extend(((a+b)//2,'plano_'+k) for k,a,b,n in PLANOS)
    return sc,cuadros

def intervalo(texto):
    try:
        a,b = map(int,texto.split('-'))
        if 1<=a<=b<=FIN:
            return a,b
    except ValueError:
        pass
    raise argparse.ArgumentTypeError(f'Se espera a-b con 1 ≤ a ≤ b ≤ {FIN}')

def medir_rgb(rgb,sondas):
    # El JPG se lee como datos crudos, sin invertir la transferencia sRGB.
    luma = (rgb @ np.array([.2126,.7152,.0722],dtype='f'))*255
    h,w = luma.shape
    x,y = max(1,w//32),max(1,h//32)
    esquinas = [float(p.mean()) for p in (luma[:y,:x],luma[:y,-x:],luma[-y:,:x],luma[-y:,-x:])]
    caras = {}
    for nombre,pixeles in sondas.items():
        if pixeles:
            xx,yy = np.array(pixeles).T
            caras[nombre] = dict(media_sRGB=float(luma[yy,xx].mean()),sondas=len(xx))
    return dict(caras_superiores=caras,esquinas_sRGB=esquinas,
                blanco_puro_pct_incluye_emisivos=100*float(np.mean(np.all(rgb>=254.5/255,axis=2))))

def fotometria(sc,ruta,k,f):
    img = bpy.data.images.load(str(ruta),check_existing=False)
    try:
        img.colorspace_settings.name = 'Non-Color'
        w,h = img.size
        pix = np.empty(len(img.pixels),'f')
        img.pixels.foreach_get(pix)
        cam_obj = sc.camera
        pos = np.array(cam_obj.matrix_world.translation)
        direccion = -np.array(cam_obj.matrix_world.to_3x3())[:,2]
        cam = (pos,pos+direccion,cam_obj.data.lens,cam_obj.data.sensor_width,*camaras()[k][4:])
        foco_x = cam[5][0]
        medio_ancho = tipografia()[1]/2 if k=='E' else .062
        muestras = {'base':[], 'superior':[]}
        deps = bpy.context.evaluated_depsgraph_get()
        xy = np.array(list(product(np.linspace(0,w-1,64,dtype=int),np.linspace(0,h-1,36,dtype=int))))
        rayos = rayos_camara(cam,(xy+.5)/(w,h),cam_obj.data.shift_y)
        for pixel,rayo in zip(xy,rayos):
            hit,p,n,_,obj,_ = sc.ray_cast(deps,Vector(cam[0]),Vector(rayo).normalized())
            if (hit and obj.name in muestras and n.z>.99 and min(abs(p.z),abs(p.z-Z_CORTE))<.00002
                    and abs(p.x-foco_x)<=medio_ancho and abs(p.y)<.042):
                muestras[obj.name].append(pixel)
        return medir_rgb(pix.reshape(h,w,-1)[:,:,:3],muestras)
    finally:
        bpy.data.images.remove(img)

@contextmanager
def toma(sc,nombre,f):
    sc.frame_set(f)
    k = next(k for k,a,b,_ in PLANOS if a<=f<=b)
    if nombre!='muestra':
        yield k
        return
    # También enlazar el marcador activo: Blender puede reevaluarlo al iniciar el render.
    marcador = sc.timeline_markers[k]
    anterior = marcador.camera
    pieza = bpy.data.objects['Pieza 11 N']
    tarjeta = bpy.data.objects['Tarjeta baja']
    posicion_tarjeta = tarjeta.location.copy()
    desplazamiento = pieza.delta_location.z
    try:
        marcador.camera = sc.camera = bpy.data.objects['cam_muestra']
        tarjeta.location.x += .50  # La imagen especular queda a la derecha de la muestra.
        pieza.delta_location.z = TAPA_MUESTRA-altura('N',f)
        bpy.context.view_layer.update()
        yield 'muestra'
    finally:
        tarjeta.location = posicion_tarjeta
        pieza.delta_location.z = desplazamiento
        marcador.camera = sc.camera = anterior
        bpy.context.view_layer.update()

def renderizar(sc,args,cuadros,r):
    a,b = args.cuadros or (1,FIN)
    if args.mp4:
        sc.frame_start,sc.frame_end = a,b
        sc.frame_set(a)
        sc.render.image_settings.media_type = 'VIDEO'
        sc.render.image_settings.file_format = 'FFMPEG'
        sc.render.ffmpeg.format,sc.render.ffmpeg.codec = 'MPEG4','H264'
        sc.render.ffmpeg.constant_rate_factor = 'HIGH'
        sc.render.filepath = str(args.salida/'codemageddon.mp4')
        bpy.ops.render.render(animation=True)
        if not Path(sc.render.filepath).is_file():
            raise RuntimeError('FFmpeg no generó codemageddon.mp4')
        return
    if args.cuadros:
        (args.salida/'fotogramas').mkdir(exist_ok=True)
        cuadros.extend((f,f'fotogramas/{f:04}') for f in range(a,b+1))
    blancos = r['animacion']['blanco_puro_pct_incluye_emisivos'] = {}
    mediciones = r['fotometria_JPG'] = {}
    for n,nombre in cuadros:
        with toma(sc,nombre,n) as k:
            ruta = args.salida/(nombre+'.jpg')
            sc.render.filepath = str(ruta)
            inicio = perf_counter()
            bpy.ops.render.render(write_still=True)
            segundos = perf_counter()-inicio
            medicion = mediciones[nombre] = fotometria(sc,ruta,k,n)
            medicion.update(camara=sc.camera.name,cuadro=n,segundos_render=segundos)
            blancos[nombre] = medicion['blanco_puro_pct_incluye_emisivos']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida',required=True,type=Path)
    parser.add_argument('--cuadro',action='append',type=int,default=[],metavar=f'1..{FIN}')
    parser.add_argument('--cuadros',type=intervalo,metavar='a-b')
    for flag in ('planos','muestra','previa','guardar','autoprueba','mp4'):
        parser.add_argument('--'+flag,action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:])
    if any(not 1<=n<=FIN for n in args.cuadro):
        parser.error(f'Los cuadros válidos son 1–{FIN}')
    if args.mp4 and (args.muestra or args.planos or args.cuadro):
        parser.error('--mp4 admite --cuadros a-b y genera únicamente vídeo')
    args.salida = args.salida.resolve()
    args.salida.mkdir(parents=True,exist_ok=True)
    r,cuadros = {'comprobaciones':{}},[]
    try:
        r = informe()
        if not args.autoprueba:
            sc,cuadros = ejecutar(args,r)
            # Orquestador: renderiza aunque falle una comprobación (queda en escena.json y aborta al final).
            renderizar(sc,args,cuadros,r)
    except Exception as error:
        r['comprobaciones']['Construcción'] = 'FALLO'
        r['error'] = repr(error)
        raise
    finally:
        with (args.salida/'escena.json').open('w') as f:
            json.dump(r,f,ensure_ascii=False,indent=2,default=lambda a:a.tolist(),allow_nan=False)
    if 'FALLO' in r['comprobaciones'].values():
        raise RuntimeError(f"Revisar {args.salida/'escena.json'}")

if __name__=='__main__':
    main()
