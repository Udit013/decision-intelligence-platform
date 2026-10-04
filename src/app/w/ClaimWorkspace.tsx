'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/** Reads the token from the URL fragment (never sent to the server in the URL) and claims it. */
export function ClaimWorkspace() {
  const [state, setState] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = window.location.hash.slice(1)
    history.replaceState(null, '', '/w')
    fetch('/api/workspace/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) return window.location.replace('/data')
        setMessage(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not open this workspace.')
        setState('error')
      })
      .catch(() => {
        setMessage('Network error — check your connection and open the link again.')
        setState('error')
      })
  }, [])

  return (
    <div>
      <p className="kicker">Private workspace</p>
      <h1 className="mt-3 font-display text-[26px] font-medium leading-tight">
        {state === 'working' ? 'Opening your workspace…' : 'That link didn’t work'}
      </h1>
      {state === 'error' && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
          <Link href="/data" className="btn-line mt-6">
            Go to the data manager
          </Link>
        </>
      )}
    </div>
  )
}
