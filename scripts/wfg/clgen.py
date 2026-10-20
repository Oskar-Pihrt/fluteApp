"""Turn parsed WFG clarinet rows into FingeringSpec entries for the app's grammar."""
import json, re, sys

NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
ENH = {'E#': ('F', 0), 'B#': ('C', 1), 'Fb': ('E', 0), 'Cb': ('B', -1)}

def canonical(note):
    m = re.match(r'([A-G][#b]?)(\d)', note)
    name, octave = m.group(1), int(m.group(2))
    if name in ENH:
        name, shift = ENH[name]
        octave += shift
    if name.endswith('b'):
        i = NOTE_ORDER.index(name[0]) - 1
        if i < 0:
            i += 12
            octave -= 1
        name = NOTE_ORDER[i]
    return f'{name}{octave}'

def midi(note):
    m = re.match(r'([A-G]#?)(\d)', note)
    return NOTE_ORDER.index(m.group(1)) + 12 * (int(m.group(2)) + 1)

SIDE = {'clrs1': ['S1'], 'clrs2': ['S2'], 'clrs3': ['S3'], 'clrs4': ['S4'], 'clrs12': ['S1', 'S2'],
        'clrs34': ['S3', 'S4'], 'clrs234': ['S2', 'S3', 'S4']}

def code_for(imgs, system):
    i = imgs.index('p')
    left, right = imgs[:i], imgs[i + 1:]
    reg = 'clrk' in left
    thumb = 'clow' in left
    tok = ('R' if reg else '') + ('T' if thumb else '')
    tok = tok or '-'
    laux, raux = [], []
    holes = []
    for img in left:
        if img in ('clrk', 'clow', 'olow'):
            continue
        if img == 'cllsa':
            laux.append('A')
        elif img == 'cllsab':
            laux.append('sG#')
        elif img in ('c', 'o', 'halfhole'):
            holes.append({'c': str(len(holes) + 1), 'o': '-', 'halfhole': '0'}[img])
        elif img == 'tsliver':
            # Left sliver keys sit between the finger holes: after hole 1 the
            # Oehler F/C sliver, after hole 2 the E♭/B♭ sliver.
            laux.append({1: 'F', 2: 'Eb'}[len(holes)])
        else:
            m = re.match(r'o?cllh(\w+)$', img)
            name = {'e': 'E', 'f': 'F', 'gb': 'F#', 'db': 'C#', 'ab': 'G#', 'bb': 'Bb'}[m.group(1)]
            laux.append(name)
    rholes = []
    for img in right:
        if img in SIDE:
            raux.extend(SIDE[img])
        elif img in ('c', 'o'):
            rholes.append({'c': str(len(rholes) + 1), 'o': '-'}[img])
        elif img in ('bsliver', 'tsliver'):
            # Between holes 2 and 3: Boehm B/F♯ sliver, Oehler B♭/F sliver.
            raux.append('B' if system == 'boehm' else 'Bb')
        else:
            m = re.match(r'o?clrh(\w+)$', img)
            name = {'e': 'E', 'f': 'F', 'gb': 'F#', 'ab': 'G#'}[m.group(1)]
            raux.append(name)
    assert len(holes) == 3 and len(rholes) == 3, (imgs, holes, rholes)
    return ' '.join([tok, ''.join(holes), *laux]) + ' | ' + ' '.join([''.join(rholes), *raux])

def tidy(desc):
    desc = re.sub(r' _(\d)', r'\1', desc)
    desc = re.sub(r' \^', ' ', desc).replace(' .', '.').replace(' ,', ',').strip()
    if desc in ('Basic.', ''):
        return None
    return desc

def build(basic_files, alt_file, system):
    rows = []
    for f in basic_files:
        rows += [json.loads(l) for l in open(f)]
    basic_top = max(midi(canonical(r['note'])) for r in rows)
    alt = [json.loads(l) for l in open(alt_file)]
    alt = [r for r in alt if basic_top < midi(canonical(r['note'])) <= midi('C7')]
    # The alternate charts list up to twenty ways per note; keep the first few.
    kept, count = [], {}
    for r in alt:
        n = canonical(r['note'])
        count[n] = count.get(n, 0) + 1
        if count[n] <= 4:
            kept.append(r)
    alt = kept
    specs, seen = [], {}
    for source, group in (('basic', rows), ('alt', alt)):
        for r in group:
            note = canonical(r['note'])
            code = code_for(r['imgs'], system)
            key = (note, code)
            if key in seen:
                continue
            first = note not in {s['note'] for s in specs}
            spec = {'note': note, 'code': code, 'kind': 'primary' if first else 'alternate'}
            d = tidy(r['desc'])
            if d:
                spec['comment'] = d
            if source == 'alt' and first:
                spec['verify'] = ('Upper altissimo: taken as the first of several in WFG’s '
                                  'alternate chart — the best fingering varies from clarinet to clarinet.')
            seen[key] = True
            specs.append(spec)
    specs.sort(key=lambda s: midi(s['note']))
    return specs

def ts(specs, name):
    out = [f'export const {name}: FingeringSpec[] = [']
    for s in specs:
        parts = [f"note: '{s['note']}'", f"code: '{s['code']}'", f"kind: '{s['kind']}'"]
        for k in ('comment', 'verify'):
            if k in s:
                parts.append(f"{k}: {json.dumps(s[k], ensure_ascii=False)}")
        out.append('  { ' + ', '.join(parts) + ' },')
    out.append(']')
    return chr(10).join(out)

if __name__ == '__main__':
    system, alt_file, *basic = sys.argv[1:]
    print(ts(build(basic, alt_file, system), 'GENERATED'))
