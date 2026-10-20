"""Training crops with augmentation.

Pages are normalised to a staff spacing of `TARGET_S` pixels — the same
normalisation the app applies before inference — with a random jitter so the
model tolerates the app's imperfect scale estimate. Each page load yields
several crops, mostly centred on staves where all the labels live, sometimes
anywhere (titles, margins and text are what false positives come from).

Augmentation imitates the inputs the app actually gets: PDF screenshots
(clean, possibly low-resolution and upscaled), scans (binarised, speckled,
thickened or thinned ink, slight rotation) and phone photos (blur, JPEG,
uneven light, shadows, noise, low contrast).
"""
import glob
import math
import os
import random

import cv2
import numpy as np
import torch
from torch.utils.data import IterableDataset, get_worker_info

from .targets import CLASSES, RHYTHM_FIRST, load_anchors

TARGET_S = 10.0
STRIDE = 4
CROP = 224


def find_pages(roots):
    pages = []
    for root in roots:
        for json_path in glob.glob(os.path.join(root, '**', '*.json'), recursive=True):
            base = json_path[:-5]
            for ext in ('.png', '.pgm'):
                if os.path.exists(base + ext):
                    pages.append((base + ext, json_path))
                    break
    return sorted(pages)


def gaussian_targets(anchors, out_h, out_w, sigma_cells=0.7):
    """Heatmaps (C, H, W), offsets (2, H, W) and offset mask (H, W) at output stride."""
    heat = np.zeros((len(CLASSES), out_h, out_w), np.float32)
    offset = np.zeros((2, out_h, out_w), np.float32)
    mask = np.zeros((out_h, out_w), np.float32)
    radius = int(math.ceil(sigma_cells * 3))
    ys, xs = np.mgrid[-radius : radius + 1, -radius : radius + 1]
    for cls, x, y in anchors:
        cx, cy = x / STRIDE, y / STRIDE
        ix, iy = int(cx), int(cy)
        if not (0 <= ix < out_w and 0 <= iy < out_h):
            continue
        g = np.exp(-((xs + ix + 0.5 - cx) ** 2 + (ys + iy + 0.5 - cy) ** 2) / (2 * sigma_cells**2))
        x0, x1 = max(0, ix - radius), min(out_w, ix + radius + 1)
        y0, y1 = max(0, iy - radius), min(out_h, iy + radius + 1)
        gx0, gy0 = x0 - (ix - radius), y0 - (iy - radius)
        patch = g[gy0 : gy0 + (y1 - y0), gx0 : gx0 + (x1 - x0)]
        np.maximum(heat[cls, y0:y1, x0:x1], patch, out=heat[cls, y0:y1, x0:x1])
        heat[cls, iy, ix] = 1.0
        offset[0, iy, ix] = cx - ix
        offset[1, iy, ix] = cy - iy
        mask[iy, ix] = 1.0
    return heat, offset, mask


def attribute_targets(attributes, out_h, out_w):
    """Duration and dot labels (H, W), −1 where unlabelled.

    A label covers the 3×3 cells around its point, so it is still read
    correctly when the detected peak lands a cell off.
    """
    dur = np.full((out_h, out_w), -1, np.int64)
    dots = np.full((out_h, out_w), -1, np.int64)
    for x, y, d, n in attributes:
        ix, iy = int(x / STRIDE), int(y / STRIDE)
        x0, x1 = max(0, ix - 1), min(out_w, ix + 2)
        y0, y1 = max(0, iy - 1), min(out_h, iy + 2)
        if x0 >= x1 or y0 >= y1:
            continue
        if d >= 0:
            dur[y0:y1, x0:x1] = d
        if n >= 0:
            dots[y0:y1, x0:x1] = n
    return dur, dots


