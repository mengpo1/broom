#!/usr/bin/env python3
"""Assembles the comparison of the three mirror positions captured by compare-mirror-variants.mjs:
one column per variant, the cockpit view above, the front view (enlarged on the car) below, the
chase view last. Also measures, on the pictures, where the mirrors moved between the first and the
last variant, to check that the two sides moved by the same amount (symmetry)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
report = json.load(open(os.path.join(out, 'mirror-variants.json')))
F = os.path.join(out, 'frames')
W, H = report['width'], report['height']
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except OSError:
    font = small = ImageFont.load_default()

def load(variant, cam):
    return Image.open(os.path.join(F, f"mirror-{variant['id']}-{cam}.png")).convert('RGB')

cell_w, cell_h, band = 640, 360, 54
front_box = (360, 150, 1000, 510)            # the car seen from the front, enlarged
chase_box = (380, 428, 900, 720)             # the car seen from behind
sheet = Image.new('RGB', (3 * cell_w, band + 3 * cell_h + 2 * 24), (244, 239, 226))
d = ImageDraw.Draw(sheet)
for c, v in enumerate(report['variants']):
    x = c * cell_w
    d.text((x + 10, 6), f"{v['id']} - {v['label']}", fill=(22, 22, 31), font=font)
    d.text((x + 10, 31), f"centre du retroviseur a {v['y'] * 100:.1f} cm de l'axe ({(v['y'] - report['variants'][0]['y']) * 100:+.1f} cm de chaque cote)", fill=(22, 22, 31), font=small)
    sheet.paste(load(v, 'COCKPIT').resize((cell_w, cell_h), Image.LANCZOS), (x, band))
    sheet.paste(load(v, 'FRONT').crop(front_box).resize((cell_w, cell_h), Image.LANCZOS), (x, band + cell_h + 24))
    sheet.paste(load(v, 'CHASE').crop(chase_box).resize((cell_w, cell_h), Image.LANCZOS), (x, band + 2 * cell_h + 48))
    if c: d.line((x, 0, x, sheet.height), fill=(22, 22, 31), width=2)
for r, name in enumerate(('vue cockpit', 'vue de face (agrandie)', 'vue arriere (agrandie)')):
    if r: d.text((10, band + r * (cell_h + 24) - 21), name, fill=(22, 22, 31), font=small)
sheet.save(os.path.join(out, 'mirror-variants.jpg'), quality=90)

# Symmetry, measured on the cockpit pictures: between the first and the last variant the pictures differ
# where the mirrors are (old and new places together). In the band of the picture that holds the mirrors,
# the columns that changed on the left must be the reflection of those that changed on the right.
a = np.asarray(load(report['variants'][0], 'COCKPIT'), dtype=np.int16)
b = np.asarray(load(report['variants'][-1], 'COCKPIT'), dtype=np.int16)
band_top = int(H * 0.79)
changed = (np.abs(a - b).max(axis=2) > 40)[band_top:, :]
columns = changed.sum(axis=0) > 3
half = W // 2
def span(mask, offset):
    xs = np.nonzero(mask)[0]
    return None if len(xs) == 0 else [int(xs.min()) + offset, int(xs.max()) + offset]
left, right = span(columns[:half], 0), span(columns[half:], half)
entry = {'rows': [band_top, H - 1], 'left_columns': left, 'right_columns': right}
if left and right:
    entry['right_columns_reflected'] = [W - 1 - right[1], W - 1 - right[0]]
    entry['largest_difference_px'] = int(max(abs(p - q) for p, q in zip(left, entry['right_columns_reflected'])))
report['cockpit_symmetry_first_to_last'] = entry
report.pop('moved_area_first_to_last', None)
json.dump(report, open(os.path.join(out, 'mirror-variants.json'), 'w'), indent=1)
print(f"cockpit: columns that changed on the left {left}, on the right {right} (reflected: {entry.get('right_columns_reflected')}), largest difference {entry.get('largest_difference_px')} px")
print('sheet written:', os.path.join(out, 'mirror-variants.jpg'))
