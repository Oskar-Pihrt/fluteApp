import { Note } from 'tonal'
import { FINGERINGS } from '@/data/fingerings'
import type { Fingering, FingeringKind } from './fingering'
import { type KeyId, keyDistance, keySetId } from './keys'

/** The player's instrument, so results only show fingerings they can actually play. */
export interface FluteConfig {
  footJoint: 'C' | 'B'
  openHole: boolean
}

export const DEFAULT_FLUTE_CONFIG: FluteConfig = { footJoint: 'C', openHole: false }

export function isPlayable(fingering: Fingering, config: FluteConfig): boolean {
  if (fingering.footJoint === 'B' && config.footJoint !== 'B') return false
  if (fingering.requiresOpenHole && !config.openHole) return false
  return true
}

const BY_KEY_SET = new Map<string, Fingering[]>()
for (const fingering of FINGERINGS) {
  const id = keySetId(fingering.keys)
  const bucket = BY_KEY_SET.get(id)
  if (bucket) bucket.push(fingering)
  else BY_KEY_SET.set(id, [fingering])
}

const KIND_ORDER: Record<FingeringKind, number> = {
  primary: 0,
  alternate: 1,
  trill: 2,
  harmonic: 3,
}

function byPitchThenKind(a: Fingering, b: Fingering): number {
  return a.midi - b.midi || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
}

/**
 * Feature 1 — every note the given key set produces.
 *
 * Returns several results when a fingering is shared across octaves (which is
 * the norm for the first two octaves), ordered low to high.
 */
export function notesForKeys(keys: readonly KeyId[], config: FluteConfig): Fingering[] {
  const matches = BY_KEY_SET.get(keySetId(keys)) ?? []
  return matches.filter((f) => isPlayable(f, config)).sort(byPitchThenKind)
}

export interface NearMatch {
  fingering: Fingering
  /** How many keys differ from what the player selected. */
  distance: number
}

/**
 * Closest known fingerings to an unrecognised key set, so a near miss gets a
 * "did you mean…?" instead of a dead end.
 */
export function nearestFingerings(
  keys: readonly KeyId[],
  config: FluteConfig,
  limit = 4,
): NearMatch[] {
  const seenNotes = new Set<string>()
  return FINGERINGS.filter((f) => isPlayable(f, config))
    .map((fingering) => ({ fingering, distance: keyDistance(keys, fingering.keys) }))
    .filter((m) => m.distance > 0)
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        KIND_ORDER[a.fingering.kind] - KIND_ORDER[b.fingering.kind] ||
        a.fingering.midi - b.fingering.midi,
    )
    .filter((m) => {
      // One suggestion per note — otherwise a note with three alternates floods
      // the list and hides genuinely different candidates.
      if (seenNotes.has(m.fingering.note)) return false
      seenNotes.add(m.fingering.note)
      return true
    })
    .slice(0, limit)
}

/** Feature 2 — every documented way to play one note. */
export function fingeringsForNote(note: string, config: FluteConfig): Fingering[] {
  const midi = Note.midi(note)
  if (midi == null) return []
  return FINGERINGS.filter((f) => f.midi === midi && isPlayable(f, config)).sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  )
}

/** The chromatic range covered by the database, low to high, for the library list. */
export function noteRange(config: FluteConfig): { note: string; midi: number }[] {
  const playable = FINGERINGS.filter((f) => isPlayable(f, config))
  const midis = [...new Set(playable.map((f) => f.midi))].sort((a, b) => a - b)
  return midis.map((midi) => ({ midi, note: canonicalNote(midi) }))
}

/** Sharp-preferring scientific name for a MIDI number, e.g. 61 -> "C#4". */
export function canonicalNote(midi: number): string {
  return Note.fromMidiSharps(midi)
}

/** Display form: "F♯5", with the flat equivalent for accidentals. */
export function noteLabel(note: string): string {
  const parsed = Note.get(note)
  if (parsed.empty) return note
  return prettyAccidentals(parsed.name)
}

export function noteLabelWithEnharmonic(note: string): string {
  const parsed = Note.get(note)
  if (parsed.empty) return note
  const primary = prettyAccidentals(parsed.name)
  if (!parsed.alt) return primary
  const other = Note.enharmonic(parsed.name)
  return other && other !== parsed.name ? `${primary} / ${prettyAccidentals(other)}` : primary
}

function prettyAccidentals(name: string): string {
  return name.replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/bb/g, '𝄫').replace(/b/g, '♭')
}

/** True when a note has an alternative spelling worth showing (C♯ / D♭). */
export function hasEnharmonic(note: string): boolean {
  return Note.get(note).alt !== 0
}

/**
 * Chart notation with real accidental glyphs: "T 1-- | 1-- E♭".
 * Only the key tokens are rewritten — the dashes and digits are left alone.
 */
export function prettyCode(code: string): string {
  return code.replace(/\b(?:Bb|Eb|C#|D#|G#)\b/g, (token) =>
    token.replace('#', '♯').replace('b', '♭'),
  )
}

/** Concert-pitch frequency in Hz (A4 = 440). */
export function noteFrequency(note: string): number | null {
  return Note.freq(note)
}
