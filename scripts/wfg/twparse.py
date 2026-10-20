"""Parse WFG tin whistle charts (text-only fingerings) into rows."""
import re, sys, json, html
sys.path.insert(0, __import__('os').path.dirname(__file__))
from wfgparse import text

for path in sys.argv[1:]:
    s = open(path, encoding='latin-1').read()
    note = None
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S | re.I):
        th = re.search(r'<th[^>]*bgcolor[^>]*>(.*?)</th>', row, flags=re.S | re.I)
        if th:
            t = text(th.group(1)).replace(' #', '#').replace(' b', 'b')
            m = re.match(r'([A-G][#b]?) ?_(\d)', t)
            if m:
                note = m.group(1) + m.group(2)
        cells = [text(c) for c in re.findall(r'<td[^>]*>(.*?)</td>', row, flags=re.S | re.I)]
        for i, c in enumerate(cells):
            if '|' in c and note:
                print(json.dumps({'note': note, 'code': c, 'desc': cells[i + 1] if i + 1 < len(cells) else ''}, ensure_ascii=False))
                break
