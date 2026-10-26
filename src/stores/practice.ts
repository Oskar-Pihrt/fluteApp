import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { currentStreak, dayOf, TRAINING, weekOf, type ExerciseId, type NoteStats } from '@/domain/practice'

const STORAGE_KEY = 'fluteapp.practice.v1'

/** Records kept per instrument: a long tone on a flute says nothing about a tuba. */
export interface InstrumentRecords {
  /** Longest in-tune hold per written MIDI note, seconds. */
  bestHold: Record<string, number>
  notes: NoteStats
  /** Scales played through, by `keyId`. */
  scalesDone: string[]
}

export interface PersistedPractice {
  /** Days the daily training was finished. Shared by all instruments. */
  completedDays: string[]
  bestStreak: number
  totalSeconds: number
  /** How far today's training has got, so it can be finished later in the day. */
  training: { day: string; partsDone: number }
  records: Record<string, InstrumentRecords>
  metronomeOn: boolean
  metronomeBpm: number
  hideFingering: boolean
}

export const BPM_RANGE = { min: 40, max: 160 } as const

function defaults(): PersistedPractice {
  return {
    completedDays: [],
    bestStreak: 0,
    totalSeconds: 0,
    training: { day: '', partsDone: 0 },
    records: {},
    metronomeOn: false,
    metronomeBpm: 72,
    hideFingering: false,
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)

function parseRecords(raw: unknown): InstrumentRecords {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<InstrumentRecords>
  const bestHold: Record<string, number> = {}
  for (const [key, value] of Object.entries(r.bestHold ?? {})) if (count(value)) bestHold[key] = value
  const notes: NoteStats = {}
  for (const [key, value] of Object.entries(r.notes ?? {})) {
    if (!value || typeof value !== 'object') continue
    const attempts = count(value.attempts)
    if (attempts) notes[key] = { attempts, misses: Math.min(count(value.misses), attempts) }
  }
  const scalesDone = Array.isArray(r.scalesDone) ? [...new Set(r.scalesDone.filter((k) => typeof k === 'string'))] : []
  return { bestHold, notes, scalesDone }
}

/** Tolerates missing, corrupt or older data by falling back to defaults per field. */
export function parsePractice(raw: string | null): PersistedPractice {
  const result = defaults()
  if (!raw) return result
  try {
    const p = JSON.parse(raw) as Partial<PersistedPractice>
    if (Array.isArray(p.completedDays)) {
      result.completedDays = [...new Set(p.completedDays.filter((d) => typeof d === 'string' && DAY.test(d)))].sort()
    }
    result.bestStreak = Math.floor(count(p.bestStreak))
    result.totalSeconds = count(p.totalSeconds)
    if (p.training && typeof p.training.day === 'string' && DAY.test(p.training.day)) {
      result.training = {
        day: p.training.day,
        partsDone: Math.min(Math.floor(count(p.training.partsDone)), TRAINING.length),
      }
    }
    if (p.records && typeof p.records === 'object') {
      for (const [id, value] of Object.entries(p.records)) result.records[id] = parseRecords(value)
    }
    if (typeof p.metronomeOn === 'boolean') result.metronomeOn = p.metronomeOn
    if (typeof p.metronomeBpm === 'number' && Number.isFinite(p.metronomeBpm)) {
      result.metronomeBpm = Math.round(Math.min(Math.max(p.metronomeBpm, BPM_RANGE.min), BPM_RANGE.max))
    }
    if (typeof p.hideFingering === 'boolean') result.hideFingering = p.hideFingering
    return result
  } catch {
    return defaults()
  }
}

function load(): PersistedPractice {
  try {
    return parsePractice(localStorage.getItem(STORAGE_KEY))
  } catch {
    return defaults()
  }
}

/**
 * The practice streak and records. A day counts once the whole daily training
 * is done; single exercises from free practice add to the records only.
 *
 * `today` is a ref rather than read from the clock on every use, so a page
 * left open past midnight can `refreshDay()` and tests can set it.
 */
export const usePracticeStore = defineStore('practice', () => {
  const initial = load()
  const completedDays = ref<string[]>(initial.completedDays)
  const bestStreak = ref(initial.bestStreak)
  const totalSeconds = ref(initial.totalSeconds)
  const training = ref(initial.training)
  const records = ref<Record<string, InstrumentRecords>>(initial.records)
  const metronomeOn = ref(initial.metronomeOn)
  const metronomeBpm = ref(initial.metronomeBpm)
  const hideFingering = ref(initial.hideFingering)

  const today = ref(dayOf(new Date()))
  function refreshDay() {
    today.value = dayOf(new Date())
  }

  const completed = computed(() => new Set(completedDays.value))
  const streak = computed(() => currentStreak(completed.value, today.value))
  const doneToday = computed(() => completed.value.has(today.value))
  const week = computed(() => weekOf(completed.value, today.value))
  /** Parts of today's training finished (0…3); yesterday's progress doesn't carry over. */
  const partsDone = computed(() =>
    doneToday.value ? TRAINING.length : training.value.day === today.value ? training.value.partsDone : 0,
  )
  const nextPart = computed<ExerciseId | null>(() => TRAINING[partsDone.value] ?? null)

  function recordsFor(instrumentId: string): InstrumentRecords {
    if (!records.value[instrumentId]) records.value[instrumentId] = { bestHold: {}, notes: {}, scalesDone: [] }
    return records.value[instrumentId]
  }

  /** Mark a part of today's training done; the last one completes the day. */
  function finishPart(exercise: ExerciseId) {
    const index = TRAINING.indexOf(exercise)
    if (index !== partsDone.value) return
    training.value = { day: today.value, partsDone: index + 1 }
    if (index + 1 === TRAINING.length && !doneToday.value) {
      completedDays.value = [...completedDays.value, today.value].sort()
      bestStreak.value = Math.max(bestStreak.value, streak.value)
    }
  }

  function addTime(seconds: number) {
    if (seconds > 0 && Number.isFinite(seconds)) totalSeconds.value += seconds
  }

  /** Returns true when this is a new best for the note. */
  function recordHold(instrumentId: string, midi: number, seconds: number): boolean {
    const r = recordsFor(instrumentId)
    const key = String(midi)
    if (seconds <= (r.bestHold[key] ?? 0)) return false
    r.bestHold[key] = Math.round(seconds * 10) / 10
    return true
  }

  function recordNote(instrumentId: string, midi: number, missed: boolean) {
    const r = recordsFor(instrumentId)
    const item = r.notes[String(midi)] ?? { attempts: 0, misses: 0 }
    r.notes[String(midi)] = { attempts: item.attempts + 1, misses: item.misses + (missed ? 1 : 0) }
  }

  function recordScale(instrumentId: string, key: string) {
    const r = recordsFor(instrumentId)
    if (!r.scalesDone.includes(key)) r.scalesDone.push(key)
  }

  watch(
    [completedDays, bestStreak, totalSeconds, training, records, metronomeOn, metronomeBpm, hideFingering],
    () => {
      const data: PersistedPractice = {
        completedDays: completedDays.value,
        bestStreak: bestStreak.value,
        totalSeconds: totalSeconds.value,
        training: training.value,
        records: records.value,
        metronomeOn: metronomeOn.value,
        metronomeBpm: metronomeBpm.value,
        hideFingering: hideFingering.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // Private mode or full storage: practice still works, it just isn't kept.
      }
    },
    { deep: true },
  )

  return {
    completedDays,
    bestStreak,
    totalSeconds,
    records,
    metronomeOn,
    metronomeBpm,
    hideFingering,
    today,
    refreshDay,
    streak,
    doneToday,
    week,
    partsDone,
    nextPart,
    recordsFor,
    finishPart,
    addTime,
    recordHold,
    recordNote,
    recordScale,
  }
})
