import type { Pt } from './types'

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/** Pixels per centimetre from two points on the ruler a known distance apart. */
export function pxPerCm(a: Pt, b: Pt, cm: number): number {
  return cm > 0 ? dist(a, b) / cm : 0
}

export function polylineLength(pts: Pt[]): number {
  let sum = 0
  for (let i = 1; i < pts.length; i++) sum += dist(pts[i - 1], pts[i])
  return sum
}

type Bez = [Pt, Pt, Pt, Pt]

/** Catmull-Rom through the points, expressed as cubic Béziers (one per segment). */
export function splineSegments(pts: Pt[]): Bez[] {
  const segs: Bez[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    segs.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ])
  }
  return segs
}

const bezAt = ([a, b, c, d]: Bez, t: number): Pt => {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  }
}

/** Length of the smooth curve through the points, by sampling each segment. */
export function splineLength(pts: Pt[], samples = 24): number {
  if (pts.length < 2) return 0
  let sum = 0
  for (const seg of splineSegments(pts)) {
    let prev = seg[0]
    for (let i = 1; i <= samples; i++) {
      const p = bezAt(seg, i / samples)
      sum += dist(prev, p)
      prev = p
    }
  }
  return sum
}

export function splinePath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`
  const f = (n: number) => Math.round(n * 10) / 10
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`
  for (const [, c1, c2, p2] of splineSegments(pts)) {
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`
  }
  return d
}

/** Snake length in cm from the traced points and the ruler calibration. */
export function lengthCm(points: Pt[], cal: [Pt, Pt] | null, calCm: number, smooth = true): number {
  if (!cal || points.length < 2) return 0
  const scale = pxPerCm(cal[0], cal[1], calCm)
  if (scale <= 0) return 0
  const px = smooth ? splineLength(points) : polylineLength(points)
  return px / scale
}
