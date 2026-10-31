import { describe, it, expect } from 'vitest'
import { isWorkspaceToken, parseModes, serializeModes, resolveSource } from './tenancy'

describe('capability cookie validation', () => {
  const valid = 'A'.repeat(43)
  it('accepts exactly 43 base64url characters', () => {
    expect(isWorkspaceToken(valid)).toBe(true)
    expect(isWorkspaceToken('5PMIqE495pBsoGv4PG3Fyr2-3BzA58l5iKQCMahnGlI')).toBe(true)
  })
  it('rejects wrong length, forbidden characters, and non-strings', () => {
    for (const bad of ['', 'A'.repeat(42), 'A'.repeat(44), valid.slice(1) + '+', valid.slice(1) + '/', valid.slice(1) + '=', ' ' + valid.slice(1), `${valid.slice(1)}\n`, "A'; DROP TABLE x;--".padEnd(43, 'A')]) {
      expect(isWorkspaceToken(bad)).toBe(false)
    }
    for (const bad of [undefined, null, 43, {}, [valid]]) expect(isWorkspaceToken(bad)).toBe(false)
  })
})

describe('data mode cookie', () => {
  it('round-trips, ignoring unknown domains and modes', () => {
    expect(parseModes('market:demo,product:yours')).toEqual({ market: 'demo', product: 'yours' })
    expect(parseModes('market:hacked,evil:demo,operations')).toEqual({})
    expect(serializeModes({ market: 'demo', product: 'auto' })).toBe('market:demo')
  })
  it('resolves the source from preference and available data', () => {
    expect(resolveSource('auto', true)).toBe('workspace')
    expect(resolveSource('auto', false)).toBe('demo')
    expect(resolveSource('demo', true)).toBe('demo')
    expect(resolveSource('yours', false)).toBe('empty')
  })
})
