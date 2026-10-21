import { describe, expect, it } from 'vitest'
import type { Detection } from './detector'
import { dropUnledgeredHeads } from './ledgers'
import type { Bitmap, Staff } from './types'

const S = 10
const WIDTH = 200
const HEIGHT = 160
/** A staff with its top line at y = 80. */
const staff: Staff = { index: 0, lines: [80, 90, 100, 110, 120], spaceHeight: S, bottomLineY: 120, x0: 0, x1: WIDTH }

function page(ledgers: { x: number; y: number }[] = []): Bitmap {
  const data = new Uint8Array(WIDTH * HEIGHT).fill(255)
  for (const y of staff.lines) data.fill(0, y * WIDTH, (y + 1) * WIDTH)
  // A ledger line: a bit over two staff spaces long, centred on the note.
  for (const ledger of ledgers) data.fill(0, ledger.y * WIDTH + ledger.x - 10, ledger.y * WIDTH + ledger.x + 10)
  return { data, width: WIDTH, height: HEIGHT }
}

const head = (x: number, y: number): Detection => ({ cls: 'head_filled', x, y, score: 0.9 })

describe('dropUnledgeredHeads', () => {
  it('keeps notes on and next to the staff', () => {
    const heads = [head(50, 95), head(60, 75), head(70, 125)]
    expect(dropUnledgeredHeads(heads, [staff], page())).toHaveLength(3)
  })

  it('keeps a high note with its ledger line', () => {
    // C6: two ledger lines up, at y = 70 and 60.
    const heads = [head(100, 60)]
    expect(dropUnledgeredHeads(heads, [staff], page([{ x: 100, y: 70 }, { x: 100, y: 60 }]))).toHaveLength(1)
  })

  it('drops a notehead floating above the staff, like a metronome mark’s', () => {
    expect(dropUnledgeredHeads([head(100, 45)], [staff], page())).toHaveLength(0)
  })

  it('drops one floating below the staff too, but leaves other symbols alone', () => {
    const sharp: Detection = { cls: 'sharp', x: 40, y: 150, score: 0.9 }
    expect(dropUnledgeredHeads([head(100, 150), sharp], [staff], page())).toEqual([sharp])
  })
})
