import type { UserConfig } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    server: {
        allowedHosts: [],
        port: 5170,
    },
    build: {
        assetsInlineLimit: 0,
    },
    test: {
        globals: true,
        environment: 'jsdom',
    },
}) satisfies UserConfig
