export type Sex = 'm' | 'f' | 'u'

export interface Snake {
  id?: number
  name: string
  species: string // key from species.ts
  morph: string
  sex: Sex
  birthDate: string // ISO yyyy-mm-dd or ''
  acquiredDate: string
  color: string // accent colour, also tints the generated illustration
  photo?: Blob
  feedEveryDays: number
  notes: string
  createdAt: number
}

export type EventType =
  | 'feed'
  | 'shed'
  | 'weight'
  | 'length'
  | 'vet'
  | 'med'
  | 'clean'
  | 'water'
  | 'breed'
  | 'eggs'
  | 'note'

export interface SnakeEvent {
  id?: number
  snakeId: number
  type: EventType
  date: string // ISO yyyy-mm-dd
  value?: number // g for weight, cm for length, count for eggs
  text?: string
  prey?: string
  preySize?: string
  frozen?: boolean
  refused?: boolean
  measurementId?: number
}

export interface Task {
  id?: number
  snakeId?: number
  title: string
  date: string
  repeatDays?: number
  done?: boolean
}

export interface Pt {
  x: number
  y: number
}

export interface Measurement {
  id?: number
  snakeId: number
  date: string
  photo: Blob
  imgW: number
  imgH: number
  cal: [Pt, Pt]
  calCm: number
  points: Pt[]
  lengthCm: number
}
