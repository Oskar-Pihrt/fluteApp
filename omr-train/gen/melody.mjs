/**
 * Random monophonic parts as MEI, with ground truth for every note.
 *
 * The aim is not music but *engraving variety*: everything that sits on a real
 * flute or saxophone part and can be mistaken for, or hide, a notehead — beams
 * of every density, rests, ties and slurs, accidentals and key signatures,
 * ottava lines, grace notes, tuplets, dynamics, hairpins, text, fingerings,
 * articulations, meter changes, repeats and voltas. Each feature is switched
 * on per piece with its own probability so pages differ in character, not just
 * in notes.
 *
 * Notes carry xml:ids that the renderer's SVG keeps, so truth (sounding pitch,
 * grace, tied-from-previous) is joined back to the drawn noteheads by id.
 */

const STEPS = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const SHARP_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b']
const FLAT_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f']

export function rng(seed) {
  let s = seed >>> 0 || 1
  const next = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    weighted: (pairs) => {
      const total = pairs.reduce((sum, [, w]) => sum + w, 0)
      let r = next() * total
      for (const [value, w] of pairs) {
        if ((r -= w) < 0) return value
      }
      return pairs[pairs.length - 1][0]
    },
  }
}

/** Diatonic index (step + 7·octave) ↔ written name. */
const diatonic = (step, oct) => STEPS.indexOf(step) + oct * 7
const fromDiatonic = (d) => ({ step: STEPS[((d % 7) + 7) % 7], oct: Math.floor(d / 7) })

function keyAlterations(fifths) {
  const map = {}
  if (fifths > 0) for (const s of SHARP_ORDER.slice(0, fifths)) map[s] = 1
  if (fifths < 0) for (const s of FLAT_ORDER.slice(0, -fifths)) map[s] = -1
  return map
}

const xmlEscape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const TEMPI = ['Allegro', 'Andante', 'Moderato', 'Adagio', 'Presto', 'Allegretto', 'Lento', 'Vivace', 'Andantino', 'Allegro moderato']
const DIRECTIONS = ['dolce', 'cresc.', 'dim.', 'espress.', 'rit.', 'a tempo', 'legato', 'sempre p', 'poco rit.', 'leggiero', 'molto', 'sim.']
const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp']
const TITLES = ['Etude', 'Sonata', 'Partita', 'Study No.', 'Air', 'Romance', 'Sicilienne', 'Minuet', 'Caprice', 'Fantasy', 'Waltz', 'Scherzo', 'Exercise']
const COMPOSERS = ['A. Composer', 'J. M. Smith', 'K. Novák', 'L. Dubois', 'H. Weber', 'P. Rossi', 'Anonymous', 'arr. M. Brown']

/**
 * Beat patterns as durations in sixteenths, with dots and tuplets marked.
 * A beat here is a quarter (simple meters) or a dotted quarter (compound).
 */
const SIMPLE_BEATS = [
  [[4], 'q'],
  [[2, 2], 'ee'],
  [[1, 1, 1, 1], 'ssss'],
  [[3, 1], 'de-s'],
  [[2, 1, 1], 'e-ss'],
  [[1, 1, 2], 'ss-e'],
  [[1, 2, 1], 's-e-s'],
  [['t', 't', 't'], 'triplet'],
  [[2], 'e'],
  [[1, 1], 'ss'],
]
const COMPOUND_BEATS = [
  [[6], 'dq'],
  [[2, 2, 2], 'eee'],
  [[4, 2], 'q-e'],
  [[2, 4], 'e-q'],
  [[1, 1, 1, 1, 2], 'ssss-e'],
  [[1, 1, 1, 1, 1, 1], 'ssssss'],
  [[3, 1, 2], 'de-s-e'],
]

const DUR = { 1: '16', 2: '8', 3: '8', 4: '4', 6: '4', 8: '2', 12: '2', 16: '1' }
const DOTTED = new Set([3, 6, 12])

