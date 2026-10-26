import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { audioContext } from '@/domain/audio'
import { detectPitch, hzToWritten, type HeardNote } from '@/domain/pitch'
import type { Instrument } from '@/instruments/types'

export type MicState = 'idle' | 'asking' | 'listening' | 'denied' | 'unsupported'

/** Readings below this clarity are breath noise, not a note. */
const MIN_CLARITY = 0.85

/**
 * The microphone as a live stream of heard notes, for the practice screens.
 *
 * Browser audio processing is turned off: echo cancellation and noise
 * suppression treat a held flute tone as noise to remove, and automatic gain
 * makes the level meaningless. Stops by itself when the component unmounts.
 */
export function useMicrophone(instrument: () => Instrument) {
  const state = ref<MicState>('idle')
  /** What is sounding right now, or null for silence. Updated every frame. */
  const heard = shallowRef<(HeardNote & { hz: number }) | null>(null)

  let stream: MediaStream | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  let frame = 0
  let buffer: Float32Array<ArrayBuffer> | null = null

  async function start() {
    if (state.value === 'listening' || state.value === 'asking') return
    const context = audioContext()
    if (!context || !navigator.mediaDevices?.getUserMedia) {
      state.value = 'unsupported'
      return
    }
    state.value = 'asking'
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      state.value = 'denied'
      return
    }
    if (context.state === 'suspended') await context.resume()
    source = context.createMediaStreamSource(stream)
    analyser = context.createAnalyser()
    analyser.fftSize = 4096
    source.connect(analyser)
    buffer = new Float32Array(analyser.fftSize)
    state.value = 'listening'
    loop()
  }

  function loop() {
    if (!analyser || !buffer) return
    analyser.getFloatTimeDomainData(buffer)
    const reading = detectPitch(buffer, analyser.context.sampleRate)
    heard.value =
      reading && reading.clarity >= MIN_CLARITY ? { ...hzToWritten(reading.hz, instrument()), hz: reading.hz } : null
    frame = requestAnimationFrame(loop)
  }

  function stop() {
    cancelAnimationFrame(frame)
    source?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    source = null
    analyser = null
    buffer = null
    heard.value = null
    if (state.value === 'listening' || state.value === 'asking') state.value = 'idle'
  }

  onBeforeUnmount(stop)

  return { state, heard, start, stop }
}
