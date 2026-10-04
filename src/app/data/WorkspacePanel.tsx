'use client'

import { useState } from 'react'
import { KeyRound, Trash2, Copy, Check } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'

/** Explains the private workspace and offers the recovery link and full erase. */
export function WorkspacePanel() {
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    setError(null)
    const res = await fetch('/api/workspace/link', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return setError(body.error ?? 'Could not create a link.')
    setLink(body.link)
    try {
      await navigator.clipboard.writeText(body.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* clipboard blocked — the link is shown for manual copy */
    }
  }

  async function eraseAll() {
    if (!window.confirm('Delete everything in this workspace — all files, imports and imported rows? This cannot be undone.')) return
    if (!window.confirm('Are you sure? Your private workspace will be erased and a new, empty one started.')) return
    const res = await fetch('/api/workspace', { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return setError(body.error ?? 'Could not delete the workspace.')
    }
    window.location.reload()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Your private workspace</CardTitle></CardHeader>
      <CardBody className="space-y-3 text-xs leading-relaxed text-muted">
        <p>
          Files and imports belong to this browser&apos;s workspace — no account, and nobody else can see them. The sample
          data stays available in every module.
        </p>
        <div>
          <button type="button" onClick={reveal} className="inline-flex items-center gap-1.5 font-medium text-fg underline decoration-border underline-offset-4 hover:decoration-fg">
            {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <KeyRound className="h-3.5 w-3.5" />}
            {copied ? 'Recovery link copied' : 'Copy recovery link'}
          </button>
          {link && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Workspace recovery link" className="min-w-0 flex-1 rounded-md border border-border bg-surface-2/50 px-2 py-1 font-mono text-[10.5px] text-fg outline-none" />
                <button type="button" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(link)} className="rounded-md border border-border p-1 hover:bg-surface-2">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-warn">Anyone with this link can open and change your workspace. Keep it private.</p>
            </div>
          )}
        </div>
        <button type="button" onClick={eraseAll} className="inline-flex items-center gap-1.5 font-medium text-bad underline decoration-bad/30 underline-offset-4 hover:decoration-bad">
          <Trash2 className="h-3.5 w-3.5" /> Delete all my data
        </button>
        {error && <p className="text-bad" role="alert">{error}</p>}
      </CardBody>
    </Card>
  )
}
