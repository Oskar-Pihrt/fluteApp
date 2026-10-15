# OMR detector training

How the network in `public/omr/detector.{json,bin}` is made. Nothing here ships
in the app: the app gets only the exported weights and runs them with its own
TypeScript runtime (`src/omr/net.ts`).

## What the network does

A small fully convolutional network (`omr/model.py`, ~170 k parameters, ~3 GMAC
for a whole page) looks at a page normalised to a **10 px staff space** and
predicts, at a quarter of the resolution, a heatmap per symbol class plus a
sub-cell offset — CenterNet without boxes, since every symbol's size is fixed by
the staff spacing anyway.

Classes (`omr/targets.py`): filled, hollow and grace noteheads; sharp, flat,
natural, double sharp, double flat; clef; barline; ottava start and end; and a
marker on noteheads that continue a tie. Rests, text, dynamics, beams, slurs and
the rest are not classes — they are what the network learns *not* to fire on.

Turning those detections into pitches (staff position, key signature,
accidentals in force, ottava, ties) is ordinary code in `src/omr/assemble.ts`.

## Data

| Source | Script | Notes |
| --- | --- | --- |
| Synthetic parts engraved by **Verovio** in five SMuFL fonts (Leipzig, Bravura, Leland, Petaluma, Gootville) | `gen/generate.mjs` | Random monophonic parts from `gen/melody.mjs`: beams of every density, rests, ties, slurs, ottava, grace notes, tuplets, dynamics, hairpins, text, fingerings, articulations, meter and key changes, repeats. Layout, staff size, spacing and line weights randomised per page. |
| Real parts engraved by **LilyPond** (Mutopia `split: train`) | `../omr-eval/scripts/build-lilypond.mjs --split train` | A second engraver and font (Emmentaler), real music. |

Training crops are augmented (`omr/dataset.py`) towards what the app really
gets: screenshots (low resolution upscaled), scans (binarised, speckled, ink
thickened) and photos (blur, uneven light, shadow, noise, JPEG, slight rotation).

## Reproducing the model

```bash
cd omr-train
uv sync                                        # Python 3.12 + PyTorch (CPU)
(cd gen && npm install)
for i in 0 1 2; do node gen/generate.mjs --from $((i*700)) --count 700 & done; wait
node ../omr-eval/scripts/build-lilypond.mjs --split train   # needs LilyPond, see ../omr-eval/README.md
uv run python -m omr.train --data data/verovio data/lilypond --steps 12000 --batch 16 --out runs/v1
cp runs/v1/last.pt runs/current.pt
cd .. && npm run omr:model                     # export → public/omr/detector.*
npm run omr:eval                               # judge it
```

Training is CPU-only by design (the development machine has no usable GPU):
about 0.8 steps/s on four cores, so 12 000 steps is roughly four hours.

`npm run omr:model` also writes `src/omr/testing/detector.test.json`, a
PyTorch reference output that `src/omr/net.test.ts` checks the TypeScript
runtime against — if you change an operation in either place, that test is
what tells you they still agree.

## Licences

Verovio (LGPL-3.0) and LilyPond (GPL) are only tools in this pipeline; nothing
from them is linked into the app. The network architecture and training code
are this project's own. Mutopia pieces carry their own licences (public domain
or Creative Commons), listed per piece in `../omr-eval/corpus.json`.
