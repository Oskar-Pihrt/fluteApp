"""Export a trained checkpoint for the app's TypeScript runtime (src/omr/net.ts).

    uv run python -m omr.export runs/v1/last.pt ../public/omr/detector [test.json]

Writes `<out>.json` (the op list) and `<out>.bin` (float16 weights). Batch
norm is folded into the preceding convolution, so the runtime only ever sees
convolutions with a bias. A reference input/output pair is written alongside
(`<out>.test.json`) so the TS runtime can be checked against PyTorch.
"""
import json
import sys

import numpy as np
import torch
import torch.nn as nn

from .model import ConvBN, Detector, DWSep, Residual
from .targets import CLASSES, DURATIONS


class Exporter:
    def __init__(self):
        self.ops = []
        self.blobs = []
        self.offset = 0  # in float16 elements
        self.count = 0

    def tensor(self):
        self.count += 1
        return f't{self.count}'

    def blob(self, array):
        array = np.ascontiguousarray(array, dtype=np.float16)
        start = self.offset
        self.blobs.append(array.ravel())
        self.offset += array.size
        return start

    def conv(self, x, conv: nn.Conv2d, bn: nn.BatchNorm2d | None, relu: bool):
        w = conv.weight.detach().double()
        b = conv.bias.detach().double() if conv.bias is not None else torch.zeros(w.shape[0], dtype=torch.float64)
        if bn is not None:
            scale = bn.weight.detach().double() / torch.sqrt(bn.running_var.double() + bn.eps)
            w = w * scale[:, None, None, None]
            b = (b - bn.running_mean.double()) * scale + bn.bias.detach().double()
        out = self.tensor()
        self.ops.append(
            {
                'op': 'conv',
                'in': x,
                'out': out,
                'cin': conv.in_channels,
                'cout': conv.out_channels,
                'k': conv.kernel_size[0],
                'stride': conv.stride[0],
                'pad': conv.padding[0],
                'dilation': conv.dilation[0],
                'groups': conv.groups,
                'relu': relu,
                'weight': self.blob(w.numpy()),
                'bias': self.blob(b.numpy()),
            }
        )
        return out

    def module(self, x, m):
        if isinstance(m, ConvBN):
            conv, bn = m[0], m[1]
            return self.conv(x, conv, bn, len(m) > 2)
        if isinstance(m, DWSep):
            for child in m:
                x = self.module(x, child)
            return x
        if isinstance(m, Residual):
            y = self.module(x, m.block)
            out = self.tensor()
            self.ops.append({'op': 'add', 'a': x, 'b': y, 'out': out})
            return out
        if isinstance(m, nn.Sequential):
            for child in m:
                x = self.module(x, child)
            return x
        if isinstance(m, nn.Conv2d):
            return self.conv(x, m, None, False)
        raise TypeError(type(m))

    def up(self, x):
        out = self.tensor()
        self.ops.append({'op': 'up2', 'in': x, 'out': out})
        return out

    def cat(self, a, b):
        out = self.tensor()
        self.ops.append({'op': 'concat', 'in': [a, b], 'out': out})
        return out


def export(model: Detector, out_base: str, test_path: str | None = None):
    model.eval()
    e = Exporter()
    x = 'input'
    s4 = e.module(e.module(x, model.stem), model.enc4)
    s8 = e.module(s4, model.enc8)
    s16 = e.module(s8, model.enc16)
    d8 = e.module(e.cat(e.up(s16), s8), model.dec8)
    d4 = e.module(e.cat(e.up(d8), s4), model.dec4)
    h = e.module(d4, model.head)
    heat = e.module(h, model.heat)
    offset = e.module(h, model.offset)
    dur = e.module(h, model.dur)
    dots = e.module(h, model.dots)
    manifest = {
        'format': 'fluteapp-omr-net',
        'version': 2,
        'classes': CLASSES,
        'durations': DURATIONS,
        'inputStaffSpace': 10,
        'stride': 4,
        'inputMultiple': 16,
        'outputs': {'heat': heat, 'offset': offset, 'dur': dur, 'dots': dots},
        'ops': e.ops,
    }
    with open(out_base + '.json', 'w') as f:
        json.dump(manifest, f)
    np.concatenate(e.blobs).astype('<f2').tofile(out_base + '.bin')

    # Reference pair for the runtime's parity test: a small deterministic input.
    g = torch.Generator().manual_seed(0)
    sample = (torch.rand(1, 1, 64, 48, generator=g) > 0.7).float()
    with torch.no_grad():
        hl, ol, dl, tl = model(sample)
    with open(test_path or out_base + '.test.json', 'w') as f:
        json.dump(
            {
                'input': sample[0, 0].numpy().round(4).tolist(),
                'heat': hl[0].numpy().round(5).tolist(),
                'offset': ol[0].numpy().round(5).tolist(),
                'dur': dl[0].numpy().round(5).tolist(),
                'dots': tl[0].numpy().round(5).tolist(),
            },
            f,
        )
    print(f'{len(e.ops)} ops, {e.offset} weights ({e.offset * 2 / 1024:.0f} KiB)')


if __name__ == '__main__':
    ckpt = torch.load(sys.argv[1], map_location='cpu')
    model = Detector(ckpt.get('width', 1.0))
    model.load_state_dict(ckpt['model'])
    export(model, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
