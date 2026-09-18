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
    abandon: { fr: 'Abandon', en: 'Abandonment' },
    acceptation: { fr: 'Acceptation', en: 'Acceptance' },
    agressivite: { fr: 'Agressivité', en: 'Hostility' },
    ambivalence: { fr: 'Ambivalence', en: 'Ambivalence' },
    amour: { fr: 'Amour', en: 'Love' },
    angoisse: { fr: 'Angoisse', en: 'Anguish' },
    anxiete: { fr: 'Anxiété', en: 'Anxiety' },
    appartenance: { fr: 'Appartenance', en: 'Belonging' },
    attirance: { fr: 'Attirance', en: 'Attraction' },
    bienveillance: { fr: 'Bienveillance', en: 'Kindness' },
    calme: { fr: 'Calme', en: 'Calm' },
    chagrin: { fr: 'Chagrin', en: 'Sorrow' },
    colere: { fr: 'Colère', en: 'Anger' },
    compassion: { fr: 'Compassion', en: 'Compassion' },
    concentration: { fr: 'Concentration', en: 'Concentration' },
    confiance: { fr: 'Confiance', en: 'Confidence' },
    confusion: { fr: 'Confusion', en: 'Confusion' },
    courage: { fr: 'Courage', en: 'Courage' },
    culpabilite: { fr: 'Culpabilité', en: 'Guilt' },
    curiosite: { fr: 'Curiosité', en: 'Curiosity' },
    decalage: { fr: 'Décalage', en: 'Disconnection' },
    deception: { fr: 'Déception', en: 'Disappointment' },
    decouragement: { fr: 'Découragement', en: 'Discouragement' },
    degout: { fr: 'Dégoût', en: 'Disgust' },
    desespoir: { fr: 'Désespoir', en: 'Despair' },
    desir: { fr: 'Désir', en: 'Desire' },
    destabilisation: { fr: 'Déstabilisation', en: 'Destabilization' },
    detachement: { fr: 'Détachement', en: 'Detachment' },
    determination: { fr: 'Détermination', en: 'Determination' },
    devalorisation: { fr: 'Dévalorisation', en: 'Self-devaluation' },
    doute: { fr: 'Doute', en: 'Doubt' },
    embarras: { fr: 'Embarras', en: 'Embarrassment' },
    emerveillement: { fr: 'Émerveillement', en: 'Wonder' },
    enthousiasme: { fr: 'Enthousiasme', en: 'Enthusiasm' },
    envie: { fr: 'Envie', en: 'Craving' },
    epuisement: { fr: 'Épuisement', en: 'Exhaustion' },
    espoir: { fr: 'Espoir', en: 'Hope' },
    exaltation: { fr: 'Exaltation', en: 'Exaltation' },
    fatigue: { fr: 'Fatigue', en: 'Fatigue' },
    fierte: { fr: 'Fierté', en: 'Pride' },
    flou: { fr: 'Flou', en: 'Vagueness' },
    fragilite: { fr: 'Fragilité', en: 'Fragility' },
    frustration: { fr: 'Frustration', en: 'Frustration' },
    gratitude: { fr: 'Gratitude', en: 'Gratitude' },
    honte: { fr: 'Honte', en: 'Shame' },
    humiliation: { fr: 'Humiliation', en: 'Humiliation' },
    impatience: { fr: 'Impatience', en: 'Impatience' },
    indecision: { fr: 'Indécision', en: 'Indecision' },
    inquietude: { fr: 'Inquiétude', en: 'Worry' },
    insatisfaction: { fr: 'Insatisfaction', en: 'Dissatisfaction' },
    insecurite: { fr: 'Insécurité', en: 'Insecurity' },
    inspiration: { fr: 'Inspiration', en: 'Inspiration' },
    jalousie: { fr: 'Jalousie', en: 'Jealousy' },
    joie: { fr: 'Joie', en: 'Joy' },
    lassitude: { fr: 'Lassitude', en: 'Weariness' },
    mefiance: { fr: 'Méfiance', en: 'Distrust' },
    melancolie: { fr: 'Mélancolie', en: 'Melancholy' },
    motivation: { fr: 'Motivation', en: 'Motivation' },
    nervosite: { fr: 'Nervosité', en: 'Nervousness' },
    passion: { fr: 'Passion', en: 'Passion' },
    peur: { fr: 'Peur', en: 'Fear' },
    plaisir: { fr: 'Plaisir', en: 'Pleasure' },
    pression: { fr: 'Pression', en: 'Pressure' },
    rage: { fr: 'Rage', en: 'Rage' },
    reconfort: { fr: 'Réconfort', en: 'Comfort' },
    regret: { fr: 'Regret', en: 'Regret' },
    rejet: { fr: 'Rejet', en: 'Rejection' },
    remords: { fr: 'Remords', en: 'Remorse' },
    resignation: { fr: 'Résignation', en: 'Resignation' },
    resilience: { fr: 'Résilience', en: 'Resilience' },
    retenue: { fr: 'Retenue', en: 'Restraint' },
    satisfaction: { fr: 'Satisfaction', en: 'Satisfaction' },
    securite: { fr: 'Sécurité', en: 'Safety' },
    serenite: { fr: 'Sérénité', en: 'Serenity' },
    solitude: { fr: 'Solitude', en: 'Loneliness' },
    souffrance: { fr: 'Souffrance', en: 'Suffering' },
    soulagement: { fr: 'Soulagement', en: 'Relief' },
    surprise: { fr: 'Surprise', en: 'Surprise' },
    tendresse: { fr: 'Tendresse', en: 'Tenderness' },
    terreur: { fr: 'Terreur', en: 'Terror' },
    tristesse: { fr: 'Tristesse', en: 'Sadness' },
    vexation: { fr: 'Vexation', en: 'Resentment' },
    vide: { fr: 'Vide', en: 'Emptiness' },
    vitalite: { fr: 'Vitalité', en: 'Vitality' },
    vulnerabilite: { fr: 'Vulnérabilité', en: 'Vulnerability' },
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
