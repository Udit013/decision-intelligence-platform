/**
 * Capacity limits that keep a public, login-free deployment inside the free
 * Neon tier (512 MB). Per-workspace caps stop one visitor from crowding others;
 * global caps bound the worst case if many anonymous workspaces fill up.
 */
export const IMPORT_ROW_LIMIT = 25_000

/** Max live rows per workspace, by import kind. */
export const WORKSPACE_ROW_CAPS: Record<string, number> = {
  'operations.order_lines': 250_000,
  'product.events': 250_000,
  'market.markets': 2_000,
  'market.competitors': 20_000,
  'product.experiments': 1_000,
  'product.backlog': 2_000,
}

/** Live imported rows across ALL visitor workspaces (sample data excluded). */
export const GLOBAL_IMPORTED_ROW_CAP = 1_000_000
/** Stored upload bytes across all visitor workspaces. */
export const GLOBAL_FILE_BYTES_CAP = 60 * 1024 * 1024

export function rowCapError(kindLabel: string, used: number, incoming: number, cap: number): string | null {
  if (used + incoming <= cap) return null
  return `This import would bring ${kindLabel.toLowerCase()} to ${(used + incoming).toLocaleString('en-US')} rows; the per-workspace limit is ${cap.toLocaleString('en-US')}. Undo an older import or import a smaller file.`
}
