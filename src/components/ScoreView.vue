<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Score } from '@/score/model'
import { measureFill } from '@/score/ops'
import type { RenderResult, VexFlow } from '@/score/render'

/**
 * A score drawn as sheet music — staves that wrap to the width like a printed
 * page. Tap a note to select it. VexFlow and its music font load with the
 * first score shown, not with the app.
 */
const props = withDefaults(
  defineProps<{
    score: Score
    selectedId?: string | null
    playingId?: string | null
    flagged?: readonly string[]
    /** Taps on empty staff become `staffTap`, for entering notes. */
    editing?: boolean
    /** Letter names under the notes. */
    noteNames?: boolean
  }>(),
  { selectedId: null, playingId: null, flagged: () => [], editing: false, noteNames: false },
)

export interface StaffTap {
  measureIndex: number
  /** Insert after this event, or at the start of the measure with `null`. */
  afterId: string | null
  /** Steps above the bottom staff line: 0 is E4 in treble. */
  relative: number
}

const emit = defineEmits<{ select: [id: string | null]; staffTap: [tap: StaffTap] }>()

const canvas = ref<HTMLDivElement | null>(null)
const width = ref(0)
const vexflow = shallowRef<VexFlow | null>(null)
const render = shallowRef<typeof import('@/score/render').renderScore | null>(null)
const layout = shallowRef<RenderResult | null>(null)
const failed = ref(false)

const flaggedSet = computed(() => new Set(props.flagged))
const fill = computed(() => (props.score.mode === 'rhythm' ? measureFill(props.score) : undefined))

let observer: ResizeObserver | null = null

onMounted(async () => {
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.floor(entry.contentRect.width)
  })
  if (canvas.value) observer.observe(canvas.value)
  try {
    const [module, renderer] = await Promise.all([import('vexflow/bravura'), import('@/score/render')])
    // The music font is embedded in the bundle but loads asynchronously;
    // drawing before it is ready leaves empty boxes for every symbol.
    await document.fonts.load('30px Bravura')
    vexflow.value = module.default as unknown as VexFlow
    render.value = renderer.renderScore
  } catch {
    failed.value = true
  }
})

onBeforeUnmount(() => observer?.disconnect())

watch(
  [vexflow, width, () => props.score, () => props.selectedId, flaggedSet, fill, () => props.noteNames],
  () => {
    if (!vexflow.value || !render.value || !canvas.value || width.value < 10) return
    layout.value = render.value(vexflow.value, canvas.value, props.score, {
      width: width.value,
      selectedId: props.selectedId,
      flagged: flaggedSet.value,
      fill: fill.value,
      noteNames: props.noteNames,
    })
  },
  { deep: false },
)

/** The note under a tap, generously: the nearest one within reach. */
function onTap(event: MouseEvent) {
  if (!layout.value || !canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  let best: string | null = null
  let bestDistance = 22
  for (const hit of layout.value.hits) {
    const dx = Math.max(hit.x - x, 0, x - (hit.x + hit.width))
    const dy = Math.max(hit.y - y, 0, y - (hit.y + hit.height))
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      best = hit.id
    }
  }
  if (best || !props.editing) {
    emit('select', best)
    return
  }
  // An empty spot on a staff: a pitch, and where in the measure it goes.
  const stave = layout.value.staves.find(
    (s) =>
      x >= s.x &&
      x <= s.x + s.width &&
      y >= s.bottomLineY - s.spacing * 7 &&
      y <= s.bottomLineY + s.spacing * 3,
  )
  if (!stave) return
  const before = layout.value.hits
    .filter((h) => h.measureIndex === stave.measureIndex && h.x + h.width / 2 < x)
    .sort((a, b) => a.x - b.x)
  emit('staffTap', {
    measureIndex: stave.measureIndex,
    afterId: before.length ? before[before.length - 1].id : null,
    relative: Math.round((stave.bottomLineY - y) / (stave.spacing / 2)),
  })
}

/** The element the score scrolls in: the nearest scrolling ancestor, else the page. */
function scroller(): HTMLElement | null {
  for (let node = canvas.value?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

/** Keep a note in view — while it plays, or after it is picked elsewhere. */
function reveal(id: string | null | undefined) {
  if (!id || !layout.value || !canvas.value) return
  const hit = layout.value.hits.find((h) => h.id === id)
  if (!hit) return
  const rect = canvas.value.getBoundingClientRect()
  const top = rect.top + hit.y
  const box = scroller()
  if (box) {
    const view = box.getBoundingClientRect()
    if (top < view.top + 20 || top > view.bottom - 60) {
      box.scrollTo({ top: box.scrollTop + top - view.top - view.height / 3, behavior: 'smooth' })
    }
  } else if (top < 80 || top > window.innerHeight - 160) {
    window.scrollTo({ top: window.scrollY + top - window.innerHeight / 3, behavior: 'smooth' })
  }
}

/** The sounding note, lit up in place — engraving the page per note would lag. */
function markPlaying() {
  canvas.value?.querySelector('g.is-playing')?.classList.remove('is-playing')
  if (!props.playingId) return
  canvas.value?.querySelector(`#vf-${CSS.escape(props.playingId)}`)?.classList.add('is-playing')
}

watch(() => props.playingId, (id) => {
  markPlaying()
  reveal(id)
})
// A note picked in the fingering strip or by the review comes into view.
watch(() => props.selectedId, (id) => reveal(id))
watch(layout, markPlaying)

defineExpose({ reveal })
</script>

<template>
  <div class="w-full">
    <div class="overflow-hidden rounded-xl border border-ink-700 bg-ink-900 px-1 py-2">
      <p v-if="failed" class="px-3 py-6 text-center text-sm text-ink-200">
        Couldn’t load the music engraver.
      </p>
      <p v-else-if="!vexflow" class="px-3 py-6 text-center text-sm text-ink-400">Engraving…</p>
      <div
        ref="canvas"
        class="score-canvas cursor-pointer"
        role="img"
        :aria-label="`Score, ${score.measures.length} measures`"
        @click="onTap"
      />
    </div>
  </div>
</template>

<style scoped>
.score-canvas :deep(svg) {
  display: block;
}

.score-canvas {
  /* VexFlow draws in black; on the dark card its default ink becomes the
     app's pale text colour (ledger lines, grey #444 by default, too).
     Coloured notes (selected, uncertain) keep theirs. */
  --score-ink: var(--color-ink-50);
}

.score-canvas :deep([fill='black']),
.score-canvas :deep([fill='#000']),
.score-canvas :deep([fill='#000000']) {
  fill: var(--score-ink);
}

.score-canvas :deep([stroke='black']),
.score-canvas :deep([stroke='#000']),
.score-canvas :deep([stroke='#000000']),
.score-canvas :deep([stroke='#444']) {
  stroke: var(--score-ink);
}

.score-canvas :deep(g.is-playing path),
.score-canvas :deep(g.is-playing rect),
.score-canvas :deep(g.is-playing text) {
  fill: var(--color-accent-300);
  stroke: var(--color-accent-300);
}
</style>
