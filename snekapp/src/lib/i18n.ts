import { ref } from 'vue'

export type Locale = 'cs' | 'en'
const KEY = 'snekapp.locale'

function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'cs' || saved === 'en') return saved
  } catch { /* storage unavailable */ }
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  return lang.startsWith('cs') || lang.startsWith('sk') ? 'cs' : 'en'
}

export const locale = ref<Locale>(detect())

export function setLocale(l: Locale) {
  locale.value = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  document.documentElement.lang = l
}

const en = {
  // navigation
  home: 'Home', snakes: 'Snakes', calendar: 'Calendar', measure: 'Measure', more: 'More',
  // common
  save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', close: 'Close', back: 'Back', next: 'Next',
  today: 'Today', date: 'Date', notes: 'Notes', optional: 'optional', note: 'Note', snake: 'Snake', none: 'None',
  // home
  greeting: 'Hello, keeper', dueNow: 'Needs attention', allGood: 'Everyone is fed and happy.', upcoming: 'Coming up',
  welcomeTitle: 'Welcome to snekapp', welcomeText: 'Add your first snake to start tracking meals, sheds, growth and more.',
  addFirst: 'Add your first snake', tryDemo: 'Explore with demo snakes',
  statSnakes: 'Snakes', statFeeds: 'Meals · 30 d', statSheds: 'Sheds · 90 d', tasksDue: 'Tasks',
  neverFed: 'No meal logged yet', fedBtn: 'Fed', dueToday: 'Meal due today', overdueBy: 'Overdue by {d}', inDays: 'Meal in {d}', lastMeal: 'Last meal',
  nextMeal: 'Next meal', yesterday: 'yesterday', ago: '{d} ago',
  // snake
  newSnake: 'New snake', editSnake: 'Edit snake', name: 'Name', species: 'Species', morph: 'Morph / locality', sex: 'Sex',
  sex_m: 'Male', sex_f: 'Female', sex_u: 'Unknown', birthDate: 'Hatch date', acquiredDate: 'Acquired', feedEvery: 'Feed every',
  color: 'Colour', photo: 'Photo', choosePhoto: 'Choose photo', removePhoto: 'Remove photo', age: 'Age', years: 'y', monthsShort: 'm', ageUnknown: 'Age unknown',
  tabTimeline: 'Timeline', tabGrowth: 'Growth', tabCare: 'Care', tabInfo: 'Info', noEvents: 'Nothing logged yet.', logSomething: 'Log something',
  noGrowth: 'Log a weight or measure the length to see growth here.', weight: 'Weight', length: 'Length', latest: 'Latest',
  deleteSnake: 'Delete snake', deleteSnakeConfirm: 'Delete {name} and everything logged for them? This cannot be undone.',
  deleteEventConfirm: 'Delete this entry?', measureSnake: 'Measure length', noSnakes: 'No snakes yet.', measuredPhotos: 'Measurement photos',
  g: 'g', cm: 'cm', m: 'm',
  // events
  logEvent: 'Log event', whatHappened: 'What happened?',
  ev_feed: 'Meal', ev_shed: 'Shed', ev_weight: 'Weight', ev_length: 'Length', ev_clean: 'Cleaning', ev_water: 'Water change', ev_vet: 'Vet visit',
  ev_med: 'Medication', ev_breed: 'Pairing', ev_eggs: 'Clutch', ev_note: 'Note',
  prey: 'Prey', preySize: 'Size', frozen: 'Frozen-thawed', live: 'Live', refused: 'Refused', ate: 'Ate it',
  mouse: 'Mouse', rat: 'Rat', chick: 'Chick', quail: 'Quail', rabbit: 'Rabbit', other: 'Other',
  eggCount: 'Number of eggs', weightG: 'Weight (g)', lengthCm: 'Length (cm)', details: 'Details',
  // calendar
  addEvent: 'Add event', addTask: 'Add task', nothingToday: 'Nothing planned for this day.', mealDue: 'Meal due', taskTitle: 'Task',
  newTask: 'New task', repeat: 'Repeat', repeatNone: 'Does not repeat', repeatEvery: 'Every {d}', forWhom: 'For', allSnakes: 'General (no snake)',
  legend: 'Legend', loggedLegend: 'Logged', dueLegend: 'Meal due', taskLegend: 'Task',
  // measure
  measureTitle: 'Measure length', measureIntro: 'Photograph the snake next to a ruler or measuring tape, then trace its body on the photo.',
  takePhoto: 'Take a photo', fromGallery: 'Choose from gallery',
  tipsTitle: 'For an accurate result',
  tip1: 'Put a ruler or tape right next to the snake, in the same plane.',
  tip2: 'Shoot straight from above — a tilted camera skews the length.',
  tip3: 'Never stretch the snake. Let it lie naturally; the curves are traced.',
  tip4: 'Handle a calm snake gently, or measure while it rests in a tub.',
  stepRuler: 'Ruler', stepTrace: 'Trace', stepSave: 'Save',
  rulerHint: 'Tap two points on the ruler that are far apart.', rulerDistance: 'Distance between the points', scale: 'Scale',
  pxPerCm: 'px per cm', traceHint: 'Tap along the snake, from the tip of the nose to the tip of the tail. Use more points on bends.',
  undo: 'Undo', clear: 'Clear', smooth: 'Smooth curve', estimated: 'Estimated length', retake: 'New photo', resetRuler: 'Redo ruler',
  saveMeasurement: 'Save measurement', saved: 'Saved', zoomHint: 'Pinch or scroll to zoom, drag to move.', points: 'points',
  pickSnake: 'Which snake?', needSnake: 'Add a snake first to save a measurement.', loadFail: 'Could not open that image.',
  // settings
  settings: 'Settings', language: 'Language', data: 'Your data', exportData: 'Export backup', importData: 'Import backup',
  importConfirm: 'Importing replaces everything currently in the app. Continue?', importDone: 'Backup restored.', importFail: 'That file is not a snekapp backup.',
  demoData: 'Add demo snakes', clearAll: 'Delete all data', clearConfirm: 'Delete every snake, entry and photo? This cannot be undone.',
  localOnly: 'Everything is stored on this device only. Export a backup now and then.',
  guide: 'Species care guide', guideSub: 'Typical temperatures, humidity and feeding',
  about: 'About', disclaimer: 'Care values are typical ranges and not veterinary advice. When in doubt, ask a reptile vet.',
  // reminders
  reminders: 'Reminders', remindersOn: 'Feeding and task reminders', remindersTime: 'Remind me at', remindersWebOnly: 'Reminders work in the Android app.',
  remindersDenied: 'Notifications are blocked. Allow them for snekapp in Android settings.', notifyTest: 'Send a test', notifyTestBody: 'Reminders are working.',
  notifyDue: 'Meal due today.', notifyOverdue: 'Still waiting for a meal.',
  // guide
  adultSize: 'Adult length', lifespan: 'Lifespan', hotspot: 'Warm spot', coolSide: 'Cool side', humidity: 'Humidity',
  feeding: 'Feeding', juvenile: 'young', adult: 'adult', level_1: 'Beginner friendly', level_2: 'Some experience', level_3: 'Experienced keepers',
  everyN: 'every {d}', yrs: 'years',
}

