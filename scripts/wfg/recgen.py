"""Turn parsed WFG recorder rows into FingeringSpec tables, one per fingering system."""
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from clgen import canonical, midi, tidy, ts

THUMB = {'closedlow': 'T', 'clow12': 't', 'openlow': '-'}
RIGHT = {'c': None, 'o': '-', 'bothhole': None, 'bottomhole': 'h', 'openhole': '-'}

def code_for(imgs):
    i = imgs.index('p')
    left, right = imgs[:i], imgs[i + 1:]
    thumb = THUMB[left[0]]
    holes = ''.join(str(n + 1) if img == 'c' else '-' for n, img in enumerate(left[1:]))
    aux, rh = [], ''
    for img in right:
        if img == 'bell':
            aux.append('X')
            continue
        mark = RIGHT[img]
        rh += str(len(rh) + 4) if mark is None else mark
    assert len(holes) == 3 and len(rh) == 4, imgs
    return ' '.join([thumb, holes]) + ' | ' + ' '.join([rh, *aux])

def build(path, system):
    other = 'german' if system == 'english' else 'english'
    specs, seen = [], set()
    for line in open(path):
        r = json.loads(line)
        if f'for {other} models' in r['desc'].lower():
            continue
        note = canonical(r['note'])
        code = code_for(r['imgs'])
        if (note, code) in seen:
            continue
        first = note not in {s['note'] for s in specs}
        spec = {'note': note, 'code': code, 'kind': 'primary' if first else 'alternate'}
        d = tidy(r['desc'])
        if d and not d.lower().startswith('basic for'):
            spec['comment'] = d
        seen.add((note, code))
        specs.append(spec)
    specs.sort(key=lambda s: midi(s['note']))
    return specs

if __name__ == '__main__':
    path = sys.argv[1]
    print(ts(build(path, 'english'), 'BAROQUE_SPECS'))
    print()
    print(ts(build(path, 'german'), 'GERMAN_SPECS'))
