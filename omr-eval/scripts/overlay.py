"""Draw a page's ground truth (or a detection report) over its image, for eyeballing.

    python3 omr-eval/scripts/overlay.py page.pgm page.json out.png [detections.json]
"""
import json
import sys

from PIL import Image, ImageDraw

image_path, truth_path, out_path = sys.argv[1:4]
image = Image.open(image_path).convert('RGB')
draw = ImageDraw.Draw(image)
truth = json.load(open(truth_path))
for staff in truth['staves']:
    for y in staff['lines']:
        draw.line([(staff['x0'], y), (staff['x1'], y)], fill=(0, 160, 255), width=1)
for note in truth['noteheads']:
    box = [note['x'] - note['width'] / 2, note['y'] - note['height'] / 2, note['x'] + note['width'] / 2, note['y'] + note['height'] / 2]
    draw.rectangle(box, outline=(0, 200, 0) if not note['grace'] else (200, 0, 200), width=2)
for symbol in truth.get('symbols', []):
    if symbol['cls'] in ('accidental', 'clef', 'barline', 'rest', 'ottava', 'timesig'):
        draw.rectangle([symbol['x'], symbol['y'], symbol['x'] + symbol['width'], symbol['y'] + symbol['height']], outline=(255, 140, 0), width=1)
if len(sys.argv) > 4:
    for det in json.load(open(sys.argv[4])):
        x, y = det['x'], det['y']
        draw.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 0, 0), width=2)
image.save(out_path)
