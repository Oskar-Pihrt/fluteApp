export interface Species {
  key: string
  en: string
  cs: string
  latin: string
  adultCm: [number, number]
  lifespanYears: [number, number]
  /** Warm-side surface temperature, °C. */
  hotspot: [number, number]
  /** Cool-side air temperature, °C. */
  cool: [number, number]
  humidity: [number, number]
  feedJuvenileDays: number
  feedAdultDays: number
  /** 1 = beginner friendly, 3 = experienced keepers. */
  difficulty: 1 | 2 | 3
  color: string
}

// Typical captive-care ranges — a starting point, not veterinary advice.
export const SPECIES: Species[] = [
  { key: 'ball-python', en: 'Ball python', cs: 'Krajta královská', latin: 'Python regius', adultCm: [90, 150], lifespanYears: [20, 30], hotspot: [31, 33], cool: [25, 27], humidity: [55, 65], feedJuvenileDays: 7, feedAdultDays: 14, difficulty: 1, color: '#e0a85a' },
  { key: 'corn-snake', en: 'Corn snake', cs: 'Užovka červená', latin: 'Pantherophis guttatus', adultCm: [120, 150], lifespanYears: [15, 20], hotspot: [30, 32], cool: [22, 26], humidity: [40, 60], feedJuvenileDays: 7, feedAdultDays: 10, difficulty: 1, color: '#f0743c' },
  { key: 'california-kingsnake', en: 'California kingsnake', cs: 'Hroznýšovec kalifornský', latin: 'Lampropeltis californiae', adultCm: [90, 120], lifespanYears: [15, 20], hotspot: [30, 32], cool: [22, 26], humidity: [40, 60], feedJuvenileDays: 7, feedAdultDays: 10, difficulty: 1, color: '#d9c7a0' },
  { key: 'milk-snake', en: 'Milk snake', cs: 'Korálovka', latin: 'Lampropeltis triangulum', adultCm: [60, 120], lifespanYears: [15, 20], hotspot: [29, 31], cool: [22, 25], humidity: [40, 60], feedJuvenileDays: 7, feedAdultDays: 10, difficulty: 1, color: '#e8574a' },
  { key: 'boa-constrictor', en: 'Boa constrictor', cs: 'Hroznýš královský', latin: 'Boa imperator', adultCm: [180, 250], lifespanYears: [20, 30], hotspot: [31, 33], cool: [24, 27], humidity: [60, 70], feedJuvenileDays: 10, feedAdultDays: 21, difficulty: 2, color: '#b88a5a' },
  { key: 'carpet-python', en: 'Carpet python', cs: 'Krajta kobercová', latin: 'Morelia spilota', adultCm: [150, 250], lifespanYears: [15, 25], hotspot: [31, 33], cool: [24, 27], humidity: [50, 70], feedJuvenileDays: 7, feedAdultDays: 14, difficulty: 2, color: '#a3b84a' },
  { key: 'hognose', en: 'Western hognose', cs: 'Užovka nosatá', latin: 'Heterodon nasicus', adultCm: [40, 90], lifespanYears: [15, 20], hotspot: [31, 33], cool: [22, 26], humidity: [30, 40], feedJuvenileDays: 5, feedAdultDays: 10, difficulty: 2, color: '#c9a35e' },
  { key: 'rosy-boa', en: 'Rosy boa', cs: 'Hroznýšek růžový', latin: 'Lichanura trivirgata', adultCm: [60, 100], lifespanYears: [20, 30], hotspot: [30, 33], cool: [22, 26], humidity: [30, 40], feedJuvenileDays: 10, feedAdultDays: 14, difficulty: 1, color: '#d98a6a' },
  { key: 'garter-snake', en: 'Garter snake', cs: 'Užovka podvazková', latin: 'Thamnophis sirtalis', adultCm: [50, 100], lifespanYears: [8, 12], hotspot: [29, 31], cool: [21, 25], humidity: [50, 65], feedJuvenileDays: 4, feedAdultDays: 7, difficulty: 1, color: '#6bc46d' },
  { key: 'green-tree-python', en: 'Green tree python', cs: 'Krajta zelená', latin: 'Morelia viridis', adultCm: [120, 180], lifespanYears: [15, 20], hotspot: [28, 30], cool: [24, 26], humidity: [60, 80], feedJuvenileDays: 7, feedAdultDays: 14, difficulty: 3, color: '#3fd17a' },
  { key: 'reticulated-python', en: 'Reticulated python', cs: 'Krajta mřížkovaná', latin: 'Malayopython reticulatus', adultCm: [300, 600], lifespanYears: [20, 25], hotspot: [31, 33], cool: [26, 28], humidity: [60, 80], feedJuvenileDays: 7, feedAdultDays: 21, difficulty: 3, color: '#c9a24a' },
  { key: 'other', en: 'Other species', cs: 'Jiný druh', latin: '', adultCm: [0, 0], lifespanYears: [0, 0], hotspot: [30, 32], cool: [22, 26], humidity: [40, 60], feedJuvenileDays: 7, feedAdultDays: 10, difficulty: 2, color: '#5be37d' },
]

export function speciesByKey(key: string): Species {
  return SPECIES.find((s) => s.key === key) ?? SPECIES[SPECIES.length - 1]
}

export const SNAKE_COLORS = ['#5be37d', '#e8c547', '#f0743c', '#e8574a', '#f472b6', '#a78bfa', '#38bdf8', '#2dd4bf']
