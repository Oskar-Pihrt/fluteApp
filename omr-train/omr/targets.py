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
    # Rhythm. Appended, so a checkpoint from before them warm-starts.
    'rest_whole', 'rest_half', 'rest_quarter', 'rest_8th', 'rest_16th', 'rest_32nd',   # 13–18
    'ts_2_4', 'ts_3_4', 'ts_4_4', 'ts_2_2', 'ts_3_8', 'ts_6_8', 'ts_9_8', 'ts_12_8',  # 19–26
    'ts_5_4', 'ts_common', 'ts_cut',                                                 # 27–29
    'repeat_start', 'repeat_end', 'volta', 'segno', 'coda',                           # 30–34
    'dc', 'dc_al_fine', 'dc_al_coda', 'ds', 'ds_al_fine', 'ds_al_coda', 'fine', 'to_coda',  # 35–42
]
INDEX = {name: i for i, name in enumerate(CLASSES)}
# Classes only sources with rhythm truth can teach: elsewhere they are masked
# out of the loss rather than taught as background.
RHYTHM_FIRST = INDEX['rest_whole']

# Per-notehead attributes, read at the head's peak: its duration, and its dots.
DURATIONS = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd']
DUR_INDEX = {name: i for i, name in enumerate(DURATIONS)}
MAX_DOTS = 2

REST_CLASS = {'whole': 'rest_whole', 'half': 'rest_half', 'quarter': 'rest_quarter', 'eighth': 'rest_8th', '16th': 'rest_16th', '32nd': 'rest_32nd'}
TIME_CLASS = {'24': 'ts_2_4', '34': 'ts_3_4', '44': 'ts_4_4', '22': 'ts_2_2', '38': 'ts_3_8', '68': 'ts_6_8', '98': 'ts_9_8', '128': 'ts_12_8', '54': 'ts_5_4', 'common': 'ts_common', 'cut': 'ts_cut'}
MARKS = {'segno', 'coda', 'dc', 'dc_al_fine', 'dc_al_coda', 'ds', 'ds_al_fine', 'ds_al_coda', 'fine', 'to_coda'}

LILYPOND_ALT = {'1/2': 'sharp', '-1/2': 'flat', '0': 'natural', '1': 'dsharp', '-1': 'dflat'}


def accidental_anchor(kind, x, y, w, h):
    """Flats are anchored on their bowl, which is what sits on the note's line or space."""
    if kind in ('flat', 'dflat'):
        return x + w / 2, y + h * 0.75
    return x + w / 2, y + h / 2


def load_anchors(json_path):
    """Returns (truth, anchors, S, attributes, rhythm).

    anchors: (class index, x, y) in page pixels. attributes: (x, y, duration
    index or −1, dots or −1) at noteheads and rests, −1 where the source
    doesn't say. rhythm: whether this page's truth covers the rhythm classes.
    """
    with open(json_path) as f:
        truth = json.load(f)
    staves = truth['staves']
    if not staves:
        return truth, [], None, [], False
    S = truth.get('S') or (staves[0]['lines'][4] - staves[0]['lines'][0]) / 4
    anchors = []
    attributes = []
    verovio = truth.get('source') == 'verovio'
    rhythm = verovio and any('dur' in head for head in truth['noteheads'])

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
        if head.get('grace') or head.get('chordLow'):
            continue
        if 'dur' in head:
            attributes.append((head['x'], head['y'], DUR_INDEX.get(head['dur'], -1), min(head.get('dots', 0), MAX_DOTS)))
        elif 'log' in head and 0 <= head['log'] <= 5:
            # LilyPond: the duration's log, but no dot count.
            attributes.append((head['x'], head['y'], head['log'], -1))

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
                kind = sym.get('kind')
                if kind in ('repeat_start', 'repeat_both'):
                    anchors.append((INDEX['repeat_start'], x + w / 2, y + h / 2))
                if kind in ('repeat_end', 'repeat_both'):
                    anchors.append((INDEX['repeat_end'], x + w / 2, y + h / 2))
            elif cls == 'octave':
                anchors.append((INDEX['ottava_start'], x + S * 0.6, y + h / 2))
                anchors.append((INDEX['ottava_end'], x + w, y + h / 2))
            elif not rhythm:
                continue
            elif cls in ('rest', 'mRest') and sym.get('kind') in REST_CLASS:
                cx, cy = x + w / 2, y + h / 2
                anchors.append((INDEX[REST_CLASS[sym['kind']]], cx, cy))
                attributes.append((cx, cy, -1, min(sym.get('dots', 0), MAX_DOTS)))
            elif cls == 'meterSig' and sym.get('kind') in TIME_CLASS:
                anchors.append((INDEX[TIME_CLASS[sym['kind']]], x + w / 2, y + h / 2))
            elif cls == 'volta':
                # The bracket's opening corner, where its number is.
                anchors.append((INDEX['volta'], x + min(w / 2, S * 0.6), y + min(h / 2, S * 0.6)))
            elif cls == 'mark' and sym.get('kind') in MARKS:
                anchors.append((INDEX[sym['kind']], x + w / 2, y + h / 2))
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
    return truth, anchors, S, attributes, rhythm
