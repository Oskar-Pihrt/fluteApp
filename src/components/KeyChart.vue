<script setup lang="ts">
import { computed } from 'vue'
import { type InstrumentKey, type KeyId, keysInGroup, sortKeys } from '@/domain/keys'
import type { Instrument } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/**
 * An instrument's keywork drawn as a fingering chart. Filling a key in is what
 * "pressed" means. The geometry lives with the instrument
 * (`src/instruments/<id>/layout.ts`); this component only draws and toggles.
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
    /** Defaults to the active instrument. */
    instrument?: Instrument
  }>(),
  { vented: () => [], interactive: false, unavailable: () => [], size: 'md', instrument: undefined },
)

const emit = defineEmits<{ 'update:keys': [KeyId[]] }>()

const settings = useSettingsStore()
const instrument = computed(() => props.instrument ?? settings.instrument)
const chart = computed(() => instrument.value.chart)
const pixelWidth = computed(() => chart.value.pixelWidth[props.size])

/** Keys in drawing order, paired with their geometry. */
const drawnKeys = computed(() =>
  instrument.value.keys.flatMap((key) => {
    const drawing = chart.value.drawings[key.id]
    return drawing ? [{ key, drawing }] : []
  }),
)

const exclusiveSets = computed(() =>
  instrument.value.exclusiveGroups.map((group) => keysInGroup(instrument.value.keys, group)),
)

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

function toggle(key: InstrumentKey) {
  if (!props.interactive || unavailableSet.value.has(key.id)) return
  const next = new Set(props.keys)
  if (next.has(key.id)) {
    next.delete(key.id)
  } else {
    for (const group of exclusiveSets.value) {
      if (group.includes(key.id)) for (const other of group) next.delete(other)
    }
    next.add(key.id)
  }
  emit('update:keys', sortKeys([...next]))
}

/**
 * The accessible name is the only way a screen reader user can tell the keys
 * apart — so it carries the full key name.
 */
function ariaLabel(key: InstrumentKey): string {
  const suffix = {
    pressed: 'pressed',
    vented: 'ring depressed, hole open',
    unavailable: `not on this ${instrument.value.noun}`,
    open: 'open',
  }[stateOf(key.id)]
  return `${key.name}, ${suffix}`
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${chart.width} ${chart.height}`"
    :width="pixelWidth"
    :height="(pixelWidth * chart.height) / chart.width"
    class="key-chart"
    :class="{ 'key-chart--interactive': interactive }"
    :role="interactive ? 'group' : 'img'"
    :aria-label="
      interactive
        ? `${instrument.shortName} fingering — tap keys to select`
        : `${instrument.shortName} fingering diagram`
    "
  >
    <template v-for="(part, index) in chart.decorations ?? []" :key="`d${index}`">
      <line
        v-if="part.s === 'arm'"
        :x1="part.x1"
        :y1="part.y1"
        :x2="part.x2"
        :y2="part.y2"
        class="key-divider"
      />
    </template>

    <g
      v-for="{ key, drawing } in drawnKeys"
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
      <rect v-if="interactive" v-bind="drawing.hit" class="hit" />

      <template v-for="(part, index) in drawing.parts" :key="index">
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
        <ellipse
          v-else-if="part.s === 'ellipse'"
          :cx="part.cx"
          :cy="part.cy"
          :rx="part.rx"
          :ry="part.ry"
          :transform="`rotate(${part.rotate} ${part.cx} ${part.cy})`"
          class="key-shape"
        />
        <path v-else-if="part.s === 'path'" :d="part.d" class="key-shape" />
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
        v-if="stateOf(key.id) === 'vented' && drawing.ring"
        :cx="drawing.ring.cx"
        :cy="drawing.ring.cy"
        :r="drawing.ring.r * 0.5"
        class="key-vent"
      />

      <text
        v-if="drawing.text"
        :x="drawing.text.x"
        :y="drawing.text.y"
        :font-size="drawing.text.size ?? 12"
        class="key-label"
        aria-hidden="true"
      >
        {{ key.label }}
      </text>
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

.key-divider {
  stroke: var(--color-ink-400);
  stroke-width: 3;
  stroke-linecap: round;
}

.key-label {
  fill: var(--color-ink-200);
  font-family: inherit;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  user-select: none;
}

.key--pressed .key-label {
  fill: var(--color-ink-950);
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
  fill: var(--color-accent-400);
  stroke: var(--color-accent-300);
}

.key--pressed .key-arm,
.key--vented .key-arm {
  stroke: var(--color-accent-400);
}

.key--unavailable {
  opacity: 0.22;
}

/* ── Interaction ──────────────────────────────────────────────────────── */
.key-chart--interactive .key:not(.key--unavailable) {
  cursor: pointer;
}

.key-chart--interactive .key:not(.key--unavailable):hover .key-shape {
  stroke: var(--color-accent-400);
}

.key-chart--interactive .key:focus-visible {
  outline: none;
}

.key-chart--interactive .key:focus-visible .key-shape {
  stroke: var(--color-accent-300);
  stroke-width: 4;
}
</style>
