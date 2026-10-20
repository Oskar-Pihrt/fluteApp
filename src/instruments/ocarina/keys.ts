import type { InstrumentKey } from '@/domain/keys'

/**
 * The holes of a 12-hole ocarina: four finger holes per hand on top, a thumb
 * hole per hand underneath, and two small sub-holes beside the middle-finger
 * holes for the lowest notes.
 */

export const OCARINA_KEY_IDS = ['LT', 'RT', 'L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4', 'SUB_A', 'SUB_B'] as const

export type OcarinaKeyId = (typeof OCARINA_KEY_IDS)[number]

export const OCARINA_KEYS: readonly InstrumentKey[] = [
  { id: 'LT', label: 'T', name: 'Left thumb hole', hand: 'left', group: 'thumb', shape: 'hole' },
  { id: 'RT', label: 'T', name: 'Right thumb hole', hand: 'right', group: 'thumb', shape: 'hole' },
  { id: 'L1', label: '1', name: 'Left index hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L2', label: '2', name: 'Left middle hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L3', label: '3', name: 'Left ring hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L4', label: '4', name: 'Left little finger hole', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'R1', label: '1', name: 'Right index hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R2', label: '2', name: 'Right middle hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R3', label: '3', name: 'Right ring hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R4', label: '4', name: 'Right little finger hole', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'SUB_A', label: 'A', name: 'A sub-hole', hand: 'left', group: 'leftSide', shape: 'hole' },
  { id: 'SUB_B', label: 'B', name: 'B sub-hole', hand: 'right', group: 'rightSide', shape: 'hole' },
]
