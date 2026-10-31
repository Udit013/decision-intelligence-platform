import { describe, it, expect } from 'vitest'
import { workspaceIdFromToken } from './workspace-id'
import { DEMO_WORKSPACE_ID } from '@/db/ids'

describe('workspaceIdFromToken', () => {
  const a = 'A'.repeat(43)
  const b = 'B'.repeat(43)
  it('is deterministic and never echoes the token', () => {
    expect(workspaceIdFromToken(a)).toBe(workspaceIdFromToken(a))
    expect(workspaceIdFromToken(a)).not.toContain('AAAA')
  })
  it('gives different workspaces for different tokens', () => {
    expect(workspaceIdFromToken(a)).not.toBe(workspaceIdFromToken(b))
  })
  it('produces a well-formed v4 UUID that can never equal the reserved demo id', () => {
    for (const t of [a, b, 'x'.repeat(43)]) {
      const id = workspaceIdFromToken(t)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(id).not.toBe(DEMO_WORKSPACE_ID)
    }
  })
})
