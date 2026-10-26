# TimbreMap design manual

How the app looks and why, written down from what it already does. New screens
follow it; when a screen has a reason to break a rule, the reason goes in a
comment next to the exception.

The tokens live in `src/style.css` (`@theme`); everything below is expressed in
the Tailwind classes they generate.

## Principles

- **Dark only.** The app is used in rehearsal rooms and on music stands, next
  to a bright page of music. There is no light theme.
- **Calm surfaces, big notes.** The note name and the fingering chart are the
  largest things on any screen that has them; chrome stays small and quiet.
- **One accent.** Leaf green marks what is selected, pressed or the one thing to
  do next. Never two primary actions on one screen.
- **Sharp edges.** No rounded corners anywhere (below).
- **Film grain.** A 6 % fractal-noise overlay (`body::after`) sits over the
  whole viewport. Don't add other textures, gradients or shadows for depth.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` | `#191a19` | Page background; text on accent |
| `ink-900` | `#1f211f` | Cards, top bar, tab bar, key fill |
| `ink-800` | `#2a2c2a` | Raised or selected rows, progress tracks, hairlines |
| `ink-700` | `#3a3c3a` | Card borders |
| `ink-600` | `#4a4d48` | Button borders, dim text on dark |
| `ink-400` | ink-50 60 % over ink-950 | Secondary text, section labels, inactive tabs |
| `ink-200` | ink-50 88 % over ink-950 | Body text, key outlines |
| `ink-50` | `#d8e9a8` | Headings, note names, emphasis |
| `accent-500` | `#4e9f3d` | Accent pressed / active |
| `accent-400` | `#5fb84a` | Primary buttons, selection, pressed keys, active tab |
| `accent-300` | `#7bc96a` | Accent hover, note dividers, in-tune readouts |

Status colours come from Tailwind's palette, always as a tinted box:

- Warning: `border-amber-500/40 bg-amber-500/10 text-amber-100` (amber-300 for
  inline text, such as "needs checking" or an out-of-tune readout).
- Error: the same in red (`red-500/40`, `red-500/10`, `red-200`).
- Success text: `text-emerald-300`, or the accent for a confirmed note.

Things that must be told apart differ in lightness as well as hue.

## Type

One family, **Noto Serif**, for everything (`font-sans` is mapped to it).
Fingering codes use `font-mono`.

| Role | Classes |
| --- | --- |
| Note name | `NoteBadge` — `sm` text-base, `md` text-2xl, `lg` text-5xl, octave smaller in ink-400 |
| Page title | `h1.text-xl` — 600, ink-50 (set in the base layer) |
| Card title | `h2.text-base` |
| Body | `text-sm text-ink-200` |
| Secondary | `text-sm` or `text-xs text-ink-400` |
| Section label | `text-[11px]`–`text-xs font-semibold uppercase tracking-wider text-ink-400` |
| Tab label | `text-[11px] font-medium` |

## Shape

- **No rounded corners.** `border-radius: 0 !important` applies to every
  element, so `rounded-*` classes do nothing — don't write them in new code.
  Only SVG geometry is round: tone holes, keys, noteheads, the mic icon.
- Borders are 1px. A card is `border border-ink-700 bg-ink-900 p-4`; an
  empty state is `border border-dashed border-ink-700`.
- Selection is a fill (`bg-accent-400 text-ink-950`) or, for the current item
  in a sequence, a 2px accent border.

## Layout

- Phone first: one column, `px-4`, `pt-4`/`pt-5`, sections `gap-3`–`gap-6`.
- A sticky top bar (logo + instrument switch) and a fixed bottom tab bar
  (`--tabbar-height`, plus `--safe-bottom`). From `md` up the tab bar becomes a
  left sidebar holding the instrument switch, and pages may scroll normally.
- **Tool pages fit one phone screen and never scroll** — Fingering, Ear,
  Practice, a note page, an exercise. Their route sets `meta.fit` (the shell
  makes `main` exactly one screen) or `meta.immersive` (full screen, own top
  bar, no tab bar). The view is a `flex min-h-0 flex-1 flex-col` column:
  fixed parts are `shrink-0`, one part takes the rest (`flex-1 min-h-0`), and
  on short screens content shrinks or drops with the `short:` (≤720px) and
  `shorter:` (≤600px) variants rather than overflowing. Fewer items beats a
  scrollbar.
- Lists and editors (Notes, Sheets, Setup) scroll as ordinary pages.

## Components

- **Primary button** — `bg-accent-400 text-ink-950 font-semibold`, hover
  `accent-300`, active `accent-500`; `h-12` when it is the screen's main action.
- **Secondary button** — `border border-ink-600 text-ink-200 text-xs/sm
  font-medium`, hover `border-accent-400`.
- **Segmented switch** — `grid grid-cols-N gap-0.5 border border-ink-700
  bg-ink-950 p-0.5`; the chosen segment filled with the accent.
- **Card**, **empty state** — above.
- **Note chip** — a note in a strip: `border border-ink-700 bg-ink-900`, the
  selected one `border-accent-400 bg-ink-800`; a divider between notes is a
  `w-0.5 bg-accent-300` bar.
- **Key chart** (`KeyChart.vue`) — keys outlined in ink-200 on ink-900;
  pressed keys filled accent-400; partly closed keys half filled; keys the
  instrument lacks at 22 % opacity. One component everywhere, so a fingering
  looks the same on every screen.
- **Progress** — a `h-1.5 bg-ink-800` track with an accent fill.
- **Warning box** — the amber status box above, with a quiet "Dismiss".

## Interaction

- Tap targets are at least 44px (`h-11`/`min-h-11`).
- Tapping leaves no highlight and no focus ring; keyboard focus shows a 2px
  outline (`:focus-visible`). `touch-action: manipulation` removes the
  double-tap delay.
- Motion only where it carries meaning: colour transitions on press, a progress
  bar filling, a tuning marker moving. No decorative animation.

## Icons

24px stroke icons drawn inline: `fill="none" stroke="currentColor"
stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`. They take
the text colour of their context. No emoji in the interface.

## Writing

Short, plain, in the player's words: "Hold the note steady", "Played — next",
"No documented note for this combination". Explain a limitation where it
appears rather than hiding the control.
