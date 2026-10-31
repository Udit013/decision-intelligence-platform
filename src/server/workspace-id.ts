import { createHash } from 'node:crypto'

/** sha256(token) shaped as a v4 UUID. The raw token never reaches the database. */
export function workspaceIdFromToken(token: string): string {
  const h = createHash('sha256').update(token).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
