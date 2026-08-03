<script setup lang="ts">
import { computed } from 'vue'
import {
  EXCLUSIVE_KEY_GROUPS,
  FLUTE_KEYS,
  type FluteKey,
  type KeyId,
  keysInGroup,
  sortKeys,
} from '@/domain/keys'

/**
 * The flute's keywork drawn as a fingering chart — the keys alone, in their real
 * silhouettes, with no instrument body and no lettering. Filling a key in is
 * what "pressed" means.
 *
 * Laid out from the standard horizontal key chart, rotated upright so the
 * headjoint is at the top. Two consequences of that rotation are worth knowing,
 * because they are not what you would guess:
 *
 *  - The chart's second row becomes a LEFT column. It holds the two long thumb
 *    levers beside the left hand, the G♯ touchpiece, and the two small trill
 *    keys tucked between the right-hand keys.
 *  - The E♭ key and the footjoint keys run ACROSS the width, not down it. On the
 *    horizontal chart they are tall and narrow; rotated, they become wide and
 *    short, which is why the bottom of the diagram is a row of levers.
 *
 * Geometry is in viewBox units, transcribed proportionally from the chart.
 */

const props = withDefaults(
  defineProps<{
    /** Keys held down. */
    keys: readonly KeyId[]
    /** Keys whose ring is depressed but tone hole left open (open-hole flutes). */
    vented?: readonly KeyId[]
    interactive?: boolean
    /** Keys the current instrument doesn't have — shown faint and untappable. */
    unavailable?: readonly KeyId[]
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { vented: () => [], interactive: false, unavailable: () => [], size: 'md' },
)

const emit = defineEmits<{ 'update:keys': [KeyId[]] }>()

const WIDTH = 210
const HEIGHT = 612

/** A key is drawn from one or more primitives, all sharing its pressed state. */
type Part =
  | { s: 'circle'; cx: number; cy: number; r: number }
  | { s: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { s: 'arm'; x1: number; y1: number; x2: number; y2: number }

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface KeyDrawing {
  parts: Part[]
  hit: Box
  /** Ring keys can be vented, which needs a hole drawn in the middle. */
  ring?: { cx: number; cy: number; r: number }
}

/**
 * The six finger keys sit on the centre line, in two groups of three, and their
 * sizes graduate exactly as they do on the chart — the first is noticeably
 * smaller than the third.
 */
function fingerKey(cy: number, r: number): KeyDrawing {
  return {
    parts: [{ s: 'circle', cx: 130, cy, r }],
    ring: { cx: 130, cy, r },
    hit: { x: 130 - r - 6, y: cy - r - 6, width: (r + 6) * 2, height: (r + 6) * 2 },
  }
}

const LAYOUT: Record<KeyId, KeyDrawing> = {
  // Two long thumb levers down the left, beside the left hand. B♭ is the one
  // reaching further towards the headjoint.
  THUMB_BB: {
    parts: [{ s: 'rect', x: 66, y: 60, w: 30, h: 45, rx: 14 }],
    hit: { x: 66, y: 60, width: 32, height: 55 },
  },
  THUMB_B: {
    parts: [{ s: 'rect', x: 40, y: 114, w: 45, h: 70, rx: 14 }],
    hit: { x: 40, y: 114, width: 50, height: 80 },
  },

  L1: fingerKey(42, 20),
  L2: fingerKey(112, 26),
  L3: fingerKey(188, 28),

  // The G♯ key: a lobe out to the right, an arm back to its pad on the centre
  // line, and the L-shaped touchpiece the left little finger presses.
  L_GSHARP: {
    parts: [
      { s: 'rect', x: 170, y: 200, w: 40, h: 60, rx: 19 },
    ],
    hit: { x: 58, y: 214, width: 46, height: 60 },
  },

  R1: fingerKey(302, 27),
  R2: fingerKey(370, 27),
  R3: fingerKey(444, 25),

  // Trill keys: small levers on the left, between the right-hand keys.
  TRILL_D: {
    parts: [{ s: 'rect', x: 58, y: 326, w: 38, h: 24, rx: 10 }],
    hit: { x: 52, y: 320, width: 50, height: 36 },
  },
  TRILL_DSHARP: {
    parts: [{ s: 'rect', x: 58, y: 396, w: 38, h: 24, rx: 10 }],
    hit: { x: 52, y: 390, width: 50, height: 36 },
  },

  // The E♭ key spans the width — tall and narrow on the horizontal chart, so
  // wide and short once stood upright.
  R_EFLAT: {
    parts: [{ s: 'rect', x: 50, y: 482, w: 112, h: 40, rx: 16 }],
    hit: { x: 44, y: 476, width: 124, height: 52 },
  },

  // Footjoint: a row of levers across the bottom, running large to small — the
  // wide C♯ lever on the left, then C and B, with the little gizmo key on the
  // right. Spacing comes from mirroring the row about x = 97, then shifting the
  // whole row 30 units right; gaps stay even at 21 units.
  FOOT_CSHARP: {
    parts: [{ s: 'rect', x: 56, y: 534, w: 34, h: 62, rx: 13 }],
    hit: { x: 52, y: 530, width: 42, height: 70 },
  },
  FOOT_C: {
    parts: [{ s: 'rect', x: 111, y: 534, w: 15, h: 62, rx: 13 }],
    hit: { x: 103, y: 530, width: 31, height: 70 },
  },
  FOOT_B: {
    parts: [{ s: 'rect', x: 147, y: 534, w: 15, h: 62, rx: 13 }],
    hit: { x: 139, y: 530, width: 31, height: 70 },
  },
  GIZMO: {
    parts: [{ s: 'rect', x: 183, y: 546, w: 15, h: 50, rx: 13 }],
    hit: { x: 175, y: 542, width: 31, height: 58 },
  },
}

const PIXEL_WIDTH = { sm: 74, md: 104, lg: 172 } as const

const EXCLUSIVE_SETS = EXCLUSIVE_KEY_GROUPS.map(keysInGroup)

const pressedSet = computed(() => new Set(props.keys))
const ventedSet = computed(() => new Set(props.vented))
const unavailableSet = computed(() => new Set(props.unavailable))

type State = 'pressed' | 'vented' | 'open' | 'unavailable'

function stateOf(key: KeyId): State {
  if (unavailableSet.value.has(key)) return 'unavailable'
  if (pressedSet.value.has(key)) return 'pressed'
  if (ventedSet.value.has(key)) return 'vented'
  return 'open'
}

function toggle(key: FluteKey) {
  if (!props.interactive || unavailableSet.value.has(key.id)) return
  const next = new Set(props.keys)
  if (next.has(key.id)) {
    next.delete(key.id)
  } else {
    for (const group of EXCLUSIVE_SETS) {
      if (group.includes(key.id)) for (const other of group) next.delete(other)
    }
    next.add(key.id)
  }
  emit('update:keys', sortKeys([...next]))
}

/**
 * With no lettering on the keys, the accessible name is the only way a screen
 * reader user can tell them apart — so it carries the full key name.
 */
function ariaLabel(key: FluteKey): string {
  const suffix = {
    pressed: 'pressed',
    vented: 'ring depressed, hole open',
    unavailable: 'not on this flute',
    open: 'open',
  }[stateOf(key.id)]
  return `${key.name}, ${suffix}`
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    :width="PIXEL_WIDTH[size]"
    :height="(PIXEL_WIDTH[size] * HEIGHT) / WIDTH"
    class="key-chart"
    :class="{ 'key-chart--interactive': interactive }"
    :role="interactive ? 'group' : 'img'"
    :aria-label="interactive ? 'Flute fingering — tap keys to select' : 'Flute fingering diagram'"
  >
    <g
      v-for="key in FLUTE_KEYS"
      :key="key.id"
      class="key"
      :class="`key--${stateOf(key.id)}`"
      :role="interactive ? 'button' : undefined"
      :tabindex="interactive && stateOf(key.id) !== 'unavailable' ? 0 : undefined"
      :aria-pressed="interactive ? stateOf(key.id) === 'pressed' : undefined"
      :aria-label="ariaLabel(key)"
      @click="toggle(key)"
      @keydown.enter.prevent="toggle(key)"
      @keydown.space.prevent="toggle(key)"
    >
      <rect v-if="interactive" v-bind="LAYOUT[key.id].hit" class="hit" />

      <template v-for="(part, index) in LAYOUT[key.id].parts" :key="index">
        <circle
          v-if="part.s === 'circle'"
          :cx="part.cx"
          :cy="part.cy"
          :r="part.r"
          class="key-shape"
        />
        <rect
          v-else-if="part.s === 'rect'"
          :x="part.x"
          :y="part.y"
          :width="part.w"
          :height="part.h"
          :rx="part.rx"
          class="key-shape"
        />
        <line
          v-else
          :x1="part.x1"
          :y1="part.y1"
          :x2="part.x2"
          :y2="part.y2"
          class="key-arm"
        />
      </template>

      <!-- Open-hole venting: ring down, tone hole left uncovered. Only drawn
           when it applies, so a normal fingering shows plain keys as on the
           printed chart. -->
      <circle
        v-if="stateOf(key.id) === 'vented' && LAYOUT[key.id].ring"
        :cx="LAYOUT[key.id].ring!.cx"
        :cy="LAYOUT[key.id].ring!.cy"
        :r="LAYOUT[key.id].ring!.r * 0.5"
        class="key-vent"
      />
    </g>
  </svg>
</template>

<style scoped>
.key-chart {
  display: block;
  overflow: visible;
}

/* Named `key-shape`, not `outline`: Tailwind ships an `outline` utility class,
   so `class="outline"` also switched on CSS `outline-style: solid` and drew a
   box round every key's bounding box. Keep these class names prefixed. */
.key-shape {
  fill: var(--color-ink-900);
  stroke: var(--color-ink-200);
  stroke-width: 2.6;
  transition:
    fill 120ms ease,
    stroke 120ms ease;
}

.key-arm {
  stroke: var(--color-ink-200);
  stroke-width: 13;
  stroke-linecap: round;
  transition: stroke 120ms ease;
}

.key-vent {
  fill: var(--color-ink-950);
}

.hit {
  fill: transparent;
}

/* ── Pressed ──────────────────────────────────────────────────────────── */
.key--pressed .key-shape,
.key--vented .key-shape {
  fill: var(--color-brass-400);
  stroke: var(--color-brass-300);
}

.key--pressed .key-arm,
.key--vented .key-arm {
  stroke: var(--color-brass-400);
}

.key--unavailable {
  opacity: 0.22;
}

/* ── Interaction ──────────────────────────────────────────────────────── */
.key-chart--interactive .key:not(.key--unavailable) {
  cursor: pointer;
}

.key-chart--interactive .key:not(.key--unavailable):hover .key-shape {
  stroke: var(--color-brass-400);
}

.key-chart--interactive .key:focus-visible {
  outline: none;
}

.key-chart--interactive .key:focus-visible .key-shape {
  stroke: var(--color-brass-300);
  stroke-width: 4;
}
</style>
