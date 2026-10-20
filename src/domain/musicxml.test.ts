/// <reference types="node" />
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { parseMusicXml, readMxl } from './musicxml'

const note = (step: string, octave: number, extra = '') =>
  `<note>${extra.includes('<grace') ? extra : ''}<pitch><step>${step}</step>${extra.match(/<alter>.*<\/alter>/)?.[0] ?? ''}<octave>${octave}</octave></pitch><duration>1</duration>${extra.replace(/<grace\/>|<alter>.*<\/alter>/g, '')}<voice>1</voice></note>`

const score = (parts: string, partList: string) => `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Sonatina &amp; Air</work-title></work>
  <identification><creator type="composer">A. Composer</creator></identification>
  <part-list>${partList}</part-list>
  ${parts}
</score-partwise>`

describe('parseMusicXml', () => {
  it('reads title, composer and a part’s pitches in order', () => {
    const xml = score(
      `<part id="P1"><measure number="1">${note('C', 5)}${note('F', 5, '<alter>1</alter>')}${note('B', 4, '<alter>-1</alter>')}<note><rest/><duration>1</duration></note></measure></part>`,
      `<score-part id="P1"><part-name>Flute</part-name></score-part>`,
    )
    const parsed = parseMusicXml(xml)
    expect(parsed.title).toBe('Sonatina & Air')
    expect(parsed.composer).toBe('A. Composer')
    expect(parsed.parts).toHaveLength(1)
    expect(parsed.parts[0]).toMatchObject({ name: 'Flute', notes: ['C5', 'F#5', 'Bb4'], transposeSemitones: 0 })
  })

  it('keeps the top note of a chord', () => {
    const xml = score(`<part id="P1"><measure>${note('C', 5)}${note('E', 5, '<chord/>')}${note('D', 5)}</measure></part>`, '')
    expect(parseMusicXml(xml).parts[0].notes).toEqual(['E5', 'D5'])
  })

  it('merges tied continuations unless asked not to', () => {
    const xml = score(
      `<part id="P1"><measure>${note('G', 4, '<tie type="start"/>')}${note('G', 4, '<tie type="stop"/>')}${note('A', 4)}</measure></part>`,
      '',
    )
    expect(parseMusicXml(xml).parts[0].notes).toEqual(['G4', 'A4'])
    expect(parseMusicXml(xml, { mergeTies: false }).parts[0].notes).toEqual(['G4', 'G4', 'A4'])
  })

  it('reads a transposing part’s transposition', () => {
    const xml = score(
      `<part id="P1"><measure><attributes><transpose><diatonic>-5</diatonic><chromatic>-9</chromatic></transpose></attributes>${note('A', 4)}</measure></part>`,
      `<score-part id="P1"><part-name>Alto Saxophone</part-name></score-part>`,
    )
    expect(parseMusicXml(xml).parts[0].transposeSemitones).toBe(-9)
  })

  it('skips a second voice and optionally grace notes', () => {
    const xml = score(
      `<part id="P1"><measure>${note('C', 5, '<grace/>')}${note('D', 5)}<backup><duration>1</duration></backup><note><pitch><step>G</step><octave>3</octave></pitch><voice>2</voice></note></measure></part>`,
      '',
    )
    expect(parseMusicXml(xml).parts[0].notes).toEqual(['C5', 'D5'])
    expect(parseMusicXml(xml, { includeGrace: false }).parts[0].notes).toEqual(['D5'])
  })

  it('rejects files that are not partwise MusicXML', () => {
    expect(() => parseMusicXml('<html></html>')).toThrow(/not MusicXML/)
    expect(() => parseMusicXml('<score-timewise version="3.1"></score-timewise>')).toThrow(/partwise/)
  })
})

/** A minimal zip (deflate) holding the given files, as an .mxl is. */
function zip(files: Record<string, string>): ArrayBuffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content)
    const compressed = deflateRawSync(raw)
    const nameBytes = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    chunks.push(local, nameBytes, compressed)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(compressed.length, 20)
    entry.writeUInt32LE(raw.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)
    offset += 30 + nameBytes.length + compressed.length
  }
  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  const all = Buffer.concat([...chunks, centralBytes, end])
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength)
}

describe('readMxl', () => {
  it('finds the score through container.xml', async () => {
    const xml = score(`<part id="P1"><measure>${note('E', 5)}</measure></part>`, '')
    const bytes = zip({
      'META-INF/container.xml': '<container><rootfiles><rootfile full-path="score/piece.musicxml"/></rootfiles></container>',
      'score/piece.musicxml': xml,
    })
    expect(parseMusicXml(await readMxl(bytes)).parts[0].notes).toEqual(['E5'])
  })
})

describe('parseMusicXml — the score', () => {
  const xml = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="96"/></direction>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>6</duration><type>half</type><dot/></note>
    </measure>
    <measure number="2">
      <barline location="left"><ending number="1" type="start"/></barline>
      <note><rest/><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>4</duration><type>half</type><tie type="start"/></note>
      <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
    <measure number="3">
      <barline location="left"><ending number="2" type="start"/></barline>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><type>quarter</type><tie type="stop"/></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><chord/><pitch><step>G</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>3</duration></note>
      <direction><direction-type><words>D.C. al Fine</words></direction-type></direction>
      <barline location="right"><bar-style>light-heavy</bar-style><ending number="2" type="discontinue"/></barline>
    </measure>
  </part>
</score-partwise>`

  const { score } = parseMusicXml(xml).parts[0]

  it('reads measures, signatures and tempo', () => {
    expect(score.mode).toBe('rhythm')
    expect(score.tempo).toBe(96)
    expect(score.measures).toHaveLength(3)
    expect(score.measures[0]).toMatchObject({ keyFifths: 1, time: { beats: 3, beatType: 4 }, barStart: 'repeatStart' })
    expect(score.measures[1].time).toBeUndefined()
  })

  it('reads durations, dots, rests and ties', () => {
    const [m1, m2, m3] = score.measures
    expect(m1.events[0]).toMatchObject({ kind: 'note', pitch: 'G4', duration: { type: 'half', dots: 1 } })
    expect(m2.events[0]).toMatchObject({ kind: 'rest', duration: { type: 'quarter', dots: 0 } })
    expect(m2.events[1]).toMatchObject({ pitch: 'F#5', tie: true })
    expect(m3.events.map((e) => (e.kind === 'note' ? e.pitch : 'r'))).toEqual(['F#5', 'G5', 'D5'])
    // No <type>: worked out from <duration> in divisions — 3 eighths is a dotted quarter.
    expect(m3.events[2]).toMatchObject({ duration: { type: 'quarter', dots: 1 } })
  })

  it('reads repeats, endings and jumps', () => {
    const [, m2, m3] = score.measures
    expect(m2).toMatchObject({ volta: { numbers: [1] }, barEnd: 'repeatEnd' })
    expect(m3).toMatchObject({ volta: { numbers: [2] }, barEnd: 'final', jumps: ['dcAlFine'] })
  })
})
