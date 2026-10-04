import 'server-only'
import { resolveDataSource } from '@/server/workspace'
import { currencySymbol, money } from './format'

/** Which workspace Operations reads for this visitor, plus a matching money formatter. */
export async function opsSource() {
  const src = await resolveDataSource('operations')
  const symbol = currencySymbol(src.kind)
  return {
    src,
    ws: src.kind === 'empty' ? null : src.workspaceId,
    symbol,
    money: (n: number) => money(n, symbol),
  }
}
