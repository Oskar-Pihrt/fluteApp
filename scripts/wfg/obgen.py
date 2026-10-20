"""Turn parsed WFG oboe rows into FingeringSpec entries for the app's grammar."""
import json, re, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from clgen import canonical, midi, tidy, ts

LP = {'oblhab': ['G#'], 'oblheb': ['Eb'], 'oblhb': ['B'], 'oblhbb': ['Bb'], 'oblhf': ['F'], 'oblhabeb': ['G#', 'Eb']}
RP = {'obrhc': 'C', 'obrhdb': 'C#', 'obrheb': 'Eb'}

def code_for(imgs):
    i = imgs.index('p')
    left, right = imgs[:i], imgs[i + 1:]
    thumb = []
    laux, raux, holes, rholes = [], [], [], []
    for img in left:
        if img == 'obo1':
            thumb.append('I')
        elif img == 'obo3':
            thumb.append('III')
        elif img == 'obo1o3':
            thumb += ['I', 'III']
        elif img == 'obo2':
            laux.append('II')
        elif img in ('c', 'o', 'halfhole', 'ring'):
            holes.append({'c': str(len(holes) + 1), 'o': '-', 'halfhole': 'h', 'ring': '0'}[img])
        elif img == 'obtrb':
            laux.append('tB')
        elif img == 'topsliver':
            laux.append({1: 'tD', 2: 'tC#'}[len(holes)])
        elif img in LP:
            laux += LP[img]
        else:
            raise ValueError(img)
    for img in right:
        if img == 'obrsa':
            raux.append('sA')
        elif img == 'obrsab':
            raux.append('sG#')
        elif img in ('c', 'o'):
            rholes.append({'c': str(len(rholes) + 1), 'o': '-'}[img])
        elif img in ('topsliver', 'bottommoon'):
            # After the first ring the D trill key, after the second the F key.
            raux.append({1: 'tD', 2: 'F'}[len(rholes)])
        elif img == 'obc_banana':
            raux.append('c')
        elif img in RP:
            raux.append(RP[img])
        else:
            raise ValueError(img)
    assert len(holes) == 3 and len(rholes) == 3, imgs
    tok = '+'.join(thumb) or '-'
    return ' '.join([tok, ''.join(holes), *laux]) + ' | ' + ' '.join([''.join(rholes), *raux])

def build(basic, alt, top):
    specs, seen = [], set()
    rows = [json.loads(l) for f in basic for l in open(f)]
    basic_top = max(midi(canonical(r['note'])) for r in rows)
    alts = [json.loads(l) for l in open(alt)]
    count = {}
    for source, group in (('basic', rows), ('alt', alts)):
        for r in group:
            note = canonical(r['note'])
            m = midi(note)
            if source == 'alt':
                if not basic_top < m <= midi(top):
                    continue
                count[note] = count.get(note, 0) + 1
                if count[note] > 3:
                    continue
            if 'knee' in r['desc'].lower():
                continue  # bell closed with the knee: not a key fingering
            code = code_for(r['imgs'])
            if (note, code) in seen:
                continue
            first = note not in {s['note'] for s in specs}
            spec = {'note': note, 'code': code, 'kind': 'primary' if first else 'alternate'}
            d = tidy(r['desc'])
            if d:
                spec['comment'] = d
            if source == 'alt' and first:
                spec['verify'] = ('Top of the range: taken as the first of several in WFG’s alternate '
                                  'chart — the best fingering varies with oboe and reed.')
            seen.add((note, code))
            specs.append(spec)
    specs.sort(key=lambda s: midi(s['note']))
    return specs

if __name__ == '__main__':
    alt, top, *basic = sys.argv[1:]
    print(ts(build(basic, alt, top), 'OBOE_SPECS'))
