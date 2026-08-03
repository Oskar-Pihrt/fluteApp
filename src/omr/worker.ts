/// <reference lib="webworker" />
import { grayscaleFromRgba } from './bitmap'
import { recognise } from './recognise'
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

self.onmessage = (event: MessageEvent<RecogniseRequest>) => {
  const { rgba, width, height, debug, playableNotes } = event.data

  try {
    const gray = grayscaleFromRgba(rgba, width, height)

    const { result, debug: debugBitmaps } = recognise(gray, {
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