def augment(img, rng):
    """Photometric degradations on a float32 image in [0, 1] (1 = paper)."""
    h, w = img.shape
    kind = rng.random()
    # Ink weight: thicken or thin strokes a little, as heavy or light printing does.
    # Thinning is rare: at a 10 px staff space a staff line is a pixel or two
    # thick and disappears outright.
    if rng.random() < 0.25:
        k = np.ones((2, 2), np.uint8)
        img = cv2.erode(img, k) if rng.random() < 0.8 else cv2.dilate(img, k)
    # Low-resolution source upscaled (screenshots of a whole page).
    if rng.random() < 0.25:
        f = rng.uniform(0.4, 0.8)
        small = cv2.resize(img, (max(8, int(w * f)), max(8, int(h * f))), interpolation=cv2.INTER_AREA)
        img = cv2.resize(small, (w, h), interpolation=rng.choice([cv2.INTER_LINEAR, cv2.INTER_CUBIC, cv2.INTER_NEAREST]))
    # Blur (focus, motion-free).
    if rng.random() < 0.35:
        s = rng.uniform(0.3, 1.3)
        img = cv2.GaussianBlur(img, (0, 0), s)
    # Paper and ink tone, contrast.
    paper = rng.uniform(0.75, 1.0) if kind < 0.6 else 1.0
    ink = rng.uniform(0.0, 0.35)
    img = ink + (paper - ink) * img
    # Uneven light: a linear gradient plus soft shadow blobs (photos).
    if kind < 0.45:
        gx, gy = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))
        a, b = rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25)
        img = img * (1 + a * gx + b * gy)
        for _ in range(rng.randint(0, 2)):
            cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(w * 0.2, w * 0.8)
            blob = np.exp(-((gx * w / 2 + w / 2 - cx) ** 2 + (gy * h / 2 + h / 2 - cy) ** 2) / (2 * r * r))
            img = img * (1 - rng.uniform(0.1, 0.4) * blob)
    # Sensor noise.
    if rng.random() < 0.5:
        img = img + np.random.normal(0, rng.uniform(0.005, 0.06), img.shape).astype(np.float32)
    # Speckle (dirty scans).
    if rng.random() < 0.15:
        n = int(h * w * rng.uniform(0.0005, 0.004))
        ys_, xs_ = np.random.randint(0, h, n), np.random.randint(0, w, n)
        img[ys_, xs_] = rng.choice([0.0, 1.0])
    img = np.clip(img, 0, 1)
    # Hard binarisation (fax-like scans, or the app's own thresholding).
    if rng.random() < 0.15:
        img = (img > rng.uniform(0.4, 0.65)).astype(np.float32)
    # JPEG artefacts.
    if rng.random() < 0.4:
        q = rng.randint(25, 90)
        ok, enc = cv2.imencode('.jpg', (img * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, q])
        if ok:
            img = cv2.imdecode(enc, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    return img


class CropDataset(IterableDataset):
    def __init__(self, pages, crops_per_page=8, augment_p=0.85, seed=0, rotate_deg=1.5):
        self.pages = pages
        self.crops_per_page = crops_per_page
        self.augment_p = augment_p
        self.seed = seed
        self.rotate_deg = rotate_deg

    def __iter__(self):
        info = get_worker_info()
        wid = info.id if info else 0
        rng = random.Random(self.seed * 1000 + wid + random.randint(0, 1 << 30))
        np.random.seed(rng.randint(0, 1 << 31))
        while True:
            img_path, json_path = rng.choice(self.pages)
            try:
                truth, anchors, S, attributes, rhythm = load_anchors(json_path)
            except Exception:
                continue
            if not S or not anchors:
                continue
            page = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if page is None:
                continue
            class_mask = np.ones(len(CLASSES), np.float32)
            if not rhythm:
                class_mask[RHYTHM_FIRST:] = 0
            for _ in range(self.crops_per_page):
                sample = self.crop(page, truth, anchors, S, rng, attributes, class_mask)
                if sample is not None:
                    yield sample

    def crop(self, page, truth, anchors, S, rng, attributes=(), class_mask=None):
        h, w = page.shape
        scale = TARGET_S / S * rng.uniform(0.85, 1.2)
        angle = rng.uniform(-self.rotate_deg, self.rotate_deg) if rng.random() < 0.5 else 0.0
        # Crop centre in page pixels: on a staff most of the time.
        staves = truth['staves']
        if rng.random() < 0.85 and staves:
            st = rng.choice(staves)
            cy = (st['lines'][0] + st['lines'][4]) / 2 + rng.uniform(-6, 6) * S
            cx = rng.uniform(st['x0'], st['x1'])
        else:
            cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        # Affine: page → crop. Scale, rotate about the crop centre.
        M = cv2.getRotationMatrix2D((cx, cy), angle, scale)
        M[0, 2] += CROP / 2 - cx
        M[1, 2] += CROP / 2 - cy
        img = cv2.warpAffine(page, M, (CROP, CROP), flags=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR, borderValue=255)
        img = img.astype(np.float32) / 255

        pts = []
        for cls, x, y in anchors:
            nx = M[0, 0] * x + M[0, 1] * y + M[0, 2]
            ny = M[1, 0] * x + M[1, 1] * y + M[1, 2]
            if 0 <= nx < CROP and 0 <= ny < CROP:
                pts.append((cls, nx, ny))

        attrs = []
        for x, y, d, n in attributes:
            nx = M[0, 0] * x + M[0, 1] * y + M[0, 2]
            ny = M[1, 0] * x + M[1, 1] * y + M[1, 2]
            if 0 <= nx < CROP and 0 <= ny < CROP:
                attrs.append((nx, ny, d, n))

        if rng.random() < self.augment_p:
            img = augment(img, rng)
        heat, offset, mask = gaussian_targets(pts, CROP // STRIDE, CROP // STRIDE)
        dur, dots = attribute_targets(attrs, CROP // STRIDE, CROP // STRIDE)
        x = torch.from_numpy((1.0 - img[None]).astype(np.float32))  # ink = 1, paper = 0
        cmask = class_mask if class_mask is not None else np.ones(len(CLASSES), np.float32)
        return (
            x,
            torch.from_numpy(heat),
            torch.from_numpy(offset),
            torch.from_numpy(mask),
            torch.from_numpy(dur),
            torch.from_numpy(dots),
            torch.from_numpy(cmask),
        )
