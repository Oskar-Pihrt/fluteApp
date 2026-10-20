# OMR eval set

The one place that decides whether note detection works. Every change to the
recogniser is judged by `npm run omr:eval` against pages with exact ground truth,
not by eye and not by synthetic fixtures alone.

## What is in it

| Source | How it is made | Truth |
| --- | --- | --- |
| `data/lilypond/<piece>/<variant>/p<N>-<dpi>.pgm` | Real solo parts (flute, clarinet, violin — all monophonic treble) from the [Mutopia Project](https://www.mutopiaproject.org), recompiled with LilyPond 2.24 and rendered at 72, 150 and 300 dpi, in the editor's layout (`default`) and squeezed onto a 16 pt staff (`small`) | Every notehead's position and pitch, read from LilyPond's own SVG output via `lilypond/omr-annotate.ly` |
| `data/photos/<piece>/p<N>.pgm` | The 300 dpi pages "photographed": perspective, page curl, uneven light, shadow, blur, noise, JPEG | The same noteheads, pushed through the same mapping |
| `private/` (git-ignored) | Your own pages — drop a `.pgm`/`.png` and a truth `.json` beside it | Hand-made |

Pieces and their licences are listed in `corpus.json`; `split: eval` pieces are
held out here, `split: train` pieces become training data for the detector
(`omr-train/`). Nothing downloaded or rendered is committed.

## Building it

Needs LilyPond 2.24.4 unpacked in `omr-train/.tools/` (no install, no root):

```bash
mkdir -p omr-train/.tools && cd omr-train/.tools
curl -LO https://gitlab.com/lilypond/lilypond/-/releases/v2.24.4/downloads/lilypond-2.24.4-linux-x86_64.tar.gz
tar xzf lilypond-2.24.4-linux-x86_64.tar.gz && cd ../..
```

plus `rsvg-convert`, `unzip` and Python with Pillow. Then:

```bash
node omr-eval/scripts/build-lilypond.mjs            # eval split → omr-eval/data/lilypond
uv run --project omr-train python omr-eval/scripts/photo-sim.py   # → omr-eval/data/photos
```

## Running it

```bash
npm run omr:eval                                   # the network, every page
npm run omr:eval -- --filter 'photos/'             # a subset (regex on the path)
npm run omr:eval -- --detector heuristic           # the old recogniser, for comparison
npm run omr:eval -- --label v2                     # report → reports/v2.json
```

Columns:

- **seq.acc** — 1 − edit distance ÷ truth length over the printed note sequence
  (staff by staff, left to right, chords reduced to the top note). The headline.
- **played** — the same against the sequence with tied continuations merged,
  which is what the app shows by default.
- **recall / precision** — noteheads found at the right place (within 0.6 staff
  spaces), regardless of pitch.
- **pitch** — of the noteheads found, how many got the right pitch.
- **≥95%** — pages read at 95 % or better.
- **dur. / dots** — of the noteheads found, how many got the right duration
  and dot count (where the truth has them: LilyPond pages have durations,
  `verovio-rhythm` pages both).
- **rhythm** — 1 − edit distance ÷ length over notes as pitch:duration:dots
  and rests, on pages whose truth has complete rhythm (`verovio-rhythm`).
- **bars** — measures whose durations add up to the time signature, as read
  or after the recogniser's own correction.

`data/verovio-rhythm/` is made from Verovio pages the detector never trained
on: `node omr-train/gen/generate.mjs --from 900000 --count 30 --out DIR`, then
`omr-eval/scripts/verovio-eval.py DIR omr-eval/data/verovio-rhythm`.

## Ground truth format

```jsonc
{
  "width": 1241, "height": 1754,
  "staves": [{ "lines": [y0, y1, y2, y3, y4], "x0": 104, "x1": 1136 }],
  "noteheads": [{ "x": 172.4, "y": 289.1, "width": 13.6, "height": 11.0,
                  "staffIndex": 1, "midi": 74, "grace": false, "tied": false }]
}
```

Noteheads are centres in image pixels; `midi` is the pitch the player fingers —
an ottava line is already applied.
