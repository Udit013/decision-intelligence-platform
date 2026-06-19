import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Test the pure core engine and domain logic; UI/app are validated by the Next build.
    include: ['src/core/**/*.test.ts', 'src/domains/**/*.test.ts'],
    environment: 'node',
  },
})
