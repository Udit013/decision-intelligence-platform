/** POST /api/workspace/mode { domain, mode } — remember demo vs. own-data per module. */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { MODE_COOKIE, DATA_MODES, parseModes, serializeModes, type DataMode, type DomainKey } from '@/core/tenancy'

const DOMAINS: DomainKey[] = ['operations', 'market', 'product']

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { domain?: unknown; mode?: unknown } | null
  if (!body || !DOMAINS.includes(body.domain as DomainKey) || !DATA_MODES.includes(body.mode as DataMode)) {
    return NextResponse.json({ error: 'Expected { domain, mode } with mode auto | demo | yours.' }, { status: 400 })
  }
  const jar = await cookies()
  const modes = parseModes(jar.get(MODE_COOKIE)?.value)
  modes[body.domain as DomainKey] = body.mode as DataMode
  const value = serializeModes(modes)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(MODE_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: value ? 60 * 60 * 24 * 400 : 0,
  })
  return res
}
