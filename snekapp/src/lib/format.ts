import { days, t, type MsgKey } from './i18n'
import { ageParts } from './dates'
import type { SnakeEvent } from './types'

export function eventSummary(e: SnakeEvent): string {
  const parts: string[] = []
  switch (e.type) {
    case 'feed':
      if (e.refused) parts.push(t('refused'))
      else {
        if (e.prey) parts.push(t(e.prey as MsgKey))
        if (e.preySize) parts.push(e.preySize)
        if (e.frozen != null) parts.push(e.frozen ? t('frozen') : t('live'))
      }
      break
    case 'weight': parts.push(`${e.value} ${t('g')}`); break
    case 'length': parts.push(`${e.value} ${t('cm')}`); break
    case 'eggs': parts.push(`${e.value} 🥚`); break
  }
  if (e.text) parts.push(e.text)
  return parts.join(' · ')
}

export function ageText(birth: string): string {
  const a = ageParts(birth)
  if (!a) return t('ageUnknown')
  if (a.years === 0) return `${a.months} ${t('monthsShort')}`
  return `${a.years} ${t('years')}${a.months ? ` ${a.months} ${t('monthsShort')}` : ''}`
}

/** "yesterday", "3 days ago" … */
export function relativeDays(n: number): string {
  if (n === 0) return t('today')
  if (n === 1) return t('yesterday')
  return t('ago', { d: days(n) })
}
