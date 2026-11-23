#!/usr/bin/env python3
"""Assembles the comparison of the mirror mounts captured by compare-mirror-proposals.mjs: one column
per mount (the mount of the game first), and from top to bottom the cockpit view, the lower left
corner of the cockpit enlarged, the same corner with the steering at full lock, the front view
enlarged on the car and the three-quarter rear view enlarged on the cockpit.
Also measures on the pictures: how far each mirror moved toward the centre of the picture, whether
the two sides moved alike (symmetry), and how much room is left between the mirror and the driver's
glove with the steering straight (at full lock the arm is to be looked at on the sheet)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
report = json.load(open(os.path.join(out, 'mirror-proposals.json')))
F = os.path.join(out, 'frames')
W, H = report['width'], report['height']
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 19)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except OSError:
    font = small = ImageFont.load_default()

def load(variant, view):
    return Image.open(os.path.join(F, f"mirror-{variant['id']}-{view}.png")).convert('RGB')

variants = report['variants']
base = next(v for v in variants if v['inTheGame'])
INK, PAPER = (22, 22, 31), (244, 239, 226)
cell_w, cell_h, band, gap = 512, 288, 58, 22
corner_box = (0, 468, 448, 720)              # lower left corner of the cockpit view (the left mirror, the wheel, the left hand)
front_box = (384, 168, 976, 501)             # the car seen from the front
chase_box = (480, 455, 800, 635)             # the car seen from three quarters behind, enlarged twice on the cockpit and its mirror
lock_box = (64, 432, 576, 720)               # the same corner as far as the steering wheel, at the size of the picture
ROWS = [('vue cockpit', 'COCKPIT', None), ('coin inférieur gauche du cockpit (agrandi)', 'COCKPIT', corner_box),
        ('volant braqué à fond à gauche : le bras passe au plus près du rétroviseur gauche', 'LOCK', lock_box), ('vue de face (agrandie)', 'FRONT', front_box),
        ('vue de trois quarts arrière (agrandie deux fois) - pointillé : bord du rétroviseur actuel', 'CHASE', chase_box)]
sheet = Image.new('RGB', (len(variants) * cell_w, band + len(ROWS) * (cell_h + gap)), PAPER)
d = ImageDraw.Draw(sheet)

def glass_left_edge(img):
    """Left edge (x) of the glass of the left mirror: the sky it reflects, in the lower left quarter of the cockpit view."""
    a = np.asarray(img, dtype=np.int16)[int(H * 0.6):, :W // 2]
    sky = (a[:, :, 2] > 200) & (a[:, :, 1] > 200) & (a[:, :, 0] > 180) & (a[:, :, 0] < 235) & (a[:, :, 2] - a[:, :, 0] > 15)
    cols = np.nonzero(sky.sum(axis=0) > 6)[0]
    # the glass is the first run of such columns from the left (the windscreen further right is not part of it)
    end = cols[0]
    for c in cols:
        if c - end > 3: break
        end = c
    return int(cols[0]), int(end)

def glove_left_edge(img):
    """Leftmost saturated red column low in the left half of the picture, right of the mirror: the driver's left glove,
    or the red band of the bodywork just behind it."""
    a = np.asarray(img, dtype=np.int16)[int(H * 0.6):, :W // 2]
    red = (a[:, :, 0] > 170) & (a[:, :, 1] < 70) & (a[:, :, 2] < 80)
    cols = np.nonzero(red.sum(axis=0) > 6)[0]
    return int(cols[0]) if len(cols) else None

guide_x = None
for c, v in enumerate(variants):
    x = c * cell_w
    title = f"{v['id'].upper()} - {'position actuelle (dans le jeu)' if v['inTheGame'] else 'proposition'}"
    d.text((x + 8, 5), title, fill=INK, font=font)
    d.text((x + 8, 30), f"centre à {v['y'] * 100:.1f} cm de l'axe ({(v['y'] - base['y']) * 100:+.1f} cm de chaque côté)", fill=INK, font=small)
    d.text((x + 8, 44), f"boîtier {v['width'] * 100:.0f} x {v['height'] * 100:.1f} cm, centre à {v['z'] * 100:.1f} cm du sol", fill=INK, font=small)
    for r, (label, view, box) in enumerate(ROWS):
        y = band + r * (cell_h + gap)
        img = load(v, view)
        if box: img = img.crop(box)
        sheet.paste(img.resize((cell_w, cell_h), Image.LANCZOS), (x, y + gap))
        if c == 0: d.text((8, y + 3), label, fill=INK, font=small)
        if view == 'CHASE':
            if guide_x is None:
                # outer edge of the mirror glass of the mount of the game in that view: rightmost light blue column near the cockpit
                a = np.asarray(load(base, 'CHASE'), dtype=np.int16)[520:570, 600:700]
                blue = (a[:, :, 2] > 190) & (a[:, :, 0] < 190) & (a[:, :, 2] - a[:, :, 0] > 40)
                cols = np.nonzero(blue.sum(axis=0) > 2)[0]
                guide_x = 600 + int(cols.max()) + 1 if len(cols) else 652
            gx = x + round((guide_x - box[0]) * cell_w / (box[2] - box[0]))
            for y0 in range(y + gap + 50, y + gap + 200, 12): d.line((gx, y0, gx, y0 + 6), fill=(255, 214, 10), width=2)
    if c: d.line((x, 0, x, sheet.height), fill=INK, width=2)
sheet.save(os.path.join(out, 'mirror-proposals.jpg'), quality=90)
# the cockpit view of every mount at full size, to be looked at one by one
for v in variants: load(v, 'COCKPIT').save(os.path.join(out, f"mirror-proposal-{v['id']}-cockpit.jpg"), quality=92)

# ---- measurements on the cockpit pictures
ref = np.asarray(load(base, 'COCKPIT'), dtype=np.int16)
band_top = int(H * 0.72)
base_edge = glass_left_edge(load(base, 'COCKPIT'))[0]
for v in variants:
    cockpit = load(v, 'COCKPIT')
    g0, g1 = glass_left_edge(cockpit)
    entry = {'glass_columns_left_mirror': [g0, g1], 'moved_toward_the_centre_px': g0 - base_edge, 'moved_share_of_picture_width': round((g0 - base_edge) / W, 4)}
    entry['centre_moved_toward_the_centre_px'] = round((g0 + g1) / 2 - sum(glass_left_edge(load(base, 'COCKPIT'))) / 2, 1)
    glove = glove_left_edge(cockpit)
    entry['room_between_glass_and_the_red_of_glove_or_livery_px'] = None if glove is None else glove - g1
    if not v['inTheGame']:
        # symmetry: the columns that differ from the mount of the game on the left must be the reflection of those on the right
        changed = (np.abs(np.asarray(cockpit, dtype=np.int16) - ref).max(axis=2) > 40)[band_top:, :]
        columns = changed.sum(axis=0) > 3
        half = W // 2
        xs_l, xs_r = np.nonzero(columns[:half])[0], np.nonzero(columns[half:])[0] + half
        if len(xs_l) and len(xs_r):
            left, right = [int(xs_l.min()), int(xs_l.max())], [int(xs_r.min()), int(xs_r.max())]
            reflected = [W - 1 - right[1], W - 1 - right[0]]
            entry['symmetry'] = {'left_columns': left, 'right_columns_reflected': reflected, 'largest_difference_px': int(max(abs(p - q) for p, q in zip(left, reflected)))}
    v['measured'] = entry
    print(v['id'], entry)
json.dump(report, open(os.path.join(out, 'mirror-proposals.json'), 'w'), indent=1)
print('sheet written:', os.path.join(out, 'mirror-proposals.jpg'))
