<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { db } from '@/lib/db'
import { snakes } from '@/lib/store'
import { resizeImage } from '@/lib/image'
import { lengthCm, pxPerCm, splinePath } from '@/lib/measure'
import { todayISO } from '@/lib/dates'
import { t } from '@/lib/i18n'
import type { Pt } from '@/lib/types'

const route = useRoute()
const router = useRouter()

type Step = 'pick' | 'ruler' | 'trace'
const step = ref<Step>('pick')
const error = ref('')

// --- photo ---------------------------------------------------------------
const photo = ref<Blob | null>(null)
const photoUrl = ref('')
const imgW = ref(1)
const imgH = ref(1)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  error.value = ''
  try {
    const r = await resizeImage(f, 2000, 0.9)
    if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
    photo.value = r.blob
    photoUrl.value = URL.createObjectURL(r.blob)
    imgW.value = r.width
    imgH.value = r.height
    cal.value = []
    points.value = []
    step.value = 'ruler'
    await nextTick()
    fit()
  } catch {
    error.value = t('loadFail')
  }
}
onBeforeUnmount(() => photoUrl.value && URL.revokeObjectURL(photoUrl.value))

// --- measuring state -----------------------------------------------------
const cal = ref<Pt[]>([])
const calCm = ref<number>(30)
const points = ref<Pt[]>([])
const smooth = ref(true)
const PRESETS = [10, 15, 20, 30, 50, 100]

const calibrated = computed(() => cal.value.length === 2 && calCm.value > 0)
const scale = computed(() => (calibrated.value ? pxPerCm(cal.value[0], cal.value[1], calCm.value) : 0))
const result = computed(() => lengthCm(points.value, calibrated.value ? [cal.value[0], cal.value[1]] : null, calCm.value, smooth.value))
const pathD = computed(() => (smooth.value ? splinePath(points.value) : points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')))

// --- viewport (zoom & pan) ----------------------------------------------
const stage = ref<HTMLElement | null>(null)
const W = ref(320)
const H = ref(320)
const base = ref(1)
const s = ref(1)
const tx = ref(0)
const ty = ref(0)
const unit = computed(() => 1 / (base.value * s.value)) // image px per screen px

function fit() {
  if (!stage.value) return
  W.value = stage.value.clientWidth
  H.value = Math.max(240, Math.min((W.value * imgH.value) / imgW.value, window.innerHeight * 0.56))
  base.value = Math.min(W.value / imgW.value, H.value / imgH.value)
  s.value = 1
  tx.value = ty.value = 0
  clampView()
}
function clampView() {
  const dw = imgW.value * base.value * s.value
  const dh = imgH.value * base.value * s.value
  tx.value = dw <= W.value ? (W.value - dw) / 2 : Math.min(0, Math.max(W.value - dw, tx.value))
  ty.value = dh <= H.value ? (H.value - dh) / 2 : Math.min(0, Math.max(H.value - dh, ty.value))
}
function zoomAt(px: number, py: number, factor: number) {
  const ns = Math.min(10, Math.max(1, s.value * factor))
  const k = ns / s.value
  tx.value = px - (px - tx.value) * k
  ty.value = py - (py - ty.value) * k
  s.value = ns
  clampView()
}
const zoomBy = (f: number) => zoomAt(W.value / 2, H.value / 2, f)

const ptrs = new Map<number, Pt>()
let start: Pt = { x: 0, y: 0 }
let moved = false
let multi = false
let pinch = 0

const rectOf = () => stage.value!.getBoundingClientRect()
const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }

function onDown(e: PointerEvent) {
  stage.value!.setPointerCapture(e.pointerId)
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (ptrs.size === 1) { start = { x: e.clientX, y: e.clientY }; moved = false; multi = false }
  else { multi = true; pinch = pinchDist() }
}
function onMove(e: PointerEvent) {
  const prev = ptrs.get(e.pointerId)
  if (!prev) return
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (ptrs.size === 1) {
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) moved = true
    if (moved) { tx.value += e.clientX - prev.x; ty.value += e.clientY - prev.y; clampView() }
  } else if (ptrs.size === 2) {
    const d = pinchDist()
    const [a, b] = [...ptrs.values()]
    const r = rectOf()
    if (pinch > 0) zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch)
    pinch = d
  }
}
function onUp(e: PointerEvent) {
  const wasTap = ptrs.size === 1 && !moved && !multi
  ptrs.delete(e.pointerId)
  if (wasTap) place(e.clientX, e.clientY)
}
function onWheel(e: WheelEvent) {
  const r = rectOf()
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
}

function place(cx: number, cy: number) {
  const r = rectOf()
  const x = (cx - r.left - tx.value) / (base.value * s.value)
  const y = (cy - r.top - ty.value) / (base.value * s.value)
  if (x < 0 || y < 0 || x > imgW.value || y > imgH.value) return
  const p = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  if (step.value === 'ruler') {
    cal.value = cal.value.length >= 2 ? [p] : [...cal.value, p]
  } else if (step.value === 'trace') {
    points.value = [...points.value, p]
  }
}

