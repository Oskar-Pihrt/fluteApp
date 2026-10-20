import type { InstrumentKey, KeyGroup } from '@/domain/keys'

/**
 * The "keys" of brass instruments: piston or rotary valves, the double horn's
 * thumb valve, and the trombone's slide positions and F trigger. A fingering
 * is still the set held down — for a trombone, one slide position plus,
 * perhaps, the trigger.
 */

export const VALVE_KEY_IDS = ['THUMB_BB', 'V1', 'V2', 'V3', 'V4'] as const
export type ValveKeyId = (typeof VALVE_KEY_IDS)[number]

export const VALVE_KEYS: readonly InstrumentKey[] = [
  {
    id: 'THUMB_BB',
    label: 'T',
    name: 'Thumb valve (B♭ side)',
    hand: 'left',
    group: 'thumb',
    shape: 'lever',
  },
  { id: 'V1', label: '1', name: 'First valve', hand: 'both', group: 'valves', shape: 'hole' },
  { id: 'V2', label: '2', name: 'Second valve', hand: 'both', group: 'valves', shape: 'hole' },
  { id: 'V3', label: '3', name: 'Third valve', hand: 'both', group: 'valves', shape: 'hole' },
  {
    id: 'V4',
    label: '4',
    name: 'Fourth valve',
    hand: 'both',
    group: 'valves',
    shape: 'hole',
    requires: 'fourthValve',
  },
]

export const SLIDE_KEY_IDS = ['TRIGGER', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] as const
export type SlideKeyId = (typeof SLIDE_KEY_IDS)[number]

export const SLIDE_KEYS: readonly InstrumentKey[] = [
  {
    id: 'TRIGGER',
    label: 'F',
    name: 'F trigger',
    hand: 'left',
    group: 'thumb',
    shape: 'lever',
    requires: 'fTrigger',
  },
  ...([1, 2, 3, 4, 5, 6, 7] as const).map(
    (n): InstrumentKey => ({
      id: `P${n}`,
      label: String(n),
      name: `Slide in ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n - 1]} position`,
      hand: 'right',
      group: 'slide',
      shape: 'lever',
    }),
  ),
]

/** The slide is in one position at a time. */
export const SLIDE_EXCLUSIVE_GROUPS: readonly KeyGroup[] = ['slide']