const cs: Record<keyof typeof en, string> = {
  home: 'Domů', snakes: 'Hadi', calendar: 'Kalendář', measure: 'Měření', more: 'Více',
  save: 'Uložit', cancel: 'Zrušit', delete: 'Smazat', edit: 'Upravit', add: 'Přidat', close: 'Zavřít', back: 'Zpět', next: 'Dál',
  today: 'Dnes', date: 'Datum', notes: 'Poznámky', optional: 'nepovinné', note: 'Poznámka', snake: 'Had', none: 'Žádný',
  greeting: 'Ahoj, chovateli', dueNow: 'Chce pozornost', allGood: 'Všichni jsou nakrmení a spokojení.', upcoming: 'Brzy na řadě',
  welcomeTitle: 'Vítej v snekappu', welcomeText: 'Přidej prvního hada a začni sledovat krmení, svlékání, růst a další.',
  addFirst: 'Přidat prvního hada', tryDemo: 'Vyzkoušet s ukázkovými hady',
  statSnakes: 'Hadi', statFeeds: 'Krmení · 30 d', statSheds: 'Svlékání · 90 d', tasksDue: 'Úkoly',
  neverFed: 'Zatím žádné krmení', fedBtn: 'Nakrmen', dueToday: 'Krmení dnes', overdueBy: 'Zpoždění {d}', inDays: 'Krmení za {d}', lastMeal: 'Poslední krmení',
  nextMeal: 'Další krmení', yesterday: 'včera', ago: 'před {d}',
  newSnake: 'Nový had', editSnake: 'Upravit hada', name: 'Jméno', species: 'Druh', morph: 'Morfa / lokalita', sex: 'Pohlaví',
  sex_m: 'Samec', sex_f: 'Samice', sex_u: 'Neznámé', birthDate: 'Datum vylíhnutí', acquiredDate: 'Pořízen', feedEvery: 'Krmit každých',
  color: 'Barva', photo: 'Fotka', choosePhoto: 'Vybrat fotku', removePhoto: 'Odebrat fotku', age: 'Věk', years: 'r', monthsShort: 'm', ageUnknown: 'Věk neznámý',
  tabTimeline: 'Historie', tabGrowth: 'Růst', tabCare: 'Péče', tabInfo: 'Info', noEvents: 'Zatím nic zapsáno.', logSomething: 'Zapsat událost',
  noGrowth: 'Zapiš váhu nebo změř délku a tady uvidíš růst.', weight: 'Váha', length: 'Délka', latest: 'Poslední',
  deleteSnake: 'Smazat hada', deleteSnakeConfirm: 'Smazat {name} a vše, co k němu bylo zapsáno? Nejde to vrátit.',
  deleteEventConfirm: 'Smazat tento záznam?', measureSnake: 'Změřit délku', noSnakes: 'Zatím žádní hadi.', measuredPhotos: 'Fotky z měření',
  g: 'g', cm: 'cm', m: 'm',
  logEvent: 'Zapsat událost', whatHappened: 'Co se stalo?',
  ev_feed: 'Krmení', ev_shed: 'Svlékání', ev_weight: 'Váha', ev_length: 'Délka', ev_clean: 'Úklid', ev_water: 'Výměna vody', ev_vet: 'Veterinář',
  ev_med: 'Léky', ev_breed: 'Spáření', ev_eggs: 'Snůška', ev_note: 'Poznámka',
  prey: 'Kořist', preySize: 'Velikost', frozen: 'Mražená', live: 'Živá', refused: 'Odmítl', ate: 'Snědl',
  mouse: 'Myš', rat: 'Potkan', chick: 'Kuře', quail: 'Křepelka', rabbit: 'Králík', other: 'Jiné',
  eggCount: 'Počet vajec', weightG: 'Váha (g)', lengthCm: 'Délka (cm)', details: 'Podrobnosti',
  addEvent: 'Přidat událost', addTask: 'Přidat úkol', nothingToday: 'Na tento den nic není.', mealDue: 'Krmení', taskTitle: 'Úkol',
  newTask: 'Nový úkol', repeat: 'Opakovat', repeatNone: 'Neopakovat', repeatEvery: 'Každých {d}', forWhom: 'Pro', allSnakes: 'Obecné (bez hada)',
  legend: 'Legenda', loggedLegend: 'Zapsáno', dueLegend: 'Krmení', taskLegend: 'Úkol',
  measureTitle: 'Měření délky', measureIntro: 'Vyfoť hada vedle pravítka nebo metru a na fotce obkresli jeho tělo.',
  takePhoto: 'Vyfotit', fromGallery: 'Vybrat z galerie',
  tipsTitle: 'Pro přesný výsledek',
  tip1: 'Dej pravítko nebo metr těsně k hadovi, do stejné roviny.',
  tip2: 'Fotky přímo shora – nakloněný telefon zkresluje délku.',
  tip3: 'Hada nenatahuj. Nech ho ležet přirozeně, zatáčky se obkreslí.',
  tip4: 'S klidným hadem zacházej jemně, nebo ho měř, když odpočívá v boxu.',
  stepRuler: 'Pravítko', stepTrace: 'Obkreslení', stepSave: 'Uložení',
  rulerHint: 'Klepni na dva body na pravítku, které jsou od sebe daleko.', rulerDistance: 'Vzdálenost mezi body', scale: 'Měřítko',
  pxPerCm: 'px na cm', traceHint: 'Klepej podél hada od špičky čenichu po špičku ocasu. V zatáčkách dej bodů víc.',
  undo: 'Zpět', clear: 'Smazat', smooth: 'Vyhladit křivku', estimated: 'Odhadovaná délka', retake: 'Nová fotka', resetRuler: 'Znovu pravítko',
  saveMeasurement: 'Uložit měření', saved: 'Uloženo', zoomHint: 'Přibližuj štípnutím nebo kolečkem, posouvej tažením.', points: 'bodů',
  pickSnake: 'Který had?', needSnake: 'Nejdřív přidej hada, ke kterému měření uložíš.', loadFail: 'Obrázek se nepodařilo otevřít.',
  settings: 'Nastavení', language: 'Jazyk', data: 'Tvoje data', exportData: 'Exportovat zálohu', importData: 'Importovat zálohu',
  importConfirm: 'Import nahradí všechno, co je teď v aplikaci. Pokračovat?', importDone: 'Záloha obnovena.', importFail: 'Tohle není záloha snekappu.',
  demoData: 'Přidat ukázkové hady', clearAll: 'Smazat všechna data', clearConfirm: 'Smazat všechny hady, záznamy a fotky? Nejde to vrátit.',
  localOnly: 'Vše je uložené jen v tomhle zařízení. Čas od času si udělej zálohu.',
  guide: 'Průvodce péčí o druhy', guideSub: 'Typické teploty, vlhkost a krmení',
  about: 'O aplikaci', disclaimer: 'Hodnoty péče jsou typická rozmezí, ne veterinární rada. V případě pochybností se zeptej veterináře pro plazy.',
  reminders: 'Připomínky', remindersOn: 'Připomínat krmení a úkoly', remindersTime: 'Připomenout v', remindersWebOnly: 'Připomínky fungují v aplikaci pro Android.',
  remindersDenied: 'Notifikace jsou zablokované. Povol je pro snekapp v nastavení Androidu.', notifyTest: 'Poslat zkušební', notifyTestBody: 'Připomínky fungují.',
  notifyDue: 'Dnes je čas na krmení.', notifyOverdue: 'Pořád čeká na krmení.',
  adultSize: 'Dospělá délka', lifespan: 'Délka života', hotspot: 'Teplé místo', coolSide: 'Chladná strana', humidity: 'Vlhkost',
  feeding: 'Krmení', juvenile: 'mladý', adult: 'dospělý', level_1: 'Vhodné pro začátečníky', level_2: 'Chce zkušenost', level_3: 'Pro zkušené chovatele',
  everyN: 'každých {d}', yrs: 'let',
}

export type MsgKey = keyof typeof en
const dict = { en, cs }

export function t(key: MsgKey, params?: Record<string, string | number>): string {
  let s: string = dict[locale.value][key] ?? en[key]
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
  return s
}

export function days(n: number): string {
  const a = Math.abs(n)
  if (locale.value === 'cs') return `${a} ${a === 1 ? 'den' : a >= 2 && a <= 4 ? 'dny' : 'dní'}`
  return `${a} ${a === 1 ? 'day' : 'days'}`
}
