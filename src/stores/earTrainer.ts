import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  levelsFor,
  MODES,
  shouldUnlockNextLevel,
  UNLOCK_WINDOW,
  type Mode,
  type ModeStats,
  type Question,
} from '@/domain/earTraining'

const STORAGE_KEY = 'fluteapp.earTrainer.v1'

interface ModeProgress {
  /** Highest level available. */
  unlocked: number
  /** Level currently being practised — can be below `unlocked`. */
  level: number
  stats: ModeStats
  /** Most recent results at the current level, oldest first. */
  recent: boolean[]
}

interface PersistedEarTrainer {
  mode: Mode
  progress: Record<Mode, ModeProgress>
}

function freshProgress(): ModeProgress {
  return { unlocked: 1, level: 1, stats: {}, recent: [] }
}

function defaults(): PersistedEarTrainer {
  return {
    mode: 'note',
    progress: { note: freshProgress(), interval: freshProgress(), reference: freshProgress() },
  }
}

function clampLevel(mode: Mode, value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback
  return Math.min(Math.max(n, 1), levelsFor(mode).length)
}

function parseProgress(mode: Mode, raw: Partial<ModeProgress> | undefined): ModeProgress {
  const base = freshProgress()
  if (!raw || typeof raw !== 'object') return base
  const unlocked = clampLevel(mode, raw.unlocked, 1)
  const stats: ModeStats = {}
  for (const [key, value] of Object.entries(raw.stats ?? {})) {
    if (value && Number.isFinite(value.attempts) && Number.isFinite(value.correct)) {
      stats[key] = { attempts: value.attempts, correct: Math.min(value.correct, value.attempts) }
    }
  }
  return {
    unlocked,
    level: Math.min(clampLevel(mode, raw.level, 1), unlocked),
    stats,
    recent: Array.isArray(raw.recent) ? raw.recent.filter((r) => typeof r === 'boolean').slice(-UNLOCK_WINDOW) : [],
  }
}

/** Tolerates missing, corrupt or older data by falling back to defaults per field. */
export function parseEarTrainer(raw: string | null): PersistedEarTrainer {
  const result = defaults()
  if (!raw) return result
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedEarTrainer>
    if (parsed.mode && MODES.includes(parsed.mode)) result.mode = parsed.mode
    for (const mode of MODES) result.progress[mode] = parseProgress(mode, parsed.progress?.[mode])
    return result
  } catch {
    return defaults()
  }
}

function load(): PersistedEarTrainer {
  try {
    return parseEarTrainer(localStorage.getItem(STORAGE_KEY))
  } catch {
    return defaults()
  }
}

/**
 * Ear trainer progress: which levels are unlocked, per-item accuracy and the
 * recent-answer window that drives unlocking. Score and streak are session
 * only — they reset when the app is reopened.
 */
export const useEarTrainerStore = defineStore('earTrainer', () => {
  const initial = load()
  const mode = ref<Mode>(initial.mode)
  const progress = ref<Record<Mode, ModeProgress>>(initial.progress)

  const sessionCorrect = ref(0)
  const sessionAttempts = ref(0)
  const streak = ref(0)
  const bestStreak = ref(0)

  const current = computed(() => progress.value[mode.value])

  function setLevel(level: number) {
    const p = current.value
    const next = clampLevel(mode.value, level, p.level)
    if (next > p.unlocked || next === p.level) return
    p.level = next
    // The window measures the level being practised.
    p.recent = []
  }

  /**
   * Record an answer. Returns the newly unlocked level, if this answer earned
   * one, so the view can announce it.
   */
  function record(question: Question, correct: boolean): number | null {
    const p = progress.value[question.mode]
    const key = String(question.answer)
    const item = p.stats[key] ?? { attempts: 0, correct: 0 }
    item.attempts++
    if (correct) item.correct++
    p.stats[key] = item

    p.recent = [...p.recent, correct].slice(-UNLOCK_WINDOW)

    sessionAttempts.value++
    if (correct) {
      sessionCorrect.value++
      streak.value++
      bestStreak.value = Math.max(bestStreak.value, streak.value)
    } else {
      streak.value = 0
    }

    // Only practising the top unlocked level can unlock the next.
    if (p.level === p.unlocked && shouldUnlockNextLevel(question.mode, p.unlocked, p.recent)) {
      p.unlocked++
      p.level = p.unlocked
      p.recent = []
      return p.unlocked
    }
    return null
  }

  function resetStats(target: Mode) {
    progress.value[target] = freshProgress()
  }

  watch(
    [mode, progress],
    () => {
      const payload: PersistedEarTrainer = { mode: mode.value, progress: progress.value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Private browsing with storage disabled — progress just won't persist.
      }
    },
    { deep: true },
  )

  return {
    mode,
    progress,
    current,
    sessionCorrect,
    sessionAttempts,
    streak,
    bestStreak,
    setLevel,
    record,
    resetStats,
  }
})
