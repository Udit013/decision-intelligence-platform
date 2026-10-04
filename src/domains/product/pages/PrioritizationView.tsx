'use client'

import { useMemo, useState } from 'react'
import { rankInitiatives, type InitiativeInput, type ScoringModel } from '../prioritization'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'

const MODELS: { id: ScoringModel; label: string }[] = [
  { id: 'rice', label: 'RICE' },
  { id: 'ice', label: 'ICE' },
  { id: 'wsjf', label: 'WSJF' },
]
const TIER_TONE = { Now: 'good', Next: 'accent', Later: 'neutral', Backlog: 'bad' } as const

/** Interactive model switcher over a fixed initiative list (sample or imported backlog). */
export function PrioritizationView({ items, wsjfEnabled }: { items: InitiativeInput[]; wsjfEnabled: boolean }) {
  const [model, setModel] = useState<ScoringModel>('rice')
  const ranked = useMemo(() => rankInitiatives(model, items), [model, items])

  return (
    <>
      <div className="mb-4 inline-flex rounded-md border border-border bg-surface p-1" role="group" aria-label="Scoring model">
        {MODELS.map((m) => {
          const disabled = m.id === 'wsjf' && !wsjfEnabled
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              aria-pressed={model === m.id}
              title={disabled ? 'Add user value, time criticality and risk reduction columns to your backlog to enable WSJF' : undefined}
              onClick={() => setModel(m.id)}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${model === m.id ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-muted hover:text-fg'} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Initiatives by {model.toUpperCase()} — ranked via core/scoreAndClassify</CardTitle></CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">#</th>
                <th className="py-2">Initiative</th>
                <th className="py-2 text-right">RICE</th>
                <th className="py-2 text-right">ICE</th>
                <th className="py-2 text-right">WSJF</th>
                <th className="py-2 text-right">Priority</th>
                <th className="py-2 text-center">Tier</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((i) => (
                <tr key={i.name} className="border-b border-border/50">
                  <td className="py-2 text-muted">{i.rank}</td>
                  <td className="py-2"><span className="font-medium">{i.name}</span><p className="text-xs text-muted">{i.description}</p></td>
                  <td className={`py-2 text-right tabular-nums ${model === 'rice' ? 'text-fg' : 'text-muted'}`}>{i.rice}</td>
                  <td className={`py-2 text-right tabular-nums ${model === 'ice' ? 'text-fg' : 'text-muted'}`}>{i.ice}</td>
                  <td className={`py-2 text-right tabular-nums ${model === 'wsjf' ? 'text-fg' : 'text-muted'}`}>{i.wsjf ?? '—'}</td>
                  <td className="py-2 text-right tabular-nums">{i.priority}</td>
                  <td className="py-2 text-center"><Badge tone={TIER_TONE[i.tier as keyof typeof TIER_TONE] ?? 'neutral'}>{i.tier}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Priority is the 0–100 normalized score from core/scoreAndClassify for the active model; tiers (Now/Next/Later/Backlog) are its buckets.</p>
        </CardBody>
      </Card>
    </>
  )
}
