/** Workspace identity primitives shared by the proxy (edge) and the server. */
export const WORKSPACE_COOKIE = 'csiq_ws'
export const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400 // browsers cap cookies at ~400 days
export const MODE_COOKIE = 'csiq_mode'

/** 32 random bytes, base64url without padding. */
export function isWorkspaceToken(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v)
}

export type DomainKey = 'operations' | 'market' | 'product'
/** auto = your data when you have some, otherwise the demo; demo / yours = forced. */
export type DataMode = 'auto' | 'demo' | 'yours'
export const DATA_MODES: DataMode[] = ['auto', 'demo', 'yours']

export function parseModes(raw: string | undefined): Partial<Record<DomainKey, DataMode>> {
  const out: Partial<Record<DomainKey, DataMode>> = {}
  for (const part of (raw ?? '').split(',')) {
    const [d, m] = part.split(':')
    if ((d === 'operations' || d === 'market' || d === 'product') && (DATA_MODES as string[]).includes(m)) {
      out[d] = m as DataMode
    }
  }
  return out
}

export function serializeModes(modes: Partial<Record<DomainKey, DataMode>>): string {
  return Object.entries(modes)
    .filter(([, m]) => m && m !== 'auto')
    .map(([d, m]) => `${d}:${m}`)
    .join(',')
}

/** What a module should show, given the visitor's preference and whether they have data. */
export function resolveSource(mode: DataMode, hasOwnData: boolean): 'workspace' | 'demo' | 'empty' {
  if (mode === 'demo') return 'demo'
  if (mode === 'yours') return hasOwnData ? 'workspace' : 'empty'
  return hasOwnData ? 'workspace' : 'demo'
}
