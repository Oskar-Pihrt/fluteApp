"""The detector: a small fully convolutional U-Net with CenterNet heads.

Deliberately built only from operations the app's TypeScript runtime
implements (src/omr/net.ts): 3×3 and 1×1 convolutions (grouped for
depthwise), batch norm (folded into the conv at export), ReLU, nearest ×2
upsampling, channel concatenation and a sigmoid. Anything else here would
need a matching kernel there.

Input: 1 channel, ink = 1, page normalised to a staff spacing of 10 px.
Output at stride 4: one heatmap per class and a 2-channel sub-cell offset.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F

from .targets import CLASSES, DURATIONS, MAX_DOTS

SEPARABLE = True


class ConvBN(nn.Sequential):
    def __init__(self, cin, cout, k=3, stride=1, dilation=1, groups=1, relu=True):
        pad = dilation * (k // 2)
        layers = [nn.Conv2d(cin, cout, k, stride, pad, dilation=dilation, groups=groups, bias=False), nn.BatchNorm2d(cout)]
        if relu:
            layers.append(nn.ReLU(inplace=True))
        super().__init__(*layers)


class DWSep(nn.Sequential):
    """A 3×3 block: depthwise-separable when `SEPARABLE`, a plain convolution
    otherwise. Separable is fewer FLOPs, but PyTorch's CPU backward for
    depthwise convolutions is so slow that plain convolutions train several
    times faster here — and training time on a CPU is the binding constraint."""

    def __init__(self, cin, cout, stride=1, dilation=1):
        if SEPARABLE:
            super().__init__(ConvBN(cin, cin, 3, stride, dilation, groups=cin), ConvBN(cin, cout, 1))
        else:
            super().__init__(ConvBN(cin, cout, 3, stride, dilation))


class Residual(nn.Module):
    def __init__(self, c, dilation=1):
        super().__init__()
        self.block = DWSep(c, c, dilation=dilation)

    def forward(self, x):
        return x + self.block(x)


class Detector(nn.Module):
    """Encoder to /16, decoder back to /4, heads at /4.

    The output stride is 4 — 2.5 px at the 10 px staff space — with the offset
    head restoring sub-cell precision. Every layer at /4 is depthwise-separable
    and narrow, because that resolution is where the app spends its time: the
    whole network is about 2 GMAC on a full page.
    """

    def __init__(self, width=1.0):
        super().__init__()
        c = lambda n: max(8, int(n * width))
        self.stem = nn.Sequential(ConvBN(1, c(16), 3, 2), DWSep(c(16), c(32), 2))  # /4
        self.enc4 = Residual(c(32))
        self.enc8 = nn.Sequential(DWSep(c(32), c(80), 2), Residual(c(80)), Residual(c(80), 2))  # /8
        self.enc16 = nn.Sequential(DWSep(c(80), c(160), 2), Residual(c(160)), Residual(c(160), 2), Residual(c(160), 4), Residual(c(160), 8))  # /16
        self.dec8 = DWSep(c(160) + c(80), c(64))
        self.dec4 = DWSep(c(64) + c(32), c(32))
        self.head = DWSep(c(32), c(32))
        self.heat = nn.Conv2d(c(32), len(CLASSES), 1)
        self.offset = nn.Conv2d(c(32), 2, 1)
        # Attributes of the symbol at a peak: a note's duration, and its dots.
        self.dur = nn.Conv2d(c(32), len(DURATIONS), 1)
        self.dots = nn.Conv2d(c(32), MAX_DOTS + 1, 1)
        nn.init.constant_(self.heat.bias, -2.19)  # prior ≈ 0.1, the CenterNet init

    def forward(self, x):
        s4 = self.enc4(self.stem(x))
        s8 = self.enc8(s4)
        s16 = self.enc16(s8)
        up = lambda t: F.interpolate(t, scale_factor=2, mode='nearest')
        d8 = self.dec8(torch.cat([up(s16), s8], 1))
        d4 = self.dec4(torch.cat([up(d8), s4], 1))
        h = self.head(d4)
        return self.heat(h), self.offset(h), self.dur(h), self.dots(h)


def focal_loss(logits, target, class_mask=None):
    """CenterNet's penalty-reduced focal loss over heatmaps.

    `class_mask` (N, C) leaves out classes a sample's source has no truth
    for — they are neither positives nor background there.
    """
    pred = torch.sigmoid(logits).clamp(1e-4, 1 - 1e-4)
    weight = class_mask[:, :, None, None] if class_mask is not None else 1.0
    pos = target.eq(1).float() * weight
    neg = (1 - target.eq(1).float()) * weight
    pos_loss = torch.log(pred) * (1 - pred) ** 2 * pos
    neg_loss = torch.log(1 - pred) * pred**2 * (1 - target) ** 4 * neg
    num_pos = pos.sum().clamp(min=1)
    return -(pos_loss.sum() + neg_loss.sum()) / num_pos


def attribute_loss(logits, target):
    """Cross-entropy over the labelled cells only (−1 is unlabelled)."""
    if not (target >= 0).any():
        return logits.sum() * 0
    return F.cross_entropy(logits, target, ignore_index=-1)


def offset_loss(pred, target, mask):
    m = mask[:, None]
    return (F.l1_loss(pred * m, target * m, reduction='sum')) / mask.sum().clamp(min=1)
