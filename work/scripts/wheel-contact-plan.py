#!/usr/bin/env python3
"""The contact between the wheels seen from above, drawn from the telemetry of a recorded sequence
(work/renders/collisions/HOPslow.json: the positions of the two cars at every simulation step).
Each car is its body (the box of the collision model) and its four tyres (wheel-contacts.js); the
car ahead stays in the middle of the picture, heading up. The picture says, step by step: the gap
between the two bodies, the width of tyre in contact, and whether the car is on the ground or in the air.

python3 work/scripts/wheel-contact-plan.py work/renders/collisions/HOPslow.json work/renders/collisions/wheel-contact-plan.mp4
With a third argument (a video of the same sequence), the two are put side by side in the output instead."""
import json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
beside = sys.argv[3] if len(sys.argv) > 3 else None
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# the dimensions of the collision model, read from the sources of the game
geometry = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import { WHEEL_LAYOUT } from './src/physics/wheel-contacts.js'; import { BASE_CAR_SPEC } from './src/vehicles/car-spec.js';"
    "console.log(JSON.stringify({ wheels: WHEEL_LAYOUT, halfLength: BASE_CAR_SPEC.collisionHalfLength, halfWidth: BASE_CAR_SPEC.collisionHalfWidth }))"], cwd=root))
W_, HL, HW = geometry['wheels'], geometry['halfLength'], geometry['halfWidth']
data = json.load(open(src))
frames, fps = data['frames'], data.get('fps', 30)

WIDTH, HEIGHT, SCALE = 480, 540, 34.0
CX, CY = WIDTH / 2 + 40, HEIGHT / 2 + 40
try:
    bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 19)
except OSError:
    bold = font = big = ImageFont.load_default()
INK, PAPER, ROAD = (22, 22, 31), (244, 239, 226), (98, 100, 110)
BLUE, RED, YELLOW = (40, 70, 160), (200, 30, 40), (255, 214, 10)


def rect(cx, cz, heading, hl, hw):
    f, r = (math.cos(heading), math.sin(heading)), (-math.sin(heading), math.cos(heading))
    return [(cx + f[0] * hl * i + r[0] * hw * j, cz + f[1] * hl * i + r[1] * hw * j) for i, j in ((1, 1), (1, -1), (-1, -1), (-1, 1))]


def tyres(car):
    x, z, h = car
    f, r = (math.cos(h), math.sin(h)), (-math.sin(h), math.cos(h))
    out = {}
    for axle, ax, track, tyre in (('front', W_['frontAxleX'], W_['frontTrack'], W_['frontTyre']), ('rear', W_['rearAxleX'], W_['rearTrack'], W_['rearTyre'])):
        for side in (1, -1):
            out[(axle, side)] = rect(x + f[0] * ax + r[0] * side * track, z + f[1] * ax + r[1] * side * track, h, tyre['radius'], tyre['width'] / 2)
    return out


def overlap(p, q):
    """Depth by which two convex polygons overlap (0 when apart)."""
    best = 1e9
    for poly in (p, q):
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            nx, nz = -(b[1] - a[1]), b[0] - a[0]
            l = math.hypot(nx, nz)
            pa = [(c[0] * nx + c[1] * nz) / l for c in p]
            pb = [(c[0] * nx + c[1] * nz) / l for c in q]
            o = min(max(pa), max(pb)) - max(min(pa), min(pb))
            if o <= 0: return 0.0
            best = min(best, o)
    return best


def view(points, lead):
    """World points to the picture: the car ahead in the middle, heading up."""
    x0, z0, h0 = lead
    f, r = (math.cos(h0), math.sin(h0)), (-math.sin(h0), math.cos(h0))
    return [(CX + ((px - x0) * r[0] + (pz - z0) * r[1]) * SCALE, CY - ((px - x0) * f[0] + (pz - z0) * f[1]) * SCALE) for px, pz in points]


