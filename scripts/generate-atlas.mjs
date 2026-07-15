import { readdir } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import sharp from 'sharp'

const CARDS_DIR = resolve(import.meta.dirname, '..', 'src', 'cards')
const OUT_DIR = resolve(import.meta.dirname, '..', 'src', 'assets')
const ATLAS_NAME = 'atlas'

const FRAME_W = 256
const FRAME_H = 382
const COLS = 10

async function main() {
    const files = (await readdir(CARDS_DIR))
        .filter((f) => f.endsWith('.webp'))
        .sort()

    const rows = Math.ceil(files.length / COLS)
    const atlasW = COLS * FRAME_W
    const atlasH = rows * FRAME_H

    const frames = {}
    const composites = []

    for (let i = 0; i < files.length; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const name = basename(files[i], '.webp')

        composites.push({
            input: resolve(CARDS_DIR, files[i]),
            left: col * FRAME_W,
            top: row * FRAME_H,
        })

        frames[name] = {
            frame: { x: col * FRAME_W, y: row * FRAME_H, w: FRAME_W, h: FRAME_H },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
            sourceSize: { w: FRAME_W, h: FRAME_H },
        }
    }

    await sharp({
        create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite(composites)
        .webp({ quality: 90 })
        .toFile(resolve(OUT_DIR, `${ATLAS_NAME}.webp`))

    const manifest = {
        frames,
        meta: {
            image: `${ATLAS_NAME}.webp`,
            size: { w: atlasW, h: atlasH },
            scale: 1,
        },
    }

    const { writeFile } = await import('node:fs/promises')
    await writeFile(resolve(OUT_DIR, `${ATLAS_NAME}.json`), JSON.stringify(manifest))

    console.log(`Atlas generated: ${files.length} frames → ${atlasW}×${atlasH}px`)
}

main()
