import { Interval, Note } from 'tonal'
import { type Duration, durationTicks, type Jump, type Measure, type Score, TICKS_PER_QUARTER } from '@/score/model'
import { keyAt, timeAt } from '@/score/ops'

/**
 * A score as MusicXML 4.0 (partwise, one part), for MuseScore, Sibelius,
 * Finale or Dorico — the inverse of `parseMusicXml`'s score reading. A
 * pitches-mode score is written as quarter notes, since MusicXML needs
 * durations.
 */

export interface ExportMeta {
  title: string
  composer: string
  partName: string
  /** Written to sounding, in semitones — the part's <transpose>. */
  transposeSemitones: number
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TYPE_NAME: Record<Duration['type'], string> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': '16th',
  '32nd': '32nd',
}

const JUMP_DIRECTION: Record<Jump, string> = {
  segno: '<direction-type><segno/></direction-type><sound segno="segno"/>',
  coda: '<direction-type><coda/></direction-type><sound coda="coda"/>',
  fine: '<direction-type><words>Fine</words></direction-type><sound fine="yes"/>',
  toCoda: '<direction-type><words>To Coda</words></direction-type><sound tocoda="coda"/>',
  dc: '<direction-type><words>D.C.</words></direction-type><sound dacapo="yes"/>',
  dcAlFine: '<direction-type><words>D.C. al Fine</words></direction-type><sound dacapo="yes"/>',
  dcAlCoda: '<direction-type><words>D.C. al Coda</words></direction-type><sound dacapo="yes"/>',
  ds: '<direction-type><words>D.S.</words></direction-type><sound dalsegno="segno"/>',
  dsAlFine: '<direction-type><words>D.S. al Fine</words></direction-type><sound dalsegno="segno"/>',
  dsAlCoda: '<direction-type><words>D.S. al Coda</words></direction-type><sound dalsegno="segno"/>',
}

function transposeXml(semitones: number): string {
  if (!semitones) return ''
  const octaves = Math.trunc(semitones / 12)
  const chromatic = semitones - octaves * 12
  const interval = Interval.get(Interval.fromSemitones(chromatic))
  const diatonic = interval.empty ? 0 : (interval.num ?? 1) - Math.sign(interval.num ?? 1)
  return `<transpose><diatonic>${diatonic}</diatonic><chromatic>${chromatic}</chromatic>${
    octaves ? `<octave-change>${octaves}</octave-change>` : ''
  }</transpose>`
}

function timeXml(score: Score, index: number): string {
  const time = score.measures[index].time ?? (index === 0 ? timeAt(score, 0) : null)
  if (!time || score.mode !== 'rhythm') return ''
  const symbol = time.symbol ? ` symbol="${time.symbol}"` : ''
  return `<time${symbol}><beats>${time.beats}</beats><beat-type>${time.beatType}</beat-type></time>`
}

function sameEnding(a?: Measure, b?: Measure): boolean {
  return !!a?.volta && !!b?.volta && a.volta.numbers.join() === b.volta.numbers.join()
}

export function scoreToMusicXml(score: Score, meta: ExportMeta): string {
  const rhythm = score.mode === 'rhythm'
  const measures: string[] = []
  let tiedInto = false

  score.measures.forEach((measure, index) => {
    const parts: string[] = []
    const opensEnding = measure.volta && !sameEnding(score.measures[index - 1], measure)
    const closesEnding = measure.volta && !sameEnding(measure, score.measures[index + 1])
    const numbers = measure.volta?.numbers.join(', ') ?? ''

    if (measure.barStart === 'repeatStart' || opensEnding) {
      parts.push(
        `<barline location="left">${measure.barStart === 'repeatStart' ? '<bar-style>heavy-light</bar-style>' : ''}${
          opensEnding ? `<ending number="${numbers}" type="start">${numbers}.</ending>` : ''
        }${measure.barStart === 'repeatStart' ? '<repeat direction="forward"/>' : ''}</barline>`,
      )
    }

    if (index === 0) {
      parts.push(
        `<attributes><divisions>${TICKS_PER_QUARTER}</divisions><key><fifths>${keyAt(score, 0)}</fifths></key>${timeXml(
          score,
          0,
        )}<clef><sign>G</sign><line>2</line></clef>${transposeXml(meta.transposeSemitones)}</attributes>`,
      )
      if (score.tempo) {
        parts.push(
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>`,
        )
      }
    } else if (measure.keyFifths !== undefined || (measure.time && rhythm)) {
      parts.push(
        `<attributes>${measure.keyFifths !== undefined ? `<key><fifths>${measure.keyFifths}</fifths></key>` : ''}${timeXml(
          score,
          index,
        )}</attributes>`,
      )
    }

    // Segno and coda mark where a measure begins; the rest where it ends.
    const jumps = measure.jumps ?? []
    for (const jump of jumps.filter((j) => j === 'segno' || j === 'coda')) {
      parts.push(`<direction placement="above">${JUMP_DIRECTION[jump]}</direction>`)
    }

    for (const event of measure.events) {
      const duration: Duration = rhythm ? (event.duration ?? { type: 'quarter', dots: 0 }) : { type: 'quarter', dots: 0 }
      const ticks = durationTicks(duration)
      const dots = '<dot/>'.repeat(duration.dots)
      if (event.kind === 'rest') {
        parts.push(`<note><rest/><duration>${ticks}</duration><voice>1</voice><type>${TYPE_NAME[duration.type]}</type>${dots}</note>`)
        tiedInto = false
        continue
      }
      const parsed = Note.get(event.pitch)
      const alter = parsed.alt ? `<alter>${parsed.alt}</alter>` : ''
      const tieStart = rhythm && !!event.tie
      const ties = `${tiedInto ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}`
      const tied = `${tiedInto ? '<tied type="stop"/>' : ''}${tieStart ? '<tied type="start"/>' : ''}`
      parts.push(
        `<note><pitch><step>${parsed.letter}</step>${alter}<octave>${parsed.oct}</octave></pitch><duration>${ticks}</duration>${ties}<voice>1</voice><type>${
          TYPE_NAME[duration.type]
        }</type>${dots}${tied ? `<notations>${tied}</notations>` : ''}</note>`,
      )
      tiedInto = tieStart
    }

    for (const jump of jumps.filter((j) => j !== 'segno' && j !== 'coda')) {
      parts.push(`<direction placement="below">${JUMP_DIRECTION[jump]}</direction>`)
    }

    const last = index === score.measures.length - 1
    const style =
      measure.barEnd === 'repeatEnd' || measure.barEnd === 'final' || (last && !measure.barEnd)
        ? '<bar-style>light-heavy</bar-style>'
        : measure.barEnd === 'double'
          ? '<bar-style>light-light</bar-style>'
          : ''
    if (style || closesEnding) {
      const ending = closesEnding
        ? `<ending number="${numbers}" type="${measure.barEnd === 'repeatEnd' ? 'stop' : 'discontinue'}"/>`
        : ''
      const repeat = measure.barEnd === 'repeatEnd' ? '<repeat direction="backward"/>' : ''
      parts.push(`<barline location="right">${style}${ending}${repeat}</barline>`)
    }

    measures.push(`<measure number="${index + 1}">${parts.join('')}</measure>`)
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>${escape(meta.title)}</work-title></work>
<identification>${meta.composer ? `<creator type="composer">${escape(meta.composer)}</creator>` : ''}<encoding><software>TimbreMap</software></encoding></identification>
<part-list><score-part id="P1"><part-name>${escape(meta.partName)}</part-name></score-part></part-list>
<part id="P1">
${measures.join('\n')}
</part>
</score-partwise>
`
}
