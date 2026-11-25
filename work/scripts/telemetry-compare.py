#!/usr/bin/env python3
"""Compares the telemetry of recorded collision sequences (work/renders/collisions/*.json) with that of
another recording of the same scenarios, image by image: which fields are identical, and from which image
they differ. Only the fields present in both recordings are compared.
python3 work/scripts/telemetry-compare.py <reference dir> <new dir> [E2 E3 ...]"""
import json, os, sys

ref_dir, new_dir = sys.argv[1], sys.argv[2]
names = sys.argv[3:] or ['E2', 'E3', 'E3x', 'E4', 'E5', 'HOP', 'HOPx']
report = {}
for name in names:
    a_path, b_path = os.path.join(ref_dir, name + '.json'), os.path.join(new_dir, name + '.json')
    if not (os.path.exists(a_path) and os.path.exists(b_path)):
        print(f'{name}: missing on one side'); continue
    a, b = json.load(open(a_path))['frames'], json.load(open(b_path))['frames']
    keys = [k for k in a[0] if k in b[0]]
    first = None
    for i in range(min(len(a), len(b))):
        if any(a[i][k] != b[i][k] for k in keys):
            first = i; break
    entry = {'images': [len(a), len(b)], 'fieldsCompared': len(keys), 'identical': first is None and len(a) == len(b), 'firstDifferentImage': first}
    if first is not None:
        entry['secondsBeforeTheFirstDifference'] = round(first / 60, 3)
        entry['differentFieldsThere'] = [k for k in keys if a[first][k] != b[first][k]]
    report[name] = entry
    print(f"{name}: {len(a)} / {len(b)} images, {len(keys)} fields: " + ('IDENTICAL image by image' if entry['identical'] else f"identical for the first {first} images ({first / 60:.2f} s), then different ({', '.join(entry.get('differentFieldsThere', [])[:6])})"))
if '--json' in sys.argv: json.dump(report, sys.stdout)
