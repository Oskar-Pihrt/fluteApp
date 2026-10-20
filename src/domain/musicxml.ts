import { Note } from 'tonal'
import {
  DURATION_TYPES,
  type Duration,
  type DurationType,
  eventId,
  type Jump,
  type Measure,
  type Score,
  type ScoreEvent,
  type TimeSignature,
  TICKS_PER_QUARTER,
  durationTicks,
} from '@/score/model'

/**
 * MusicXML import: the exact alternative to reading notes off a picture.
 *
 * MuseScore, Finale, Sibelius and Dorico all export MusicXML, and many free
 * scores are published in it, so when a player has the file there is no reason
 * to guess. Each part is read twice over: as the flat pitch sequence the note
 * strip and detection compare against, and as a full score — measures,
 * durations, rests, ties, time and key signatures, repeats, endings and
 * D.C./D.S. marks. Dynamics, articulations and layout are skipped.
 *
 * A deliberately small reader rather than a DOM parse: MusicXML's note
 * structure is regular, and this way it runs (and is tested) without a DOM.
 */

export interface MusicXmlPart {
  id: string
  name: string
  /** Pitches in the part's *written* pitch, as printed in it. */
  notes: string[]
  /**
   * Semitones from written to sounding, from the part's <transpose>. −9 for an
   * alto saxophone part, 0 for a flute.
   */
  transposeSemitones: number
  /** The part as a rhythm-mode score, in its written pitch. */
  score: Score
}

export interface MusicXmlScore {
  title: string
  composer: string
  parts: MusicXmlPart[]
}

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Inner content of the first `<tag>` — decoded text for leaves, raw XML for `raw`. */
function text(xml: string, tag: string, raw = false): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  if (!match) return null
  return raw ? match[1] : decode(match[1].trim())
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Spell a MusicXML pitch; `alter` may be fractional (quarter tones), which is rounded. */
function spell(step: string, alter: number, octave: number): string {
  const a = Math.round(alter)
  const accidental = a > 0 ? '#'.repeat(a) : 'b'.repeat(-a)
  return `${step}${accidental}${octave}`
}

export interface ParseOptions {
  /** Merge a tied continuation into the note it continues. Default true. */
  mergeTies?: boolean
  /** Keep grace notes. Default true. */
  includeGrace?: boolean
}

export function parseMusicXml(xml: string, options: ParseOptions = {}): MusicXmlScore {
  const mergeTies = options.mergeTies ?? true
  const includeGrace = options.includeGrace ?? true
  if (!/<score-partwise[\s>]/.test(xml)) {
    if (/<score-timewise[\s>]/.test(xml)) throw new Error('Timewise MusicXML is not supported. Export as partwise (the usual kind).')
    throw new Error('That file is not MusicXML.')
  }

  const title = text(xml, 'work-title') ?? text(xml, 'movement-title') ?? ''
  const composer = xml.match(/<creator[^>]*type="composer"[^>]*>([\s\S]*?)<\/creator>/)?.[1]?.trim() ?? ''

  const names = new Map<string, string>()
  for (const match of xml.matchAll(/<score-part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/score-part>/g)) {
    names.set(match[1], text(match[2], 'part-name') ?? match[1])
  }

  const parts: MusicXmlPart[] = []
  for (const match of xml.matchAll(/<part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/part>/g)) {
    const [, id, body] = match
    let transposeSemitones = 0
    const notes: string[] = []
    // Pitch of the last note kept, for chords (keep the top) and ties (merge).
    let lastMidi: number | null = null
    let lastWasChordable = false

    for (const element of body.matchAll(/<(note|transpose)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const [, kind, content] = element
      if (kind === 'transpose') {
        const chromatic = Number(text(content, 'chromatic') ?? 0)
        const octaves = Number(text(content, 'octave-change') ?? 0)
        transposeSemitones = chromatic + octaves * 12
        continue
      }
      // Only the first voice: a part with a second voice (divisi) would
      // otherwise interleave two lines.
      const voice = text(content, 'voice')
      if (voice && voice !== '1') continue
      if (/<rest[\s/>]/.test(content)) {
        lastWasChordable = false
        continue
      }
      const isGrace = /<grace[\s/>]/.test(content)
      if (isGrace && !includeGrace) continue
      const pitch = text(content, 'pitch', true)
      if (!pitch) continue
      const step = text(pitch, 'step')?.toUpperCase() ?? ''
      if (!STEPS.includes(step)) continue
      const name = spell(step, Number(text(pitch, 'alter') ?? 0), Number(text(pitch, 'octave') ?? 4))
      const midi = Note.midi(name)
      if (midi == null) continue

      if (/<chord[\s/>]/.test(content) && lastWasChordable) {
        // Same chord as the previous note: keep whichever is higher.
        if (lastMidi != null && midi > lastMidi) {
          notes[notes.length - 1] = name
          lastMidi = midi
        }
        continue
      }
      const continuesTie = /<tie[^>]*type="stop"/.test(content)
      if (mergeTies && continuesTie && lastMidi === midi) {
        lastWasChordable = true
        continue
      }
      notes.push(name)
      lastMidi = midi
      lastWasChordable = true
    }
    parts.push({ id, name: names.get(id) ?? id, notes, transposeSemitones, score: partScore(body) })
  }

  return { title, composer, parts: parts.filter((part) => part.notes.length) }
}

const TYPE_NAMES: Record<string, DurationType> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  // Shorter values are drawn as the shortest the app has.
  '64th': '32nd',
  '128th': '32nd',
  breve: 'whole',
}

