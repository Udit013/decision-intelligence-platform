'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Card, CardBody } from './Card'
import { Badge } from './Badge'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  source?: 'ollama' | 'deterministic'
}

/** Reusable advisor chat — posts {question} to `endpoint`, expects {text, source}. */
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
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
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
        <div className="mb-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {messages.map((m, i) => (
          <Card key={i} className={m.role === 'user' ? 'ml-auto max-w-[80%] bg-surface-2' : 'mr-auto max-w-[85%]'}>
            <CardBody className="py-3">
              {m.role === 'assistant' && m.source && (
                <Badge tone={m.source === 'ollama' ? 'accent' : 'neutral'} className="mb-2">{m.source === 'ollama' ? 'local model' : 'deterministic'}</Badge>
              )}
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
            </CardBody>
          </Card>
        ))}
        {busy && <p className="text-sm text-muted">Thinking…</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the advisor…" className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-sm text-[var(--accent)] disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  )
}
