"""Build an offline reference reconstruction with explicit, nonoverlapping face UVs.

This is editable Bedrock source generation, not a Blockbench project rewrite.
Every run requires a fresh evidence directory; never modifies a previous candidate.
"""
import json, math, shutil, sys, hashlib
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.forge/iterations' / (sys.argv[1] if len(sys.argv)>1 else '016-reference-reconstruction')
OUT.mkdir(parents=True, exist_ok=False)
(OUT/'candidate').mkdir()
(OUT/'control').mkdir()
for src in ['models/entity/kittie_army_cat.geo.json','textures/entity/kittie_army_cat.png']:
    shutil.copy2(ROOT/'resource_pack'/src, OUT/'control'/Path(src).name)
atlas=Image.new('RGBA',(256,256),(0,0,0,0))
cursor=[1,1,0]
ownership=[]
bones=[]
DARK=(34,31,37); PLUM=(42,35,44); CREAM=(235,212,177); PINK=(225,117,122)

def bone(name,pivot,parent=None):
    b={'name':name,'pivot':pivot,'cubes':[]}
    if parent:b['parent']=parent
    bones.append(b)
    return b

def face_image(w,h,material,name,face):
    color={'dark':DARK,'cream':CREAM,'pink':PINK,'nose':(229,112,120),'mouth':(151,60,69)}[material]
    shade={'north':0,'south':-3,'east':-5,'west':-3,'up':6,'down':-10}[face]
    color=tuple(max(0,min(255,v+shade)) for v in color)
    im=Image.new('RGBA',(w,h),color+(255,)); d=ImageDraw.Draw(im)
    # Broad, low contrast pixel clusters; no per-pixel random noise.
    if material in ('dark','cream'):
        for yy in range(0,h,4):
            for xx in range(0,w,4):
                code=(xx//4*7+yy//4*11+len(name)*3)%13
                if code in (1,4,9):
                    delta=4 if code==1 else -3
                    c=tuple(max(0,min(255,v+delta)) for v in color)+(255,)
                    d.rectangle((xx,yy,min(w-1,xx+3),min(h-1,yy+3)),fill=c)
    if name=='skull' and face=='north':
        # 32x24 face; geometry supplies cheek and chin volume below it.
        d.rectangle((15,3,16,6),fill=(246,225,189))
        d.rectangle((13,7,18,10),fill=CREAM)
        d.rectangle((12,11,19,23),fill=CREAM)
        for x in (3,21):
            d.rectangle((x-1,8,x+8,19),fill=(21,16,23))
            d.rectangle((x,10,x+7,19),fill=(123,20,81))
            d.rectangle((x,11,x+7,17),fill=(222,40,151))
            d.rectangle((x+1,12,x+6,19),fill=(242,102,184))
            d.rectangle((x+3,13,x+5,16),fill=(88,21,67))
            d.rectangle((x+4,12,x+4,17),fill=(88,21,67))
            d.rectangle((x+1,11,x+3,13),fill=(255,237,245))
            d.rectangle((x+5,17,x+6,19),fill=(255,226,239))
        d.rectangle((1,21,30,23),fill=CREAM)
    if name.startswith('ear_') and face=='north':
        # The outermost border remains black, and the staircase is structural.
        lo=2
        hi=w-3
        if hi>=lo:
            d.rectangle((lo,0,hi,h-1),fill=PINK)
            if h>2:d.rectangle((lo,h//2,hi,h-1),fill=(239,139,141))
            if name.endswith('_0'):d.rectangle((0,h-1,w-1,h-1),fill=DARK)
    if name.startswith('paw') and face in ('south','down'):
        if face=='down':
            d.rectangle((w//3,h//3,2*w//3,2*h//3),fill=PINK)
            for x in (1,w//2,w-3):d.rectangle((x,1,x+1,2),fill=(221,111,119))
        else:
            d.rectangle((w//2-1,h-4,w//2+1,h-2),fill=PINK)
    return im

def cube(b,name,origin,size,material='dark',rotation=None,pivot=None):
    c={'origin':origin,'size':size,'uv':{}}
    if rotation is not None:c.update(rotation=rotation,pivot=pivot or origin)
    for f,dims in [('north',(size[0],size[1])),('south',(size[0],size[1])),('east',(size[2],size[1])),('west',(size[2],size[1])),('up',(size[0],size[2])),('down',(size[0],size[2]))]:
        w,h=[max(1,round(v*4)) for v in dims]
        if cursor[0]+w+1>256:cursor[:]=[1,cursor[1]+cursor[2]+1,0]
        x,y=cursor[:2]
        assert y+h<256, 'Atlas overflow'
        atlas.paste(face_image(w,h,material,name,f),(x,y))
        c['uv'][f]={'uv':[x,y],'uv_size':[w,h]}
        ownership.append({'cube':name,'bone':b['name'],'face':f,'rect':[x,y,w,h]})
        cursor[0]+=w+1;cursor[2]=max(cursor[2],h)
    b['cubes'].append(c)

body=bone('body',[0,6,0])
cube(body,'torso',[-2.8,3.8,-3.8],[5.6,4.5,8])
head=bone('head',[0,8,-3.4],'body')
head['locators']={'lead':[0,8,-5]}
cube(head,'skull',[-4,8,-6],[8,6,5])
cube(head,'cheek_r',[-3.8,8,-6.65],[3.2,1.35,0.8],'cream')
cube(head,'cheek_l',[0.6,8,-6.65],[3.2,1.35,0.8],'cream')
cube(head,'muzzle',[-1.75,7.9,-6.95],[3.5,1.3,1.1],'cream')
cube(head,'chin',[-1.2,7.7,-6.6],[2.4,.5,.7],'cream')
cube(head,'nose',[-.6,8.85,-7.12],[1.2,.5,.25],'nose')
cube(head,'mouth',[-.22,8.4,-7.1],[.44,.5,.15],'mouth')
for side in ('r','l'):
    for i in range(5):
        width=2.75-i*.5
        x=-4 if side=='r' else 4-width
        cube(head,f'ear_{side}_{i}',[x,14+i*.6,-3.6],[width,.6,1.1])
    x=-4 if side=='r' else 1
    cube(head,f'brow_{side}',[x,11.8,-6.12],[3,.5,.25])
# An actual tapered bib, rather than the old belly strip.
for i,(w,h) in enumerate([(3.6,.9),(2.7,.9),(1.8,.9),(.9,.8)]):
    cube(body,f'bib_{i}',[-w/2,6.65-i*.8,-4.02],[w,h,.3],'cream')
for side,x in [('L',1.8),('R',-1.8)]:
    for kind,z in [('front',-3.8),('back',2.6)]:
        leg=bone(f'{kind}Leg{side}',[x,6,z+1],'body')
        cube(leg,f'{kind}_{side}_leg',[x-1.1,1.7,z],[2.2,4.5,2.4])
        cube(leg,f'paw_{kind}_{side}',[x-1.2,0,z-.2],[2.4,1.8,2.7],'cream')
tail1=bone('tail1',[0,6.6,3.8],'body')
cube(tail1,'tail_lower',[-.65,6.2,3.5],[1.3,4.7,1.3],rotation=[-22,0,0],pivot=[0,6.6,3.8])
tail2=bone('tail2',[0,10.3,5.4],'tail1')
cube(tail2,'tail_upper',[-.6,10.2,4.9],[1.2,2.45,1.2],rotation=[10,0,0],pivot=[0,10.3,5.4])
cube(tail2,'tail_tip',[-.6,12.5,4.9],[1.2,1.3,1.2],'cream',rotation=[10,0,0],pivot=[0,10.3,5.4])
geo={'format_version':'1.12.0','minecraft:geometry':[{'description':{'identifier':'geometry.kittie_army.cat','texture_width':256,'texture_height':256,'visible_bounds_width':2.5,'visible_bounds_height':2,'visible_bounds_offset':[0,1,0]},'bones':bones}]}
(OUT/'candidate/kittie_army_cat.geo.json').write_text(json.dumps(geo,indent=2)+'\n')
atlas.save(OUT/'candidate/kittie_army_cat.png')
(OUT/'uv-ownership.json').write_text(json.dumps(ownership,indent=2)+'\n')
contract={'approved':True,'approval':'User requested closest possible match to the existing generated sheet, 2026-09-05.','reference':'source_art/references/kittie_army_cat_reference_sheet_imagegen.png','priorConstraintsSuperseded':['vanilla body proportions','four head cubes','64x32 atlas'],'priorities':['square oversized head','tall stair-stepped pink ears','large pink eyes with pupils and glints','cream blaze and short broad muzzle','compact body and sturdy cream paws','upright cream-tipped tail'],'preserved':['entity identifier','bone names and hierarchy','behavior and animation wiring'],'runtimeProof':False,'workflow':'Offline editable Bedrock geometry; Forge bridge unavailable; actual exporter-compatible assets reviewed with seven-view Minecraft Entity Viewer evidence.'}
(OUT/'design-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
shutil.copy2(__file__,OUT/'build_reference_reconstruction.py')
print(OUT)
