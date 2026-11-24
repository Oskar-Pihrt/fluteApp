const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from a to b (b − a), immune to daylight-saving shifts. */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

export function ageParts(birth: string, today = todayISO()): { years: number; months: number } | null {
  if (!birth) return null
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const total = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  if (total < 0) return null
  return { years: Math.floor(total / 12), months: total % 12 }
}

export function localeTag(locale: string): string {
  return locale === 'cs' ? 'cs-CZ' : 'en-GB'
}

export function fmtDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return parseISO(iso).toLocaleDateString(localeTag(locale), opts)
}
