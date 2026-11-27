# The app's pixel trophies (user, 2026-11-27): 32x40 sprites drawn from shapes, shaded and outlined.
# Run: python3 cli/trophy-art.py public/media/trophies 1   (the second argument is the scale).
# Found-object trophies (a bell, a jug, an axe...) are drawn as the objects; sculpted ones are the app's own designs.
from PIL import Image
import math, os, sys
W,H=32,40
MAT={ # light, mid, dark
 'gold':((255,240,160),(226,179,60),(168,116,26)),
 'silver':((246,248,250),(201,206,214),(128,136,148)),
 'bronze':((232,168,110),(184,115,51),(122,69,32)),
 'wood':((184,128,72),(139,90,43),(90,54,24)),
 'black':((90,90,96),(48,48,54),(24,24,28)),
 'brown':((196,140,90),(150,98,58),(98,60,30)),
 'cream':((255,250,235),(236,226,200),(196,182,150)),
 'red':((235,110,95),(192,57,43),(130,30,22)),
 'green':((110,190,120),(46,125,50),(24,80,30)),
 'steel':((230,234,240),(170,178,190),(110,118,130)),
}
OUT=(36,26,14)
class C:
    def __init__(s): s.g=[[None]*W for _ in range(H)]
    def px(s,x,y,m):
        if 0<=x<W and 0<=y<H: s.g[y][x]=m
    def rect(s,x0,y0,x1,y1,m):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): s.px(x,y,m)
    def ell(s,cx,cy,rx,ry,m,ymin=-99,ymax=99):
        for y in range(H):
            for x in range(W):
                if ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1 and ymin<=y<=ymax: s.px(x,y,m)
    def ring(s,cx,cy,rx,ry,t,m):
        for y in range(H):
            for x in range(W):
                d=((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2
                d2=((x+.5-cx)/(rx-t))**2+((y+.5-cy)/(ry-t))**2
                if d<=1 and d2>1: s.px(x,y,m)
    def poly(s,pts,m):
        for y in range(H):
            for x in range(W):
                X,Y=x+.5,y+.5; ins=False; j=len(pts)-1
                for i in range(len(pts)):
                    xi,yi=pts[i]; xj,yj=pts[j]
                    if (yi>Y)!=(yj>Y) and X<(xj-xi)*(Y-yi)/(yj-yi)+xi: ins=not ins
                    j=i
                if ins: s.px(x,y,m)
    def map(s,x0,y0,rows,m):
        for j,r in enumerate(rows):
            for i,c in enumerate(r):
                if c=='#': s.px(x0+i,y0+j,m)
    def render(s,scale=6):
        im=Image.new('RGBA',(W,H),(0,0,0,0)); p=im.load()
        for y in range(H):
            row=s.g[y]; x=0
            while x<W:
                m=row[x]
                if m is None: x+=1; continue
                x1=x
                while x1+1<W and row[x1+1]==m: x1+=1
                n=x1-x+1
                for i in range(n):
                    f=(i+.5)/n
                    L,M,D=MAT[m]
                    c=L if (f<.28 and n>=3) else D if (f>.78 and n>=3) else M
                    # top edge of a shape a bit lighter
                    if y>0 and s.g[y-1][x+i]!=m and c==M and n>=3: c=L
                    p[x+i,y]=c+(255,)
                x=x1+1
        q=im.copy(); qp=q.load()
        for y in range(H):
            for x in range(W):
                if p[x,y][3]==0 and any(0<=x+dx<W and 0<=y+dy<H and p[x+dx,y+dy][3] for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                    qp[x,y]=OUT+(255,)
        return q.resize((W*scale,H*scale),Image.NEAREST)

def base(c,top=33,m='wood',plate='gold',w=11):
    c.rect(16-w,top,15+w,top+1,m); c.rect(16-w-1,top+2,16+w,top+4,m)
    if plate: c.rect(12,top+2,19,top+3,plate)

def cup(c,m='gold',big=True):
    c.ell(16,9,11 if big else 9,9 if big else 8,m,ymin=3 if big else 4)
    c.rect(5 if big else 7,3 if big else 4,26 if big else 24,4 if big else 5,m)
    c.ring(5,10,4,5,1.6,m); c.ring(27,10,4,5,1.6,m)
    c.rect(14,17,17,24,m); c.rect(12,23,19,24,m); c.rect(10,25,21,27,m)
    c.ell(16,30,8,3,m)
    base(c)

def football(c,cx,cy,rx,ry,m):
    c.ell(cx,cy,rx,ry,m)
    for x in range(int(cx-rx*.45),int(cx+rx*.45)+1): c.px(x,int(cy-ry*.25),'cream')
    for x in (int(cx-2),int(cx),int(cx+2)): c.px(x,int(cy-ry*.25)-1,'cream'); c.px(x,int(cy-ry*.25)+1,'cream')

FIG={
'pass':["......##......",".....####...##",".....####..##.","......##..##..","....#######...","...########...","..##.####.....","..#..####.....","....######....","....######....","....##..##....","...##....##...","...##....##...","..##......##..","..##......##..",".###......###."],
'run':["........##....",".......####...",".......####...","........##....","......#####...","....########..","...##.######..","..##..#####...","......#####...",".....######...","....###..##...","...###....##..","..###......##.",".###.......##.","###.........#.","##..........##"],
'catch':["..##......##..","..##......##..","...##....##...","....######....",".....####.....",".....####.....","......##......","....######....","....######....","....######....","....######....","....##..##....","....##..##....","...##....##...","...##....##...","..###....###.."],
'line':["..............","..............","..............","....##........","...####.......","...####..###..","....##.######.","...###########","..############","..##.#######..","..#..##...##..",".....##...##..","....##....##..","...##.....##..","..##......##..",".###......###."],
'kick':["......##......",".....####.....",".....####.....","......##......","....######....","...########...","..##.####.##..",".....####.....",".....#####....","....###.###...","....##...###..","...##.....###.","...##......###","..##..........","..##..........",".###.........."],
'defend':[".....####.....",".....####.....","......##......","..##########..",".###.####.###.",".#...####...#.",".....####.....","....######....","....######....","...###..###...","...##....##...","..##......##..","..##......##..",".##........##.",".##........##.","###........###"],
}
def statue(c,pose,m='bronze'):
    c.map(9,6,FIG[pose],m)
    c.rect(8,23,23,24,'black'); c.rect(7,25,24,31,'black'); c.rect(10,27,21,28,'gold')
    base(c,top=32,m='wood',plate=None,w=10)

def heisman_orig(c):
    # an original: gold football atop a tall black column with a gold band and star
    football(c,16,8,7,5,'gold')
    c.rect(12,14,19,15,'gold'); c.rect(13,16,18,27,'black'); c.rect(13,20,18,21,'gold')
    c.rect(10,28,21,30,'black'); base(c,top=31)

def bowl_tr(c):
    football(c,16,9,8,5,'brown'); c.ell(16,17,9,3,'silver',ymin=16)
    c.rect(14,19,17,25,'silver'); c.rect(11,26,20,28,'silver'); base(c,top=30)

def whistle(c):
    c.ell(14,16,7,7,'gold'); c.rect(18,10,27,14,'gold'); c.rect(25,9,28,15,'gold')
    c.ell(14,16,2,2,'black')
    c.poly([(26,9),(28,9),(22,2),(20,2)],'red'); c.poly([(20,2),(22,2),(9,10),(8,9)],'red')
    c.rect(6,25,25,27,'black'); base(c,top=30)

def bell(c):
    c.rect(4,3,27,5,'wood'); c.rect(4,6,6,28,'wood'); c.rect(25,6,27,28,'wood')
    c.rect(15,6,16,8,'steel')
    c.poly([(11,9),(21,9),(23,21),(26,25),(6,25),(9,21)],'bronze')
    c.ell(16,25,3,2,'bronze'); c.rect(15,26,16,27,'steel')
    base(c,top=30,w=13)

def jug(c):
    c.ell(16,20,10,10,'brown',ymin=11)
    c.rect(12,6,19,12,'brown'); c.rect(11,4,20,6,'brown')
    c.ring(25,13,5,6,1.5,'brown')
    c.rect(10,18,22,22,'cream')  # painted band for scores
    base(c,top=31)

def axe(c):
    c.rect(3,4,28,29,'wood')
    c.poly([(7,24),(9,26),(26,9),(24,7)],'brown')     # handle
    c.poly([(18,4),(23,1),(30,8),(27,13),(22,11)],'steel')   # head
    c.rect(6,27,25,28,'gold')

def bucket(c):
    c.poly([(7,10),(25,10),(23,29),(9,29)],'wood')
    for y in (13,20,26): c.rect(7,y,25,y,'steel')
    c.ring(16,10,10,8,1.2,'steel'); c.rect(6,9,26,10,'steel')
    c.rect(12,15,20,18,'gold')

def flag(c):
    c.rect(5,2,6,30,'steel')
    c.rect(7,4,26,16,'green'); c.rect(7,4,16,10,'red')  # an original split flag
    base(c,top=31,w=8)


def playoff(c):
    cup(c,'gold',True)
    for (x,y) in ((16,7),(15,8),(16,8),(17,8),(16,9),(14,8),(18,8)): c.px(x,y,'red')
def rcup(c):
    cup(c,'bronze',False)
def hat(c):
    c.ell(16,22,13,4,'gold')            # brim
    c.poly([(9,22),(10,11),(14,9),(16,11),(18,9),(22,11),(23,22)],'gold')  # crown with a pinch
    c.rect(9,19,23,20,'brown')          # band
    base(c,top=29,w=12)
def egg(c):
    c.ell(16,11,7,9,'gold'); 
    for y in (6,9,12,15): c.px(16,y,'cream')
    c.rect(13,20,18,25,'gold'); c.rect(10,26,21,28,'gold'); base(c,top=30)
def boot(c):
    c.poly([(9,4),(17,4),(17,20),(26,21),(27,27),(9,27)],'gold')
    c.rect(8,4,18,6,'gold'); c.rect(9,27,27,28,'brown')
    base(c,top=30,w=13)
def oar(c):
    c.poly([(6,28),(8,30),(22,10),(20,8)],'wood')
    c.poly([(19,9),(23,2),(29,4),(25,12)],'wood')
    c.rect(4,30,27,32,'black'); c.rect(11,31,20,31,'gold')
def shillelagh(c):
    c.poly([(9,30),(12,30),(22,8),(19,7)],'black')
    c.ell(21,7,4,4,'black')
    for (x,y) in ((12,26),(14,22),(16,18),(18,14),(20,10)): c.px(x,y,'green'); c.px(x+1,y,'red')
    base(c,top=31,w=10)
def saddle(c):
    c.poly([(5,14),(9,12),(14,16),(20,16),(24,10),(27,12),(26,20),(6,20)],'brown')
    c.rect(14,20,16,27,'steel'); c.ell(15,28,3,2,'steel')
    c.rect(4,20,8,22,'brown'); c.rect(24,20,28,22,'brown')
    base(c,top=30,w=12)
def skillet(c):
    c.ell(13,18,10,8,'black'); c.ell(13,18,7,5,'steel')
    c.rect(22,16,30,19,'black')
    base(c,top=29,w=13)
def can(c):
    c.rect(9,8,23,28,'steel'); c.rect(8,7,24,8,'steel'); c.rect(13,4,19,7,'steel')
    c.ring(16,6,5,4,1.2,'steel')
    c.rect(9,14,23,19,'red')
    base(c,top=30,w=11)
def cannon(c):
    c.poly([(5,13),(25,7),(27,13),(7,19)],'black')
    c.ell(27,10,2,3,'black')
    c.ell(13,22,6,6,'wood'); c.ell(13,22,2,2,'black')
    c.rect(5,27,27,29,'wood')
    c.rect(3,30,29,32,'black'); c.rect(12,31,19,31,'gold')
def keg(c):
    c.ell(16,18,9,12,'wood',ymin=6,ymax=30)
    for y in (9,15,21,27): c.rect(8,y,24,y,'steel')
    c.rect(13,16,19,19,'cream')
    base(c,top=31,w=11)
def belt(c):
    c.rect(2,14,29,20,'brown')
    c.ell(16,17,8,7,'gold'); c.ell(16,17,4,4,'red')
    c.rect(4,15,7,19,'steel'); c.rect(24,15,27,19,'steel')
    base(c,top=29,w=12)
def wheel(c):
    c.ring(16,16,12,12,2.4,'wood'); c.ell(16,16,3,3,'steel')
    for k in range(8):
        a=k*math.pi/4
        for r in range(3,11):
            c.px(int(round(16+r*math.cos(a))),int(round(16+r*math.sin(a))),'wood')
    c.rect(6,29,25,30,'black'); c.rect(4,31,27,33,'black'); c.rect(12,32,19,32,'gold')
def clipboard(c):
    c.rect(8,4,23,27,'wood'); c.rect(10,7,21,25,'cream'); c.rect(13,3,18,6,'steel')
    for y in (10,13,16,19,22): c.rect(12,y,19,y,'black')
    c.px(13,9,'red'); c.px(17,13,'red')
    base(c,top=30,w=11)

SPRITES={
 'national':lambda c:cup(c,'gold',True),'conference':lambda c:cup(c,'silver',False),'bowl':bowl_tr,'heisman':heisman_orig,
 'qb':lambda c:statue(c,'pass'),'rb':lambda c:statue(c,'run'),'wr':lambda c:statue(c,'catch'),'te':lambda c:statue(c,'catch','silver'),
 'ol':lambda c:statue(c,'line'),'lb':lambda c:statue(c,'defend'),'db':lambda c:statue(c,'catch','gold'),
 'k':lambda c:statue(c,'kick'),'p':lambda c:statue(c,'kick','silver'),
 'coach':whistle,'coach2':clipboard,'bell':bell,'jug':jug,'axe':axe,'bucket':bucket,'flag':flag,
 'maxwell':lambda c:statue(c,'pass','gold'),'camp':lambda c:statue(c,'catch','silver'),'def':lambda c:statue(c,'defend','gold'),'def2':lambda c:statue(c,'defend','bronze'),
 'playoff':playoff,'cup':rcup,'hat':hat,'egg':egg,'boot':boot,'oar':oar,'shillelagh':shillelagh,'saddle':saddle,'skillet':skillet,'can':can,'cannon':cannon,'keg':keg,'belt':belt,'wheel':wheel,
}
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
sheet=[]
for k,f in SPRITES.items():
    c=C(); f(c); im=c.render(int(sys.argv[2]) if len(sys.argv)>2 else 6); im.save(f'{out}/{k}.png'); sheet.append((k,im))
cols=10; sc=sheet[0][1].width
S=Image.new('RGBA',(cols*(sc+16),((len(sheet)+cols-1)//cols)*(sheet[0][1].height+16)),(250,248,244,255))
for i,(k,im) in enumerate(sheet): S.alpha_composite(im,((i%cols)*(sc+16)+8,(i//cols)*(im.height+16)+8))
S.save(f'{out}/_sheet.png')
