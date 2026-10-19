#!/usr/bin/env bash
# One unattended round of improving the note detector. Costs no tokens: it
# generates fresh training pages, fine-tunes the current model, judges the
# candidate on the eval set, and replaces the shipped model only if it scored
# better. Safe to run overnight; a bad round changes nothing.
#
#   npm run omr:improve                       # defaults below
#   STEPS=3000 GEN=300 npm run omr:improve    # a shorter round
#
# Needs the same setup as omr-train/README.md (uv sync, LilyPond, generators).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(cd .. && pwd)
STEPS=${STEPS:-6000}      # fine-tuning steps this round (~0.8 steps/s on 4 cores)
GEN=${GEN:-400}           # new Verovio pages (seeds) and as many LilyPond ones
LR=${LR:-0.0012}
LOG=runs/improve.log
mkdir -p runs data
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

[ -f runs/current.pt ] || { log "no runs/current.pt — train a first model (README)"; exit 1; }

# Fresh seeds each round, so the model never trains on the same pages twice.
ROUND=$(cat runs/round 2>/dev/null || echo 0); ROUND=$((ROUND + 1)); echo $ROUND > runs/round
BASE=$((100000 + ROUND * 10000))
log "round $ROUND: generating $GEN + $GEN pages (seeds from $BASE)"
for i in 0 1 2; do
  node gen/generate.mjs --from $((BASE + i * GEN / 3)) --count $((GEN / 3)) > data/gen-r$ROUND-$i.log 2>&1 &
done
node gen/lilypond-random.mjs --from $((BASE + 5000)) --count "$GEN" --out data/lilyrand > data/lilyrand-r$ROUND.log 2>&1 &
wait

# Real-music training pages (Mutopia, train split) once.
[ -d data/lilypond ] && [ "$(ls data/lilypond | wc -l)" -gt 0 ] || node ../omr-eval/scripts/build-lilypond.mjs --split train >> "$LOG" 2>&1 || true

START=$(uv run python -c "import torch; print(torch.load('runs/current.pt', map_location='cpu')['step'])")
OUT=runs/r$ROUND
log "fine-tuning from step $START for $STEPS steps"
uv run python -m omr.train --data data/verovio data/lilypond data/lilyrand --resume runs/current.pt \
  --steps $((START + STEPS)) --lr "$LR" --batch 16 --workers 3 --threads 4 --out "$OUT" > "runs/r$ROUND.train.log" 2>&1

# Judge the candidate against the model in use, on the same eval pages.
mkdir -p runs/cand
uv run python -m omr.export "$OUT/last.pt" runs/cand/detector runs/cand/test.json > /dev/null
cd "$ROOT"
FILTER='default/p1-150|photos/[^/]+/p1\.'
npx tsx --tsconfig omr-eval/tsconfig.json omr-eval/eval.ts --quiet --filter "$FILTER" \
  --model omr-train/runs/cand/detector --label "cand-r$ROUND" > omr-train/runs/cand/eval.log 2>&1

score() { python3 - "$1" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))['summary']
groups = [v['sequenceAccuracy'] for k, v in s.items() if k != 'all']
# Clean pages and photos count equally, whatever their number.
print(sum(groups) / len(groups) if groups else s['all']['sequenceAccuracy'])
PY
}
NEW=$(score "omr-eval/reports/cand-r$ROUND.json")
BEST=$(cat omr-train/runs/best 2>/dev/null || echo 0)
log "candidate score $NEW (best so far $BEST)"
if python3 -c "import sys; sys.exit(0 if float('$NEW') > float('$BEST') else 1)"; then
  cp "omr-train/$OUT/last.pt" omr-train/runs/current.pt
  echo "$NEW" > omr-train/runs/best
  CKPT=runs/current.pt npm run omr:model > /dev/null
  log "ACCEPTED — public/omr/detector.* replaced; run npm test, then commit"
else
  log "rejected — shipped model unchanged"
fi
