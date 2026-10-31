import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': src('./src'),
      'server-only': src('./src/test/server-only.ts'),
    },
  },
  test: {
    // Pure core/domain logic, plus server & route tests. DB-backed suites need
    // TEST_DATABASE_URL (a migrated Postgres) and skip themselves without it.
    include: [
      'src/core/**/*.test.ts',
      'src/domains/**/*.test.ts',
      'src/server/**/*.test.ts',
      'src/app/api/**/*.test.ts',
      'src/proxy.test.ts',
    ],
    environment: 'node',
    // DB suites share one database and clean up after themselves; run files serially.
    fileParallelism: false,
  },
})
