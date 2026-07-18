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
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-muted/40 hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="pt-1 text-[13.5px] font-semibold">
              <span className="mr-2 font-mono text-[var(--accent)]">▸</span>
              {m.text}
            </p>
          ) : (
            <div key={i} className="rounded-xl border border-border bg-surface px-4 py-4">
              {m.source && (
                <Badge tone={m.source === 'ollama' ? 'accent' : 'neutral'} className="mb-2">
                  {m.source === 'ollama' ? 'Local model' : 'Deterministic'}
                </Badge>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            </div>
          ),
        )}
        {busy && <p className="kicker py-2">Working…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-surface p-1.5 transition-colors focus-within:border-[var(--accent)]/60"
      >
        <span aria-hidden className="pl-2.5 font-mono text-sm text-[var(--accent)]">▸</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          aria-label="Ask the advisor"
          placeholder="Ask the advisor…"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13.5px] outline-none placeholder:text-muted/70"
        />
        <button type="submit" disabled={busy} className="btn-ink disabled:opacity-50">
          Ask
        </button>
      </form>
    </>
  )
}
