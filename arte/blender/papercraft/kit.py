"""Biblioteca de siluetas plegadas, con pivote en la mesa de trabajo."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path("arte/blender/papercraft").resolve()))
from comun import *

def anillo(x,y,z,a,b,n,giro=0):
    return [(x+a*math.cos(i*math.tau/n+giro),y+b*math.sin(i*math.tau/n+giro),z) for i in range(n)]

def unir(p,abajo,arriba,tonos):
    for i,a in enumerate(abajo):
        j=(i+1)%len(abajo)
        p.cara([a,abajo[j],arriba[j],arriba[i]],tonos[i%len(tonos)])

def cilindro(p,x,y,z,a,b,h,tinte,n=7):
    bajo=anillo(x,y,z,a,b,n)
    alto=anillo(x,y,z+h,a*.84,b*.84,n)
    unir(p,bajo,alto,[tinte])
    p.tapa([v[:2] for v in alto],z+h,tinte)

def copa(p,x,y,z,a,b,h,n,colores,r):
    bajo=anillo(x,y,z,a*.55,b*.55,n,.15)
    medio=anillo(x,y,z+h*.34,a,b,n,.34)
    alto=anillo(x+.12*a,y,z+h*.8,a*.7,b*.7,n,.53)
    for i in range(n):
        j=(i+1)%n
        for base,tope in [(bajo,medio),(medio,alto)]:
            p.cara([base[i],base[j],tope[i]],r.choice(colores),r.uniform(.92,1.03))
            p.cara([base[j],tope[j],tope[i]],r.choice(colores))
        p.cara([alto[i],alto[j],(x,y,z+h)],r.choice(colores))

def pino(p,alto,claro):
    cilindro(p,0,0,0,.34,.31,alto*.57,'cartón')
    for k in range(3):
        z=alto*(.17+k*.205)
        radio=alto*(.31-k*.057)
        punta=(radio*.12,-radio*.08,z+alto*(.45-.015*k))
        base=[]
        for i in range(10):
            t=i*math.tau/10+k*.58
            a=radio*(.72 if i%2 else 1)
            base.append((a*math.cos(t),a*math.sin(t),z+(.25 if i%2 else 0)))
        for i,v in enumerate(base):
            w=base[(i+1)%10]
            u=(*v[:2],v[2]+.072); s=(*w[:2],w[2]+.072)
            p.cara([v,w,s,u],'liquen')
            p.cara([u,s,punta],(['musgo','aguja'] if claro else ['pino','sombra'])[i%2],1+k*.05)

def caja(p,x,y,z,a,b,h,tinte,ch=.1):
    pts=[(-a+ch,-b),(a-ch,-b),(a,-b+ch),(a,b-ch),(a-ch,b),(-a+ch,b),(-a,b-ch),(-a,-b+ch)]
    pts=[(x+i,y+j) for i,j in pts]
    p.lamina(pts,z,h,tinte)

def muralla(p,torre):
    ancho,fondo=(4.9,4.9) if torre else (7.0,2.35)
    h=8 if torre else 5.3
    caja(p,0,0,0,ancho*.53,fondo*.58,.49,'pizarra')
    # Hiladas trabadas con juntas del ancho de un trazo de grafito.
    n=4
    for k in range(n):
        z=.49+k*(h-.49)/n
        cortes=[-.5,-.18,.16,.5] if k%2 else [-.5,-.33,0,.32,.5]
        for j,(a,b) in enumerate(zip(cortes,cortes[1:])):
            x=(a+b)*ancho/2
            dx=(b-a)*ancho/2-.023
            pts=[(x-dx,-fondo/2),(x+dx,-fondo/2),(x+dx,fondo/2),(x-dx,fondo/2)]
            al=(h-.49)/n
            bajo=[(*v,z) for v in pts]; alto=[(*v,z+al-.038) for v in pts]
            borde=[(*v,z+al-.17) for v in pts]
            unir(p,borde,alto,['alma'])
            unir(p,bajo,borde,[['piedra','dovela','piedra','sillar'][(k+j)%4]])
            p.tapa(pts,z+al-.038,'piedra')
    caja(p,0,0,h-.045,ancho*.52,fondo*.55,.32,'caliza')
    # Cubierta hundida, estribos plegados y saeteras de tinta en las torres.
    caja(p,0,0,h+.275,ancho*.45,fondo*.44,.05,'sillar')
    for lado in [-1,1]:
        x=0 if torre else -ancho*.26
        y=lado*fondo*.5
        if torre:
            for eje in [0,1]:
                u=ancho*.503*lado
                perfil=[(-.08,h*.56),(-.12,h*.79),(0,h*.83),(.12,h*.79),(.08,h*.56)]
                p.cara([(q,u,z) if eje==0 else (u,q,z) for q,z in perfil],'tinta')
        else:
            pie=[(x-.29,y-.51),(x+.29,y-.51),(x+.29,y+.51),(x-.29,y+.51)]
            cima=[(x+(u-x)*.76,y+(v-y)*.34,h*.73) for u,v in pie]
            unir(p,[(*v,.31) for v in pie],cima,['sillar','dovela'])
            p.tapa([v[:2] for v in cima],h*.73,'caliza')
    for lado in [-1,1]:
        for i in range(3):
            caja(p,(i-1)*ancho*.36,lado*fondo*.41,h+.275,ancho*.085,.29,.92,'piedra',.07)
    if torre:
        for lado in [-1,1]:
            caja(p,lado*ancho*.42,0,h+.275,.29,.45,.92,'caliza')

def piezas():
    nombres=['pino-alto','pino-joven','alcornoque','matorral','roca','laja','esparto','espigas','lienzo','torre']
    for nombre in nombres:
        p=Papel(nombre); r=azar(nombre)
        if nombre.startswith('pino'):
            pino(p,8.3 if nombre=='pino-alto' else 5.8,nombre=='pino-joven')
        elif nombre=='alcornoque':
            cilindro(p,0,0,0,.51,.45,4.2,'cartón')
            for x,y,z,a in [(0,0,3.1,3),(-1.5,.18,2.65,2),(1.3,-.7,3.4,2.1)]:
                copa(p,x,y,z,a,a*.83,2.9,7,['salvia','oliva','musgo'],r)
        elif nombre in ('matorral','roca','laja'):
            piedra=nombre!='matorral'
            for x,y,z,a in [(0,0,0,1.45),(1,.3,0,.72),(-.8,.6,0,.55)]:
                copa(p,x,y,z,a,a*.75,a*(.53 if nombre=='laja' else 1.32),6,
                     ['pizarra','piedra','caliza'] if piedra else ['musgo','aguja','oliva'],r)
        elif nombre in ('esparto','espigas'):
            for i in range(8):
                t=i*2.4
                x,y=r.uniform(-.4,.4),r.uniform(-.4,.4)
                h=r.uniform(.7,1.55)
                u,v=.15*math.cos(t),.15*math.sin(t)
                pie=(x+v*.3,y-u*.3,0); punta=(x+4*v,y-4*u,h)
                p.cara([(x-u,y-v,0),pie,punta],'huella' if nombre=='esparto' else 'musgo')
                p.cara([pie,(x+u,y+v,0),punta],'liquen')
                if nombre=='espigas':
                    copa(p,*punta,.12,.13,.48,4,['miel','flor'],r)
        else:
            muralla(p,nombre=='torre')
        yield p

def pieza_horneada(p,mat):
    from oclusion import arbol, hornear
    obj=p.objeto(mat)
    hornear(obj,arbol(p.caras),intensidad=.12)
    return obj

def construir():
    mat=iniciar()
    for i,p in enumerate(piezas()):
        obj=pieza_horneada(p,mat)
        exportar(obj,BASE/'glb'/'kit'/(p.nombre+'.glb'))
        obj.location=((i%5-2)*12,(i//5-.5)*13,0)
        obj.asset_mark()
    bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'kit.blend'),compress=True)
if __name__=='__main__':
    construir()
