import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import sharp from 'sharp'

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

// Emotion label shown on each card, per language. Add a language by adding
// its key to every entry below (and to LANGUAGES).
const LANGUAGES = ['fr', 'en']

const CARD_LABELS = {
    abandonment: { fr: 'Abandon', en: 'Abandonment' },
    acceptance: { fr: 'Acceptation', en: 'Acceptance' },
    hostility: { fr: 'Agressivité', en: 'Hostility' },
    ambivalence: { fr: 'Ambivalence', en: 'Ambivalence' },
    love: { fr: 'Amour', en: 'Love' },
    anguish: { fr: 'Angoisse', en: 'Anguish' },
    anxiety: { fr: 'Anxiété', en: 'Anxiety' },
    belonging: { fr: 'Appartenance', en: 'Belonging' },
    attraction: { fr: 'Attirance', en: 'Attraction' },
    kindness: { fr: 'Bienveillance', en: 'Kindness' },
    calm: { fr: 'Calme', en: 'Calm' },
    sorrow: { fr: 'Chagrin', en: 'Sorrow' },
    anger: { fr: 'Colère', en: 'Anger' },
    compassion: { fr: 'Compassion', en: 'Compassion' },
    concentration: { fr: 'Concentration', en: 'Concentration' },
    confidence: { fr: 'Confiance', en: 'Confidence' },
    confusion: { fr: 'Confusion', en: 'Confusion' },
    courage: { fr: 'Courage', en: 'Courage' },
    guilt: { fr: 'Culpabilité', en: 'Guilt' },
    curiosity: { fr: 'Curiosité', en: 'Curiosity' },
    disconnection: { fr: 'Décalage', en: 'Disconnection' },
    disappointment: { fr: 'Déception', en: 'Disappointment' },
    discouragement: { fr: 'Découragement', en: 'Discouragement' },
    disgust: { fr: 'Dégoût', en: 'Disgust' },
    despair: { fr: 'Désespoir', en: 'Despair' },
    desire: { fr: 'Désir', en: 'Desire' },
    destabilization: { fr: 'Déstabilisation', en: 'Destabilization' },
    detachment: { fr: 'Détachement', en: 'Detachment' },
    determination: { fr: 'Détermination', en: 'Determination' },
    'self-devaluation': { fr: 'Dévalorisation', en: 'Self-devaluation' },
    doubt: { fr: 'Doute', en: 'Doubt' },
    embarrassment: { fr: 'Embarras', en: 'Embarrassment' },
    wonder: { fr: 'Émerveillement', en: 'Wonder' },
    enthusiasm: { fr: 'Enthousiasme', en: 'Enthusiasm' },
    craving: { fr: 'Envie', en: 'Craving' },
    exhaustion: { fr: 'Épuisement', en: 'Exhaustion' },
    hope: { fr: 'Espoir', en: 'Hope' },
    exaltation: { fr: 'Exaltation', en: 'Exaltation' },
    fatigue: { fr: 'Fatigue', en: 'Fatigue' },
    pride: { fr: 'Fierté', en: 'Pride' },
    vagueness: { fr: 'Flou', en: 'Vagueness' },
    fragility: { fr: 'Fragilité', en: 'Fragility' },
    frustration: { fr: 'Frustration', en: 'Frustration' },
    gratitude: { fr: 'Gratitude', en: 'Gratitude' },
    shame: { fr: 'Honte', en: 'Shame' },
    humiliation: { fr: 'Humiliation', en: 'Humiliation' },
    impatience: { fr: 'Impatience', en: 'Impatience' },
    indecision: { fr: 'Indécision', en: 'Indecision' },
    worry: { fr: 'Inquiétude', en: 'Worry' },
    dissatisfaction: { fr: 'Insatisfaction', en: 'Dissatisfaction' },
    insecurity: { fr: 'Insécurité', en: 'Insecurity' },
    inspiration: { fr: 'Inspiration', en: 'Inspiration' },
    jealousy: { fr: 'Jalousie', en: 'Jealousy' },
    joy: { fr: 'Joie', en: 'Joy' },
    weariness: { fr: 'Lassitude', en: 'Weariness' },
    distrust: { fr: 'Méfiance', en: 'Distrust' },
    melancholy: { fr: 'Mélancolie', en: 'Melancholy' },
    motivation: { fr: 'Motivation', en: 'Motivation' },
    nervousness: { fr: 'Nervosité', en: 'Nervousness' },
    passion: { fr: 'Passion', en: 'Passion' },
    fear: { fr: 'Peur', en: 'Fear' },
    pleasure: { fr: 'Plaisir', en: 'Pleasure' },
    pressure: { fr: 'Pression', en: 'Pressure' },
    rage: { fr: 'Rage', en: 'Rage' },
    comfort: { fr: 'Réconfort', en: 'Comfort' },
    regret: { fr: 'Regret', en: 'Regret' },
    rejection: { fr: 'Rejet', en: 'Rejection' },
    remorse: { fr: 'Remords', en: 'Remorse' },
    resignation: { fr: 'Résignation', en: 'Resignation' },
    resilience: { fr: 'Résilience', en: 'Resilience' },
    restraint: { fr: 'Retenue', en: 'Restraint' },
    satisfaction: { fr: 'Satisfaction', en: 'Satisfaction' },
    safety: { fr: 'Sécurité', en: 'Safety' },
    serenity: { fr: 'Sérénité', en: 'Serenity' },
    loneliness: { fr: 'Solitude', en: 'Loneliness' },
    suffering: { fr: 'Souffrance', en: 'Suffering' },
    relief: { fr: 'Soulagement', en: 'Relief' },
    surprise: { fr: 'Surprise', en: 'Surprise' },
    tenderness: { fr: 'Tendresse', en: 'Tenderness' },
    terror: { fr: 'Terreur', en: 'Terror' },
    sadness: { fr: 'Tristesse', en: 'Sadness' },
    resentment: { fr: 'Vexation', en: 'Resentment' },
    emptiness: { fr: 'Vide', en: 'Emptiness' },
    vitality: { fr: 'Vitalité', en: 'Vitality' },
    vulnerability: { fr: 'Vulnérabilité', en: 'Vulnerability' },
}

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
