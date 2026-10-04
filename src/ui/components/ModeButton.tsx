'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DataMode, DomainKey } from '@/core/tenancy'
import { cn } from '@/ui/cn'

/** Switches a module between the sample and your own data (stored in a cookie). */
export function ModeButton({ domain, mode, children, className }: { domain: DomainKey; mode: DataMode; children: React.ReactNode; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      className={cn(className ?? 'btn-line', busy && 'opacity-60')}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/workspace/mode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ domain, mode }) })
        router.refresh()
        setBusy(false)
      }}
    >
      {children}
    </button>
  )
}
