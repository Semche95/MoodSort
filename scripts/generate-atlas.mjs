import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { AVAILABLE_LOCALES } from '../src/i18n/locales.ts'

const CARDS_DIR = resolve(import.meta.dirname, '..', 'src', 'cards')
const OUT_DIR = resolve(import.meta.dirname, '..', 'src', 'assets')
const FONT_PATH = resolve(import.meta.dirname, 'fonts', 'Poppins-Medium.ttf')
const ATLAS_NAME = 'atlas'
const CACHE_PATH = resolve(OUT_DIR, '.atlas-cache.json')

const FRAME_W = 256
const FRAME_H = 382
const COLS = 10

const TEXT_COLOR = '#6E5C4F'
const FONT_FAMILY = 'Poppins Medium'
const FONT_SIZE = FRAME_H * 0.068
const FONT_SIZE_MIN = FRAME_H * 0.05
const BASELINE_Y = FRAME_H * 0.93
const LABEL_SIDE_MARGIN = FRAME_W * 0.08
const LABEL_MAX_WIDTH = FRAME_W - LABEL_SIDE_MARGIN * 2
const LABEL_LINE_HEIGHT_RATIO = 1.15

// Languages to render an atlas for: derived from the single locale registry
// (src/i18n/locales.ts), so adding a language there is enough.
const LANGUAGES = AVAILABLE_LOCALES.map((locale) => locale.code)

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

async function measureTextWidth(text, fontSize, fontFaceCss) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W * 4}" height="${FRAME_H}">
        <defs><style>${fontFaceCss}</style></defs>
        <text x="0" y="${BASELINE_Y}" font-family="${FONT_FAMILY}" font-size="${fontSize}">${escapeXml(text)}</text>
    </svg>`

    const { info } = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true })
    return info.width
}

function splitLabelIntoTwoLines(label) {
    const middle = label.length / 2
    let bestSpaceIndex = -1
    let bestDistance = Infinity

    for (let i = 0; i < label.length; i++) {
        if (label[i] !== ' ') continue
        const distance = Math.abs(i - middle)
        if (distance < bestDistance) {
            bestDistance = distance
            bestSpaceIndex = i
        }
    }

    if (bestSpaceIndex !== -1) {
        return [label.slice(0, bestSpaceIndex), label.slice(bestSpaceIndex + 1)]
    }

    const cut = Math.round(middle)
    return [label.slice(0, cut), label.slice(cut)]
}

async function resolveLabelLayout(label, fontFaceCss) {
    for (let fontSize = FONT_SIZE; fontSize >= FONT_SIZE_MIN; fontSize--) {
        const width = await measureTextWidth(label, fontSize, fontFaceCss)
        if (width <= LABEL_MAX_WIDTH) return { fontSize, lines: [label] }
    }

    return { fontSize: FONT_SIZE_MIN, lines: splitLabelIntoTwoLines(label) }
}

async function buildLabelOverlay(label, fontFaceCss) {
    const { fontSize, lines } = await resolveLabelLayout(label, fontFaceCss)

    const textElements =
        lines.length === 1
            ? `<text
                x="${FRAME_W / 2}"
                y="${BASELINE_Y}"
                font-family="${FONT_FAMILY}"
                font-size="${fontSize}"
                fill="${TEXT_COLOR}"
                text-anchor="middle"
            >${escapeXml(lines[0])}</text>`
            : lines
                  .map((line, i) => {
                      const lineHeight = fontSize * LABEL_LINE_HEIGHT_RATIO
                      const y = BASELINE_Y + (i - 0.5) * lineHeight
                      return `<text
                        x="${FRAME_W / 2}"
                        y="${y}"
                        font-family="${FONT_FAMILY}"
                        font-size="${fontSize}"
                        fill="${TEXT_COLOR}"
                        text-anchor="middle"
                    >${escapeXml(line)}</text>`
                  })
                  .join('')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
        <defs><style>${fontFaceCss}</style></defs>
        ${textElements}
    </svg>`

    return sharp(Buffer.from(svg)).png().toBuffer()
}

async function generateAtlasForLang(lang, cardNames, fontFaceCss) {
    const dictionary = (await import(`../src/i18n/locales/${lang}.json`, { with: { type: 'json' } })).default
    const cardLabels = dictionary.cards

    const rows = Math.ceil(cardNames.length / COLS)
    const atlasW = COLS * FRAME_W
    const atlasH = rows * FRAME_H

    const frames = {}
    const composites = []

    for (let i = 0; i < cardNames.length; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const name = cardNames[i]
        const left = col * FRAME_W
        const top = row * FRAME_H

        const label = cardLabels[name]
        if (!label) {
            throw new Error(`Missing "${lang}" label for card "${name}"`)
        }

        const imagePath = resolve(CARDS_DIR, `${name}.webp`)
        const imageExists = await stat(imagePath).then(
            () => true,
            () => false,
        )
        if (!imageExists) {
            throw new Error(`Missing image file for card "${name}" (expected src/cards/${name}.webp)`)
        }

        const cardBuffer = await sharp(imagePath)
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

    console.log(`Atlas generated [${lang}]: ${cardNames.length} frames → ${atlasW}×${atlasH}px`)
}

async function computeSharedKey(cardNames) {
    const cardStats = await Promise.all(
        cardNames.map(async (name) => {
            const { mtimeMs, size } = await stat(resolve(CARDS_DIR, `${name}.webp`)).catch(() => {
                throw new Error(`Missing image file for card "${name}" (expected src/cards/${name}.webp)`)
            })
            return `${name}:${mtimeMs}:${size}`
        }),
    )

    const fontStat = await stat(FONT_PATH)

    return JSON.stringify({
        cards: cardStats,
        font: `${fontStat.mtimeMs}:${fontStat.size}`,
    })
}

async function computeLangKey(lang, sharedKey) {
    const dictionary = (await import(`../src/i18n/locales/${lang}.json`, { with: { type: 'json' } })).default
    return JSON.stringify({ shared: sharedKey, cards: dictionary.cards })
}

async function readCache() {
    const raw = await readFile(CACHE_PATH, 'utf-8').catch(() => null)
    if (!raw) return {}
    try {
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

async function main() {
    const referenceDictionary = (
        await import(`../src/i18n/locales/${LANGUAGES[0]}.json`, { with: { type: 'json' } })
    ).default
    const cardNames = Object.keys(referenceDictionary.cards).sort()

    const sharedKey = await computeSharedKey(cardNames)
    const previousCache = await readCache()
    const nextCache = {}

    const langsToGenerate = []
    for (const lang of LANGUAGES) {
        const langKey = await computeLangKey(lang, sharedKey)
        nextCache[lang] = langKey
        if (previousCache[lang] !== langKey) {
            langsToGenerate.push(lang)
        }
    }

    if (langsToGenerate.length === 0) {
        console.log('Atlas up to date, skipping generation.')
        return
    }

    const fontBase64 = (await readFile(FONT_PATH)).toString('base64')
    const fontFaceCss = `@font-face {
        font-family: '${FONT_FAMILY}';
        src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
    }`

    for (const lang of langsToGenerate) {
        await generateAtlasForLang(lang, cardNames, fontFaceCss)
    }

    await writeFile(CACHE_PATH, JSON.stringify(nextCache))
}

main().catch((error) => {
    console.error(`Atlas generation failed: ${error.message}`)
    process.exit(1)
})
