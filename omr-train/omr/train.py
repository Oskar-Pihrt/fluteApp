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
from .model import Detector, attribute_loss, focal_loss, offset_loss


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
    p.add_argument(
        '--init',
        default=None,
        help='warm-start weights from a checkpoint whose heads may differ (new classes or outputs)',
    )
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
    if args.init:
        # Every tensor whose shape matches is copied; a heatmap layer with more
        # classes keeps the old classes' rows, so only the new ones start cold.
        old = torch.load(args.init, map_location='cpu')['model']
        own = model.state_dict()
        copied = 0
        for name, tensor in old.items():
            if name not in own:
                continue
            if own[name].shape == tensor.shape:
                own[name] = tensor
                copied += 1
            elif own[name].shape[1:] == tensor.shape[1:] and own[name].shape[0] > tensor.shape[0]:
                own[name][: tensor.shape[0]] = tensor
                copied += 1
        model.load_state_dict(own)
        print(f'warm start: {copied} tensors from {args.init}', flush=True)
    if args.resume:
        ckpt = torch.load(args.resume, map_location='cpu')
        model.load_state_dict(ckpt['model'])
        opt.load_state_dict(ckpt['opt'])
        start = ckpt['step']

    def lr_at(step):
        # The schedule runs over this run's own steps, so a resumed run warms up
        # briefly and anneals again instead of inheriting a spent schedule.
        done = step - start
        warm = 200 if args.resume or args.init else 500
        if done < warm:
            return args.lr * (done + 1) / warm
        t = (done - warm) / max(1, args.steps - start - warm)
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
        for x, heat, off, mask, dur, dots, cmask in loader:
            if step >= args.steps:
                break
            for g in opt.param_groups:
                g['lr'] = lr_at(step)
            logits, offset, dur_logits, dots_logits = model(x)
            lh = focal_loss(logits, heat, cmask)
            lo = offset_loss(offset, off, mask)
            ld = attribute_loss(dur_logits, dur)
            lt = attribute_loss(dots_logits, dots)
            loss = lh + lo + 0.5 * ld + 0.5 * lt
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            opt.step()
            running.append((lh.item(), lo.item(), ld.item(), lt.item()))
            step += 1
            if step % 100 == 0:
                mh = sum(r[0] for r in running) / len(running)
                mo = sum(r[1] for r in running) / len(running)
                md = sum(r[2] for r in running) / len(running)
                mt = sum(r[3] for r in running) / len(running)
                running = []
                rate = (step - start) / (time.time() - t0)
                print(
                    f'step {step}  heat {mh:.3f}  offset {mo:.3f}  dur {md:.3f}  dots {mt:.3f}  lr {lr_at(step):.5f}  {rate:.2f} it/s',
                    flush=True,
                )
            if step % args.save_every == 0:
                model.eval()
                with torch.no_grad():
                    heat_losses, right, total = [], 0, 0
                    for vx, vh, _, _, vd, _, vm in val_batches:
                        vlogits, _, vdur, _ = model(vx)
                        heat_losses.append(focal_loss(vlogits, vh, vm).item())
                        labelled = vd >= 0
                        right += (vdur.argmax(1)[labelled] == vd[labelled]).sum().item()
                        total += labelled.sum().item()
                model.train()
                print(f'val heat {sum(heat_losses) / len(heat_losses):.3f}  duration accuracy {right / max(1, total):.3f}', flush=True)
                save(step)
                save(step, f'step{step}.pt')
    finally:
        save(step)
        print(f'saved at step {step}', flush=True)


if __name__ == '__main__':
    main()
