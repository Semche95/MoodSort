import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const OUT_DIR = resolve(import.meta.dirname, '..', 'src', 'assets', 'icons')
const LUCIDE_DIR = resolve(
    import.meta.dirname,
    '..',
    'node_modules',
    'lucide-static',
    'icons',
)

// Toolbar icons, one file per icon. No atlas needed: each is rendered once.
const ICON_NAMES = ['undo-2', 'redo-2', 'sliders-horizontal']
// Source resolution keeps the icons crisp on retina displays even though they
// are rendered at ~20-24px in the buttons.
const ICON_SIZE = 64
// Icons are rasterized white so the colour can be controlled via Sprite.tint.
const ICON_COLOR = '#ffffff'

async function main() {
    await mkdir(OUT_DIR, { recursive: true })

    for (const name of ICON_NAMES) {
        const raw = await readFile(resolve(LUCIDE_DIR, `${name}.svg`), 'utf8')
        const svg = raw.replace(/currentColor/g, ICON_COLOR)

        const webp = await sharp(Buffer.from(svg))
            .resize(ICON_SIZE, ICON_SIZE)
            .webp({ quality: 100, lossless: true })
            .toBuffer()

        await writeFile(resolve(OUT_DIR, `${name}.webp`), webp)
        console.log(`Icon written: src/assets/icons/${name}.webp (${ICON_SIZE}×${ICON_SIZE})`)
    }
}

main()