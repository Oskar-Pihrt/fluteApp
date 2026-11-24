import { addDays, ageParts, diffDays, todayISO } from './dates'
import type { SnakeEvent } from './types'
import { speciesByKey } from './species'

export type FeedState = 'never' | 'ok' | 'today' | 'overdue'

export interface FeedStatus {
  state: FeedState
  lastFed: string | null
  dueDate: string | null
  /** Negative when overdue. */
  daysUntil: number | null
}

const RETRY_AFTER_REFUSAL = 7

/**
 * When is the next meal due? Based on the last meal actually eaten; after a
 * refusal the snake is offered food again after a week (or sooner when its
 * normal interval is shorter).
 */
export function feedingStatus(events: SnakeEvent[], everyDays: number, today = todayISO()): FeedStatus {
  const feeds = events.filter((e) => e.type === 'feed').sort((a, b) => a.date.localeCompare(b.date))
  const eaten = feeds.filter((e) => !e.refused)
  const lastEaten = eaten.at(-1)
  const lastAny = feeds.at(-1)
  if (!lastAny) return { state: 'never', lastFed: null, dueDate: null, daysUntil: null }

  let dueDate: string
  if (lastAny.refused && (!lastEaten || lastAny.date >= lastEaten.date)) {
    dueDate = addDays(lastAny.date, Math.min(everyDays, RETRY_AFTER_REFUSAL))
  } else {
    dueDate = addDays(lastEaten!.date, everyDays)
  }
  const daysUntil = diffDays(today, dueDate)
  return {
    state: daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'ok',
    lastFed: lastEaten?.date ?? null,
    dueDate,
    daysUntil,
  }
}

/** Sensible default meal interval for a species at a given age. */
export function defaultFeedInterval(speciesKey: string, birthDate: string): number {
  const sp = speciesByKey(speciesKey)
  const age = ageParts(birthDate)
  const juvenile = age ? age.years < 1 : false
  return juvenile ? sp.feedJuvenileDays : sp.feedAdultDays
}
