# TimbreMap

A fingering reference and practice tool for wind instrument players — flute
and saxophones today, more on the way. One codebase, three targets: mobile web,
desktop web, and a native Android app.

Formerly FluteApp. Storage keys, the IndexedDB name, the backup format id and
the Android `appId` keep the old name on purpose, so existing installs keep
their settings and sheets.

## What it does

1. **Fingering → note.** Tap the keys you hold down and see every note that
   fingering produces. The first two octaves usually share fingerings, so a
   match often reports two notes — both are shown, not just one.
2. **Note library.** Browse the whole range and see all documented ways to play
   each note: primary, alternate, and trill fingerings.
3. **Sheet music.** Photograph or upload a piece (or import MusicXML), detect or
   note down what to play, and get the fingering for every note. A piece can be
   rewritten for another instrument at the same sounding pitch. Saved on your
   device for later.

Everything works offline. Nothing is uploaded anywhere, and there are no
accounts — which means backups are your responsibility, so **Setup → Export
backup** is a real feature, not a debug tool.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `vue-tsc` only |
| `npm test` | Unit tests (Vitest) |

## How it's put together

```
src/instruments/ the catalog, and per family: keys, chart layout, fingerings
src/domain/      instrument-independent — fingering notation, lookup, audio
src/data/        IndexedDB schema, image processing
src/components/  KeyChart (the fingering diagram), note badges, pickers
src/views/       one per route
src/platform/    native-only wiring, the instrument download cache
```

The load-bearing idea: **a fingering is just the set of keys held down.** The
interactive chart emits a set, the lookup matches sets, the library renders
sets. Everything else follows from that.

`KeyChart.vue` is used in three places and has two modes — interactive for
feature 1, read-only for features 2 and 3 — so a fingering looks identical
wherever it appears.

### Instruments

`src/instruments/catalog.ts` describes every instrument — names,
transposition, register names, the optional hardware a player can set in Setup
— and is all the app shell knows up front. Keys, chart and fingerings live in a
*data module* per family (`src/instruments/<family>/data.ts`), shared by every
instrument that fingers the same way (all saxophones use one). Each data module
builds to its own `assets/instrument-<family>-<hash>.js` chunk and is loaded
with `loadInstrument(id)`; after that, `getInstrument(id)` returns it
synchronously. The app waits for the active instrument before it mounts.

A new player gets a short welcome (what each tab does, how to install the app)
and picks their instruments (`src/views/WelcomeView.vue`). The switch at the top lists only
those, and Setup changes the list. The installed PWA precaches the
shell but **not** the instrument chunks: the service worker caches each chunk
the first time it is fetched, `src/platform/instrumentCache.ts` fetches every
chosen instrument (so it works offline from then on) and deletes the chunks of
instruments nobody chose any more.

Saved sheets store fingering ids, which are built from the instrument's
canonical key order (`keyOrder`). A test holds every id an older version could
have saved (`src/instruments/__fixtures__/saved-fingering-ids.json`) to still
resolve.

### Fingering notation

Fingerings are authored as chart codes rather than key arrays, so an entry can
be checked against a printed chart without decoding it first:

```
"T 123 G# | 123 Eb"
 │  │   │    │   └── right pinky / trill / foot keys
 │  │   │    └────── right hand: index, middle, ring
 │  │   └─────────── left pinky G# key
 │  └─────────────── left hand: index, middle, ring
 └────────────────── left thumb: T (B natural), Bb (Briccialdi), - (off)
```

Within a hand group, each position is one character: its own digit (finger
down), `-` (finger off), `0` (ring depressed, tone hole left open — open-hole
flutes) or `h` (hole half covered). Groups can be longer than three, and
instruments without a thumb key leave the thumb token out. `parseFingeringCode`
validates every code and throws on a typo, including a digit in the wrong
position.

### The fingering data

