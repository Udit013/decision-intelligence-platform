'use client'

import { useMemo, useState } from 'react'
import { rankInitiatives, type ScoringModel } from '../prioritization'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'

const MODELS: { id: ScoringModel; label: string }[] = [
  { id: 'rice', label: 'RICE' },
  { id: 'ice', label: 'ICE' },
  { id: 'wsjf', label: 'WSJF' },
]
const TIER_TONE = { Now: 'good', Next: 'accent', Later: 'neutral', Backlog: 'bad' } as const

export default function Prioritization() {
  const [model, setModel] = useState<ScoringModel>('rice')
  const ranked = useMemo(() => rankInitiatives(model), [model])

  return (
    <>
      <PageHeader title="Prioritization" tagline="RICE · ICE · WSJF — ranked & tiered by the shared scoring engine." />
      <DemoBanner note={PRODUCT_META.demoNote} />

      <div className="mb-4 inline-flex rounded-md border border-border bg-surface p-1">
        {MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${model === m.id ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-muted hover:text-fg'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Initiatives by {model.toUpperCase()} — ranked via core/scoreAndClassify</CardTitle></CardHeader>
        <CardBody>
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
                  <td className={`py-2 text-right tabular-nums ${model === 'wsjf' ? 'text-fg' : 'text-muted'}`}>{i.wsjf}</td>
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