export function generatePiece(seed) {
  const r = rng(seed)

  // ── Character of this piece ─────────────────────────────────────────────
  const instrument = r.weighted([
    ['flute', 4],
    ['sax', 3],
    ['violin', 1],
  ])
  const range = { flute: [60, 96], sax: [58, 90], violin: [55, 93] }[instrument]
  const center = r.int(range[0] + 7, range[1] - 9)
  const features = {
    density: r.next(), // 0 sparse … 1 sixteenth runs
    rests: r.next() * 0.25,
    ties: r.chance(0.6) ? r.next() * 0.15 : 0,
    slurs: r.chance(0.6) ? r.next() * 0.35 : 0,
    chromatic: r.chance(0.7) ? r.next() * 0.18 : 0.01,
    ottava: r.chance(0.3) ? 0.2 + r.next() * 0.3 : 0,
    grace: r.chance(0.35) ? r.next() * 0.08 : 0,
    tuplets: r.chance(0.3),
    dynamics: r.chance(0.7) ? r.next() * 0.25 : 0,
    hairpins: r.chance(0.5) ? r.next() * 0.15 : 0,
    text: r.chance(0.5) ? r.next() * 0.1 : 0,
    fingering: r.chance(0.15) ? r.next() * 0.3 : 0,
    artic: r.chance(0.6) ? r.next() * 0.3 : 0,
    trills: r.chance(0.25) ? r.next() * 0.06 : 0,
    chords: r.chance(0.08) ? r.next() * 0.15 : 0,
    meterChange: r.chance(0.2),
    keyChange: r.chance(0.1),
    repeats: r.chance(0.35),
    multiRest: r.chance(0.2),
    leaps: r.next() * 0.3,
  }

  let fifths = r.weighted([
    [0, 3],
    [1, 3],
    [-1, 3],
    [2, 2],
    [-2, 2],
    [3, 1.5],
    [-3, 1.5],
    [4, 1],
    [-4, 1],
    [5, 0.5],
    [-5, 0.5],
    [6, 0.3],
    [-6, 0.3],
  ])
  const meters = [
    [[4, 4], 4],
    [[3, 4], 3],
    [[2, 4], 2],
    [[6, 8], 2],
    [[2, 2], 1],
    [[3, 8], 1],
    [[12, 8], 0.5],
    [[5, 4], 0.3],
    [[9, 8], 0.5],
  ]
  let meter = r.weighted(meters)
  const initialFifths = fifths
  const initialMeter = meter
  const measures = r.int(16, 48)

  const notes = [] // truth, in document order
  const noteMeasure = {} // note id → measure number, so controls land in their start's measure
  const controls = [] // slurs, ties, ottavas, dynamics … (MEI control events)
  let id = 0
  const nextId = (prefix = 'n') => `${prefix}${++id}`

  let current = diatonic('c', 4) + Math.round(((center - 60) * 7) / 12)
  let previousNote = null
  let ottavaLeft = 0
  let ottavaStart = null
  let ottavaLastId = null
  let slurLeft = 0
  let slurStart = null
  let pendingTie = null

  const measureXml = []
  for (let m = 1; m <= measures; m++) {
    const [count, unit] = meter
    const compound = unit === 8 && count % 3 === 0 && count > 3
    // Cut time is generated in quarter beats; simple x/8 in eighth beats.
    const beatLength = compound ? 6 : unit === 8 ? 2 : 4
    const totalLength = count * (16 / unit)
    const alter = keyAlterations(fifths)
    const measureAccid = {} // `${step}${oct}` → alteration in force
    let layer = ''
    let length = 0

    // Whole-measure rest, sometimes a multi-measure one.
    if (m > 1 && r.chance(features.rests * 0.3)) {
      if (features.multiRest && r.chance(0.4) && m + 3 < measures) {
        const num = r.int(2, 8)
        layer = `<multiRest num="${num}"/>`
      } else {
        layer = `<mRest/>`
      }
      length = totalLength
    }

    while (length < totalLength) {
      const remaining = totalLength - length
      let pattern
      if (remaining >= beatLength) {
        const choices = compound ? COMPOUND_BEATS : SIMPLE_BEATS
        const dense = features.density
        pattern = r.weighted(
          choices
            .filter(([p]) => (p[0] === 't' ? features.tuplets && beatLength === 4 : p.reduce((a, b) => a + b, 0) === beatLength))
            .map(([p, name]) => [p, name.includes('s') ? 0.3 + dense * 3 : name === 'q' || name === 'dq' ? 2.5 - dense * 2 : 1]),
        )
        // Occasionally a longer note spanning two beats or the whole bar.
        if (remaining >= beatLength * 2 && r.chance(0.25 - features.density * 0.2)) {
          const long = remaining >= 16 && r.chance(0.3) ? 16 : beatLength * 2
          pattern = [long in DUR ? long : beatLength * 2]
          if (!(pattern[0] in DUR)) pattern = [beatLength]
        }
      } else {
        pattern = [remaining in DUR ? remaining : 1]
      }

      const isTuplet = pattern[0] === 't'
      const durations = isTuplet ? [2, 2, 2] : pattern
      const beamable = durations.length > 1 && durations.every((d) => d <= 3)
      const items = []
      for (const d of durations) {
        // Rest?
        if (r.chance(features.rests) && !pendingTie) {
          items.push(`<rest xml:id="${nextId('r')}" dur="${DUR[d]}"${DOTTED.has(d) ? ' dots="1"' : ''}/>`)
          continue
        }

        // Pitch: a random walk on the staff, pulled back towards the centre.
        let d7 = current
        if (pendingTie) {
          d7 = pendingTie.d7
        } else {
          const leap = r.chance(features.leaps)
          const step = leap ? r.int(-7, 7) : r.weighted([[-2, 1], [-1, 4], [0, 0.6], [1, 4], [2, 1]])
          d7 = current + step
          const midiApprox = 60 + Math.round(((d7 - 28) * 12) / 7)
          if (midiApprox > range[1] - 2 || (midiApprox > center + 10 && r.chance(0.3))) d7 -= r.int(1, 4)
          if (midiApprox < range[0] + 2 || (midiApprox < center - 10 && r.chance(0.3))) d7 += r.int(1, 4)
        }
        current = d7
        const { step, oct } = fromDiatonic(d7)

        // Accidental: key, then measure state, then an occasional chromatic note.
        const scopeKey = `${step}${oct}`
        const inForce = measureAccid[scopeKey] ?? alter[step] ?? 0
        let alteration = pendingTie ? pendingTie.alteration : inForce
        if (!pendingTie && r.chance(features.chromatic)) alteration = r.pick([-1, 0, 1].filter((a) => a !== inForce))
        const shown = alteration !== inForce
        const cautionary = !shown && !pendingTie && r.chance(0.02)
        measureAccid[scopeKey] = alteration
        const accidName = { '-1': 'f', 0: 'n', 1: 's' }[alteration]

        const writtenMidi = 12 * (oct + 1) + STEP_SEMITONES[STEPS.indexOf(step)] + alteration
        // Ottava: only over high passages; the written note is an octave down.
        if (!ottavaLeft && features.ottava && writtenMidi > range[1] - 10 && r.chance(features.ottava)) {
          ottavaLeft = r.int(3, 14)
        }
        const underOttava = ottavaLeft > 0
        const writtenOct = underOttava ? oct - 1 : oct
        const soundingMidi = writtenMidi

        const noteId = nextId()
        noteMeasure[noteId] = m
        const dur = DUR[d]
        const dots = DOTTED.has(d) ? ' dots="1"' : ''
        const accidAttr = shown || cautionary ? ` accid="${accidName}"` : alteration ? ` accid.ges="${accidName}"` : ''
        const grace = !pendingTie && r.chance(features.grace)
        let graceXml = ''
        if (grace) {
          const gd = d7 + r.pick([1, -1, 2])
          const g = fromDiatonic(gd)
          const gAlter = measureAccid[`${g.step}${g.oct}`] ?? alter[g.step] ?? 0
          const gid = nextId()
          const gWrittenOct = underOttava ? g.oct - 1 : g.oct
          graceXml = `<note xml:id="${gid}" pname="${g.step}" oct="${gWrittenOct}" dur="8" grace="${r.pick(['acc', 'unacc'])}" stem.dir="up"${gAlter ? ` accid.ges="${{ '-1': 'f', 1: 's' }[gAlter]}"` : ''}/>`
          notes.push({ id: gid, midi: 12 * (g.oct + 1) + STEP_SEMITONES[STEPS.indexOf(g.step)] + gAlter, grace: true, hollow: false, tied: false })
        }

        const isChord = r.chance(features.chords) && !pendingTie
        const artic = r.chance(features.artic) ? ` artic="${r.pick(['stacc', 'acc', 'ten', 'stacc', 'marc', 'spicc'])}"` : ''
        const noteXml = `<note xml:id="${noteId}" pname="${step}" oct="${writtenOct}" dur="${dur}"${dots}${accidAttr}${artic}${underOttava ? ` oct.ges="${oct}"` : ''}/>`
        if (isChord) {
          const lowD = d7 - r.pick([2, 3, 4, 5])
          const low = fromDiatonic(lowD)
          const lowAlter = alter[low.step] ?? 0
          const lowId = nextId()
          items.push(
            graceXml +
              `<chord dur="${dur}"${dots}>${noteXml.replace(` dur="${dur}"${dots}`, '')}<note xml:id="${lowId}" pname="${low.step}" oct="${underOttava ? low.oct - 1 : low.oct}"${lowAlter ? ` accid.ges="${{ '-1': 'f', 1: 's' }[lowAlter]}"` : ''}/></chord>`,
          )
          notes.push({ id: noteId, midi: soundingMidi, grace: false, hollow: d >= 8, tied: !!pendingTie, chordTop: true })
          notes.push({ id: lowId, midi: 12 * (low.oct + 1) + STEP_SEMITONES[STEPS.indexOf(low.step)] + lowAlter, grace: false, hollow: d >= 8, tied: false, chordLow: true })
        } else {
          items.push(graceXml + noteXml)
          notes.push({ id: noteId, midi: soundingMidi, grace: false, hollow: d >= 8, tied: !!pendingTie })
        }

        if (pendingTie) controls.push(`<tie startid="#${pendingTie.id}" endid="#${noteId}"/>`)
        pendingTie = !isChord && r.chance(features.ties) ? { id: noteId, d7, alteration } : null

        // Ottava bookkeeping.
        if (underOttava) {
          if (!ottavaStart) ottavaStart = noteId
          ottavaLastId = noteId
          ottavaLeft--
          if (!ottavaLeft) {
            controls.push(`<octave staff="1" startid="#${ottavaStart}" endid="#${ottavaLastId}" dis="8" dis.place="above"/>`)
            ottavaStart = null
          }
        }
        // Slurs.
        if (slurLeft) {
          slurLeft--
          if (!slurLeft) controls.push(`<slur startid="#${slurStart}" endid="#${noteId}" curvedir="${r.pick(['above', 'below'])}"/>`)
        } else if (r.chance(features.slurs)) {
          slurLeft = r.int(1, 6)
          slurStart = noteId
        }
        // Attached text.
        if (r.chance(features.dynamics)) controls.push(`<dynam staff="1" startid="#${noteId}">${r.pick(DYNAMICS)}</dynam>`)
        if (r.chance(features.text)) controls.push(`<dir staff="1" startid="#${noteId}" place="${r.pick(['above', 'below'])}"><rend fontstyle="italic">${xmlEscape(r.pick(DIRECTIONS))}</rend></dir>`)
        if (r.chance(features.fingering)) controls.push(`<fing staff="1" startid="#${noteId}" place="above">${r.int(0, 5)}</fing>`)
        if (r.chance(features.trills)) controls.push(`<trill staff="1" startid="#${noteId}"/>`)
        if (r.chance(features.hairpins) && previousNote) controls.push(`<hairpin staff="1" form="${r.pick(['cres', 'dim'])}" startid="#${previousNote}" endid="#${noteId}" place="below"/>`)
        previousNote = noteId
      }
      let group = items.join('')
      if (isTuplet) group = `<tuplet num="3" numbase="2">${group}</tuplet>`
      else if (beamable && items.filter((i) => i.includes('<note') || i.includes('<chord')).length > 1 && !r.chance(0.05)) group = `<beam>${group}</beam>`
      layer += group
      length += isTuplet ? beatLength : durations.reduce((a, b) => a + b, 0)
    }

    // An unfinished ottava or slur must not cross into a meter or key change.
    let attrs = ''
    if (features.repeats && m === 1 && r.chance(0.3)) attrs += ' left="rptstart"'
    if (features.repeats && m % 8 === 0 && m !== measures && r.chance(0.4)) attrs += r.pick([' right="rptend"', ' right="dbl"', ' right="rptboth"'])
    if (m === measures) attrs += ' right="end"'
    const tempo = m === 1 && r.chance(0.7) ? `<tempo staff="1" tstamp="1" place="above">${r.pick(TEMPI)}</tempo>` : ''
    measureXml.push({ n: m, xml: `<measure n="${m}"${attrs}><staff n="1"><layer n="1">${layer}</layer></staff>${tempo}`, controls: [] })

    // Meter or key change at a phrase boundary.
    if (m < measures && m % 4 === 0) {
      let change = ''
      if (features.meterChange && r.chance(0.35)) {
        meter = r.weighted(meters)
        change += ` meter.count="${meter[0]}" meter.unit="${meter[1]}"`
      }
      if (features.keyChange && r.chance(0.3)) {
        fifths = r.int(-4, 4)
        change += ` keysig="${keysigAttr(fifths)}"`
      }
      if (change && !ottavaLeft && !slurLeft && !pendingTie) measureXml.push({ xml: `<scoreDef${change}/>`, controls: [], isScoreDef: true })
    }
  }
  // Close anything left open.
  const last = measureXml.filter((m) => !m.isScoreDef).at(-1)
  if (ottavaStart) controls.push(`<octave staff="1" startid="#${ottavaStart}" endid="#${ottavaLastId}" dis="8" dis.place="above"/>`)

  // Every control event goes in the measure that holds its start note.
  const byNumber = Object.fromEntries(measureXml.filter((x) => !x.isScoreDef).map((x) => [x.n, x]))
  for (const control of controls) {
    const start = control.match(/startid="#(\w+)"/)?.[1]
    ;(byNumber[noteMeasure[start]] ?? last).controls.push(control)
  }

  const section = measureXml.map((m) => (m.isScoreDef ? m.xml : `${m.xml}${m.controls.join('')}</measure>`)).join('\n')

  const title = `${r.pick(TITLES)}${r.chance(0.5) ? ` ${r.int(1, 30)}` : ''}`
  const composer = r.pick(COMPOSERS)

  const mei = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
<meiHead><fileDesc><titleStmt><title>${xmlEscape(title)}</title><respStmt><persName role="composer">${xmlEscape(composer)}</persName></respStmt></titleStmt><pubStmt/></fileDesc></meiHead>
<music><body><mdiv><score>
<scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="G" clef.line="2" keysig="${keysigAttr(initialFifths)}" meter.count="${initialMeter[0]}" meter.unit="${initialMeter[1]}"${r.chance(0.15) ? ` meter.sym="${initialMeter[0] === 4 && initialMeter[1] === 4 ? 'common' : initialMeter[0] === 2 && initialMeter[1] === 2 ? 'cut' : ''}"`.replace(' meter.sym=""', '') : ''} ${r.chance(0.3) ? `label="${instrument === 'sax' ? r.pick(['Alto Sax.', 'Tenor Sax.', 'Saxophone']) : instrument === 'flute' ? r.pick(['Flute', 'Fl.']) : 'Violin'}"` : ''}/></staffGrp></scoreDef>
<section>
${section}
</section></score></mdiv></body></music></mei>`

  return { mei, notes, features, instrument }
}

const keysigAttr = (fifths) => (fifths === 0 ? '0' : fifths > 0 ? `${fifths}s` : `${-fifths}f`)