`src/instruments/flute/fingerings.ts` covers **B3 – C7** chromatically, transcribed from
[The Woodwind Fingering Guide](https://www.wfg.woodwind.org/flute/) basic charts
for flute, octaves 1–3.

**This data is worth proof-reading.** A mis-transcribed fingering is invisible to
anyone who can't already play the note, so `src/instruments/fingerings.test.ts` guards
the mechanical properties — full chromatic coverage, exactly one primary per
note, no duplicates, consistent B-footjoint flags, and no fingering that asks
one finger to be in two places at once — for every instrument, against the
written range its catalog entry declares. What it cannot check is whether a
fingering is *musically* right. Entries whose source was ambiguous carry a
`verify` note and show a **Needs checking** badge in the note library; B6 is
currently the only one.

Not yet covered: the fourth octave (C♯7 and up), extended alternates from the
WFG alternate charts, harmonics, and multiphonics.

## Android

The Capacitor project is set up and `android/` is generated. Building the APK
needs two things that are not installed on this machine:

- **JDK 21.** Gradle 8.14 rejects JDK 26 (`Unsupported class file major version
  70`), which is the only JDK present.
- **Android SDK**, with `ANDROID_HOME` set.

With both in place:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Or `npx cap run android` to build and deploy to a connected device.

Native specifics already handled in `src/platform/native.ts`: the hardware back
button navigates instead of closing the app, and the status bar is themed to
match. Sheet images live in IndexedDB rather than on the filesystem, so storage
behaves identically in the browser and the Android WebView — one code path.

## Installing as a web app

The production build is a PWA, so **Add to Home Screen** works on Android and
iOS and **Install** works in desktop Chrome and Edge. That route needs no
Android toolchain at all, and is the fastest way to get it onto a phone.

## Reading notes off the page

**Detect notes** on a sheet reads the pitches from the image and fills in the
sequence for you to check. It runs entirely on your device — no upload, no
service — and the result lands in the same unsaved draft you would have typed,
so reviewing, correcting and saving work exactly as before. Tap a note for
one-tap fixes (semitone, staff step, octave, insert). If you have the score as
MusicXML or `.mxl`, **Import** reads it exactly instead.

It is a small neural network (about 0.3 MB, shipped with the app and cached for
offline use) that finds noteheads, accidentals, clefs, barlines, ottava lines and
ties, plus classical code for the staff geometry and the musical rules (key
signature per staff, accidentals in force, 8va, ties). Pages the network cannot
be loaded for fall back to the older heuristic recogniser.

Measured on pages with exact ground truth (`npm run omr:eval`, see
[omr-eval/](omr-eval/)), as sequence accuracy of the note order:

| Input | Accuracy |
| --- | --- |
| Clean PDF / scan, LilyPond-engraved real parts | 99.3 % |
| Three real MuseScore parts (letters and octaves only) | 99.1–99.5 % |
| Simulated phone photos (perspective, curl, shadow, noise) | 87.7 % |

Be honest about the last row: photos are the weak spot, and the photo number is
from *simulated* photos. Dense, tightly packed parts photographed at an angle
can lose staves. Flat scans and screenshots are what it is built for; handwritten
music is out of scope. Every failure falls back to the manual editor with a
message rather than an empty screen.

How it is built and trained is in [omr-train/](omr-train/README.md);
`npm run omr:improve` runs one unattended round of fresh data, fine-tuning and
evaluation, and only replaces the shipped model if it scores better.

## Not built yet

Note **durations** are neither detected nor stored — the app is a fingering
reference, not a score editor. Repeats, `D.C.` and voltas are ignored, so a piece
with them reads in printed order rather than playing order. Chords are detected
but reduced to their top note, with a warning.

## Logo and icons

The logo is `public/logo.png`. `node scripts/render-icons.mjs` (needs
`rsvg-convert`) renders it into the favicon, the PWA and Apple touch icons and
the Android launcher icons and splash screens — run it again after changing
the logo.
