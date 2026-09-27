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

const FONT_FAMILY = 'Poppins Medium'
const FONT_SIZE = FRAME_H * 0.068
const FONT_SIZE_MIN = FRAME_H * 0.05
const BASELINE_Y = FRAME_H * 0.93
const LABEL_SIDE_MARGIN = FRAME_W * 0.08
const LABEL_MAX_WIDTH = FRAME_W - LABEL_SIDE_MARGIN * 2
const LABEL_LINE_HEIGHT_RATIO = 1.15

// Themes to render an atlas for: every locale gets both, unconditionally.
const THEMES = ['light', 'dark']

// A gap under ~32 levels between top and bottom leaves too few 8-bit steps for a smooth
// gradient over the card's height and produces visible banding.
const THEME_BACKGROUND_COLORS = {
    light: { top: '#d4f4e5', bottom: '#fcf4e1' },
    dark: { top: '#606060', bottom: '#404040' },
}

const THEME_TEXT_COLORS = {
    light: '#80655a',
    dark: '#e8dcc8',
}

const SHADOW_ELLIPSE = { cx: 128, cy: 304.5, rx: 68, ry: 8.5 }
const SHADOW_COLOR = '#EDCAC3'

const THEME_SHADOW_OPACITY = {
    light: 0.75,
    dark: 0.22,
}

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

async function buildLabelOverlay(label, fontFaceCss, theme) {
    const { fontSize, lines } = await resolveLabelLayout(label, fontFaceCss)
    const textColor = THEME_TEXT_COLORS[theme]

    const textElements =
        lines.length === 1
            ? `<text
                x="${FRAME_W / 2}"
                y="${BASELINE_Y}"
                font-family="${FONT_FAMILY}"
                font-size="${fontSize}"
                fill="${textColor}"
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
                        fill="${textColor}"
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

function hexToRgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16)
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

// A linear gradient quantizes to a visible handful of 8-bit steps over the card's height;
// a blur can't fix this, since blurring a linear ramp converges back to the same ramp and
// re-rounding it to 8-bit reproduces the same steps. A small triangular-distributed random
// offset per pixel (sum of two uniform randoms, less patterned than a single one) breaks up
// the steps into a smooth-looking gradient while staying imperceptible as grain.
const DITHER_NOISE_AMPLITUDE = 4

function triangularNoise(amplitude) {
    return (Math.random() + Math.random() - 1) * amplitude
}

function buildBackgroundBuffer(theme) {
    const { top, bottom } = THEME_BACKGROUND_COLORS[theme]
    const topRgb = hexToRgb(top)
    const bottomRgb = hexToRgb(bottom)
    const channels = 3
    const data = Buffer.alloc(FRAME_W * FRAME_H * channels)

    for (let y = 0; y < FRAME_H; y++) {
        const t = y / (FRAME_H - 1)
        for (let x = 0; x < FRAME_W; x++) {
            const noise = triangularNoise(DITHER_NOISE_AMPLITUDE)
            const rowOffset = (y * FRAME_W + x) * channels
            for (let c = 0; c < channels; c++) {
                const value = topRgb[c] + (bottomRgb[c] - topRgb[c]) * t + noise
                data[rowOffset + c] = Math.max(0, Math.min(255, Math.round(value)))
            }
        }
    }

    return sharp(data, { raw: { width: FRAME_W, height: FRAME_H, channels } }).png().toBuffer()
}

function buildShadowBuffer(theme) {
    const { cx, cy, rx, ry } = SHADOW_ELLIPSE
    const opacity = THEME_SHADOW_OPACITY[theme]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SHADOW_COLOR}" fill-opacity="${opacity}" />
    </svg>`

    return sharp(Buffer.from(svg)).png().toBuffer()
}

