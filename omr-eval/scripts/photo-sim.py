"""Simulated phone photos of the eval pages, with the ground truth carried along.

    uv run --project omr-train python omr-eval/scripts/photo-sim.py

Takes each LilyPond eval page rendered at 300 dpi and photographs it, in
effect: a perspective tilt, a gentle page curl, uneven light and a shadow,
lens blur, sensor noise and JPEG compression, then a resize to typical phone
resolution. Every notehead is pushed through the same geometric mapping, so
the truth stays exact. Deterministic per page, so runs are comparable.
"""
import glob
import json
import os
import random

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'data', 'photos')


def simulate(gray, rng):
    h, w = gray.shape
    # Page curl: rows bow by a few pixels across the width.
    amp = rng.uniform(0, 0.006) * h
    xs, ys = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    curl = (amp * np.sin(np.pi * xs / w + rng.uniform(-0.3, 0.3))).astype(np.float32)
    # Perspective: corners pulled in by up to 6 % of the page.
    j = lambda: rng.uniform(0, 0.06)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[j() * w, j() * h], [w - j() * w, j() * h], [w - j() * w, h - j() * h], [j() * w, h - j() * h]])
    H = cv2.getPerspectiveTransform(src, dst)
    Hinv = np.linalg.inv(H)
    # Backward map for remap: output pixel → source pixel (perspective, then curl).
    pts = np.stack([xs.ravel(), ys.ravel(), np.ones(xs.size, np.float32)])
    back = Hinv @ pts
    mx = (back[0] / back[2]).reshape(h, w).astype(np.float32)
    my = (back[1] / back[2]).reshape(h, w).astype(np.float32)
    my = my - (amp * np.sin(np.pi * mx / w)).astype(np.float32)
    img = cv2.remap(gray, mx, my, cv2.INTER_LINEAR, borderValue=int(rng.uniform(60, 140)))
    img = img.astype(np.float32) / 255

    # Light: gradient, a soft shadow, a slightly grey paper.
    gx, gy = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))
    img = img * (rng.uniform(0.72, 0.95) + rng.uniform(-0.12, 0.12) * gx + rng.uniform(-0.12, 0.12) * gy)
    cx, cy, r = rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.3, 0.9)
    img = img * (1 - rng.uniform(0.1, 0.35) * np.exp(-((gx - cx) ** 2 + (gy - cy) ** 2) / (2 * r * r)))
    img = cv2.GaussianBlur(img.astype(np.float32), (0, 0), rng.uniform(0.6, 1.6))
    img = img + np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, rng.uniform(0.01, 0.035), img.shape)
    img = np.clip(img * 255, 0, 255).astype(np.uint8)

    # Phone resolution: the page fills a ~3000 px tall frame, then JPEG.
    scale = rng.uniform(2400, 3200) / h
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    ok, enc = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(55, 85)])
    img = cv2.imdecode(enc, cv2.IMREAD_GRAYSCALE)

    def forward(x, y):
        y = y + amp * np.sin(np.pi * x / w)
        p = H @ np.array([x, y, 1.0])
        return p[0] / p[2] * scale, p[1] / p[2] * scale

    return img, forward, scale


def main():
    pages = sorted(glob.glob(os.path.join(ROOT, 'data', 'lilypond', '*', 'default', 'p*-300.pgm')))
    for path in pages:
        piece = path.split(os.sep)[-3]
        page = os.path.basename(path).split('-')[0]
        out_dir = os.path.join(OUT, piece)
        out = os.path.join(out_dir, f'{page}.pgm')
        if os.path.exists(out):
            continue
        rng = random.Random(f'{piece}/{page}')
        gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        truth = json.load(open(path[:-4] + '.json'))
        img, forward, scale = simulate(gray, rng)
        heads = []
        for n in truth['noteheads']:
            x, y = forward(n['x'], n['y'])
            heads.append({**n, 'x': x, 'y': y, 'width': n['width'] * scale, 'height': n['height'] * scale})
        staves = []
        for st in truth['staves']:
            mid = (st['x0'] + st['x1']) / 2
            lines = [forward(mid, y)[1] for y in st['lines']]
            staves.append({'lines': lines, 'x0': forward(st['x0'], st['lines'][2])[0], 'x1': forward(st['x1'], st['lines'][2])[0]})
        os.makedirs(out_dir, exist_ok=True)
        cv2.imwrite(out, img)
        json.dump({'width': img.shape[1], 'height': img.shape[0], 'staves': staves, 'noteheads': heads}, open(out[:-4] + '.json', 'w'))
        print('ok', piece, page)


if __name__ == '__main__':
    main()
