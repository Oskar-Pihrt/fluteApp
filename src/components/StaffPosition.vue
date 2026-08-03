<script setup lang="ts">
import { computed } from 'vue'
import { staffPosition } from '@/domain/staff'

/**
 * Where a note falls on a five-line staff. Purely informational: no clef,
 * stem or duration, since this isn't notating rhythm or replacing a real
 * score, just showing where the note sits relative to the five lines.
 */
const props = withDefaults(defineProps<{ note: string; size?: 'sm' | 'md' }>(), { size: 'md' })

const WIDTH = 90
const HEIGHT = 240
const LINE_SPACING = 18
const HALF_STEP = LINE_SPACING / 2
/** E4, the bottom line. */
const STAFF_BOTTOM_Y = 191
const STAFF_X1 = 6
const STAFF_X2 = 84
const NOTE_X = 60
const LEDGER_HALF_WIDTH = 15

const PIXEL_WIDTH = { sm: 46, md: 64 } as const

function y(relative: number): number {
  return STAFF_BOTTOM_Y - relative * HALF_STEP
}

const position = computed(() => staffPosition(props.note))

const staffLineYs = [0, 2, 4, 6, 8].map(y)

const ledgerYs = computed(() => {
  const pos = position.value
  if (!pos) return []
  const below = Array.from({ length: pos.ledgerBelow }, (_, i) => y(-2 * (i + 1)))
  const above = Array.from({ length: pos.ledgerAbove }, (_, i) => y(8 + 2 * (i + 1)))
  return [...below, ...above]
})

const noteY = computed(() => (position.value ? y(position.value.relative) : 0))

const accidentalGlyph = computed(() => {
  const acc = position.value?.accidental
  return acc === '#' ? '♯' : acc === 'b' ? '♭' : ''
})

const description = computed(() => {
  const pos = position.value
  if (!pos) return ''
  if (pos.ledgerBelow > 0) {
    return `${pos.ledgerBelow} ledger line${pos.ledgerBelow > 1 ? 's' : ''} below the staff`
  }
  if (pos.ledgerAbove > 0) {
    return `${pos.ledgerAbove} ledger line${pos.ledgerAbove > 1 ? 's' : ''} above the staff`
  }
  if (pos.relative === 0) return 'on the bottom line'
  if (pos.relative === 8) return 'on the top line'
  return pos.onLine ? 'on a staff line' : 'in a staff space'
})
</script>

<template>
  <svg
    v-if="position"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    :width="PIXEL_WIDTH[size]"
    :height="(PIXEL_WIDTH[size] * HEIGHT) / WIDTH"
    role="img"
    :aria-label="`${note}, ${description}`"
    class="staff-position"
  >
    <line
      v-for="ly in staffLineYs"
      :key="`staff-${ly}`"
      :x1="STAFF_X1"
      :y1="ly"
      :x2="STAFF_X2"
      :y2="ly"
      class="staff-line"
    />

    <!-- Only the ledger lines this note actually needs. -->
    <line
      v-for="ly in ledgerYs"
      :key="`ledger-${ly}`"
      :x1="NOTE_X - LEDGER_HALF_WIDTH"
      :y1="ly"
      :x2="NOTE_X + LEDGER_HALF_WIDTH"
      :y2="ly"
      class="ledger-line"
    />

    <text
      v-if="accidentalGlyph"
      :x="NOTE_X - 22"
      :y="noteY"
      class="accidental"
      aria-hidden="true"
    >
      {{ accidentalGlyph }}
    </text>

    <ellipse
      :cx="NOTE_X"
      :cy="noteY"
      rx="9"
      ry="6.5"
      :transform="`rotate(-20 ${NOTE_X} ${noteY})`"
      class="notehead"
    />
  </svg>
</template>

<style scoped>
.staff-position {
  display: block;
  overflow: visible;
}

.staff-line,
.ledger-line {
  stroke: var(--color-ink-400);
  stroke-width: 2;
}

.notehead {
  fill: var(--color-brass-400);
}

.accidental {
  fill: var(--color-ink-200);
  font-size: 24px;
  text-anchor: middle;
  dominant-baseline: central;
}
</style>