first_launch = next((i for i, f in enumerate(frames) if any(e['type'] in ('launch', 'hop') for e in f['events'])), None)
first_landing = next((i for i, f in enumerate(frames) if any(e['type'] == 'landing' for e in f['events'])), None)
size = f'{WIDTH}x{HEIGHT}'
plan_path = out if not beside else out + '.plan.mp4'
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', size, '-r', str(fps), '-i', '-',
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', plan_path], stdin=subprocess.PIPE)
summary = {'source': os.path.basename(src), 'imagesPerSecond': fps, 'takeOffImage': first_launch, 'landingImage': first_landing}
if first_launch is not None:
    # the contact itself, measured on the positions of the step where the car took off
    me, lead = frames[first_launch]['place'], frames[first_launch]['placeOther']
    mine, theirs = tyres(me), tyres(lead)
    depth, sa, sb = max(((overlap(mine[('front', a)], theirs[('rear', b)]), a, b) for a in (1, -1) for b in (1, -1)), key=lambda t: t[0])
    fx = [p[0] for p in view(mine[('front', sa)], lead)]; rx = [p[0] for p in view(theirs[('rear', sb)], lead)]
    rel = view([(me[0], me[1])], lead)[0]
    summary.update({'tyreOverlapAtTakeOffCm': round((min(max(fx), max(rx)) - max(min(fx), min(rx))) / SCALE * 100, 1), 'tyreDepthAtTakeOffCm': round(depth * 100, 1),
                    'bodiesOverlapAtTakeOffM': round(overlap(rect(me[0], me[1], me[2], HL, HW), rect(lead[0], lead[1], lead[2], HL, HW)), 3),
                    'lateralGapBetweenBodiesCm': round((abs(rel[0] - CX) / SCALE - 2 * HW) * 100, 1), 'aheadAtTakeOffM': round((CY - rel[1]) / SCALE, 2),
                    'frontWheelOfTheCarBehind': 'right' if sa > 0 else 'left', 'rearWheelOfTheCarAhead': 'right' if sb > 0 else 'left'})
