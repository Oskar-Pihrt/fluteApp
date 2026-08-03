import { onUnmounted, ref, shallowRef } from 'vue'
import { noteRange } from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'
import type { OmrProgress, OmrResult } from './types'
import type { RecogniseRequest, SerialisedDebug, WorkerResponse } from './worker'

/**
 * Drives the recogniser worker from a component.
 *
 * Decoding happens here on the main thread because it needs a canvas, but it is
 * a single fast operation; the per-pixel work all happens in the worker. The
 * decoded buffer is transferred rather than copied.
 */

const STAGE_LABELS: Record<OmrProgress['stage'], string> = {
  binarise: 'Reading the image',
  deskew: 'Straightening the page',
  scale: 'Measuring the staves',
  staves: 'Finding the staff lines',
  symbols: 'Finding the notes',
  pitch: 'Working out the pitches',
}

export function useRecogniser() {
  const settings = useSettingsStore()

  const running = ref(false)
  const progress = ref<OmrProgress | null>(null)
  const error = ref<string | null>(null)
  const result = shallowRef<OmrResult | null>(null)
  const debug = shallowRef<SerialisedDebug | null>(null)

  let worker: Worker | null = null

  function terminate() {
    worker?.terminate()
    worker = null
  }

  function cancel() {
    terminate()
    running.value = false
    progress.value = null
  }

  onUnmounted(terminate)

  /** Decode a stored image blob to raw RGBA. */
  async function decode(blob: Blob): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas is unavailable in this browser.')
      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height)
      return { rgba: imageData.data, width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close()
    }
  }

  async function run(image: Blob, options: { debug?: boolean } = {}): Promise<OmrResult | null> {
    cancel()
    running.value = true
    error.value = null
    result.value = null
    debug.value = null
    progress.value = { stage: 'binarise', fraction: 0 }

    try {
      const decoded = await decode(image)

      // The flute's playable range, so out-of-range reads get flagged rather
      // than silently accepted — an octave error is the commonest failure.
      const playableNotes = noteRange(settings.fluteConfig).map((entry) => entry.note)

      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

      return await new Promise<OmrResult | null>((resolve) => {
        if (!worker) {
          resolve(null)
          return
        }

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data
          if (message.type === 'progress') {
            progress.value = message.progress
            return
          }
          if (message.type === 'error') {
            error.value = message.message
            running.value = false
            terminate()
            resolve(null)
            return
          }
          result.value = message.result
          debug.value = message.debug ?? null
          running.value = false
          progress.value = null
          terminate()
          resolve(message.result)
        }

        worker.onerror = () => {
          // A worker that fails to start at all — the manual editor still works,
          // so say so plainly rather than leaving a spinner running.
          error.value = 'Note detection could not start on this device.'
          running.value = false
          terminate()
          resolve(null)
        }

        const request: RecogniseRequest = {
          rgba: decoded.rgba,
          width: decoded.width,
          height: decoded.height,
          debug: options.debug,
          playableNotes,
        }
        worker.postMessage(request, [decoded.rgba.buffer])
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not read that image.'
      running.value = false
      progress.value = null
      terminate()
      return null
    }
  }

  function stageLabel(): string {
    return progress.value ? STAGE_LABELS[progress.value.stage] : ''
  }

  return { running, progress, error, result, debug, run, cancel, stageLabel }
}
