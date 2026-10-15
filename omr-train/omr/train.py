"""Train the detector.

    uv run python -m omr.train --data data/verovio data/lilypond --steps 20000 --out runs/v1

CPU-only by design (the development machine has no usable GPU), so the model
is small and crops are 256². Checkpoints are written every `--save-every`
steps and on exit, so a long run can be stopped and exported at any point.
"""
import argparse
import math
import os
import random
import time

import torch
from torch.utils.data import DataLoader

from .dataset import CropDataset, find_pages
from .model import Detector, focal_loss, offset_loss


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--data', nargs='+', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--steps', type=int, default=20000)
    p.add_argument('--batch', type=int, default=24)
    p.add_argument('--lr', type=float, default=3e-3)
    p.add_argument('--workers', type=int, default=3)
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--width', type=float, default=1.0)
    p.add_argument('--save-every', type=int, default=1000)
    p.add_argument('--resume', default=None)
    p.add_argument('--val-fraction', type=float, default=0.03)
    args = p.parse_args()

    torch.set_num_threads(args.threads)
    os.makedirs(args.out, exist_ok=True)
    pages = find_pages(args.data)
    random.Random(0).shuffle(pages)
    n_val = max(4, int(len(pages) * args.val_fraction))
    val_pages, train_pages = pages[:n_val], pages[n_val:]
    print(f'{len(train_pages)} train pages, {len(val_pages)} val pages', flush=True)

    model = Detector(args.width)
    print(f'{sum(p.numel() for p in model.parameters()) / 1e3:.0f}k parameters', flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    start = 0
    if args.resume:
        ckpt = torch.load(args.resume, map_location='cpu')
        model.load_state_dict(ckpt['model'])
        opt.load_state_dict(ckpt['opt'])
        start = ckpt['step']

    def lr_at(step):
        warm = 500
        if step < warm:
            return args.lr * (step + 1) / warm
        t = (step - warm) / max(1, args.steps - warm)
        return args.lr * (0.02 + 0.98 * 0.5 * (1 + math.cos(math.pi * min(1.0, t))))

    loader = DataLoader(CropDataset(train_pages), batch_size=args.batch, num_workers=args.workers, persistent_workers=args.workers > 0, prefetch_factor=4 if args.workers else None)
    # A fixed validation batch set, drawn once, so the numbers are comparable over time.
    val_iter = iter(DataLoader(CropDataset(val_pages, seed=12345), batch_size=args.batch, num_workers=0))
    val_batches = [next(val_iter) for _ in range(8)]

    def save(step, name='last.pt'):
        torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'step': step, 'width': args.width}, os.path.join(args.out, name))

    model.train()
    t0 = time.time()
    running = []
    step = start
    try:
        for x, heat, off, mask in loader:
            if step >= args.steps:
                break
            for g in opt.param_groups:
                g['lr'] = lr_at(step)
            logits, offset = model(x)
            lh = focal_loss(logits, heat)
            lo = offset_loss(offset, off, mask)
            loss = lh + lo
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            opt.step()
            running.append((lh.item(), lo.item()))
            step += 1
            if step % 100 == 0:
                mh = sum(r[0] for r in running) / len(running)
                mo = sum(r[1] for r in running) / len(running)
                running = []
                rate = (step - start) / (time.time() - t0)
                print(f'step {step}  heat {mh:.3f}  offset {mo:.3f}  lr {lr_at(step):.5f}  {rate:.2f} it/s', flush=True)
            if step % args.save_every == 0:
                model.eval()
                with torch.no_grad():
                    vl = [focal_loss(model(vx)[0], vh).item() for vx, vh, _, _ in val_batches]
                model.train()
                print(f'val heat {sum(vl) / len(vl):.3f}', flush=True)
                save(step)
                save(step, f'step{step}.pt')
    finally:
        save(step)
        print(f'saved at step {step}', flush=True)


if __name__ == '__main__':
    main()