/** A duration from `<type>` and `<dot/>`s, or failing that from `<duration>` in divisions. */
function readDuration(content: string, divisions: number): Duration | undefined {
  const type = text(content, 'type')
  const dots = Math.min(2, (content.match(/<dot\s*\/?>/g) ?? []).length)
  if (type && TYPE_NAMES[type]) return { type: TYPE_NAMES[type], dots }
  const raw = Number(text(content, 'duration'))
  if (!raw || !divisions) return undefined
  const ticks = (raw / divisions) * TICKS_PER_QUARTER
  // The plain or dotted value closest to the length written.
  let best: Duration | undefined
  for (const candidate of DURATION_TYPES) {
    for (const d of [0, 1, 2]) {
      const option = { type: candidate, dots: d }
      if (!best || Math.abs(durationTicks(option) - ticks) < Math.abs(durationTicks(best) - ticks)) best = option
    }
  }
  return best
}

const JUMP_WORDS: [RegExp, Jump][] = [
  [/d\.?\s*c\.?\s*al\s*fine/i, 'dcAlFine'],
  [/d\.?\s*c\.?\s*al\s*coda/i, 'dcAlCoda'],
  [/d\.?\s*s\.?\s*al\s*fine/i, 'dsAlFine'],
  [/d\.?\s*s\.?\s*al\s*coda/i, 'dsAlCoda'],
  [/da\s*capo|^\s*d\.\s*c\./i, 'dc'],
  [/dal\s*segno|^\s*d\.\s*s\./i, 'ds'],
  [/to\s*coda/i, 'toCoda'],
  [/^\s*fine\s*$/i, 'fine'],
]

function jumpsIn(direction: string): Jump[] {
  const found: Jump[] = []
  if (/<segno[\s/>]/.test(direction)) found.push('segno')
  if (/<coda[\s/>]/.test(direction)) found.push('coda')
  for (const words of direction.matchAll(/<words[^>]*>([\s\S]*?)<\/words>/g)) {
    const phrase = decode(words[1])
    const hit = JUMP_WORDS.find(([pattern]) => pattern.test(phrase))
    if (hit) found.push(hit[1])
  }
  if (!found.some((j) => j.startsWith('dc')) && /<sound[^>]*dacapo="yes"/.test(direction)) found.push('dc')
  if (!found.some((j) => j.startsWith('ds')) && /<sound[^>]*dalsegno=/.test(direction)) found.push('ds')
  if (!found.includes('fine') && /<sound[^>]*fine=/.test(direction)) found.push('fine')
  if (!found.includes('toCoda') && /<sound[^>]*tocoda=/.test(direction)) found.push('toCoda')
  return found
}

/**
 * One part as a rhythm-mode score: its first voice, chords reduced to the
 * top note, grace notes left out (they take no time). Tuplets are read at
 * their written value, so a measure of triplets reads as overfull.
 */
