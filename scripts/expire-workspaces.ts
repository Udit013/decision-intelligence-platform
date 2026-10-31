/**
 * Inspect or run workspace expiry by hand.
 *   npx tsx scripts/expire-workspaces.ts            dry run (default): lists what WOULD be deleted
 *   npx tsx scripts/expire-workspaces.ts --apply    actually delete (workspaces inactive ≥ 90 days)
 *   --days=N (≥ 30)  --limit=N
 */
import 'dotenv/config'
import { expireWorkspaces } from '../src/server/expiry'

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const apply = process.argv.includes('--apply')
  const report = await expireWorkspaces({
    dryRun: !apply,
    days: arg('days') ? Number(arg('days')) : undefined,
    limit: arg('limit') ? Number(arg('limit')) : undefined,
  })
  console.log(apply ? 'APPLIED' : 'DRY RUN (nothing deleted — pass --apply to delete)')
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
