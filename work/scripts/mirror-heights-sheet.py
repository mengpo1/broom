#!/usr/bin/env python3
"""Assembles the comparison of the three mirror heights captured by compare-mirror-heights.mjs:
one column per variant, the cockpit view above, the front view (enlarged on the car) below, the
three-quarter rear view last. Also measures, on the cockpit pictures, by how much the mirrors moved
and checks that the two sides moved alike (symmetry) and that nothing moved sideways."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
report = json.load(open(os.path.join(out, 'mirror-heights.json')))
F = os.path.join(out, 'frames')
W, H = report['width'], report['height']
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except OSError:
    font = small = ImageFont.load_default()

def load(variant, cam):
    return Image.open(os.path.join(F, f"mirror-height-{variant['id']}-{cam}.png")).convert('RGB')

cell_w, cell_h, band = 640, 360, 54
front_box = (360, 150, 1000, 510)            # the car seen from the front, enlarged
chase_box = (480, 455, 800, 635)             # the car seen from three quarters behind, enlarged twice on the cockpit and its mirror
variants = report['variants']
sheet = Image.new('RGB', (3 * cell_w, band + 3 * cell_h + 2 * 24), (244, 239, 226))
d = ImageDraw.Draw(sheet)

# Measured on the cockpit pictures: by how many pixels each mirror moved up compared with variant A, found by sliding
# the picture of the variant down until its mirror lies on the mirror of A (the smallest difference inside the zone of
# the mirror), for the left mirror and for the right one separately; and the same search sideways, which must give 0.
LEFT_ZONE = (60, 520, 300, 716)               # x0, y0, x1, y1: the left mirror in all three variants, 1280 x 720
RIGHT_ZONE = (W - LEFT_ZONE[2], LEFT_ZONE[1], W - LEFT_ZONE[0], LEFT_ZONE[3])
base = np.asarray(load(variants[0], 'COCKPIT'), dtype=np.int16)

def moved(picture, zone):
    x0, y0, x1, y1 = zone
    cur = np.asarray(picture, dtype=np.int16)
    # the pixels that belong to the mirror of A: those that differ from the last variant inside the zone, lower part
    last = np.asarray(load(variants[-1], 'COCKPIT'), dtype=np.int16)
    best = (1e9, 0, 0)
    for dy in range(0, 90):
        for dx in (-2, -1, 0, 1, 2):
            a = base[y0 + 90:y1, x0 + 4:x1 - 4]
            b = cur[y0 + 90 - dy:y1 - dy, x0 + 4 + dx:x1 - 4 + dx]
            # only where A shows its mirror (it differs there from the highest variant): the housing, glass and arm
            mask = np.abs(base[y0 + 90:y1, x0 + 4:x1 - 4] - last[y0 + 90:y1, x0 + 4:x1 - 4]).max(axis=2) > 30
            if mask.sum() < 200: continue
            err = float(np.abs(a - b).max(axis=2)[mask].mean())
            if err < best[0] - 1e-9: best = (err, dy, dx)
    return {'up': best[1], 'sideways': best[2], 'residual': round(best[0], 1)}

tops = []
for v in variants:
    pic = load(v, 'COCKPIT')
    v['measuredInTheCockpitView'] = {'leftMirror': moved(pic, LEFT_ZONE), 'rightMirror': moved(pic, RIGHT_ZONE), 'expectedUpPx': v.get('expectedRisePx')}
    v['raisedOnThePicturePx'] = v['measuredInTheCockpitView']['leftMirror']['up']

for c, v in enumerate(variants):
    x = c * cell_w
    title = f"{v['id']} - {v['label']}" + (' (dans le jeu)' if v['isDefaultOfTheGame'] else '')
    d.text((x + 10, 6), title, fill=(22, 22, 31), font=font)
    moved = v['raisedOnThePicturePx']
    sub = f"boîtier à {v['z'] * 100:.1f} cm du sol ({v['raisedByCm']:+.1f} cm)"
    if moved: sub += f" ; {moved} px plus haut dans la vue cockpit"
    sub += f" ; option {v['option']}"
    d.text((x + 10, 31), sub, fill=(22, 22, 31), font=small)
    sheet.paste(load(v, 'COCKPIT').resize((cell_w, cell_h), Image.LANCZOS), (x, band))
    sheet.paste(load(v, 'FRONT').crop(front_box).resize((cell_w, cell_h), Image.LANCZOS), (x, band + cell_h + 24))
    sheet.paste(load(v, 'CHASE').crop(chase_box).resize((cell_w, cell_h), Image.LANCZOS), (x, band + 2 * cell_h + 48))
    if c: d.line((x, 0, x, sheet.height), fill=(22, 22, 31), width=2)
for r, name in enumerate(('vue cockpit', 'vue de face (agrandie)', 'vue de trois quarts arrière (agrandie deux fois)')):
    if r: d.text((10, band + r * (cell_h + 24) - 21), name, fill=(22, 22, 31), font=small)
sheet.save(os.path.join(out, 'mirror-heights.jpg'), quality=90)
json.dump(report, open(os.path.join(out, 'mirror-heights.json'), 'w'), indent=1)
for v in variants:
    m = v['measuredInTheCockpitView']
    print(f"{v['id']}: housing at {v['z']} m; in the cockpit view the left mirror is {m['leftMirror']['up']} px higher than in A (sideways {m['leftMirror']['sideways']} px), the right one {m['rightMirror']['up']} px (sideways {m['rightMirror']['sideways']} px); expected {m['expectedUpPx']} px")
print('sheet written:', os.path.join(out, 'mirror-heights.jpg'))
