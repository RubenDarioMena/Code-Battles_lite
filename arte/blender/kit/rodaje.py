from math import cos, pi, sin, tau

from .estructura import SEGMENTOS
from .geometria import ensamblar, pieza, superficie, torno


def taco(r, ancho, angulo, paso, signo):
    # Sector inclinado, con los extremos de los dos medios tacos en espiga.
    filas = []
    for radio in (r*.945,r):
        fila = []
        for da,z in ((-.26,.02),(.26,.02),(.38,.39),(-.14,.39)):
            a = angulo+da*paso
            fila.append((radio*cos(a),radio*sin(a),z*ancho*signo))
        if signo<0:
            fila.reverse()
        filas.append(fila)
    # En coordenadas locales (tangente, eje), la normal es radial.
    return superficie(filas,"goma")


@pieza("rueda")
def rueda(diametro=.46, ancho=.15, agujero=.05, material="pintura", *, detalle):
    r,h = diametro/2,ancho/2
    if not 0<agujero/2<.57*r or h<=0:
        raise ValueError("Dimensiones de rueda inválidas")
    # Los tacos alcanzan el diámetro nominal. La banda lisa lo mantiene en L2.
    banda = r*(.95 if detalle==0 else 1)
    perfil = [(.58*r,-.84*h),(.72*r,-h),(.88*r,-h),(banda,-.73*h)]
    if detalle==1:
        perfil += [(r,-.22*h),(.96*r,-.16*h),(.96*r,.16*h),(r,.22*h)]
    perfil += [(banda,.73*h),(.88*r,h),(.72*r,h),(.58*r,.84*h)]
    n = (48,32,16)[detalle]
    partes = [torno(perfil,n,"goma",True)]
    rin = [(.582*r,-.81*h),(.582*r,.81*h),(.50*r,.81*h),(.39*r,.50*h),
           (.24*r,.52*h),(.22*r,.86*h),(agujero/2,.86*h),(agujero/2,-.86*h),
           (.22*r,-.86*h),(.24*r,-.52*h),(.39*r,-.50*h),(.50*r,-.81*h)]
    partes.append(torno(rin,SEGMENTOS[detalle],material,True))
    if detalle==0:
        paso = tau/32
        for j in range(32):
            for signo in (-1,1):
                partes.append(taco(r,ancho,(j+.26)*paso,paso,signo))
    return ensamblar(*partes).alinear((1,0,0))


def pista(s, centros, radio):
    """Centro y normal del estadio en YZ, a distancia s de la tangencia inferior."""
    arco = pi*radio
    if s<=centros:
        return -centros/2+s,-radio,0,-1
    s -= centros
    if s<=arco:
        a = -pi/2+s/radio
        return centros/2+radio*cos(a),radio*sin(a),cos(a),sin(a)
    s -= arco
    if s<=centros:
        return centros/2-s,radio,0,1
    a = pi/2+(s-centros)/radio
    return -centros/2+radio*cos(a),radio*sin(a),cos(a),sin(a)


@pieza("oruga")
def oruga(centros=.44, radio=.14, ancho=.115, espesor=.022, eslabones=36,
          material="grafito", *, detalle):
    if not 0<espesor<radio or min(centros,ancho)<=0 or eslabones<6:
        raise ValueError("Dimensiones de oruga inválidas")
    medio = radio-espesor/2
    arco = pi*medio
    perimetro = 2*(centros+arco)
    def seccion(s):
        y,z,ny,nz = pista(s,centros,medio)
        return [(x*ancho,y+k*espesor*ny,z+k*espesor*nz)
                for x,k in ((-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5))]
    if detalle==0:
        partes = []
        # Centrar un eslabón en el extremo redondo y muestrear su curvatura.
        for i in range(eslabones):
            centro = centros+arco/2+i*perimetro/eslabones
            filas = [seccion((centro+t*perimetro/eslabones)%perimetro) for t in (-.47,0,.47)]
            m = superficie(filas,material)
            m.materiales[2] = m.materiales[6] = "goma"
            partes.append(m)
        return ensamblar(*partes)
    n = (16,8)[detalle-1]
    distancias = ([0]+[centros+arco*j/n for j in range(n+1)]
                  +[2*centros+arco+arco*j/n for j in range(n)])
    return superficie([seccion(s) for s in distancias],material,True)
