"""Parse a WFG basic fingering chart into rows of (note, images, code, description)."""
import re, sys, html, json

def text(cell):
    cell = re.sub(r'<sup>(.*?)</sup>', r' ^\1 ', cell, flags=re.S | re.I)
    cell = re.sub(r'<sub>(.*?)</sub>', r' _\1 ', cell, flags=re.S | re.I)
    cell = re.sub(r'<img[^>]*src="[^"]*/(sharp|flat)_blue\.gif"[^>]*>', lambda m: '#' if m.group(1) == 'sharp' else 'b', cell)
    cell = re.sub(r'<br\s*/?>', ' / ', cell, flags=re.I)
    cell = re.sub(r'<[^>]+>', ' ', cell)
    return re.sub(r'\s+', ' ', html.unescape(cell)).strip()

def parse(path):
    s = open(path, encoding='latin-1').read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S | re.I)
    out, note = [], None
    for row in rows:
        th = re.search(r'<th[^>]*rowspan[^>]*>(.*?)</th>', row, flags=re.S | re.I) or re.search(r'<th[^>]*bgcolor[^>]*>(.*?)</th>', row, flags=re.S | re.I)
        if th:
            t = text(th.group(1))
            m = re.match(r'([A-G][#b]?) ?_(\d)', t.replace(' #', '#').replace(' b', 'b'))
            if m:
                note = m.group(1) + m.group(2)
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, flags=re.S | re.I)
        for i, cell in enumerate(cells):
            imgs = re.findall(r'src="[^"]*/k/([^/"]+)\.gif"', cell)
            if imgs and 'p' in imgs:
                code = text(cells[i - 1]) if i > 0 else ''
                desc = text(cells[i + 1]) if i + 1 < len(cells) else ''
                out.append({'note': note, 'imgs': imgs, 'code': code, 'desc': desc})
                break
    return out

if __name__ == '__main__':
    for p in sys.argv[1:]:
        for r in parse(p):
            print(json.dumps(r, ensure_ascii=False))
