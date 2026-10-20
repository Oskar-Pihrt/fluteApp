import type { InstrumentKey } from '@/domain/keys'

/**
 * The holes of a recorder, as The Woodwind Fingering Guide numbers them
 * (wfg.woodwind.org/recorder/rec_fing.html): the thumb hole underneath,
 * seven finger holes on top — the lowest two of them double — and the bell,
 * closed against the knee for one high note. The same for baroque (English)
 * and German fingering and for every size.
 */

export const RECORDER_KEY_IDS = ['THUMB', 'L1', 'L2', 'L3', 'R4', 'R5', 'R6', 'R7', 'BELL'] as const

export type RecorderKeyId = (typeof RECORDER_KEY_IDS)[number]

export const RECORDER_KEYS: readonly InstrumentKey[] = [
  { id: 'THUMB', label: 'T', name: 'Thumb hole', hand: 'left', group: 'thumb', shape: 'hole', partial: true },
  { id: 'L1', label: '1', name: 'Left index hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L2', label: '2', name: 'Left middle hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L3', label: '3', name: 'Left ring hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'R4', label: '4', name: 'Right index hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R5', label: '5', name: 'Right middle hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R6', label: '6', name: 'Right ring double hole', hand: 'right', group: 'rightStack', shape: 'hole', partial: true },
  { id: 'R7', label: '7', name: 'Right little finger double hole', hand: 'right', group: 'rightStack', shape: 'hole', partial: true },
  { id: 'BELL', label: 'X', name: 'Bell (closed against the knee)', hand: 'both', group: 'rightPinky', shape: 'hole' },
]
