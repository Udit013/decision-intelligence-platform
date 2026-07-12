'use client'

import { useState } from 'react'
import { Badge } from './Badge'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  source?: 'ollama' | 'deterministic'
}

/**
 * Advisor console — a transcript, not a chat bubble UI. User entries read as
 * queries (mono, prefixed ▸); answers as ruled analyst notes with their source
 * tagged. Posts {question} to `endpoint`, expects {text, source}.
 */
export function AdvisorChat({ endpoint, suggestions }: { endpoint: string; suggestions: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function ask(q: string) {
    if (!q.trim() || busy) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', text: data.text, source: data.source }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Something went wrong reaching the advisor.', source: 'deterministic' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {messages.length === 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-fg hover:text-fg"
            >
              ▸ {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-0">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="border-t border-border py-3 font-mono text-[13px] font-medium">
              <span className="mr-2 text-[var(--accent)]">▸</span>
              {m.text}
            </p>
          ) : (
            <div key={i} className="border-t border-border bg-surface px-4 py-4" style={{ boxShadow: 'inset 2px 0 0 var(--accent)' }}>
              {m.source && (
                <Badge tone={m.source === 'ollama' ? 'accent' : 'neutral'} className="mb-2">
                  {m.source === 'ollama' ? 'Local model' : 'Deterministic'}
                </Badge>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            </div>
          ),
        )}
        {busy && <p className="border-t border-border py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Working…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="mt-5 flex border border-fg"
      >
        <span aria-hidden className="flex items-center pl-3 font-mono text-sm text-[var(--accent)]">▸</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          aria-label="Ask the advisor"
          placeholder="Ask the advisor…"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[13px] outline-none placeholder:text-muted/70"
        />
        <button type="submit" disabled={busy} className="btn-ink border-y-0 border-r-0 disabled:opacity-50">
          Ask
        </button>
      </form>
    </>
  )
}
