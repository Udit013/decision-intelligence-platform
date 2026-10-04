/**
 * Content keys for de-duplication (server-only: uses node:crypto).
 *
 * Event-style rows have no natural id, and genuinely repeated rows are legal
 * (the same SKU twice on one invoice). Each row's key is therefore
 * sha256(fields + occurrence index of that exact field tuple within the file):
 * re-importing an overlapping file yields the same keys and is skipped by the
 * database's unique index, while in-file repeats are preserved.
 */
import { createHash } from 'node:crypto'

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

export function occurrenceKeys(tuples: string[][]): string[] {
  const seen = new Map<string, number>()
  return tuples.map((t) => {
    const base = t.join('\u001f')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return sha256Hex(`${base}\u001e${n}`)
  })
}
