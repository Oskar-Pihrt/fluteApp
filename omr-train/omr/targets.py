"""Ground truth → detector targets.

Every page format (Verovio synthetic, LilyPond) is reduced to one list of
anchor points with a class each, in page pixels. The detector predicts a
heatmap per class plus a sub-cell offset, CenterNet-style; sizes are not
regressed because every symbol's size is fixed relative to the staff spacing.
"""
import json

CLASSES = [
    'head_filled',   # 0
    'head_hollow',   # 1
    'head_grace',    # 2
    'sharp',         # 3
    'flat',          # 4
    'natural',       # 5
    'dsharp',        # 6
    'dflat',         # 7
    'clef',          # 8
    'barline',       # 9
    'ottava_start',  # 10
    'ottava_end',    # 11
    'tied_head',     # 12  marks a notehead that continues a tie
]
INDEX = {name: i for i, name in enumerate(CLASSES)}

LILYPOND_ALT = {'1/2': 'sharp', '-1/2': 'flat', '0': 'natural', '1': 'dsharp', '-1': 'dflat'}


def accidental_anchor(kind, x, y, w, h):
    """Flats are anchored on their bowl, which is what sits on the note's line or space."""
    if kind in ('flat', 'dflat'):
        return x + w / 2, y + h * 0.75
    return x + w / 2, y + h / 2


def load_anchors(json_path):
    """Returns (truth dict, list of (class index, x, y), staff spacing S in pixels)."""
    with open(json_path) as f:
        truth = json.load(f)
    staves = truth['staves']
    if not staves:
        return truth, [], None
    S = truth.get('S') or (staves[0]['lines'][4] - staves[0]['lines'][0]) / 4
    anchors = []
    verovio = truth.get('source') == 'verovio'

    for head in truth['noteheads']:
        if head.get('grace'):
            cls = 'head_grace'
        elif head.get('hollow') if verovio else head.get('log', 2) <= 1:
            cls = 'head_hollow'
        else:
            cls = 'head_filled'
        anchors.append((INDEX[cls], head['x'], head['y']))
        if head.get('tied'):
            anchors.append((INDEX['tied_head'], head['x'], head['y']))

    for sym in truth['symbols']:
        cls = sym['cls']
        x, y, w, h = sym['x'], sym['y'], sym['width'], sym['height']
        if verovio:
            if cls in ('sharp', 'flat', 'natural', 'dsharp', 'dflat'):
                anchors.append((INDEX[cls], *accidental_anchor(cls, x, y, w, h)))
            elif cls == 'clef':
                anchors.append((INDEX['clef'], x + w / 2, y + h / 2))
            elif cls == 'barLine':
                anchors.append((INDEX['barline'], x + w / 2, y + h / 2))
            elif cls == 'octave':
                anchors.append((INDEX['ottava_start'], x + S * 0.6, y + h / 2))
                anchors.append((INDEX['ottava_end'], x + w, y + h / 2))
        else:
            if cls == 'accidental' and sym.get('alt') in LILYPOND_ALT:
                kind = LILYPOND_ALT[sym['alt']]
                anchors.append((INDEX[kind], *accidental_anchor(kind, x, y, w, h)))
            elif cls == 'keyglyph' and sym.get('kind') in ('sharp', 'flat', 'natural'):
                anchors.append((INDEX[sym['kind']], *accidental_anchor(sym['kind'], x, y, w, h)))
            elif cls == 'clef':
                anchors.append((INDEX['clef'], x + w / 2, y + h / 2))
            elif cls == 'barline':
                # LilyPond barlines at the end of a system include the thick
                # final bar; their centre is still the right anchor.
                anchors.append((INDEX['barline'], x + w / 2, y + h / 2))
            elif cls == 'ottava':
                anchors.append((INDEX['ottava_start'], x + S * 0.6, y + h / 2))
                anchors.append((INDEX['ottava_end'], x + w, y + h / 2))
    return truth, anchors, S
