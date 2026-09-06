"""Static geometry, UV ownership, and animation-target checks for the cat."""
import json, math
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
g=json.loads((root/'resource_pack/models/entity/kittie_army_cat.geo.json').read_text())['minecraft:geometry'][0]
im=Image.open(root/'resource_pack/textures/entity/kittie_army_cat.png').convert('RGBA')
assert im.size==(g['description']['texture_width'],g['description']['texture_height'])==(256,256)
bones={b['name']:b for b in g['bones']}
assert len(bones)==len(g['bones'])==8
assert set(bones)=={'head','body','frontLegL','frontLegR','backLegL','backLegR','tail1','tail2'}
owned=set(); count=0
for b in bones.values():
    assert not b.get('bind_pose_rotation'), 'Unsupported legacy bind rotation'
    parent=b.get('parent'); seen={b['name']}
    while parent:
        assert parent in bones and parent not in seen, 'Invalid parent chain'
        seen.add(parent); parent=bones[parent].get('parent')
    for c in b['cubes']:
        count+=1
        assert all(math.isfinite(v) and v>0 for v in c['size'])
        assert all(math.isfinite(v) for k in ('origin','pivot','rotation') for v in c.get(k,[]))
        assert set(c['uv'])=={'north','south','east','west','up','down'}
        for f in c['uv'].values():
            x,y=f['uv']; w,h=f['uv_size']
            assert all(isinstance(v,int) for v in (x,y,w,h))
            assert x>=0 and y>=0 and w>0 and h>0 and x+w<=im.width and y+h<=im.height
            pixels={(xx,yy) for yy in range(y,y+h) for xx in range(x,x+w)}
            assert not pixels.intersection(owned), 'Unintended UV overlap'
            owned.update(pixels)
            assert all(im.getpixel(p)[3]==255 for p in pixels), 'Transparent assigned face'
for leg in ('frontLegL','frontLegR','backLegL','backLegR'):
    assert min(c['origin'][1] for c in bones[leg]['cubes'])==0, 'Paw must touch neutral ground'
animations=json.loads((root/'resource_pack/animations/kittie_army.animation.json').read_text())['animations']
for a in animations.values():assert set(a['bones'])<=set(bones), 'Unknown animation target'
print(f'Cat static checks passed: {count} cubes, 8 bones, {count*6} disjoint opaque face islands, planted neutral paws, valid animation targets.')
