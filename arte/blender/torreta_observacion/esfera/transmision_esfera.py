"""Cinemática y transmisiones ilustrativas de la montura de observación."""
from math import acos, asin, atan, atan2, cos, sin, tan, pi, tau, radians, hypot
from geometria_esfera import grid, lathe, tube, mix, N, R, POLAR, PITCH, SKEW

Z = .750
AZ, PIN = 180, 18
MODULE = .005
WHEEL, SAT = 60, 18
MOD_X = .002
CONTACT = .535
LIP_C = .616
KEYS = [(1,0,0,0,0),(21,0,0,0,0),(88,180,0,0,0),(108,180,0,1,0),
        (132,180,0,1,1),(165,215,42,1,1),(201,145,-28,1,1),
        (224,180,0,1,1),(249,180,0,1,.12),(276,180,0,.52,.12),(288,180,0,.52,.12)]
FRAMES = 288
# Bucle de presentación: apagada -> activa mirando en varias direcciones -> guardada.
# Termina en la misma pose y con los motores en el mismo ángulo que el cuadro 1.
KEYS_BUCLE = [(1,0,0,0,0),(24,0,0,0,0),(84,180,0,0,0),(102,180,0,1,0),(124,180,0,1,1),
              (156,205,60,1,1),(188,165,-35,1,1),(216,212,-110,1,1),(244,180,0,1,1),
              (324,360,0,0,0),(360,360,0,0,0)]  # sigue girando: 360° = reposo
# En el cierre del bucle, telescopio y hojas se recogen mientras la esfera ya gira de vuelta.


def usar_bucle():
    global KEYS, FRAMES
    KEYS, FRAMES = KEYS_BUCLE, 360


def state(frame, variant):
    for i,(a,b) in enumerate(zip(KEYS,KEYS[1:])):
        if frame <= b[0]:
            t=max(0,(frame-a[0])/(b[0]-a[0]))
            raw=t
            t=t*t*(3-2*t)
            pitch,yaw,doors,extension=[mix(x,y,t) for x,y in zip(a[1:],b[1:])]
            if KEYS is KEYS_BUCLE and b[1]>a[1] and b[3]<a[3]:
                ease=lambda u:(lambda c:c*c*(3-2*c))(min(1,max(0,u)))
                extension=mix(a[4],b[4],ease(raw/.30))      # telescopio: 0-30 % del giro
                doors=mix(a[3],b[3],ease((raw-.25)/.25))  # hojas: 25-50 %, casi recogido
            banks=(0,0,0,0,0,5,-6,0,0,0,0)
            bank=radians(mix(banks[i],banks[i+1],t)) if variant=='C' and len(KEYS)==len(banks) else 0.
            return (-radians(yaw)*(AZ if variant=="S" else AZ/PIN),-radians(pitch)*(N if variant=="S" else WHEEL/SAT),
                    doors,extension,bank)
    return state(FRAMES,variant)


