import type { EventType } from './types'

export interface EventMeta {
  type: EventType
  icon: string
  color: string
}

export const EVENT_TYPES: EventMeta[] = [
  { type: 'feed', icon: '🐭', color: '#f59e0b' },
  { type: 'shed', icon: '🐍', color: '#a78bfa' },
  { type: 'weight', icon: '⚖️', color: '#38bdf8' },
  { type: 'length', icon: '📏', color: '#5be37d' },
  { type: 'clean', icon: '🧹', color: '#2dd4bf' },
  { type: 'water', icon: '💧', color: '#60a5fa' },
  { type: 'vet', icon: '🩺', color: '#f87171' },
  { type: 'med', icon: '💊', color: '#fb7185' },
  { type: 'breed', icon: '💞', color: '#f472b6' },
  { type: 'eggs', icon: '🥚', color: '#fde68a' },
  { type: 'note', icon: '📝', color: '#94a3b8' },
]

export const eventMeta = (type: EventType): EventMeta => EVENT_TYPES.find((e) => e.type === type)!

export const PREY = ['mouse', 'rat', 'chick', 'quail', 'rabbit', 'other'] as const
export const PREY_SIZES = ['pinky', 'fuzzy', 'hopper', 'weaner', 'small', 'medium', 'large', 'xl'] as const