function partScore(body: string): Score {
  const measures: Measure[] = []
  let divisions = 1
  let tempo: number | undefined
  let lastKey: number | undefined
  let lastTime: string | undefined
  let openEnding: number[] | null = null

  for (const match of body.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)) {
    const content = match[1]
    const measure: Measure = { id: eventId(), events: [] }
    let lastNote: (ScoreEvent & { kind: 'note' }) | null = null

    for (const element of content.matchAll(
      /<(attributes|note|barline|direction)\b([^>]*)>([\s\S]*?)<\/\1>|<sound\b[^>]*\/>/g,
    )) {
      const [whole, kind, attrs, inner] = element
      if (!kind) {
        const bpm = whole.match(/tempo="([\d.]+)"/)
        if (bpm && tempo === undefined) tempo = Math.round(Number(bpm[1]))
        continue
      }
      if (kind === 'attributes') {
        const div = Number(text(inner, 'divisions'))
        if (div) divisions = div
        const fifths = text(inner, 'fifths')
        if (fifths !== null && Number(fifths) !== lastKey) {
          lastKey = Number(fifths)
          measure.keyFifths = lastKey
        }
        const timeXml = text(inner, 'time', true)
        if (timeXml) {
          const symbol = inner.match(/<time[^>]*symbol="(common|cut)"/)?.[1] as TimeSignature['symbol']
          const time: TimeSignature = {
            beats: Number(text(timeXml, 'beats')) || 4,
            beatType: Number(text(timeXml, 'beat-type')) || 4,
            ...(symbol ? { symbol } : {}),
          }
          const signature = JSON.stringify(time)
          if (signature !== lastTime) {
            lastTime = signature
            measure.time = time
          }
        }
        continue
      }
      if (kind === 'direction') {
        const jumps = jumpsIn(inner)
        if (jumps.length) measure.jumps = [...(measure.jumps ?? []), ...jumps]
        const bpm = inner.match(/<sound[^>]*tempo="([\d.]+)"/)
        if (bpm && tempo === undefined) tempo = Math.round(Number(bpm[1]))
        continue
      }
      if (kind === 'barline') {
        const right = !/location="left"/.test(attrs)
        if (/<repeat[^>]*direction="forward"/.test(inner)) measure.barStart = 'repeatStart'
        if (/<repeat[^>]*direction="backward"/.test(inner)) measure.barEnd = 'repeatEnd'
        else if (right && /<bar-style>light-heavy</.test(inner)) measure.barEnd = 'final'
        else if (right && /<bar-style>light-light</.test(inner)) measure.barEnd = 'double'
        const ending = inner.match(/<ending[^>]*number="([^"]+)"[^>]*type="(start|stop|discontinue)"/)
        if (ending && ending[2] === 'start') {
          openEnding = ending[1].split(/[,\s]+/).map(Number).filter(Boolean)
        }
        if (ending && ending[2] !== 'start') {
          measure.volta = { numbers: openEnding ?? ending[1].split(/[,\s]+/).map(Number).filter(Boolean) }
          openEnding = null
        }
        continue
      }
      // A note or rest, first voice only.
      const voice = text(inner, 'voice')
      if (voice && voice !== '1') continue
      if (/<grace[\s/>]/.test(inner)) continue
      const duration = readDuration(inner, divisions)
      if (/<rest[\s/>]/.test(inner)) {
        // A whole-measure rest is written with the measure's duration but no type.
        measure.events.push({ kind: 'rest', id: eventId(), ...(duration ? { duration } : {}) })
        lastNote = null
        continue
      }
      const pitch = text(inner, 'pitch', true)
      if (!pitch) continue
      const step = text(pitch, 'step')?.toUpperCase() ?? ''
      if (!STEPS.includes(step)) continue
      const name = spell(step, Number(text(pitch, 'alter') ?? 0), Number(text(pitch, 'octave') ?? 4))
      if (/<chord[\s/>]/.test(inner)) {
        if (lastNote && (Note.midi(name) ?? 0) > (Note.midi(lastNote.pitch) ?? 0)) lastNote.pitch = name
        continue
      }
      const note: ScoreEvent & { kind: 'note' } = {
        kind: 'note',
        id: eventId(),
        pitch: name,
        source: 'imported',
        ...(duration ? { duration } : {}),
        ...(/<tie[^>]*type="start"/.test(inner) ? { tie: true } : {}),
      }
      measure.events.push(note)
      lastNote = note
    }
    if (openEnding && !measure.volta) measure.volta = { numbers: openEnding }
    measures.push(measure)
  }

  return {
    mode: 'rhythm',
    clef: 'treble',
    measures: measures.length ? measures : [{ id: eventId(), events: [] }],
    ...(tempo ? { tempo } : {}),
  }
}

/**
 * The XML inside a compressed .mxl file: a zip whose META-INF/container.xml
 * names the score. Read with the browser's own DecompressionStream, so no zip
 * library is needed.
 */
export async function readMxl(bytes: ArrayBuffer): Promise<string> {
  const files = await unzip(bytes)
  const container = files.get('META-INF/container.xml')
  const rootPath = container ? new TextDecoder().decode(container).match(/full-path="([^"]+)"/)?.[1] : undefined
  const root =
    (rootPath && files.get(rootPath)) ??
    [...files.entries()].find(([path]) => !path.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(path))?.[1]
  if (!root) throw new Error('No score found inside that .mxl file.')
  return new TextDecoder().decode(root)
}

async function unzip(bytes: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes)
  const data = new Uint8Array(bytes)
  // End of central directory: scan back for its signature.
  let eocd = -1
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('That .mxl file is not a valid zip archive.')
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(data.subarray(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength

    const localName = view.getUint16(localOffset + 26, true)
    const localExtra = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localName + localExtra
    const raw = data.subarray(start, start + compressedSize)
    if (method === 0) files.set(name, raw)
    else if (method === 8) files.set(name, await inflate(raw))
  }
  return files
}

async function inflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