def wheel(m,name,parent,teeth,module,width,bore,phase=0,helix=0,**kw):
    # Flancos evolventes a 20 grados. Perfil repetido a radio de pie, base,
    # primitivo, adenda y de vuelta, con holgura angular en el primitivo.
    rp=teeth*module/2
    rb=rp*cos(radians(20))
    root,tip=rp-1.25*module,rp+module
    def flank(r):
        a=acos(min(1,rb/r))
        return .245*tau/teeth+tan(radians(20))-radians(20)-(tan(a)-a)
    levels=[root,max(root,rb),rp,tip]
    outline=[(-pi/teeth,root)]+[(-flank(r),r) for r in levels]+[(flank(r),r) for r in levels[::-1]]
    p=m.part(name,parent,'bronce',**kw)
    def point(u,v):
        i=round(u*teeth*len(outline))
        da,r=outline[i%len(outline)]
        j=round(v*4)%4
        z=(-1 if j in (0,3) else 1)*width/2
        a=phase+(i//len(outline))*tau/teeth+da+z*tan(helix)/rp
        r=r if j<2 else bore
        return r*cos(a),r*sin(a),z
    grid(p,teeth*len(outline),4,point,True,True)
    if name.startswith('Piñón'):
        p.accents.extend(range(3*len(outline),4*len(outline)))
    return p


def tower(m,cut,variant):
    m.group='torre'
    sector=(pi/2,3*pi/2) if cut else (0,tau)
    def ring(name,mat,profile):
        return lathe(m.part(name,None,mat),profile,128,sector)
    ring('Fuste','torre',[(.685,.055),(.69,.061),(.69,.752),(.688,.758),(.684,.760),
                         (.635,.760),(.631,.756),(.631,.742),(.661,.736),(.661,.075),(.12,.075),(.12,.055)])
    ring('Junta inferior','grafito',[(.69,.061),(.691,.064),(.691,.075),(.69,.078),(.687,.078),(.687,.061)])

    # El labio fijo deja libre el barrido de los apoyos y del lector de índice.
    # Las coordenadas del corte coinciden con las del fuste en todo el perfil.
    spans=[(0,16,LIP_C if variant=='C' else .630)]
    for i,j,inner in spans:
        start,end=(max(i,4),min(j,12)) if cut else (i,j)
        if start>=end:
            continue
        profile=[(.641,.742),(.641,.754),(inner+.003,.754),(inner,.751),(inner,.744),(inner+.002,.742)]
        lathe(m.part('Labio '+str(i),None,'torre'),profile,(end-start)*12,
              (start*tau/16,end*tau/16))


def mechanism(m,v):
    m.group='mecanismo_'+v
    base=m.part('base_giro').name
    tube(m,'Portaescobillas fijo',None,'grafito',.027,.060,.076,.108)
    tube(m,'Colector eléctrico axial',base,'bronce',.012,.022,.080,.144)
    tube(m,'Araña del colector',base,'motor',.002,.009,-.164,.164,
         loc=(.162,0,.150),rot=(0,pi/2,0))
    tube(m,'Pista fija axial',None,'grafito',.322,.362,.075,.098)
    tube(m,'Pista giratoria axial',base,'cresta',.323,.361,.104,.123)
    cage=m.part('Portarrodillos axial').name
    for i in range(24):
        a=tau*i/24
        eje=m.part('Eje rodillo '+str(i),cage,loc=(.342*cos(a),.342*sin(a),.101),rot=(0,pi/2,a))
        tube(m,'Rodillo axial '+str(i),eje.name,'bronce',.001,.003,-.013,.013)
    wheel(m,'Corona de azimut',base,AZ,MODULE,.022,.318,helix=-atan(MODULE/.064) if v=='S' else 0,loc=(0,0,.134))
    if v=='S':
        mount=m.part('Reductor azimut',loc=(.482,0,.134),rot=(pi/2,0,0)).name
        motor=m.part('motor_azimut',mount).name
        worm(m,motor,'azimut',.032,pi*MODULE,.004,6)
        case=m.part('Apoyo azimut',mount,rot=(0,0,-pi/2)).name
        housing(m,case,'azimut',.038,.043,.058)
        tube(m,'Motor base',mount,'motor',.003,.026,.067,.139)
    else:
        motor=m.part('motor_azimut',loc=(0,(AZ+PIN)*MODULE/2,.134)).name
        wheel(m,'Piñón de azimut',motor,PIN,MODULE,.022,.006)
        tube(m,'Estátor azimut',None,'motor',.007,.034,.076,.116,loc=(0,.495,0))
    lathe(m.part('Plataforma',base,'motor'),[(.544,.182),(.548,.186),(.548,.196),
                                            (.54,.200),(.305,.200),(.305,.178),(.37,.178)])
    tube(m,'Cubo de plataforma',base,'motor',.320,.353,.120,.184)
    if v=='S':
        return relay(m,base)
    return gimbal(m,base)


ANGLES=(-pi/4,-3*pi/4)
GAP=pi/2-POLAR
# Semihuella angular conservadora de la hélice en el plano de giro.
FOOT=.245


def lift(angle,pitch):
    distance=asin(abs(cos(angle-pitch)))
    return .053*max(0,min(1,(GAP+FOOT+.05-distance)/.05))


def worm(m,parent,label,r,lead,depth,turns,hand=1):
    profile=[(-.28,-1),(-.22,0),(-.14,1),(.14,1),(.22,0),(.28,-1)]
    def thread(u,v):
        f,h=profile[round(v*6)%6]
        a=hand*tau*turns*(u-.5)
        radius=r+h*depth
        return radius*cos(a),radius*sin(a),lead*(turns*(u-.5)+f)
    grid(m.part('Hélice '+label,parent,'cresta'),round(turns*40),6,thread,False,True)
    end=lead*(turns/2+.28)
    tube(m,'Núcleo '+label,parent,'acero',.002,r-depth+.0001,-end,end)


def bar(m,name,parent,mat,a,b,r):
    x,y,z=[q-p for p,q in zip(a,b)]
    length=hypot(x,y,z)
    tube(m,name,parent,mat,0,r,0,length,loc=a,rot=(0,atan2(hypot(x,y),z),atan2(y,x)))


def housing(m,parent,tag,inner,outer,end):
    # +Y local mira hacia el exterior, la media cuna deja la rosca a la vista.
    lathe(m.part('Cuna '+tag,parent,'naranja'),[(outer,-end),(outer,end),
          (inner,end),(inner,-end)],48,(0,pi))
    for side in (-1,1):
        z=side*end
        lathe(m.part('Testero '+tag+str(side),parent,'naranja'),
              [(outer,z-.005),(outer,z+.005),(.030,z+.005),(.030,z-.005)],48,(0,pi))
        tube(m,'Rodamiento '+tag+str(side),parent,'grafito',.014,.032,z-.006,z+.006)
    tube(m,'Árbol '+tag,parent,'cresta',0,.014,-end-.012,end+.012)


def supports(m,base):
    # Cuatro ruedas de eje vertical. El canal salva las crestas y el
    # labio inferior recoge el hombro esférico contiguo a la banda.
    for i,a in enumerate((.45,-.45,pi+.45,pi-.45)):
        tag=str(i)
        radius=.060
        h=.074
        track=(R*R-h*h)**.5
        d=track+radius
        xy=(d*cos(a),d*sin(a))
        foot=(.53*cos(a),.53*sin(a),.196)
        hub=(*xy,Z-.105)
        bar(m,'Horquilla '+tag,base,'grafito',foot,hub,.017)
        tube(m,'Perno rueda '+tag,base,'bronce',0,.014,-.11,.03,loc=(*xy,Z))
        lathe(m.part('Rueda de apoyo '+tag,base,'motor',loc=(*xy,Z)),
              [(.018,-.090),(.057,-.082),(.060,-h),(.059,-.067),
               (.047,-.057),(.047,.014),(.050,.023),(.048,.029),(.018,.029)])
        # Dos pares separados en el plano YZ para que los contactos sobre
        # gajos se alternen cuando la banda atraviesa uno de los puntos.
        y=.105 if i%2 else -.105
        x=.462 if i<2 else -.462
        z=-(R*R-x*x-y*y)**.5
        normal=(x/R,y/R,z/R)
        center=tuple(q*.533+(Z if j==2 else 0) for j,q in enumerate(normal))
        axis=(0,acos(-normal[2]),atan2(-normal[1],-normal[0]))
        ball=m.part('Bola de transferencia '+tag,base,'cresta',loc=center,rot=axis)
        lathe(ball,[(.033*sin(pi*j/32),.033*cos(pi*j/32)) for j in range(33)],48)
        tube(m,'Copa de bola '+tag,base,'grafito',.027,.037,-.032,.005,loc=center,rot=axis)
        bar(m,'Pedestal de bola '+tag,base,'grafito',(*center[:2],.196),center,.020)


def shaft_ends(i,offset):
    a=ANGLES[i]
    end=(-.149,.149)[i]
    fork=(0,(CONTACT+offset)*cos(a)-end*sin(a),Z+(CONTACT+offset)*sin(a)+end*cos(a))
    return (.157,CONTACT*cos(a)-end*sin(a),.240),fork


def relay(m,base):
    shaft=m.part('muñón motriz',base,loc=(0,0,Z)).name
    # La coordenada Y local apunta contra el avance meridiano. El eje
    # negativo de Y hace avanzar la rosca izquierda hacia el diente siguiente.
    for i,a in enumerate(ANGLES):
        tag=str(i)
        carrier=m.part('Normal '+tag,base,loc=(0,0,Z),rot=(a-pi/2,0,0)).name
        slide=m.part('Carro '+tag,carrier,loc=(0,0,CONTACT)).name
        mount=m.part('Caja orientada '+tag,slide,rot=(pi/2,0,0)).name
        rotor=m.part('motor_elevacion' if i==0 else 'seguidor',mount).name
        worm(m,rotor,'meridiana '+tag,.046,R*PITCH,.009,3.75,hand=-1)
        housing(m,mount,tag,.060,.066,.138)
        bar(m,'Pie '+tag,base,'grafito',(-.082,.65*cos(a),.194),(-.082,.65*cos(a),Z+.65*sin(a)),.024)
        tube(m,'Corredera fija '+tag,carrier,'grafito',.014,.021,.623,.676,loc=(-.082,0,0))
        tube(m,'Vástago de cuna '+tag,slide,'cresta',0,.013,.025,.132,loc=(-.082,0,0))
        bar(m,'Oreja de cuna '+tag,slide,'naranja',(-.085,0,.027),(-.049,0,.027),.012)
        # Reenvío al extremo inferior de cada sinfín. El árbol telescópico
        # acompaña al carro durante el relevo.
        end=-.149 if i==0 else .149
        lower,fork=shaft_ends(i,0)
        length=hypot(*(b-a for a,b in zip(lower,fork)))
        for label,r in [('Manguito',.016),('Estriado',.011)]:
            start=lower if label=='Manguito' else fork
            tube(m,label+' cardán '+tag,base,'grafito' if label=='Manguito' else 'cresta',
                 .012 if label=='Manguito' else 0,r,0,length*.63,loc=start)
            tube(m,'Cruceta '+label+tag,base if label=='Manguito' else mount,'bronce',
                 0,.014,-.020,.020,loc=start if label=='Manguito' else (0,0,end),rot=(0,pi/2,0))
        tube(m,'Caja cónica superior '+tag,mount,'grafito',0,.027,end-.018,end+.018)
        tube(m,'Caja cónica inferior '+tag,base,'naranja',0,.028,-.022,.022,loc=lower)
        if i==0:
            first=lower
        else:
            bar(m,'Árbol común',base,'cresta',first,lower,.012)
    bar(m,'Reductor de inversión',base,'grafito',first,(.210,*first[1:]),.037)
    bar(m,'Motor de inversión',base,'motor',(.207,*first[1:]),(.312,*first[1:]),.031)
    supports(m,base)
    return shaft


def gimbal(m,base):
    ring=m.part('cardán',base,loc=(0,0,Z)).name
    tube(m,'Anillo exterior',ring,'turquesa',.528,.550,-.014,.014)
    shaft=m.part('muñón motriz',ring).name
    for sign in (-1,1):
        bar(m,'Brazo Y '+str(sign),base,'turquesa',(0,sign*.494,.196),(0,sign*.583,Z),.019)
        bar(m,'Eje Y '+str(sign),ring,'acero',(0,sign*.539,0),(0,sign*.607,0),.014)
        bar(m,'Eje X '+str(sign),shaft,'acero',(sign*.482,0,0),(sign*.573,0,0),.014)
    for axis,parent,carrier,label in [(0,shaft,ring,'inversión'),(1,ring,base,'ladeo')]:
        rot=(0,pi/2,0) if axis==0 else (-pi/2,0,0)
        loc=(.563,0,0) if axis==0 else (0,.591,0)
        wheel(m,'Corona '+label,parent,WHEEL,MOD_X,.013,.011,loc=loc,rot=rot)
        center=(loc[0],loc[1],(-.078 if axis==0 else Z-.078))
        support=m.part('Reductor '+label,carrier,loc=center,rot=rot).name
        rotor=m.part('motor_elevacion' if axis==0 else 'motor_ladeo',support).name
        wheel(m,'Piñón '+label,rotor,SAT,MOD_X,.013,.003,phase=pi/SAT if axis==0 else 0)
        tube(m,'Soporte naranja '+label,support,'naranja',.005,.029,.010,.018)
        tube(m,'Motor '+label,support,'motor',.002,.022,.018,.039)
        anchor=(.53,0,0) if axis==0 else (0,.55,Z-.14)
        bar(m,'Ménsula '+label,carrier,'turquesa',anchor,center,.009)
    return shaft
