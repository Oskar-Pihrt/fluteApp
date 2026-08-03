# FluteApp

A reference and practice tool for transverse (Boehm-system) flute players. One
codebase, three targets: mobile web, desktop web, and a native Android app.

## What it does

1. **Fingering → note.** Tap the keys you hold down and see every note that
   fingering produces. The flute's first two octaves share fingerings, so a
   match usually reports two notes — both are shown, not just one.
2. **Note library.** Browse the whole range and see all documented ways to play
   each note: primary, alternate, and trill fingerings.
3. **Sheet music.** Photograph or upload a piece, note down what to play, and
   get the fingering for every note. Saved on your device for later.

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
src/domain/     the flute itself — keys, fingering notation, lookup, audio
src/data/       the fingering database, IndexedDB schema, image processing
src/components/ KeyChart (the fingering diagram), note badges, pickers
src/views/      one per route
src/platform/   native-only wiring (no-ops in a browser)
```

The load-bearing idea: **a fingering is just the set of keys held down.** The
interactive chart emits a set, the lookup matches sets, the library renders
sets. Everything else follows from that.

`KeyChart.vue` is used in three places and has two modes — interactive for
feature 1, read-only for features 2 and 3 — so a fingering looks identical
wherever it appears.

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
down), `-` (finger off), or `0` (ring depressed, tone hole left open — open-hole
flutes only). `parseFingeringCode` validates every code and throws on a typo,
including a digit in the wrong position.

### The fingering data

`src/data/fingerings.ts` covers **B3 – C7** chromatically, transcribed from
[The Woodwind Fingering Guide](https://www.wfg.woodwind.org/flute/) basic charts
for flute, octaves 1–3.

**This data is worth proof-reading.** A mis-transcribed fingering is invisible to
anyone who can't already play the note, so `src/data/fingerings.test.ts` guards
the mechanical properties — full chromatic coverage, exactly one primary per
note, no duplicates, consistent B-footjoint flags, and no fingering that asks
one finger to be in two places at once. What it cannot check is whether a
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

**Detect notes** on a sheet tries to read the pitches from the image and fills in
the sequence for you to check. It runs entirely on your device — no upload, no
service — and it is an assist, not a replacement: the notes land in the same
unsaved draft you would have typed, so reviewing, correcting and saving work
exactly as before.

> **Status: experimental, and not yet reliable on real scores.**
>
> The pipeline is thoroughly tested against synthetic pages — it reads those
> exactly, including skew, brightness gradients, ledger lines, hollow noteheads,
> key signatures and measure-scoped accidentals. It has *not* been made to work on
> a real, densely engraved part yet; on a page of beamed sixteenths with ottava
> marks and time-signature changes it currently produces little or nothing useful.
>
> Manual note entry is complete and reliable, and remains the way to use the app.
> Detection is a work in progress on top of it.

Two things make this tractable rather than a research project. The app stores
**pitch order only**, with no durations, so recognition never has to interpret
stems, beams, flags, dots, rests or tuplets — it reduces to *find the noteheads,
work out each one's pitch*. And flute parts are monophonic, single-staff and in
treble clef throughout, which is the easiest case in the field.

It lives in [src/omr/](src/omr/) and is plain TypeScript over typed arrays — no
OpenCV, no ML model, nothing added to the download. Everything except the worker
and the Vue composable is a pure function, so the whole recogniser is unit-tested
in Node with no setup.

```
binarise   Sauvola local threshold, with a global fallback in flat regions
deskew     skew angle from projection sharpness, then one rotation
staves     line thickness and spacing, line detection, line removal
glyphs     clef extent, barlines, accidentals, key signature
noteheads  filled by erosion, hollow by enclosed-hole detection
pitch      staff position → letter → key signature → measure accidentals
```

Three details worth knowing if you touch it:

- **`spaceHeight` is the line pitch**, centre to centre — not the bare white gap.
  Every size threshold downstream is a multiple of it, which is what makes the
  detector resolution-independent.
- **Pitch is derived, not stored.** Each note keeps its staff position, so
  correcting a misread key signature re-spells the whole piece instantly with no
  second pass over the image. That is what the key-signature buttons do.
- **The clef has to be located before noteheads.** Its bowls are solid ellipses of
  about the right size sitting on staff positions, so without excluding them they
  read as notes.

Turn on **Show detection stages** in dev mode to see the binarised, staff-removed
and eroded bitmaps — which stage a page fails at is otherwise guesswork.

Accuracy is best on flat scans and PDF screenshots, which is what it was built
for. Photos are harder and handwritten music is out of scope. Every failure falls
back to the manual editor with a message rather than an empty screen.

**Where it stands.** Synthetic fixtures pass exactly, and a generated
eleven-system page reads ~270 notes through the real import path. A genuine
engraved flute part does not work yet. The gap between those two facts is the open
problem: the fixtures evidently do not capture whatever real engraving does
differently — likely beam density, ottava brackets and tightly spaced sixteenth
runs. The next step is to diagnose against a real page using the stage bitmaps and
the measurements the recogniser now reports on every run, rather than to keep
guessing at fixtures.

## Not built yet

Note **durations** are neither detected nor stored — the app is a fingering
reference, not a score editor. Repeats, `D.C.` and voltas are ignored, so a piece
with them reads in printed order rather than playing order. Chords are detected
but reduced to their top note, with a warning.
