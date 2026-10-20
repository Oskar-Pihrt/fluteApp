import type { InstrumentKey } from '@/domain/keys'

/** The six finger holes of a tin whistle; any of them can be half covered. */

export const WHISTLE_KEY_IDS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const

export type WhistleKeyId = (typeof WHISTLE_KEY_IDS)[number]

export const WHISTLE_KEYS: readonly InstrumentKey[] = [
  { id: 'H1', label: '1', name: 'Left index hole', hand: 'left', group: 'leftStack', shape: 'hole', partial: true },
  { id: 'H2', label: '2', name: 'Left middle hole', hand: 'left', group: 'leftStack', shape: 'hole', partial: true },
  { id: 'H3', label: '3', name: 'Left ring hole', hand: 'left', group: 'leftStack', shape: 'hole', partial: true },
  { id: 'H4', label: '4', name: 'Right index hole', hand: 'right', group: 'rightStack', shape: 'hole', partial: true },
  { id: 'H5', label: '5', name: 'Right middle hole', hand: 'right', group: 'rightStack', shape: 'hole', partial: true },
  { id: 'H6', label: '6', name: 'Right ring hole', hand: 'right', group: 'rightStack', shape: 'hole', partial: true },
]