async function generateAtlas(lang, theme, cardNames, fontFaceCss) {
    const dictionary = (await import(`../src/i18n/locales/${lang}.json`, { with: { type: 'json' } })).default
    const cardLabels = dictionary.cards
    const backgroundBuffer = await buildBackgroundBuffer(theme)

    const rows = Math.ceil(cardNames.length / COLS)
    const atlasW = COLS * FRAME_W
    const atlasH = rows * FRAME_H

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

        const cardBuffer = await sharp(backgroundBuffer)
            .composite([
                { input: await buildShadowBuffer(theme) },
                { input: imagePath },
                { input: await buildLabelOverlay(label, fontFaceCss, theme) },
            ])
            .toBuffer()

        composites.push({ input: cardBuffer, left, top })
    }

    const imageName = `${ATLAS_NAME}.${lang}.${theme}.webp`

    await sharp({
        create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite(composites)
        .webp({ quality: 90 })
        .toFile(resolve(OUT_DIR, imageName))

    console.log(`Atlas image generated [${lang}/${theme}]: ${cardNames.length} frames → ${atlasW}×${atlasH}px`)
}

/** Frame layout depends only on `cardNames`, never on locale or theme, so it's written once and shared by every webp. */
async function writeAtlasManifest(cardNames) {
    const rows = Math.ceil(cardNames.length / COLS)
    const atlasW = COLS * FRAME_W
    const atlasH = rows * FRAME_H

    const frames = {}
    for (let i = 0; i < cardNames.length; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const left = col * FRAME_W
        const top = row * FRAME_H

        frames[cardNames[i]] = {
            frame: { x: left, y: top, w: FRAME_W, h: FRAME_H },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
            sourceSize: { w: FRAME_W, h: FRAME_H },
        }
    }

    const manifest = {
        frames,
        meta: {
            size: { w: atlasW, h: atlasH },
            scale: 1,
        },
    }

    await writeFile(resolve(OUT_DIR, `${ATLAS_NAME}.json`), JSON.stringify(manifest))
    console.log(`Atlas manifest generated: ${cardNames.length} frames`)
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

async function computeComboKey(lang, theme, sharedKey) {
    const dictionary = (await import(`../src/i18n/locales/${lang}.json`, { with: { type: 'json' } })).default
    return JSON.stringify({
        shared: sharedKey,
        theme,
        cards: dictionary.cards,
        background: THEME_BACKGROUND_COLORS[theme],
        textColor: THEME_TEXT_COLORS[theme],
        shadowOpacity: THEME_SHADOW_OPACITY[theme],
    })
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

    // Every locale × theme combination is a build target, unconditionally: adding
    // a locale or a theme is enough to have it generated, the cache below only
    // skips regenerating a combination whose own inputs haven't changed.
    const combosToGenerate = []
    for (const lang of LANGUAGES) {
        for (const theme of THEMES) {
            const cacheKey = `${lang}.${theme}`
            const comboKey = await computeComboKey(lang, theme, sharedKey)
            nextCache[cacheKey] = comboKey
            if (previousCache[cacheKey] !== comboKey) {
                combosToGenerate.push({ lang, theme })
            }
        }
    }

    // The manifest (frame coordinates) depends only on `cardNames`, so it's a single
    // shared build target instead of one per locale or per locale × theme.
    nextCache.manifest = sharedKey
    const manifestNeedsGeneration = previousCache.manifest !== sharedKey

    if (combosToGenerate.length === 0 && !manifestNeedsGeneration) {
        console.log('Atlas up to date, skipping generation.')
        return
    }

    const fontBase64 = (await readFile(FONT_PATH)).toString('base64')
    const fontFaceCss = `@font-face {
        font-family: '${FONT_FAMILY}';
        src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
    }`

    for (const { lang, theme } of combosToGenerate) {
        await generateAtlas(lang, theme, cardNames, fontFaceCss)
    }

    if (manifestNeedsGeneration) {
        await writeAtlasManifest(cardNames)
    }

    await writeFile(CACHE_PATH, JSON.stringify(nextCache))
}

main().catch((error) => {
    console.error(`Atlas generation failed: ${error.message}`)
    process.exit(1)
})
