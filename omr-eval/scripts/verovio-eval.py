"""Turn generated Verovio pages (omr-train format) into rhythm eval pages.

    uv run --project omr-train python omr-eval/scripts/verovio-eval.py SRC_DIR omr-eval/data/verovio-rhythm

Writes `<name>.pgm` plus truth in the eval format: noteheads with their staff,
duration (`dur`, and `log` as LilyPond writes it) and dots, and the rests —
what the rhythm metrics in eval.ts compare against. Use seeds the detector
never trained on.
"""
import glob
import json
import os
import sys

from PIL import Image

LOG = {'whole': 0, 'half': 1, 'quarter': 2, 'eighth': 3, '16th': 4, '32nd': 5}


def staff_of(staves, y):
    best, distance = 0, float('inf')
    for i, staff in enumerate(staves):
        d = abs(y - (staff['lines'][0] + staff['lines'][4]) / 2)
        if d < distance:
            best, distance = i, d
    return best


def main(src, out):
    os.makedirs(out, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(src, '*.json'))):
        truth = json.load(open(path))
        png = path[:-5] + '.png'
        if not os.path.exists(png) or not truth['staves']:
            continue
        staves = truth['staves']
        heads = []
        for h in truth['noteheads']:
            heads.append({
                'x': h['x'], 'y': h['y'], 'width': h['width'], 'height': h['height'],
                'staffIndex': staff_of(staves, h['y']), 'midi': h['midi'], 'step': 0,
                'log': LOG.get(h.get('dur'), 2), 'grace': bool(h.get('grace')), 'tied': bool(h.get('tied')),
                **({'dur': h['dur'], 'dots': h.get('dots', 0)} if 'dur' in h else {}),
            })
        rests = [
            {'x': s['x'] + s['width'] / 2, 'y': s['y'] + s['height'] / 2, 'staffIndex': staff_of(staves, s['y'] + s['height'] / 2), 'kind': s['kind'], 'measure': s['cls'] == 'mRest', 'dots': s.get('dots', 0)}
            for s in truth['symbols'] if s['cls'] in ('rest', 'mRest') and s.get('kind')
        ]
        name = os.path.basename(path)[:-5]
        Image.open(png).convert('L').save(os.path.join(out, name + '.pgm'))
        json.dump({'width': truth['width'], 'height': truth['height'], 'staves': staves, 'noteheads': heads, 'rests': rests, 'rhythm': True},
                  open(os.path.join(out, name + '.json'), 'w'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
