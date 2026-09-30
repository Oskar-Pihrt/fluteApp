// Renders public/favicon.svg into the PWA and Android icon PNGs.
// Needs rsvg-convert (librsvg). Sizes of the Android files are taken from the
// existing PNGs, so run it after `cap add android`.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const BG = '#191A19'
const root = new URL('..', import.meta.url).pathname
const res = join(root, 'android/app/src/main/res')

const size = (file) => {
  const b = readFileSync(file)
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

// The flute motif from favicon.svg, without the tile, drawn in a 64x64 space.
const motif = `
  <rect x="7" y="28" width="50" height="8" fill="#3A3C3A"/>
  <circle cx="20" cy="32" r="5" fill="#4E9F3D"/>
  <circle cx="33" cy="32" r="5" fill="#4E9F3D"/>
  <circle cx="46" cy="32" r="5" fill="${BG}" stroke="#D8E9A8" stroke-width="1.6"/>
  <ellipse cx="11" cy="32" rx="2.1" ry="3" fill="#101110"/>`

// Motif scaled about the centre, on a w x h canvas; bg=null keeps it transparent.
function svg(w, h, scale, bg) {
  const s = (Math.min(w, h) / 64) * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}
  <g transform="translate(${w / 2} ${h / 2}) scale(${s}) translate(-32 -32)">${motif}</g></svg>`
}

const tmp = mkdtempSync(join(tmpdir(), 'icons-'))
function render(out, w, h, scale, bg) {
  const src = join(tmp, 'in.svg')
  writeFileSync(src, svg(w, h, scale, bg))
  execFileSync('rsvg-convert', ['-w', w, '-h', h, '-o', out, src])
}

// Web / PWA. The tile in favicon.svg is the whole motif at scale 1.
render(join(root, 'public/pwa-192.png'), 192, 192, 1, BG)
render(join(root, 'public/pwa-512.png'), 512, 512, 1, BG)
render(join(root, 'public/pwa-maskable-512.png'), 512, 512, 0.7, BG)

// Android launcher icons and splash screens.
for (const dir of readdirSync(res)) {
  const d = join(res, dir)
  if (dir.startsWith('mipmap-') && !dir.includes('anydpi')) {
    const [w, h] = size(join(d, 'ic_launcher.png'))
    render(join(d, 'ic_launcher.png'), w, h, 0.85, BG)
    render(join(d, 'ic_launcher_round.png'), w, h, 0.7, BG)
    // Adaptive foreground: 108dp canvas, only the inner 66dp is guaranteed visible.
    const [fw, fh] = size(join(d, 'ic_launcher_foreground.png'))
    render(join(d, 'ic_launcher_foreground.png'), fw, fh, 0.6, null)
  } else if (dir.startsWith('drawable') && readdirSync(d).includes('splash.png')) {
    const [w, h] = size(join(d, 'splash.png'))
    render(join(d, 'splash.png'), w, h, 0.35, BG)
  }
}
