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
for _k in ('gold','silver','bronze'):
    _l,_m,_d=MAT[_k]; MAT[_k+'_d']=(_d,tuple(int(v*.7) for v in _d),tuple(int(v*.5) for v in _d))
OUT=(36,26,14)
MAT['seam']=(OUT,OUT,OUT)
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

# The award figures (user, 2026-11-27: a pose of its own for each award, with a head; approved round by round),
# 18x22: '#' the statue, 'o' the ball (the same metal, much darker, so it shows).
POSE={
'heisman':[  # stiff-arm
 "..................",
 ".........###......",
 ".........###......",
 ".........###......",
 "..........#.......",
 ".........###......",
 ".......######.....",
 "..############....",
 ".........##ooo....",
 ".........##ooo....",
 ".........###......",
 ".........####.....",
 ".........#####....",
 "........#######...",
 "........##..##....",
 ".......###..##....",
 ".......##...##....",
 "......##....##....",
 "......##..........",
 ".....##...........",
 "...####...........",
 "...##.............",
],
'maxwell':[  # breaking a tackle, ball locked in both arms
 "..................",
 "..................",
 "........###.......",
 "........###.......",
 "........###.......",
 ".........#........",
 "........###.......",
 ".......#####......",
 "......##ooo##.....",
 "......##ooo##.....",
 "........####......",
 "........###.......",
 "........######....",
 "........######....",
 "........##..##....",
 "........##..##....",
 ".......###..##....",
 ".......##...###...",
 ".......##...###...",
 "......##..........",
 "......##..........",
 "....####..........",
],
'camp':[  # boot up on the ball, forearm on the knee
 "..................",
 ".......#..........",
 "......###.........",
 "......###.........",
 ".......#..........",
 "....########......",
 "...##########.....",
 "..###.#####..#....",
 "..##..#####..#....",
 "...########..##...",
 "......#####..##...",
 "......######.##...",
 "......##..#####...",
 "......##....##....",
 "......##....##....",
 "......##....##....",
 "......##...####...",
 "......##.ooooooo..",
 "......##.oooooooo.",
 "......##..oooooo..",
 ".....###..........",
 "....####..........",
],
'qb':[  # passing
 "..................",
 "..............oo..",
 ".......###...oooo.",
 ".......###...##...",
 ".......###...##...",
 "........#.####....",
 "..###.#######.....",
 "...########.......",
 "........###.......",
 "........###.......",
 "........###.......",
 "........###.......",
 "........###.......",
 ".......####.......",
 ".......#####......",
 "......###.###.....",
 ".....###...##.....",
 ".....##....##.....",
 ".....##.....##....",
 "....##......##....",
 "....##......##....",
 "....##......##....",
],
'rb':[  # sprinting, ball tucked high, free arm pumping, knee up
 "..................",
 "..................",
 ".........###......",
 ".........###......",
 ".........###......",
 "..........#.......",
 ".........###......",
 ".......#####......",
 "......#######ooo..",
 "......#######oo...",
 ".....##.####.##...",
 ".....##.###.......",
 "........####......",
 "........######....",
 "........##.###....",
 ".......###..##....",
 ".......##...##....",
 "......###...###...",
 ".....###....###...",
 ".....##...........",
 "...###............",
 "...#..............",
],
'wr':[  # one-handed grab on the run, the other arm straight back for balance
 "..................",
 "..................",
 "...............ooo",
 "...............ooo",
 "..............###.",
 "........###...##..",
 "........###..##...",
 "........######....",
 ".........####.....",
 ".......#####......",
 ".....######.......",
 "...####.###.......",
 "..###...###.......",
 ".......####.......",
 ".......####.......",
 ".......####.......",
 "......#####.......",
 ".....###.###......",
 "...#####..##......",
 "...##.....##......",
 "..........##......",
 "...........###....",
],
'te':[  # rumbling, shoulder lowered
 "..................",
 "..................",
 "..................",
 "..................",
 "...........###....",
 "...........###....",
 "...........###....",
 "...........#......",
 "....###.#####.....",
 ".....#########....",
 "........###oooo...",
 ".......####.oo....",
 ".......###........",
 ".......####.......",
 "......######......",
 "......##..###.....",
 ".....###...##.....",
 ".....##....###....",
 ".....##.....##....",
 "....##......####..",
 "....##........##..",
 "....#.............",
],
'ol':[  # three-point stance, back flat, one hand down
 "..................",
 "..................",
 "..................",
 "..................",
 "..................",
 "..................",
 "..................",
 ".............###..",
 ".............###..",
 "........####.###..",
 "....##########....",
 "....##########....",
 "....##########....",
 "....####.##.##....",
 "...########.##....",
 "...##..####.##....",
 "...##..####.##....",
 "...##..##...##....",
 "..##...##...##....",
 "..##...##...##....",
 "..###..###...#....",
 "..###..###...#....",
],
'def':[  # drive block / bull rush, arms locked out at two heights
 "..................",
 "..................",
 "..................",
 "..................",
 "..................",
 "...........###....",
 "...........###....",
 "...........###.##.",
 ".........########.",
 "........#######...",
 "......#######.....",
 ".....#####.######.",
 ".....####...#####.",
 ".....####.........",
 "....######........",
 "....##..###.......",
 "...###..###.......",
 "...##....##.......",
 "..##.....##.......",
 ".###......##......",
 ".##.......###.....",
 ".#........###.....",
],
'def2':[  # fist punched up
 "..................",
 "............###...",
 "............###...",
 ".......##....#....",
 ".......###...#....",
 ".......##...##....",
 ".....#########....",
 "....##########....",
 "....##.#####......",
 "....#..#####......",
 "....#..#####......",
 "...##..#####......",
 "...##..######.....",
 ".......##.###.....",
 ".......##.###.....",
 "......###..###....",
 "......##...###....",
 "......##....##....",
 ".....###....##....",
 ".....###....##....",
 ".....###.....###..",
 "....####.....####.",
],
'lb':[  # shuffling to the ball, one arm cocked up, the other out low (after the real Butkus statue)
 "..................",
 "..................",
 "........###.......",
 "........###...#...",
 "........###..##...",
 ".........#...##...",
 ".......########...",
 "......########....",
 "..#########.......",
 "...###..###.......",
 "........###.......",
 "........###.......",
 "........###.......",
 "........###.......",
 ".......#####......",
 ".......##.###.....",
 "......###.###.....",
 ".....###...#......",
 "....###....#......",
 "....##.....#......",
 "...##......#......",
 "...........###....",
],
'db':[  # leaping to knock the ball away
 "............oo....",
 "...........oooo...",
 "...........##.....",
 "...........##.....",
 "........##.##.....",
 ".......######.....",
 "........##.##.....",
 ".......#####......",
 "......######......",
 ".....#######......",
 "....#..#####......",
 "....#..#####......",
 ".......######.....",
 ".......###.####...",
 ".......###...##...",
 ".......###..###...",
 ".......###..##....",
 ".......##...##....",
 "......##..........",
 "......##..........",
 ".....###..........",
 "....###...........",
],
'k':[  # leg cocked back, ball on the tee
 "..................",
 "..................",
 "..................",
 "........###.......",
 "........###.......",
 "........###.......",
 ".........#........",
 "......######......",
 "....##########....",
 "...###.###..###...",
 "...##..###...##...",
 "......####........",
 "......####........",
 "..##..###.........",
 "..#######.........",
 "...######.........",
 "....######........",
 ".....#.###........",
 "........##........",
 "........##..oo....",
 "........##.oooo...",
 "........###.##....",
],
'p':[  # punt
 "..................",
 "..................",
 "..................",
 "..............ooo.",
 ".....###....#.ooo.",
 ".....###..###.....",
 ".....###.###...##.",
 "......#####...##..",
 ".....####....##...",
 ".########...##....",
 "..#######.###.....",
 "......#######.....",
 "......#####.......",
 "......####........",
 "......###.........",
 "......##..........",
 "......##..........",
 "......##..........",
 "......##..........",
 "......##..........",
 "......##..........",
 "......###.........",
],
}
# The Heisman is the special one (user, 2026-11-28): its figure a size up (21x26, the stiff arm with an open hand),
# on a tall black base with angled sides and a bronze plaque, over a wide stepped wood base. Approved step by step.
HEISMAN_BIG=[
 ".....................",
 ".....................",
 "...........###.......",
 "...........###.......",
 "...........###.......",
 "............#........",
 "...#......####.......",
 "...#.....#####.......",
 "...############......",
 "....#####.######.....",
 "..........###ooo#....",
 "..........###ooo.....",
 "..........####.......",
 "..........####.......",
 "..........######.....",
 "..........#######....",
 ".........###..###....",
 ".........###..###....",
 "........###...##.....",
 "........##....##.....",
 ".......###....##.....",
 ".......##.....##.....",
 "......###............",
 ".....###.............",
 "...####..............",
 "....#................",
]
def figure(c,x0,y0,rows,m):
    c.map(x0,y0,rows,m)
    c.map(x0,y0,[r.replace('#','.').replace('o','#') for r in rows],m+'_d')
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch=='#' and any(0<=y+dy<len(rows) and 0<=x+dx<len(r) and rows[y+dy][x+dx]=='o' for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                c.px(x0+x,y0+y,'seam')
def heisman_tr(c):
    figure(c,5,-1,HEISMAN_BIG,'bronze')
    c.rect(7,24,24,25,'bronze')
    c.poly([(8,26),(24,26),(28,34),(4,34)],'black')
    c.rect(11,28,20,31,'bronze'); c.rect(12,29,19,29,'bronze_d'); c.rect(12,30,17,30,'bronze_d')
    c.rect(3,34,28,35,'wood'); c.rect(2,36,29,38,'wood')

def statue(c,pose,m='bronze'):
    c.map(7,1,POSE[pose],m)
    c.map(7,1,[r.replace('#','.').replace('o','#') for r in POSE[pose]],m+'_d')
    # A dark seam where the ball meets the body, so the ball reads on every metal (user, 2026-11-28).
    rows=POSE[pose]
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch=='#' and any(0<=y+dy<len(rows) and 0<=x+dx<len(r) and rows[y+dy][x+dx]=='o' for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                c.px(7+x,1+y,'seam')
    c.rect(8,23,23,24,'black'); c.rect(7,25,24,31,'black'); c.rect(10,27,21,28,'gold')
    base(c,top=32,m='wood',plate=None,w=10)

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


# ---- Bowl trophies (user, 2026-11-28: "unique trophies for each one (make the pixel art designs inspired by the real trophies)";
# approved round by round). Drawn from the real trophies where a photo or description was found: Rose (Leishman Trophy:
# silver football over a cage of gold rods, roses at the base), Sugar (an antique silver sugar bowl), Orange (a glass bowl
# of oranges), Cotton (a silver football on intertwined metal, AT&T Stadium base), Fiesta (a lapis column, gold sunset, lit
# dome), Peach (the Crumbley Trophy: a football raised from the base), the CFP's (gold brackets around a silver football,
# black base), Liberty (a quarter-size Liberty Bell on a wooden yoke), Independence (an eagle with the 13-star flag on
# intertwined metal), Las Vegas (a white football on three gold columns), Hall of Fame (the Outback Bowl's crystal and
# boomerang), Carquest (the Pop-Tarts Bowl's football toaster), Copper (Tucson's blown glass and copper); the rest themed.
MAT.update({
 'glass':((236,248,255),(190,222,240),(140,180,205)), 'orange':((255,190,90),(240,130,20),(180,80,10)),
 'lapis':((90,120,220),(38,62,160),(20,32,96)), 'peach':((255,205,160),(246,150,100),(200,96,64)),
 'rose':((255,120,140),(214,40,70),(140,20,40)), 'rose2':((235,90,110),(176,24,50),(110,12,30)), 'leaf':((120,200,110),(50,140,60),(26,90,34)),
 'sun1':((255,236,120),(250,200,50),(210,150,20)), 'sun2':((255,170,90),(240,110,40),(190,70,20)), 'sun3':((240,110,110),(200,50,60),(140,30,40)),
 'copper':((240,170,120),(196,110,62),(130,64,30)), 'sea':((140,210,240),(40,140,200),(20,80,140)), 'stone':((250,240,215),(225,205,165),(170,145,105)),
 'koa':((200,120,70),(150,80,40),(96,48,22)), 'flower':((255,170,200),(236,90,140),(170,40,90)), 'bbronze':((120,100,80),(72,58,44),(40,32,24)),
})
def ball(c,cx,cy,rx,ry,m,laces='cream'):
    c.ell(cx,cy,rx,ry,m)
    y=int(cy-ry*.25)
    for x in range(int(cx-rx*.45),int(cx+rx*.45)+1): c.px(x,y,laces)
    for x in (int(cx-2),int(cx),int(cx+2)): c.px(x,y-1,laces); c.px(x,y+1,laces)
def b_rose(c):
    c.poly([(8,9),(11,4),(17,1),(23,2),(25,5),(22,10),(16,12),(10,12)],'silver')
    for x in (13,15,17,19): c.px(x,6,'silver_d')
    c.rect(13,7,20,7,'silver_d')
    c.rect(13,13,18,13,'gold'); c.rect(12,14,19,14,'silver'); c.rect(11,15,20,15,'gold')
    for i in range(6):
        xt=10.5+i*2.2
        for y in range(16,29):
            f=(y-16)/12; x=round(xt+(15.5-xt)*0.25*f); c.px(x,y,'gold' if i%2==0 else 'silver')
    c.rect(11,29,20,29,'gold'); c.rect(10,30,21,30,'silver')
    k=0
    for row,(y,xs) in enumerate(((32,(6,11,16,21,26)),(35,(3,8,13,18,23,28)))):
        for x in xs:
            m='rose' if k%2==0 else 'rose2'; k+=1
            c.ell(x,y+.5,2.6,2.2,m)
            c.px(int(x)-1,y,'rose2' if m=='rose' else 'rose')
    for x in (5,10,15,20,25): c.px(x,37,'leaf'); c.px(x+1,37,'leaf')
def b_sugar(c):
    c.rect(15,4,16,5,'silver'); c.ell(16,9,6,3,'silver',ymin=6)
    c.rect(9,10,22,11,'silver')
    c.ell(16,13,9,7,'silver',ymin=12)
    c.ring(6,15,3,4,1.3,'silver'); c.ring(26,15,3,4,1.3,'silver')
    c.rect(9,14,22,14,'silver_d')
    c.rect(14,20,17,23,'silver'); c.ell(16,25,6,2,'silver')
    base(c,top=29,plate='gold')
def b_orange(c):
    for (x,y) in ((11,8),(16,6),(21,8),(9,12),(14,11),(19,11),(23,12),(12,15),(17,15),(21,15)): c.ell(x,y,2.6,2.6,'orange')
    c.ell(16,12,11,8,'glass',ymin=9)
    for (x,y) in ((9,12),(14,11),(19,11),(23,12),(12,15),(17,15),(21,15)): c.ell(x,y,2.4,2.4,'orange',ymin=10)
    c.rect(5,9,26,9,'glass')
    c.rect(15,20,16,25,'silver'); c.ell(16,26,6,2,'silver')
    c.px(10,5,'leaf'); c.px(17,3,'leaf')
    base(c,top=29)
def b_cotton(c):
    ball(c,16,6,7,4,'silver')
    for i,y in enumerate(range(10,26)):
        o=int(3*math.sin(y/2.0)); c.px(16+o,y,'steel'); c.px(15+o,y,'steel'); c.px(16-o,y,'silver'); c.px(17-o,y,'silver')
    c.ell(16,29,12,4,'silver',ymax=28); c.rect(4,28,27,31,'silver')
    for x in range(6,26,3): c.px(x,29,'glass')
    base(c,top=32,w=13,plate=None)
def b_fiesta(c):
    ball(c,16,4,6,3,'gold')
    c.ell(16,11,7,5,'glass',ymax=11); c.rect(9,11,22,12,'gold')
    c.poly([(10,13),(21,13),(19,27),(12,27)],'lapis')
    c.rect(11,16,20,17,'sun1'); c.rect(11,18,20,19,'sun2'); c.rect(12,20,19,21,'sun3')
    c.rect(9,27,22,28,'gold'); c.rect(7,29,24,31,'gold')
    base(c,top=32,w=12,plate=None)
def b_peach(c):
    ball(c,16,6,8,5,'gold')
    c.poly([(10,26),(13,26),(16,11),(15,11)],'silver'); c.poly([(19,26),(22,26),(17,11),(16,11)],'silver')
    c.ell(16,22,3,3,'peach'); c.px(17,19,'leaf'); c.px(18,19,'leaf')
    c.rect(8,26,23,28,'silver')
    base(c,top=30,w=12)
def b_cfp(c, silver_split=True):
    # silver football cradled at the top
    c.ell(16,8,4.5,7,'silver')
    for y in (5,7,9,11): c.rect(15,y,17,y,'silver_d')
    # gold petals: left and right halves of a tapered cone, open at the top
    c.poly([(8,6),(11,2),(13,1),(12,4),(11.5,9),(14,15),(15.5,16),(15.5,28),(14,28)],'gold')
    c.poly([(24,6),(21,2),(19,1),(20,4),(20.5,9),(18,15),(16.5,16),(16.5,28),(18,28)],'gold')
    if silver_split: c.rect(16,16,16,28,'steel')
    c.rect(14,29,18,29,'steel')
    # black octagonal base with the mark
    c.rect(10,30,21,38,'black'); c.rect(11,29,20,29,'black')
    c.ring(16,33,1.6,2.2,0.7,'gold'); c.px(16,33,'cream')
def b_citrus(c):
    ball(c,16,6,7,4,'gold')
    c.rect(15,10,16,12,'gold')
    c.ell(16,17,8,6,'silver',ymin=12); c.rect(8,12,23,13,'silver')
    c.ell(16,17,3,3,'orange'); c.px(17,13,'leaf'); c.px(18,14,'leaf'); c.px(14,14,'leaf')
    c.rect(14,23,17,25,'silver'); c.rect(11,26,20,28,'silver'); base(c,top=30)
def b_holiday(c):
    ball(c,16,7,8,5,'silver')
    c.rect(15,12,16,20,'silver')
    c.poly([(5,28),(7,22),(11,20),(14,23),(17,20),(21,19),(25,22),(27,28)],'sea')
    c.rect(4,28,27,30,'sea')
    for x in (8,13,18,23): c.px(x,22,'glass'); c.px(x+1,21,'glass')
    base(c,top=31,w=12,plate=None)
def b_gator(c):
    # a gator lying across the top: snout left, tail curling down right, bumpy back, legs
    c.ell(16,9,8,3,'green'); c.poly([(2,9),(9,7),(9,11),(2,10)],'green'); c.poly([(23,8),(29,10),(28,14),(26,12),(23,11)],'green')
    for x in range(10,23,2): c.px(x,6,'leaf')
    c.px(7,8,'black'); c.px(3,10,'cream'); c.px(5,10,'cream')
    c.rect(10,12,11,13,'green'); c.rect(20,12,21,13,'green')
    c.ell(16,18,9,5,'silver',ymin=15); c.rect(7,14,24,15,'silver')
    c.rect(14,23,17,25,'silver'); c.rect(11,26,20,28,'silver'); base(c,top=30)
def b_sun(c):
    ball(c,16,6,7,4,'silver')
    for i in range(9):
        a=math.pi+i*math.pi/8
        for r in range(4,8): c.px(round(16+r*math.cos(a)),round(19+r*math.sin(a)),'silver')
    c.rect(12,19,19,20,'silver'); c.rect(14,11,17,26,'silver'); c.rect(15,12,16,25,'steel')
    c.rect(10,27,21,28,'silver'); base(c,top=30)
def b_halloffame(c):
    # all crystal with a boomerang (the Outback Bowl's trophy; the Hall of Fame Bowl became the Outback Bowl)
    ball(c,16,6,7,4,'glass','steel')
    c.poly([(8,14),(16,11),(24,14),(22,16),(16,14),(10,16)],'glass')
    c.poly([(13,17),(19,17),(18,27),(14,27)],'glass')
    c.rect(10,27,21,29,'glass'); base(c,top=30)
def b_freedom(c):
    c.poly([(2,6),(9,9),(14,8),(16,4),(18,8),(23,9),(30,6),(25,13),(18,14),(16,16),(14,14),(7,13)],'gold')
    c.px(16,5,'cream')
    ball(c,16,19,6,4,'silver')
    c.rect(15,23,16,25,'gold'); c.rect(11,26,20,28,'gold'); base(c,top=30)
def b_alamo(c):
    c.poly([(5,28),(5,14),(9,12),(12,8),(14,6),(16,5),(18,6),(20,8),(23,12),(27,14),(27,28)],'stone')
    c.ell(16,24,3,5,'black',ymin=19); c.rect(13,24,19,28,'black')
    c.rect(9,16,10,19,'black'); c.rect(22,16,23,19,'black')
    ball(c,16,12,3,2,'brown')
    base(c,top=29,w=12)
def b_copper(c):
    # blown glass on copper (Tucson's later bowl trophy, the Arizona Bowl: blown glass and copper)
    c.ell(16,10,7,9,'glass'); c.ell(14,8,2,4,'sea'); c.ell(18,13,2,3,'sun2')
    c.rect(11,18,20,20,'copper'); c.poly([(12,21),(19,21),(17,26),(14,26)],'copper')
    c.rect(10,27,21,28,'copper'); base(c,top=30)
def b_aloha(c):
    ball(c,16,8,8,5,'silver')
    for i,x in enumerate(range(7,26,2)): c.px(x,15+(1 if 9<x<23 else 0),'flower' if i%2 else 'sun1')
    c.rect(14,16,17,25,'koa')
    c.ell(16,20,2,2,'flower')
    c.rect(10,26,21,28,'koa'); base(c,top=30)
def b_carquest(c):
    # the bowl lives on as the Pop-Tarts Bowl, whose trophy is a toaster shaped like a silver football
    c.ell(16,12,11,8,'silver')
    c.rect(11,5,13,9,'black'); c.rect(18,5,20,9,'black')
    c.rect(11,3,13,5,'peach'); c.rect(18,3,20,5,'peach')
    for x in (12,16,20): c.px(x,13,'cream')
    c.rect(26,12,27,14,'black')
    c.rect(13,20,18,24,'silver'); c.rect(10,25,21,27,'silver'); base(c,top=29)
def b_liberty(c):
    c.rect(5,3,26,5,'wood')                       # the yoke
    c.poly([(5,6),(7,6),(4,28),(2,28)],'wood'); c.poly([(25,6),(27,6),(30,28),(28,28)],'wood')  # legs
    for y in (12,18,24): c.px(4 if y<20 else 3,y,'gold'); c.px(27 if y<20 else 28,y,'gold')
    c.rect(15,6,16,7,'bbronze')
    c.poly([(11,8),(21,8),(22,18),(25,22),(7,22),(10,18)],'bbronze')
    c.rect(7,22,24,23,'bbronze')
    for i,y in enumerate(range(12,23)): c.px(17+(i%3==1),y,'cream')   # the crack
    base(c,top=29,w=14)
def b_independence(c):
    # eagle with the 13-star flag on top of intertwined metal
    c.rect(19,1,19,10,'steel'); c.rect(20,1,27,5,'red')
    for y in (2,4): c.rect(20,y,27,y,'cream')
    c.rect(20,1,22,3,'sea')
    c.poly([(6,8),(11,10),(14,8),(16,6),(18,8),(21,10),(19,13),(16,15),(13,13)],'gold'); c.px(16,7,'cream')
    for y in range(15,27):
        o=round(2.5*math.sin(y/1.8)); c.px(16+o,y,'silver'); c.px(15-o,y,'steel')
    c.rect(10,27,21,28,'silver'); base(c,top=30)
def b_lasvegas(c):
    c.ell(16,7,8,5,'cream')
    for (x,y) in ((10,5),(13,9),(17,4),(21,8),(15,6),(19,10),(12,7)): c.px(x,y,'glass')
    for x in (14,16,18): c.px(x,6,'gold')
    c.poly([(9,11),(11,11),(15,26),(13,26)],'gold'); c.poly([(23,11),(21,11),(17,26),(19,26)],'gold'); c.rect(15,12,16,26,'gold')
    c.ell(16,27,7,2,'gold')
    base(c,top=30)

SPRITES={
 'national':lambda c:cup(c,'gold',True),'conference':lambda c:cup(c,'silver',False),
 # Every award statue is bronze, so none looks better than another (user, 2026-11-28).
 'heisman':heisman_tr,'maxwell':lambda c:statue(c,'maxwell','bronze'),'camp':lambda c:statue(c,'camp','bronze'),
 'qb':lambda c:statue(c,'qb','bronze'),'rb':lambda c:statue(c,'rb','bronze'),'wr':lambda c:statue(c,'wr','bronze'),'te':lambda c:statue(c,'te','bronze'),
 'ol':lambda c:statue(c,'ol','bronze'),'def':lambda c:statue(c,'def','bronze'),'def2':lambda c:statue(c,'def2','bronze'),'lb':lambda c:statue(c,'lb','bronze'),
 'db':lambda c:statue(c,'db','bronze'),'k':lambda c:statue(c,'k','bronze'),'p':lambda c:statue(c,'p','bronze'),
 'coach':whistle,'coach2':clipboard,'bell':bell,'jug':jug,'axe':axe,'bucket':bucket,'flag':flag,
 **{'bowl-'+k:globals()['b_'+k] for k in ('rose','sugar','orange','cotton','fiesta','peach','cfp','citrus','holiday','gator','sun','halloffame','freedom','alamo','copper','aloha','carquest','liberty','independence','lasvegas')},
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
