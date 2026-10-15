/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadNet, type NetManifest, runNet } from './net'

/**
 * Parity between the TypeScript runtime and PyTorch, on the reference pair the
 * exporter writes next to the weights. Skipped when no exported model exists
 * (a fresh clone before `npm run omr:model`).
 */
const base = 'public/omr/detector'
const reference = 'src/omr/testing/detector.test.json'
const hasModel = existsSync(`${base}.json`) && existsSync(reference)

describe.skipIf(!hasModel)('detector network runtime', () => {
  it('matches PyTorch on the reference input', () => {
    const manifest = JSON.parse(readFileSync(`${base}.json`, 'utf8')) as NetManifest
    const bin = readFileSync(`${base}.bin`)
    const net = loadNet(manifest, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
    const ref = JSON.parse(readFileSync(reference, 'utf8')) as { input: number[][]; heat: number[][][]; offset: number[][][] }
    const h = ref.input.length
    const w = ref.input[0].length
    const { heat, offset } = runNet(net, { c: 1, h, w, data: Float32Array.from(ref.input.flat()) })

    // Weights are stored as float16, so allow for their rounding.
    let worst = 0
    ref.heat.forEach((plane, c) =>
      plane.forEach((row, y) => row.forEach((v, x) => (worst = Math.max(worst, Math.abs(heat.data[(c * heat.h + y) * heat.w + x] - v))))),
    )
    ref.offset.forEach((plane, c) =>
      plane.forEach((row, y) => row.forEach((v, x) => (worst = Math.max(worst, Math.abs(offset.data[(c * offset.h + y) * offset.w + x] - v))))),
    )
    expect(heat.c).toBe(manifest.classes.length)
    expect(worst).toBeLessThan(0.05)
  })
})
