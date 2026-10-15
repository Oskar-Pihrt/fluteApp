/**
 * A minimal inference runtime for the notehead/symbol detector.
 *
 * The network (omr-train/omr/model.py) is built only from convolutions —
 * full, depthwise and 1×1 — plus ReLU, residual adds, nearest ×2 upsampling
 * and channel concatenation, so a hundred-odd lines of typed-array loops run it
 * with no dependency at all. That keeps the app's download a megabyte of
 * weights rather than a ten-megabyte WebAssembly runtime, and it runs anywhere
 * a worker does, the Android WebView included.
 *
 * Tensors are CHW float32. Batch norm was folded into the convolutions at
 * export, so every convolution carries a bias.
 */

export interface Tensor {
  c: number
  h: number
  w: number
  data: Float32Array
}

interface ConvOp {
  op: 'conv'
  in: string
  out: string
  cin: number
  cout: number
  k: number
  stride: number
  pad: number
  dilation: number
  groups: number
  relu: boolean
  weight: number
  bias: number
}
type Op =
  | ConvOp
  | { op: 'add'; a: string; b: string; out: string }
  | { op: 'up2'; in: string; out: string }
  | { op: 'concat'; in: [string, string]; out: string }

export interface NetManifest {
  format: 'fluteapp-omr-net'
  version: number
  classes: string[]
  inputStaffSpace: number
  stride: number
  inputMultiple: number
  outputs: { heat: string; offset: string }
  ops: Op[]
}

export interface Net {
  manifest: NetManifest
  weights: Float32Array
}

/** IEEE half → float, for the float16 weight file. */
function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1
  const exponent = (h >> 10) & 0x1f
  const fraction = h & 0x3ff
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024)
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

export function loadNet(manifest: NetManifest, weightBytes: ArrayBuffer): Net {
  const halves = new Uint16Array(weightBytes)
  const weights = new Float32Array(halves.length)
  for (let i = 0; i < halves.length; i++) weights[i] = halfToFloat(halves[i])
  return { manifest, weights }
}

function tensor(c: number, h: number, w: number): Tensor {
  return { c, h, w, data: new Float32Array(c * h * w) }
}

function conv(input: Tensor, op: ConvOp, weights: Float32Array): Tensor {
  if (op.k === 1 && op.stride === 1 && op.groups === 1) return pointwise(input, op, weights)
  if (op.k === 3 && op.groups === input.c && op.cout === input.c) return depthwise(input, op, weights)
  return generalConv(input, op, weights)
}

/**
 * 1×1 convolution — a matrix product of the weights with the pixels. Pixels go
 * in blocks small enough that a block's inputs for every channel stay in
 * cache while all the output channels are accumulated from them; streaming
 * whole planes instead re-reads the input once per output channel.
 */
const PW_BLOCK = 256
const pwAcc = new Float32Array(PW_BLOCK * 4)

function pointwise(input: Tensor, op: ConvOp, weights: Float32Array): Tensor {
  const { cout, relu } = op
  const cin = input.c
  const P = input.h * input.w
  const out = tensor(cout, input.h, input.w)
  const src = input.data
  const dst = out.data
  const wOff = op.weight
  for (let p0 = 0; p0 < P; p0 += PW_BLOCK) {
    const n = Math.min(PW_BLOCK, P - p0)
    for (let co = 0; co < cout; co += 4) {
      const m = Math.min(4, cout - co)
      for (let j = 0; j < 4; j++) {
        const b = j < m ? weights[op.bias + co + j] : 0
        pwAcc.fill(b, j * PW_BLOCK, j * PW_BLOCK + n)
      }
      const w0b = wOff + co * cin
      const w1b = w0b + cin
      const w2b = w1b + cin
      const w3b = w2b + cin
      for (let ci = 0; ci < cin; ci++) {
        const w0 = weights[w0b + ci]
        const w1 = m > 1 ? weights[w1b + ci] : 0
        const w2 = m > 2 ? weights[w2b + ci] : 0
        const w3 = m > 3 ? weights[w3b + ci] : 0
        const s0 = ci * P + p0
        for (let i = 0; i < n; i++) {
          const v = src[s0 + i]
          pwAcc[i] += w0 * v
          pwAcc[PW_BLOCK + i] += w1 * v
          pwAcc[2 * PW_BLOCK + i] += w2 * v
          pwAcc[3 * PW_BLOCK + i] += w3 * v
        }
      }
      for (let j = 0; j < m; j++) {
        const d = (co + j) * P + p0
        const a = j * PW_BLOCK
        if (relu) for (let i = 0; i < n; i++) dst[d + i] = pwAcc[a + i] > 0 ? pwAcc[a + i] : 0
        else for (let i = 0; i < n; i++) dst[d + i] = pwAcc[a + i]
      }
    }
  }
  return out
}