function goTrace() { step.value = 'trace' }
function redoRuler() { step.value = 'ruler'; cal.value = []; points.value = [] }
function newPhoto() { step.value = 'pick' }
const undo = () => { points.value = points.value.slice(0, -1) }

onMounted(() => window.addEventListener('resize', fit))
onBeforeUnmount(() => window.removeEventListener('resize', fit))

// --- saving -----------------------------------------------------------------
const snakeId = ref<number | ''>(Number(route.query.snake) || '')
const date = ref(todayISO())
const canSave = computed(() => snakeId.value !== '' && result.value > 0 && !!photo.value)

const plain = (p: Pt): Pt => ({ x: p.x, y: p.y })

async function save() {
  if (!canSave.value || !photo.value) return
  const id = snakeId.value as number
  const len = Math.round(result.value * 10) / 10
  await db.transaction('rw', db.measurements, db.events, async () => {
    const mid = (await db.measurements.add({
      snakeId: id, date: date.value, photo: photo.value!, imgW: imgW.value, imgH: imgH.value,
      // plain copies: IndexedDB cannot clone Vue's reactive proxies
      cal: [plain(cal.value[0]), plain(cal.value[1])], calCm: calCm.value, points: points.value.map(plain), lengthCm: len,
    })) as number
    await db.events.add({ snakeId: id, type: 'length', date: date.value, value: len, measurementId: mid })
  })
  router.push(`/snake/${id}`)
}
</script>

