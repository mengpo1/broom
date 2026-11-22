#!/usr/bin/env python3
"""Measures the animation of the left front tyre on a video written by compare-wheels-video.mjs
(its manifest, <video>.json, gives the display rate, the segments and the halves of the picture).

For each segment and each half (before above, after below, or a single one):
  - how often the drawing of the tread changes (changes per second, longest run without change);
  - in which direction the marks move in the two halves of the tread width: the lines on which
    marks (or rows of dashes) are centred are found in every drawing, and each one is matched
    with the nearest mark of the previous drawing. Upward on screen is the direction in which
    the tread of a tyre rolling forward is seen from the cockpit (from the rear face over the top).
Only clear matches are counted (a step of 6 to 34 lines, with no other mark nearly as close).
The two halves must agree, with at least three quarters of the steps going the same way: a
pattern that reads upward in one place and downward in another does not show which way the
wheel turns. "unclear" also covers the cases this method cannot read: too few marks in sight
(the sparse, staggered marks of the slow drawing), marks that run into each other (the trails
of the tyre turning very fast), a changing speed, or no change at all (a frozen tyre).

python3 work/scripts/wheel-motion-check.py [video.mp4] [out.json]
"""
import json, os, subprocess, sys
import numpy as np

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
video = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(root, 'work/renders/comparison/wheels-before-after.mp4')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'work/benchmarks', os.path.basename(video).replace('.mp4', '-motion.json'))
manifest = json.load(open(video.replace('.mp4', '.json')))
FPS, HALF = manifest['fps'], manifest['halfHeight']
TREAD = (95, 150, 215, 283)                  # x0, y0, x1, y1 inside a half: tread of the left front tyre, above the mirror
BANDS = {'outer': (115, 155), 'inner': (155, 195)}            # the two halves of the tread (rim and sidewall left out)
ROWS = (150, 283)
MAX_SHIFT = 34                               # a phase of either drawing moves the pattern by less than this; the opposite reading needs more

# Only the tread of the tyre is kept from each picture (one small patch per half): a long video at
# 144 images per second would not fit in memory otherwise.
X0, Y0, X1, Y1 = TREAD
probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video], check=True, capture_output=True, text=True)
WIDTH, HEIGHT = (int(v) for v in probe.stdout.strip().split(','))
decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
patches = [[] for _ in manifest['halves']]
while True:
    raw = decoder.stdout.read(WIDTH * HEIGHT)
    if len(raw) < WIDTH * HEIGHT: break
    picture = np.frombuffer(raw, dtype=np.uint8).reshape(HEIGHT, WIDTH)
    for hi in range(len(patches)): patches[hi].append(picture[hi * HALF + Y0:hi * HALF + Y1, X0:X1].astype(np.float32))
decoder.wait()

def mark_rows(residual):
    """Lines (rows of the picture) on which a mark or a row of dashes is centred, from the light strokes of a tread patch."""
    profile = np.convolve(residual.mean(axis=1), np.ones(13) / 13, mode='same')      # one bump per row of dashes, whatever the lanes
    if profile.max() < 1.2: return []
    on = profile > profile.max() * 0.55
    rows, start = [], None
    for y, v in enumerate(list(on) + [False]):
        if v and start is None: start = y
        if not v and start is not None:
            if y - 1 - start >= 2: rows.append((start + y - 1) / 2)
            start = None
    return rows

report = {'video': os.path.relpath(video, root), 'fps': FPS, 'segments': {}}
for seg in manifest['segments']:
    entry = {}
    for hi, half in enumerate(manifest['halves']):
        skip = max(1, round(FPS / 15))
        seq = patches[hi][seg['first'] + skip:seg['first'] + seg['frames'] - skip]
        x0 = X0
        changes, run, longest = 0, 0, 0
        drawings = [[0]]                         # runs of pictures showing the same drawing of the tread
        for i, (a, b) in enumerate(zip(seq, seq[1:])):
            diff = np.abs(a - b) > 24
            if diff.mean() > 0.0025: changes += 1; run = 0; drawings.append([i + 1])
            else: run += 1; longest = max(longest, run); drawings[-1].append(i + 1)
        res = {'changes_per_second': round(changes * FPS / (len(seq) - 1), 1), 'longest_still_run_images': longest,
               'longest_still_run_seconds': round(longest / FPS, 3)}
        # the light strokes of the tread: each drawing minus the darkest state of every pixel over the segment
        patch = np.stack(seq)
        light = patch - patch.min(axis=0)
        res['light_stroke_share'] = round(float((light > 14).mean()), 4)          # how much of the tread carries a light stroke at a given instant
        for band, (bx0, bx1) in BANDS.items():
            up = down = 0; steps = []
            previous = None
            for d in drawings:
                rows = mark_rows(light[d].mean(axis=0)[:, bx0 - x0:bx1 - x0])
                if previous and rows:
                    for r in rows:
                        by_distance = sorted(previous, key=lambda q: abs(q - r))
                        nearest = by_distance[0]
                        # only a clear match counts: close enough, and clearly closer than any other mark
                        if not 6 <= abs(nearest - r) <= MAX_SHIFT: continue
                        if len(by_distance) > 1 and abs(by_distance[1] - r) < 1.6 * abs(nearest - r): continue
                        steps.append(r - nearest)
                        if r < nearest: up += 1
                        else: down += 1
                if rows: previous = rows
            res[band] = {'steps_up': up, 'steps_down': down, 'median_step_rows': float(np.median(np.abs(steps))) if steps else None}
        def reading(b):
            u, d = res[b]['steps_up'], res[b]['steps_down']
            return 0 if u + d < 6 or max(u, d) < 0.75 * (u + d) else (-1 if u > d else 1)
        dirs = {b: reading(b) for b in BANDS}
        res['halves_agree'] = bool(dirs['outer'] == dirs['inner'] and dirs['outer'] != 0)
        res['direction'] = {-1: 'up', 1: 'down'}[dirs['outer']] if res['halves_agree'] else 'unclear'
        entry[half] = res
    report['segments'][seg['label']] = entry

json.dump(report, open(out, 'w'), indent=1)
for name, entry in report['segments'].items():
    for half, r in entry.items():
        print(f"{name:14s} {half:6s} {r['changes_per_second']:5.1f} changes/s, longest still run {r['longest_still_run_images']:2d} images ({r['longest_still_run_seconds']:.2f} s), "
              f"light strokes on {r['light_stroke_share'] * 100:4.1f} % of the tread, clear steps up/down: outer half {r['outer']['steps_up']}/{r['outer']['steps_down']}, inner half {r['inner']['steps_up']}/{r['inner']['steps_down']} -> {r['direction']}")
print('->', os.path.relpath(out, root))
