import { Note } from 'tonal'
import type { Instrument, InstrumentConfig } from '@/instruments/types'
import type { Fingering, FingeringKind } from './fingering'
import { type KeyId, keyDistance, keySetId } from './keys'

/**
 * The instrument being looked up, and the player's setup of it — so results
 * only show fingerings they can actually play.
 */
export interface InstrumentContext {
  instrument: Instrument
  config: InstrumentConfig
}

export function isPlayable(fingering: Fingering, config: InstrumentConfig): boolean {
  return fingering.requires.every((r) => config.includes(r))
}

/** Keys the player's instrument doesn't have — shown faint on the chart. */
export function unavailableKeys({ instrument, config }: InstrumentContext): KeyId[] {
  return instrument.keys.filter((k) => k.requires && !config.includes(k.requires)).map((k) => k.id)
}

const INDEXES = new WeakMap<Instrument, Map<string, Fingering[]>>()

function byKeySet(instrument: Instrument): Map<string, Fingering[]> {
  let index = INDEXES.get(instrument)
  if (index) return index
  index = new Map()
  for (const fingering of instrument.fingerings) {
    const id = keySetId(fingering.keys)
    const bucket = index.get(id)
    if (bucket) bucket.push(fingering)
    else index.set(id, [fingering])
  }
  INDEXES.set(instrument, index)
  return index
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
export function notesForKeys(keys: readonly KeyId[], { instrument, config }: InstrumentContext): Fingering[] {
  const matches = byKeySet(instrument).get(keySetId(keys)) ?? []
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
  { instrument, config }: InstrumentContext,
  limit = 4,
): NearMatch[] {
  const seenNotes = new Set<string>()
  return instrument.fingerings
    .filter((f) => isPlayable(f, config))
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
export function fingeringsForNote(note: string, { instrument, config }: InstrumentContext): Fingering[] {
  const midi = Note.midi(note)
  if (midi == null) return []
  return instrument.fingerings
    .filter((f) => f.midi === midi && isPlayable(f, config))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/** The chromatic range covered by the database, low to high, for the library list. */
export function noteRange({ instrument, config }: InstrumentContext): { note: string; midi: number }[] {
  const playable = instrument.fingerings.filter((f) => isPlayable(f, config))
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
 * What a written note actually sounds as on the instrument: itself on the
 * flute, a major ninth lower on the tenor sax. Flat-preferring, since that is
 * how concert pitch for a B♭ instrument is usually spelled ("A♭3").
 */
export function soundingNote(note: string, instrument: Instrument): string | null {
  const midi = Note.midi(note)
  if (midi == null) return null
  if (!instrument.transposeSemitones) return note
  return Note.fromMidi(midi + instrument.transposeSemitones)
}

/** Sounding frequency in Hz (A4 = 440) of a written note. */
export function noteFrequency(note: string, instrument: Instrument): number | null {
  const sounding = soundingNote(note, instrument)
  return sounding == null ? null : Note.freq(sounding)
}
