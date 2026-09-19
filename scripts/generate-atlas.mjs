import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import sharp from 'sharp'
import { CARD_LABELS } from '../src/i18n/locales/card-labels.ts'

const CARDS_DIR = resolve(import.meta.dirname, '..', 'src', 'cards')
const OUT_DIR = resolve(import.meta.dirname, '..', 'src', 'assets')
const FONT_PATH = resolve(import.meta.dirname, 'fonts', 'Poppins-Medium.ttf')
const ATLAS_NAME = 'atlas'

const FRAME_W = 256
const FRAME_H = 382
const COLS = 10

const TEXT_COLOR = '#6E5C4F'
const FONT_FAMILY = 'Poppins Medium'
const FONT_SIZE = FRAME_H * 0.068
const BASELINE_Y = FRAME_H * 0.93

// Languages to render an atlas for. Add a language by adding its key to
// every entry in CARD_LABELS (and to this list).
const LANGUAGES = ['fr', 'en']

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

async function buildLabelOverlay(label, fontFaceCss) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
        <defs><style>${fontFaceCss}</style></defs>
        <text
            x="${FRAME_W / 2}"
            y="${BASELINE_Y}"
            font-family="${FONT_FAMILY}"
            font-size="${FONT_SIZE}"
            fill="${TEXT_COLOR}"
            text-anchor="middle"
        >${escapeXml(label)}</text>
    </svg>`

    return sharp(Buffer.from(svg)).png().toBuffer()
}

async function generateAtlasForLang(lang, files, fontFaceCss) {
    const rows = Math.ceil(files.length / COLS)
    const atlasW = COLS * FRAME_W
    const atlasH = rows * FRAME_H

    const frames = {}
    const composites = []

    for (let i = 0; i < files.length; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const name = basename(files[i], '.webp')
        const left = col * FRAME_W
        const top = row * FRAME_H

        const label = CARD_LABELS[name]?.[lang]
        if (!label) {
            throw new Error(`Missing "${lang}" label for card "${name}"`)
        }

        const cardBuffer = await sharp(resolve(CARDS_DIR, files[i]))
            .composite([{ input: await buildLabelOverlay(label, fontFaceCss) }])
            .toBuffer()

        composites.push({ input: cardBuffer, left, top })

        frames[name] = {
            frame: { x: left, y: top, w: FRAME_W, h: FRAME_H },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
            sourceSize: { w: FRAME_W, h: FRAME_H },
        }
    }

    const imageName = `${ATLAS_NAME}.${lang}.webp`

    await sharp({
        create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite(composites)
        .webp({ quality: 90 })
        .toFile(resolve(OUT_DIR, imageName))

    const manifest = {
        frames,
        meta: {
            image: imageName,
            size: { w: atlasW, h: atlasH },
            scale: 1,
        },
    }

    await writeFile(resolve(OUT_DIR, `${ATLAS_NAME}.${lang}.json`), JSON.stringify(manifest))

    console.log(`Atlas generated [${lang}]: ${files.length} frames → ${atlasW}×${atlasH}px`)
}

async function main() {
    const files = (await readdir(CARDS_DIR))
        .filter((f) => f.endsWith('.webp'))
        .sort()

    const fontBase64 = (await readFile(FONT_PATH)).toString('base64')
    const fontFaceCss = `@font-face {
        font-family: '${FONT_FAMILY}';
        src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
    }`

    for (const lang of LANGUAGES) {
        await generateAtlasForLang(lang, files, fontFaceCss)
    }
}

main()