<template>
  <header class="mb-4 pt-2">
    <h1 class="text-4xl font-extrabold">{{ t('measureTitle') }}</h1>
    <div class="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
      <template v-for="(label, i) in [t('photo'), t('stepRuler'), t('stepTrace')]" :key="label">
        <span class="flex items-center gap-1.5 rounded-full px-3 py-1.5" :class="['pick', 'ruler', 'trace'].indexOf(step) >= i ? 'bg-accent text-accent-ink' : 'bg-white/5 text-muted'">
          <span>{{ i + 1 }}</span>{{ label }}
        </span>
        <span v-if="i < 2" class="h-px flex-1 bg-line" />
      </template>
    </div>
  </header>

  <!-- 1 · photo -->
  <section v-if="step === 'pick'" class="space-y-4">
    <div class="card overflow-hidden p-5">
      <svg viewBox="0 0 320 110" class="mb-4 w-full" aria-hidden="true">
        <rect x="10" y="74" width="300" height="26" rx="5" fill="#e8c547" />
        <g stroke="#6b5410" stroke-width="1.500"><path v-for="i in 31" :key="i" :d="`M${10 + (i - 1) * 10} 74v${(i - 1) % 5 === 0 ? 14 : 8}`" /></g>
        <path d="M20 52c40-34 70 18 110-6s60-30 100-8 50 8 70-6" fill="none" stroke="#5be37d" stroke-width="16" stroke-linecap="round" />
        <path d="M20 52c40-34 70 18 110-6s60-30 100-8 50 8 70-6" fill="none" stroke="#c9f7d4" stroke-opacity=".5" stroke-width="3" stroke-linecap="round" stroke-dasharray=".1 11" />
        <circle cx="300" cy="40" r="3" fill="#06120d" />
      </svg>
      <p class="text-muted">{{ t('measureIntro') }}</p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <label class="btn btn-primary cursor-pointer"><Icon name="camera" /> {{ t('takePhoto') }}<input type="file" accept="image/*" capture="environment" class="hidden" @change="onFile" /></label>
        <label class="btn cursor-pointer"><Icon name="image" /> {{ t('fromGallery') }}<input type="file" accept="image/*" class="hidden" @change="onFile" /></label>
      </div>
      <p v-if="error" class="mt-3 text-sm text-danger">{{ error }}</p>
    </div>
    <div class="card p-5">
      <h2 class="mb-2 flex items-center gap-2 font-bold"><Icon name="leaf" class="text-accent" /> {{ t('tipsTitle') }}</h2>
      <ul class="space-y-2 text-sm text-muted">
        <li v-for="k in (['tip1', 'tip2', 'tip3', 'tip4'] as const)" :key="k" class="flex gap-2"><span class="text-accent">•</span>{{ t(k) }}</li>
      </ul>
    </div>
  </section>

  <!-- 2 + 3 · calibrate and trace -->
  <section v-else>
    <div
      ref="stage"
      class="relative touch-none select-none overflow-hidden rounded-3xl border border-line bg-black"
      :style="{ height: H + 'px', cursor: 'crosshair' }"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @wheel.prevent="onWheel"
    >
      <div class="absolute left-0 top-0 origin-top-left" :style="{ width: imgW * base + 'px', height: imgH * base + 'px', transform: `translate(${tx}px, ${ty}px) scale(${s})` }">
        <img :src="photoUrl" class="pointer-events-none block h-full w-full" draggable="false" alt="" />
        <svg :viewBox="`0 0 ${imgW} ${imgH}`" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <!-- ruler calibration -->
          <line v-if="cal.length === 2" :x1="cal[0].x" :y1="cal[0].y" :x2="cal[1].x" :y2="cal[1].y" stroke="#e8c547" :stroke-width="2.5 * unit" :stroke-dasharray="`${7 * unit} ${5 * unit}`" />
          <g v-for="(p, i) in cal" :key="'c' + i">
            <circle :cx="p.x" :cy="p.y" :r="9 * unit" fill="#e8c54733" stroke="#e8c547" :stroke-width="2 * unit" />
            <path :d="`M${p.x - 5 * unit} ${p.y}h${10 * unit}M${p.x} ${p.y - 5 * unit}v${10 * unit}`" stroke="#e8c547" :stroke-width="1.6 * unit" />
          </g>
          <!-- snake trace -->
          <template v-if="points.length">
            <path :d="pathD" fill="none" stroke="#000" stroke-opacity=".45" :stroke-width="6 * unit" stroke-linecap="round" stroke-linejoin="round" />
            <path :d="pathD" fill="none" stroke="#5be37d" :stroke-width="3 * unit" stroke-linecap="round" stroke-linejoin="round" />
            <circle v-for="(p, i) in points" :key="'p' + i" :cx="p.x" :cy="p.y" :r="(i === 0 ? 7 : 4.5) * unit" :fill="i === 0 ? '#5be37d' : '#06120d'" stroke="#5be37d" :stroke-width="2 * unit" />
          </template>
        </svg>
      </div>

      <div class="absolute right-2 top-2 flex flex-col gap-1.5" @pointerdown.stop @pointerup.stop>
        <button class="btn !min-h-9 !w-9 !p-0 bg-black/60 text-lg backdrop-blur" aria-label="zoom in" @click="zoomBy(1.6)">＋</button>
        <button class="btn !min-h-9 !w-9 !p-0 bg-black/60 text-lg backdrop-blur" aria-label="zoom out" @click="zoomBy(1 / 1.6)">－</button>
        <button class="btn !min-h-9 !w-9 !p-0 bg-black/60 text-xs backdrop-blur" aria-label="fit" @click="fit">1:1</button>
      </div>
    </div>
    <p class="mt-2 text-center text-xs text-muted">{{ t('zoomHint') }}</p>

    <!-- ruler controls -->
    <div v-if="step === 'ruler'" class="card mt-3 space-y-4 p-4">
      <p class="font-semibold">{{ t('rulerHint') }}</p>
      <div>
        <label class="label">{{ t('rulerDistance') }}</label>
        <div class="flex items-center gap-2">
          <input v-model.number="calCm" type="number" min="0" step="any" inputmode="decimal" class="input !w-28" />
          <span class="text-muted">{{ t('cm') }}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button v-for="p in PRESETS" :key="p" class="chip" :aria-pressed="calCm === p" @click="calCm = p">{{ p }}</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn flex-1" @click="newPhoto">{{ t('retake') }}</button>
        <button class="btn flex-1" :disabled="!cal.length" @click="cal = []">{{ t('clear') }}</button>
        <button class="btn btn-primary flex-1" :disabled="!calibrated" @click="goTrace">{{ t('next') }}</button>
      </div>
    </div>

    <!-- trace controls -->
    <div v-else class="card mt-3 space-y-4 p-4">
      <p class="text-sm text-muted">{{ t('traceHint') }}</p>
      <div class="flex items-end justify-between">
        <div>
          <div class="label !mb-0">{{ t('estimated') }}</div>
          <div class="font-display text-5xl font-extrabold text-accent">{{ result > 0 ? result.toFixed(1) : '—' }}<span class="ml-1 text-xl text-muted">{{ t('cm') }}</span></div>
        </div>
        <div class="text-right text-xs text-muted">{{ points.length }} {{ t('points') }}<br />{{ scale.toFixed(1) }} {{ t('pxPerCm') }}</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-sm" :disabled="!points.length" @click="undo"><Icon name="undo" class="!h-4 !w-4" /> {{ t('undo') }}</button>
        <button class="btn btn-sm" :disabled="!points.length" @click="points = []">{{ t('clear') }}</button>
        <button class="chip ml-auto" :aria-pressed="smooth" @click="smooth = !smooth">{{ t('smooth') }}</button>
      </div>

      <div class="space-y-3 border-t border-line pt-4">
        <p v-if="!snakes.length" class="text-sm text-muted">{{ t('needSnake') }} <RouterLink to="/snakes" class="text-accent underline">{{ t('snakes') }}</RouterLink></p>
        <div v-else class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">{{ t('pickSnake') }}</label>
            <select v-model="snakeId" class="input"><option value="" disabled>—</option><option v-for="sn in snakes" :key="sn.id" :value="sn.id">{{ sn.name }}</option></select>
          </div>
          <div><label class="label">{{ t('date') }}</label><input v-model="date" type="date" class="input" /></div>
        </div>
        <div class="flex gap-2">
          <button class="btn" @click="redoRuler">{{ t('resetRuler') }}</button>
          <button class="btn btn-primary flex-1" :disabled="!canSave" @click="save">{{ t('saveMeasurement') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
