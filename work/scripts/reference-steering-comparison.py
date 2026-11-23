# Side-by-side video: the passage of the reference footage studied for the held steering (left) and
# the same manoeuvre in Virage GP (right), synchronised on the first movement of the hands.
# Left: the 3D view of the footage (the banner above it is left out), with what the analysis reads
# on every image: the position of the hands (one of seven drawings) and the key ASSUMED to be down
# (the footage does not show the controls: see docs/specifications/held-steering.md).
# Right: a clip recorded by work/scripts/steering-sequences.mjs on the circuit fitted on the passage
# (clips/passage-<variant>.mp4), which carries its own caption.
# The footage is not in the repository: its path is the first argument.
#   python3 work/scripts/reference-steering-comparison.py <footage.mp4> <level.npy> [variant=a] [out]
# level.npy: the position read on every image of the footage (-3..3), as produced by the scripts in
# work/reference-frames/S-steering-hold_1m47s-1m56s/method/.
import json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

video, levels = sys.argv[1], np.load(sys.argv[2])
variant = sys.argv[3] if len(sys.argv) > 3 else 'a'
root = 'work/renders/steering'
out = sys.argv[4] if len(sys.argv) > 4 else f'{root}/reference-vs-{variant}.mp4'
clip = f'{root}/clips/passage-{variant}.mp4'
telemetry = json.load(open(f'{root}/telemetry-{variant}.json'))['manoeuvres']['passage']
FPS, REF_FPS, FIRST, SECONDS = 60, 25, 107.76, 8.9          # first movement of the hands in the footage (s), length of the passage
KEYS = telemetry['keys']                                     # [[from, to, side], ...] seconds from the first movement: the hypothesis
SPEEDS = telemetry.get('speeds') or []                       # [[seconds, km/h], ...]: the display of the footage, as read
HIDDEN = [(3.84, 4.8), (5.88, 7.48)]                         # the arm of the driver hides the display (third position of the hands)
frames = telemetry['frames']
lead = frames - round((SECONDS + 0.4) * FPS) - 1             # images of the clip before the first key (approach)
W, H = 960, 540
VIEW = (0, 122, 576, 360)                                    # the 3D view and the cockpit, without the banner
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
text = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
NAMES = {-3: 'gauche 3 — bras croisé', -2: 'gauche 2 — marqué', -1: 'gauche 1 — léger', 0: 'centre', 1: 'droite 1 — léger', 2: 'droite 2 — marqué', 3: 'droite 3 — bras croisé'}
CELLS = ['G3', 'G2', 'G1', '·', 'D1', 'D2', 'D3']

t0 = FIRST - lead / FPS
n_ref = int((frames / FPS) * REF_FPS) + 2
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-i', video, '-frames:v', str(n_ref), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
ref = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 360, 576, 3)
enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', clip,
                        '-filter_complex', '[0:v][1:v]hstack=inputs=2:shortest=1[v]', '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-movflags', '+faststart', out], stdin=subprocess.PIPE)
vw, vh = W, round((VIEW[3] - VIEW[1]) * W / 576)             # 960 x 397
for i in range(frames):
    t = t0 + i / FPS                                          # time in the footage
    k = min(len(ref) - 1, int(round((t - t0) * REF_FPS)))
    level = int(levels[min(len(levels) - 1, int(round(t * REF_FPS)))])
    since = t - FIRST
    key = next((side for a, b, side in KEYS if a <= since < b), 0)
    img = Image.new('RGB', (W, H), (244, 239, 226)); d = ImageDraw.Draw(img)
    img.paste(Image.fromarray(ref[k][VIEW[1]:VIEW[3], VIEW[0]:VIEW[2]]).resize((vw, vh), Image.NEAREST), (0, 0))
    y = vh + 8
    minutes = int(t // 60)
    d.text((14, y), f'Vidéo de référence (1991) — {minutes}:{t - 60 * minutes:05.2f}', fill=(22, 22, 31), font=bold)
    d.text((14, y + 26), f'Position des mains relevée sur l\'image : {NAMES[level]}', fill=(22, 22, 31), font=text)
    for c, name in enumerate(CELLS):                          # the seven positions, the current one filled
        x = 14 + c * 62; on = (c - 3) == level
        d.rectangle((x, y + 52, x + 54, y + 80), fill=(179, 38, 30) if on and level else (22, 22, 31) if on else (244, 239, 226), outline=(22, 22, 31), width=2)
        d.text((x + 27, y + 66), name, fill=(244, 239, 226) if on else (22, 22, 31), font=text, anchor='mm')
    label = 'TOUCHE DROITE ▶' if key > 0 else '◀ TOUCHE GAUCHE' if key < 0 else 'aucune touche'
    d.text((470, y + 52), 'Appui SUPPOSÉ (les commandes ne sont pas visibles) :', fill=(22, 22, 31), font=text)
    d.text((470, y + 72), label if since >= 0 else 'approche', fill=(179, 38, 30) if key else (22, 22, 31), font=bold)
    speed = ''
    if SPEEDS:
        if any(a <= since < b for a, b in HIDDEN): speed = 'Vitesse : afficheur caché par le bras'
        else:
            v = SPEEDS[0][1] if since <= SPEEDS[0][0] else SPEEDS[-1][1]
            for (ta, va), (tb, vb) in zip(SPEEDS, SPEEDS[1:]):
                if ta <= since <= tb: v = va + (vb - va) * (since - ta) / (tb - ta); break
            speed = f'Vitesse lue sur l\'afficheur : {round(v)} km/h'
    d.text((470, y + 26), speed, fill=(22, 22, 31), font=text)
    d.text((14, y + 96), 'À droite : Virage GP — mêmes appuis supposés, même vitesse (pédales réglées sur l\'afficheur), piste ajustée à ce passage.', fill=(22, 22, 31), font=text)
    enc.stdin.write(img.tobytes())
enc.stdin.close(); enc.wait()
print(out, frames, 'images;', f'footage from {t0:.2f} s; {lead} images of approach')