/** Depthwise 3×3, all nine taps in one pass over each output row. */
function depthwise(input: Tensor, op: ConvOp, weights: Float32Array): Tensor {
  const { stride: s, pad, dilation: d, relu } = op
  const { c, h, w } = input
  const outH = Math.floor((h + 2 * pad - 2 * d - 1) / s) + 1
  const outW = Math.floor((w + 2 * pad - 2 * d - 1) / s) + 1
  const out = tensor(c, outH, outW)
  const src = input.data
  const dst = out.data
  // Output columns whose whole 3-tap row lies inside the input.
  const xIn0 = Math.max(0, Math.ceil(pad / s))
  const xIn1 = Math.min(outW, Math.floor((w - 1 - 2 * d + pad) / s) + 1)
  for (let ch = 0; ch < c; ch++) {
    const wb = op.weight + ch * 9
    const k0 = weights[wb], k1 = weights[wb + 1], k2 = weights[wb + 2]
    const k3 = weights[wb + 3], k4 = weights[wb + 4], k5 = weights[wb + 5]
    const k6 = weights[wb + 6], k7 = weights[wb + 7], k8 = weights[wb + 8]
    const bias = weights[op.bias + ch]
    const sb = ch * h * w
    const db = ch * outH * outW
    for (let oy = 0; oy < outH; oy++) {
      const iy = oy * s - pad
      const rowOut = db + oy * outW
      const r0ok = iy >= 0 && iy < h
      const r1ok = iy + d >= 0 && iy + d < h
      const r2ok = iy + 2 * d >= 0 && iy + 2 * d < h
      const r0 = sb + iy * w
      const r1 = r0 + d * w
      const r2 = r0 + 2 * d * w
      // Interior columns: no bounds checks in the hot loop.
      for (let ox = xIn0; ox < xIn1; ox++) {
        const ix = ox * s - pad
        let acc = bias
        if (r0ok) acc += k0 * src[r0 + ix] + k1 * src[r0 + ix + d] + k2 * src[r0 + ix + 2 * d]
        if (r1ok) acc += k3 * src[r1 + ix] + k4 * src[r1 + ix + d] + k5 * src[r1 + ix + 2 * d]
        if (r2ok) acc += k6 * src[r2 + ix] + k7 * src[r2 + ix + d] + k8 * src[r2 + ix + 2 * d]
        dst[rowOut + ox] = relu && acc < 0 ? 0 : acc
      }
      // Edge columns, bounds-checked.
      for (let ox = 0; ox < outW; ox++) {
        if (ox === xIn0 && xIn1 > xIn0) {
          ox = xIn1 - 1
          continue
        }
        const ix = ox * s - pad
        let acc = bias
        for (let ky = 0; ky < 3; ky++) {
          const yy = iy + ky * d
          if (yy < 0 || yy >= h) continue
          for (let kx = 0; kx < 3; kx++) {
            const xx = ix + kx * d
            if (xx < 0 || xx >= w) continue
            acc += weights[wb + ky * 3 + kx] * src[sb + yy * w + xx]
          }
        }
        dst[rowOut + ox] = relu && acc < 0 ? 0 : acc
      }
    }
  }
  return out
}

