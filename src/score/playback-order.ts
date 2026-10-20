import type { Measure, Score } from './model'

/**
 * The order measures are played in: repeats taken, first and second endings
 * chosen per pass, D.C. and D.S. followed to Fine or the coda. Returns
 * measure indices.
 *
 * Conventions, as most printed music assumes them:
 *  - a repeat with no start sign goes back to the beginning (or to the last
 *    final or double barline before it);
 *  - a repeat is played twice, or as many times as its highest ending says;
 *  - after a D.C. or D.S. repeats are not taken again, and only the last
 *    ending of a group is played;
 *  - `fine` ends the piece only after an "al Fine" jump; `toCoda` jumps to
 *    the coda only after an "al Coda" jump.
 */
export function playbackOrder(score: Score): number[] {
  const measures = score.measures
  const order: number[] = []
  let i = 0
  let repeatStart = 0
  let pass = 1
  let jumped: 'none' | 'plain' | 'fine' | 'coda' = 'none'
  let guard = 0

  const voltaGroup = (index: number): number[] => {
    // The run of consecutive measures with endings that this one is in.
    let start = index
    while (start > 0 && measures[start - 1].volta) start--
    let end = index
    while (end < measures.length - 1 && measures[end + 1].volta) end++
    return measures.slice(start, end + 1).flatMap((m) => m.volta?.numbers ?? [])
  }

  const plays = (measure: Measure, index: number): boolean => {
    if (!measure.volta) return true
    if (jumped !== 'none') return measure.volta.numbers.includes(Math.max(...voltaGroup(index)))
    return measure.volta.numbers.includes(pass)
  }

  let arrivedByJumpBack = false
  while (i < measures.length && guard++ < 10_000) {
    const measure = measures[i]
    if (measure.barStart === 'repeatStart' && !arrivedByJumpBack) {
      repeatStart = i
      pass = 1
    }
    arrivedByJumpBack = false
    if (!plays(measure, i)) {
      i++
      continue
    }
    order.push(i)
    const jumps = measure.jumps ?? []

    if (jumped === 'fine' && jumps.includes('fine')) break
    if (jumped === 'coda' && jumps.includes('toCoda')) {
      const coda = measures.findIndex((m, k) => k > i && m.jumps?.includes('coda'))
      if (coda === -1) break
      i = coda
      continue
    }

    if (measure.barEnd === 'repeatEnd' && jumped === 'none') {
      const endings = measure.volta ? voltaGroup(i) : (measures[i + 1]?.volta ? voltaGroup(i + 1) : [])
      const times = Math.max(2, ...endings)
      if (pass < times) {
        pass++
        i = repeatStart
        arrivedByJumpBack = true
        continue
      }
    }

    const dc = jumps.find((j) => j === 'dc' || j === 'dcAlFine' || j === 'dcAlCoda')
    const ds = jumps.find((j) => j === 'ds' || j === 'dsAlFine' || j === 'dsAlCoda')
    if (jumped === 'none' && (dc || ds)) {
      const jump = (dc ?? ds)!
      jumped = jump.endsWith('AlFine') ? 'fine' : jump.endsWith('AlCoda') ? 'coda' : 'plain'
      const target = dc ? 0 : Math.max(0, measures.findIndex((m) => m.jumps?.includes('segno')))
      i = target
      continue
    }

    if (measure.barEnd === 'final' || measure.barEnd === 'double') {
      // A section ends; a later repeat with no start sign goes back to here.
      repeatStart = i + 1
      pass = 1
    }
    i++
  }
  return order
}
