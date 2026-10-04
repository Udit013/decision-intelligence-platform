'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Undo2 } from 'lucide-react'
import { getImportKind } from '@/domains/import-kinds'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { cn } from '@/ui/cn'

export interface ImportRow {
  id: string
  domain: string
  kind: string
  label: string
  status: 'committed' | 'undone' | 'pending'
  rowsTotal: number
  rowsInserted: number
  rowsDuplicate: number
  rowsSkipped: number
  createdAt: string
  undoneAt: string | null
  fileId: string | null
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Every import into this workspace, newest first; each live one can be undone exactly. */
export function ImportHistory({ imports, onChanged, flash }: { imports: ImportRow[]; onChanged: () => void; flash: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function undo(i: ImportRow) {
    const kind = getImportKind(i.kind)
    if (!window.confirm(`Undo "${i.label}"?\n\nThis removes the ${i.rowsInserted.toLocaleString('en-US')} ${kind?.label.toLowerCase() ?? 'rows'} this import added. Other imports are unaffected.`)) return
    setBusy(i.id)
    try {
      const res = await fetch(`/api/data/imports/${i.id}/undo`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      flash(res.ok ? `Undone — removed ${body.undone.removed.toLocaleString('en-US')} rows. Analytics refreshed.` : (body.error ?? `Undo failed (HTTP ${res.status}).`))
    } finally {
      setBusy(null)
      onChanged()
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Import history</CardTitle>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{imports.filter((i) => i.status === 'committed').length} live</span>
      </CardHeader>
      <CardBody>
        {imports.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nothing imported yet. Upload a file, then choose <strong className="font-medium text-fg">Import</strong> on it.</p>
        ) : (
          <ol className="divide-y divide-border">
            {imports.map((i) => {
              const kind = getImportKind(i.kind)
              const live = i.status === 'committed'
              return (
                <li key={i.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3', !live && 'opacity-60', busy === i.id && 'opacity-40')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">{i.label}</span>
                      <Badge tone={live ? 'good' : 'neutral'}>{live ? 'live' : 'undone'}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                      {kind?.label ?? i.kind} → <Link href={`/${i.domain}`} className="underline decoration-border underline-offset-2 hover:text-fg">{i.domain}</Link>
                      {' · '}{fmtDate(i.createdAt)}
                      {i.undoneAt && ` · undone ${fmtDate(i.undoneAt)}`}
                    </p>
                  </div>
                  <p className="font-mono text-[11px] tabular-nums text-muted">
                    <span className="text-fg">{i.rowsInserted.toLocaleString('en-US')}</span> added
                    {i.rowsDuplicate > 0 && ` · ${i.rowsDuplicate.toLocaleString('en-US')} dup`}
                    {i.rowsSkipped > 0 && <span className="text-warn"> · {i.rowsSkipped.toLocaleString('en-US')} invalid</span>}
                  </p>
                  {live && (
                    <button
                      type="button"
                      onClick={() => undo(i)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-bad/40 hover:text-bad disabled:opacity-40"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Undo
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