function generalConv(input: Tensor, op: ConvOp, weights: Float32Array): Tensor {
  const { cout, k, stride, pad, dilation, groups, relu } = op
  const outH = Math.floor((input.h + 2 * pad - dilation * (k - 1) - 1) / stride) + 1
  const outW = Math.floor((input.w + 2 * pad - dilation * (k - 1) - 1) / stride) + 1
  const out = tensor(cout, outH, outW)
  const inW = input.w
  const inH = input.h
  const inPlane = inH * inW
  const outPlane = outH * outW
  const cinPerGroup = input.c / groups
  const coutPerGroup = cout / groups
  const src = input.data
  const dst = out.data

  for (let co = 0; co < cout; co++) {
    const bias = weights[op.bias + co]
    const plane = co * outPlane
    dst.fill(bias, plane, plane + outPlane)
    const group = Math.floor(co / coutPerGroup)
    for (let cig = 0; cig < cinPerGroup; cig++) {
      const ci = group * cinPerGroup + cig
      const inBase = ci * inPlane
      const wBase = op.weight + (co * cinPerGroup + cig) * k * k
      if (k === 1 && stride === 1) {
        // Pointwise: one scaled add of a whole plane.
        const wv = weights[wBase]
        for (let i = 0; i < outPlane; i++) dst[plane + i] += wv * src[inBase + i]
        continue
      }
      for (let ky = 0; ky < k; ky++) {
        const dy = ky * dilation - pad
        for (let kx = 0; kx < k; kx++) {
          const wv = weights[wBase + ky * k + kx]
          if (wv === 0) continue
          const dx = kx * dilation - pad
          // Output columns whose input column falls inside the image.
          const xStart = Math.max(0, Math.ceil(-dx / stride))
          const xEnd = Math.min(outW, Math.floor((inW - 1 - dx) / stride) + 1)
          for (let oy = 0; oy < outH; oy++) {
            const iy = oy * stride + dy
            if (iy < 0 || iy >= inH) continue
            const rowIn = inBase + iy * inW + dx
            const rowOut = plane + oy * outW
            if (stride === 1) {
              for (let ox = xStart; ox < xEnd; ox++) dst[rowOut + ox] += wv * src[rowIn + ox]
            } else {
              for (let ox = xStart; ox < xEnd; ox++) dst[rowOut + ox] += wv * src[rowIn + ox * stride]
            }
          }
        }
      }
    }
    if (relu) {
      for (let i = plane; i < plane + outPlane; i++) if (dst[i] < 0) dst[i] = 0
    }
  }
  return out
}

function add(a: Tensor, b: Tensor): Tensor {
  const out = tensor(a.c, a.h, a.w)
  for (let i = 0; i < out.data.length; i++) out.data[i] = a.data[i] + b.data[i]
  return out
}

function up2(input: Tensor): Tensor {
  const out = tensor(input.c, input.h * 2, input.w * 2)
  const { w, h } = input
  for (let c = 0; c < input.c; c++) {
    for (let y = 0; y < h * 2; y++) {
      const srcRow = c * h * w + (y >> 1) * w
      const dstRow = c * h * 4 * w + y * w * 2
      for (let x = 0; x < w * 2; x++) out.data[dstRow + x] = input.data[srcRow + (x >> 1)]
    }
  }
  return out
}

function concat(a: Tensor, b: Tensor): Tensor {
  const out = tensor(a.c + b.c, a.h, a.w)
  out.data.set(a.data, 0)
  out.data.set(b.data, a.data.length)
  return out
}

/**
 * Run the network. Input height and width must be multiples of
 * `manifest.inputMultiple` so the skip connections line up.
 */
export function runNet(
  net: Net,
  input: Tensor,
  onOp?: (op: Op, ms: number) => void,
): { heat: Tensor; offset: Tensor } {
  const { ops, outputs } = net.manifest
  const values = new Map<string, Tensor>([['input', input]])
  // Free each intermediate after its last use; peak memory is what limits a phone.
  const lastUse = new Map<string, number>()
  ops.forEach((op, index) => {
    const inputs = op.op === 'add' ? [op.a, op.b] : op.op === 'concat' ? op.in : [op.in]
    for (const name of inputs) lastUse.set(name, index)
  })

  ops.forEach((op, index) => {
    const started = onOp ? performance.now() : 0
    let out: Tensor
    if (op.op === 'conv') out = conv(values.get(op.in)!, op, net.weights)
    else if (op.op === 'add') out = add(values.get(op.a)!, values.get(op.b)!)
    else if (op.op === 'up2') out = up2(values.get(op.in)!)
    else out = concat(values.get(op.in[0])!, values.get(op.in[1])!)
    values.set(op.out, out)
    onOp?.(op, performance.now() - started)
    for (const [name, last] of lastUse) {
      if (last === index && name !== outputs.heat && name !== outputs.offset) values.delete(name)
    }
  })
  return { heat: values.get(outputs.heat)!, offset: values.get(outputs.offset)! }
}
