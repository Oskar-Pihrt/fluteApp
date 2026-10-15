/// <reference lib="webworker" />
import { grayscaleFromRgba } from './bitmap'
import { loadNet, type Net, type NetManifest } from './net'
import { recognise } from './recognise'
import { recogniseWithNet } from './recogniseNet'
import type { Bitmap, OmrProgress, OmrResult } from './types'

/**
 * Worker entry for the recogniser.
 *
 * The pipeline makes a dozen passes over several million pixels, which would
 * freeze the UI for seconds on a phone. Running it here keeps the page
 * responsive and makes cancelling trivial — the main thread just terminates the
 * worker.
 *
 * Pixel buffers are transferred rather than copied in both directions, so a
 * multi-megapixel page costs nothing to hand across.
 */

export interface RecogniseRequest {
  rgba: Uint8ClampedArray
  width: number
  height: number
  debug?: boolean
  playableNotes?: string[]
}

export interface SerialisedDebug {
  binarised?: Bitmap
  staffRemoved?: Bitmap
  eroded?: Bitmap
}

export type WorkerResponse =
  | { type: 'progress'; progress: OmrProgress }
  | { type: 'done'; result: OmrResult; debug?: SerialisedDebug }
  | { type: 'error'; message: string }

/**
 * The detector network, fetched once per worker. It ships in the app (and the
 * PWA precache), so this works offline; if it cannot be loaded for any reason
 * the heuristic recogniser runs instead.
 */
let netPromise: Promise<Net | null> | null = null
function getNet(): Promise<Net | null> {
  netPromise ??= (async () => {
    try {
      const base = new URL(`${import.meta.env.BASE_URL}omr/detector`, self.location.href).href
      const [manifest, weights] = await Promise.all([
        fetch(`${base}.json`).then((r) => (r.ok ? (r.json() as Promise<NetManifest>) : Promise.reject(new Error(r.statusText)))),
        fetch(`${base}.bin`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)))),
      ])
      return loadNet(manifest, weights)
    } catch {
      return null
    }
  })()
  return netPromise
}

self.onmessage = async (event: MessageEvent<RecogniseRequest>) => {
  const { rgba, width, height, debug, playableNotes } = event.data

  try {
    const gray = grayscaleFromRgba(rgba, width, height)
    // The stage inspector shows the heuristic pipeline's bitmaps, so a debug run
    // uses that pipeline; it is a development tool only.
    const net = debug ? null : await getNet()
    const run = net ? (g: typeof gray, o: Parameters<typeof recognise>[1]) => recogniseWithNet(g, net, o) : recognise

    const { result, debug: debugBitmaps } = run(gray, {
      debug,
      playableNotes,
      onProgress: (progress) => {
        const message: WorkerResponse = { type: 'progress', progress }
        self.postMessage(message)
      },
    })

    const transfer: ArrayBuffer[] = []
    for (const bitmap of [debugBitmaps?.binarised, debugBitmaps?.staffRemoved, debugBitmaps?.eroded]) {
      if (bitmap) transfer.push(bitmap.data.buffer as ArrayBuffer)
    }

    const message: WorkerResponse = { type: 'done', result, debug: debugBitmaps }
    self.postMessage(message, transfer)
  } catch (cause) {
    const message: WorkerResponse = {
      type: 'error',
      message: cause instanceof Error ? cause.message : 'Recognition failed.',
    }
    self.postMessage(message)
  }
}
