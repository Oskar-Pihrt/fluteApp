"""Turn parsed WFG tin whistle rows into a FingeringSpec table."""
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from clgen import canonical, midi, tidy, ts

def build(path, top):
    specs, seen = [], set()
    for line in open(path):
        r = json.loads(line)
        desc = r['desc'].lower()
        if 'fife' in desc and 'whistle' not in desc:
            continue  # fife-only fingerings
        note = canonical(r['note'])
        if midi(note) > midi(top):
            continue
        raw = r['code'].replace(' ', '').replace('–', '-').replace('½', 'h')
        lh, rh = raw.split('|')
        code = f'{lh} | {rh}'
        if (note, code) in seen:
            continue
        first = note not in {s['note'] for s in specs}
        spec = {'note': note, 'code': code, 'kind': 'primary' if first else 'alternate'}
        d = tidy(r['desc'].replace('For tin whistle or fife in D.', '').strip(' /'))
        if d:
            spec['comment'] = d
        seen.add((note, code))
        specs.append(spec)
    specs.sort(key=lambda s: midi(s['note']))
    return specs

if __name__ == '__main__':
    print(ts(build(sys.argv[1], sys.argv[2]), 'WHISTLE_SPECS'))
