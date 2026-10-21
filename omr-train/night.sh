#!/usr/bin/env bash
# One overnight round aimed at real MuseScore-style parts: fresh training pages
# with metronome marks (♩ = 112) the detector must not read as notes, a
# fine-tune of the shipped model on them plus everything before, and a
# judgement against the shipped model on the same eval pages — including your
# own pages in omr-eval/private. The candidate replaces the model only if it
# scores better. Like improve.sh, a bad round changes nothing.
#
#   omr-train/night.sh                     # defaults below
#   STEPS=3000 GEN=300 omr-train/night.sh  # a shorter round
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd .. && pwd)
STEPS=${STEPS:-8000}
GEN=${GEN:-900}
LR=${LR:-0.0012}
SEED=${SEED:-600000}
OUT=runs/night
LOG=runs/night.log
mkdir -p runs data "$OUT"
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "generating $GEN Verovio pages and $((GEN * 2 / 3)) LilyPond pages with tempo marks (seeds from $SEED)"
for i in 0 1 2; do
  node gen/generate.mjs --from $((SEED + i * GEN / 3)) --count $((GEN / 3)) --out data/verovio-tempo > "data/gen-tempo-$i.log" 2>&1 &
done
LILY=$((GEN * 2 / 3))
node gen/lilypond-random.mjs --from $((SEED + 5000)) --count $((LILY / 2)) --out data/lilyrand-tempo > data/lilyrand-tempo-0.log 2>&1 &
node gen/lilypond-random.mjs --from $((SEED + 5000 + LILY / 2)) --count $((LILY / 2)) --out data/lilyrand-tempo > data/lilyrand-tempo-1.log 2>&1 &
wait
log "pages: $(ls data/verovio-tempo | grep -c json) Verovio, $(ls data/lilyrand-tempo | grep -c json) LilyPond"

START=$(uv run python -c "import torch; print(torch.load('runs/current.pt', map_location='cpu')['step'])")
log "fine-tuning from step $START for $STEPS steps"
uv run python -m omr.train --data data/verovio-rhythm data/lilypond data/lilyrand data/verovio-tempo data/lilyrand-tempo \
  --resume runs/current.pt --steps $((START + STEPS)) --lr "$LR" --batch 16 --workers 3 --threads 4 --out "$OUT" > runs/night.train.log 2>&1
log "training done"

# Judge both models on the same pages: clean engraving, photos, synthetic
# rhythm, and your MuseScore pages at the resolution phones give.
mkdir -p runs/night-cand
uv run python -m omr.export "$OUT/last.pt" runs/night-cand/detector runs/night-cand/test.json > /dev/null
cd "$ROOT"
FILTER='default/p1-150|photos/[^/]+/p1\.|verovio-rhythm/|private/lowres/'
for which in base cand; do
  MODEL=public/omr/detector
  [ "$which" = cand ] && MODEL=omr-train/runs/night-cand/detector
  npx tsx --tsconfig omr-eval/tsconfig.json omr-eval/eval.ts --quiet --filter "$FILTER" \
    --model "$MODEL" --label "night-$which" > "omr-train/runs/night-$which.eval.log" 2>&1
done

# Half pitch, half rhythm, as improve.sh — plus how many found notes are real
# on the rhythm path (tempo marks read as notes lower it).
score() { python3 - "$1" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))['summary']
named = {k: v for k, v in s.items() if k != 'all'}
groups = list(named.values())
pitch = sum(g['sequenceAccuracy'] for g in groups) / len(groups)
# MuseScore truth has no real durations (every head reads as a quarter): pitch only there.
rhythm = [g[k] for n, g in named.items() if 'private' not in n for k in ('rhythmAccuracy', 'durationAccuracy') if g.get(k) is not None]
precision = [g['rhythmPrecision'] for g in groups if g.get('rhythmPrecision') is not None]
print(0.45 * pitch + 0.45 * (sum(rhythm) / len(rhythm) if rhythm else 0) + 0.1 * (sum(precision) / len(precision) if precision else 0))
PY
}
BASE=$(score omr-eval/reports/night-base.json)
NEW=$(score omr-eval/reports/night-cand.json)
log "score: shipped $BASE, candidate $NEW"
if python3 -c "import sys; sys.exit(0 if float('$NEW') > float('$BASE') else 1)"; then
  cp "omr-train/$OUT/last.pt" omr-train/runs/current.pt
  CKPT=runs/current.pt npm run omr:model > /dev/null
  log "ACCEPTED — public/omr/detector.* replaced; run npm test, then commit"
else
  log "rejected — shipped model unchanged"
fi
