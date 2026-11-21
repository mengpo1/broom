#!/usr/bin/env python3
"""Assemble the before/after sheets from the frames captured by compare-wheels-mirrors.mjs."""
import json, os, sys
from PIL import Image, ImageDraw
out = sys.argv[1]
m = json.load(open(os.path.join(out, 'manifest.json')))
F = os.path.join(out, 'frames')
# left front tyre as seen from the cockpit (1280x720 capture)
box = (40, 420, 400, 720)
tw, th = box[2] - box[0], box[3] - box[1]
rows = []
for kmh in m['speeds']:
    for label in ('before', 'after'):
        rows.append((kmh, label))
sheet = Image.new('RGB', (150 + m['frames'] * tw, len(rows) * th), (244, 239, 226))
d = ImageDraw.Draw(sheet)
for r, (kmh, label) in enumerate(rows):
    d.text((8, r * th + th // 2 - 14), f'{kmh} km/h', fill=(22, 22, 31))
    d.text((8, r * th + th // 2 + 2), 'AVANT' if label == 'before' else 'APRES', fill=(213, 48, 42) if label == 'after' else (22, 22, 31))
    for f in range(m['frames']):
        im = Image.open(os.path.join(F, f'{label}-wheel-{kmh}-{f}.png')).convert('RGB').crop(box)
        sheet.paste(im, (150 + f * tw, r * th))
    d.line((0, r * th, sheet.width, r * th), fill=(22, 22, 31), width=2 if r % 2 == 0 else 1)
sheet.save(os.path.join(out, 'wheels-before-after.jpg'), quality=90)
cams = ('COCKPIT', 'CHASE', 'FRONT')
w, h = 640, 360
ms = Image.new('RGB', (len(cams) * w, 2 * h + 2 * 22), (244, 239, 226))
d = ImageDraw.Draw(ms)
for r, label in enumerate(('before', 'after')):
    d.text((8, r * (h + 22) + 4), ('AVANT' if label == 'before' else 'APRES') + '  -  cockpit / poursuite / face', fill=(22, 22, 31))
    for c, cam in enumerate(cams):
        im = Image.open(os.path.join(F, f'{label}-mirror-{cam}.png')).convert('RGB').resize((w, h), Image.LANCZOS)
        ms.paste(im, (c * w, r * (h + 22) + 22))
ms.save(os.path.join(out, 'mirrors-before-after.jpg'), quality=90)
print('sheets written in', out)
