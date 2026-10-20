// Renders the logo (public/logo.png) into the favicon, the PWA icons and the
// Android launcher icons and splash screens.
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

const logoFile = join(root, 'public/logo.png')
const [logoW, logoH] = size(logoFile)
const logo = `data:image/png;base64,${readFileSync(logoFile).toString('base64')}`

// The logo centred on a w x h canvas, its longer side `scale` of the shorter
// canvas side; bg=null keeps it transparent.
function svg(w, h, scale, bg) {
  const s = (Math.min(w, h) * scale) / Math.max(logoW, logoH)
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}
  <image x="${(w - logoW * s) / 2}" y="${(h - logoH * s) / 2}" width="${logoW * s}" height="${logoH * s}" xlink:href="${logo}"/></svg>`
}

const tmp = mkdtempSync(join(tmpdir(), 'icons-'))
function render(out, w, h, scale, bg) {
  const src = join(tmp, 'in.svg')
  writeFileSync(src, svg(w, h, scale, bg))
  execFileSync('rsvg-convert', ['-w', w, '-h', h, '-o', out, src])
}

// Web / PWA. The favicon is transparent, so it sits on any tab colour.
render(join(root, 'public/favicon-64.png'), 64, 64, 0.95, null)
render(join(root, 'public/apple-touch-icon.png'), 180, 180, 0.75, BG)
render(join(root, 'public/pwa-192.png'), 192, 192, 0.8, BG)
render(join(root, 'public/pwa-512.png'), 512, 512, 0.8, BG)
// Maskable icons may be cropped to a circle: keep inside the 80 % safe zone.
render(join(root, 'public/pwa-maskable-512.png'), 512, 512, 0.6, BG)

// Android launcher icons and splash screens.
for (const dir of readdirSync(res)) {
  const d = join(res, dir)
  if (dir.startsWith('mipmap-') && !dir.includes('anydpi')) {
    const [w, h] = size(join(d, 'ic_launcher.png'))
    render(join(d, 'ic_launcher.png'), w, h, 0.75, BG)
    render(join(d, 'ic_launcher_round.png'), w, h, 0.6, BG)
    // Adaptive foreground: 108dp canvas, only the inner 66dp is guaranteed visible.
    const [fw, fh] = size(join(d, 'ic_launcher_foreground.png'))
    render(join(d, 'ic_launcher_foreground.png'), fw, fh, 0.55, null)
  } else if (dir.startsWith('drawable') && readdirSync(d).includes('splash.png')) {
    const [w, h] = size(join(d, 'splash.png'))
    render(join(d, 'splash.png'), w, h, 0.3, BG)
  }
}