for i, fr in enumerate(frames):
    me, lead = fr['place'], fr['placeOther']
    img = Image.new('RGB', (WIDTH, HEIGHT), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 70, WIDTH, HEIGHT - 78), fill=ROAD)
    # distance marks every 2 m along the car ahead
    for m in range(-8, 9, 2):
        y = CY - m * SCALE
        if 76 < y < HEIGHT - 84: d.line((6, y, 14, y), fill=(190, 190, 196), width=1); d.text((17, y - 7), f'{m:+d} m', fill=(205, 205, 212), font=font)
    flying = fr['state'] == 6
    for car, colour, is_me in ((lead, BLUE, False), (me, RED, True)):
        body = view(rect(car[0], car[1], car[2], HL, HW), lead)
        if is_me and flying:
            # in the air: the shadow stays on the road, the car is drawn lifted (to the upper left, by its height)
            lift = fr['airHeight'] * SCALE * 0.5
            d.polygon(body, fill=(70, 72, 82))
            body = [(x - lift * 0.6, y - lift) for x, y in body]
        d.polygon(body, fill=tuple(int(c * 0.35 + 255 * 0.65) for c in colour), outline=colour)
        d.line(body + [body[0]], fill=colour, width=2)
        for key, poly in tyres(car).items():
            pts = view(poly, lead)
            if is_me and flying: pts = [(x - fr['airHeight'] * SCALE * 0.3, y - fr['airHeight'] * SCALE * 0.5) for x, y in pts]
            d.polygon(pts, fill=INK)
        nose = view([(car[0] + math.cos(car[2]) * (HL - 0.25), car[1] + math.sin(car[2]) * (HL - 0.25))], lead)[0]
        if is_me and flying: nose = (nose[0] - fr['airHeight'] * SCALE * 0.3, nose[1] - fr['airHeight'] * SCALE * 0.5)
        d.ellipse((nose[0] - 4, nose[1] - 4, nose[0] + 4, nose[1] + 4), fill=colour)
    # the contact: a front tyre of the car behind over a rear tyre of the car ahead
    mine, theirs = tyres(me), tyres(lead)
    tyre = max(((overlap(mine[('front', sa)], theirs[('rear', sb)]), sa, sb) for sa in (1, -1) for sb in (1, -1)), key=lambda t: t[0])
    bodies = overlap(rect(me[0], me[1], me[2], HL, HW), rect(lead[0], lead[1], lead[2], HL, HW))
    rel = view([(me[0], me[1])], lead)[0]
    ahead, right = (CY - rel[1]) / SCALE, (rel[0] - CX) / SCALE
    side_gap = abs(right) - 2 * HW
    if tyre[0] > 0 and not flying or (first_launch is not None and abs(i - first_launch) <= 2):
        pts = view(theirs[('rear', tyre[2])], lead)
        cx, cy = sum(p[0] for p in pts) / 4, max(p[1] for p in pts)
        d.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), outline=YELLOW, width=4)
    # ---- words
    # (the legends are drawn over whatever part of a car leaves the strip of road)
    d.rectangle((0, 0, WIDTH, 69), fill=PAPER); d.rectangle((0, HEIGHT - 77, WIDTH, HEIGHT), fill=PAPER)
    d.text((10, 5), 'Vu de dessus', fill=INK, font=big)
    d.text((150, 9), '(positions de la simulation, 4 fois plus lent)', fill=INK, font=font)
    d.text((10, 31), 'bleu : voiture percutée — rouge : la vôtre', fill=INK, font=font)
    d.text((10, 48), 'rectangles noirs : pneus — contour : carrosserie', fill=INK, font=font)
    t = fr['t'] - (frames[first_launch]['t'] if first_launch is not None else 0)
    if first_launch is not None and i < first_launch: state = 'au sol'
    elif flying: state = f"EN VOL, {fr['airHeight']:.2f} m"
    else: state = 'RETOMBÉE' + (' DEVANT' if ahead > 2 * HL else '')
    y0 = HEIGHT - 74
    d.text((10, y0), f"{t:+.2f} s   {fr['speed']:.0f} km/h (autre : {fr['other']:.0f})   {state}", fill=INK, font=bold)
    d.text((10, y0 + 19), 'carrosseries ' + ('en contact' if bodies > 0 and not flying else f'séparées (écart latéral {side_gap * 100:.0f} cm)'), fill=INK, font=font)
    if first_launch is not None and i >= first_launch:
        d.text((10, y0 + 36), f"au décollage : pneu avant sur pneu arrière, {summary.get('tyreOverlapAtTakeOffCm', 0):.0f} cm de gomme", fill=RED, font=font)
    else:
        d.text((10, y0 + 36), 'pneu avant / pneu arrière : ' + (f'{tyre[0] * 100:.0f} cm de recouvrement' if tyre[0] > 0 else 'pas encore de contact'), fill=INK, font=font)
    d.text((10, y0 + 53), f"votre voiture est {abs(ahead):.2f} m {'devant' if ahead > 0 else 'derrière'} (de centre à centre)", fill=INK, font=font)
    if i == first_landing:
        summary.update({'aheadAtLandingM': round(ahead, 2), 'tailAheadOfTheOtherNoseM': round(ahead - 2 * HL, 2), 'sideAtLandingM': round(right, 2), 'flightSeconds': round(fr['t'] - frames[first_launch]['t'], 3)})
    ff.stdin.write(img.tobytes())
ff.stdin.close(); ff.wait()
json.dump(summary, open(os.path.splitext(out)[0] + '.json', 'w'), indent=1)
print(summary)
if beside:
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-i', beside, '-i', plan_path, '-filter_complex', '[0:v][1:v]hstack=inputs=2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])
    os.remove(plan_path)
print('->', out)
