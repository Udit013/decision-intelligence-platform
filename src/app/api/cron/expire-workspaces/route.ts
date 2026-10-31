/**
 * GET /api/cron/expire-workspaces — daily Vercel Cron job.
 *
 * Fails closed: without CRON_SECRET configured it refuses to run, and the
 * bearer token must match (constant-time). Deletes workspaces inactive for 90
 * days (see src/server/expiry.ts). `?dryRun=1` reports without deleting.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { expireWorkspaces } from '@/server/expiry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(header: string | null, secret: string) {
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron is not configured.' }, { status: 503 })
  if (!authorized(req.headers.get('authorization'), secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
    const report = await expireWorkspaces({ dryRun })
    console.info('[cron] expire-workspaces', JSON.stringify({ ...report, candidates: report.candidates.length }))
    return NextResponse.json(report)
  } catch (e) {
    console.error('[cron] expire-workspaces failed', e)
    return NextResponse.json({ error: 'Expiry run failed.' }, { status: 500 })
  }
}
