'use client'

import { useMemo, useState } from 'react'
import { simulateExpansion, type ScenarioParams } from '../scoring'
import type { Market, CompetitiveData } from '../types'
import { usdFromThousands } from '../format'
import { Chart } from '@/ui/charts/Chart'
import { CHART, ACCENT } from '@/ui/charts/theme'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid } from '@/ui/components/Kpi'

export interface SlimMarket {
  id: string
  name: string
  gdp: number
  opportunityScore: number
  gdpGrowth: number
  riskScore: number
  saturation: number
}

export function ScenarioSimulator({ markets }: { markets: SlimMarket[] }) {
  const [marketId, setMarketId] = useState(markets[0]?.id ?? '')
  const [budget, setBudget] = useState(500)
  const [pricing, setPricing] = useState<ScenarioParams['pricingStrategy']>('mid_market')

  const result = useMemo(() => {
    const m = markets.find((x) => x.id === marketId)
    if (!m) return null
    const market = { gdp: m.gdp, opportunityScore: m.opportunityScore, gdpGrowth: m.gdpGrowth, riskScore: m.riskScore } as Market
    const comp = { marketSaturation: m.saturation, competitorCount: 10 } as CompetitiveData
    return simulateExpansion(market, comp, { budget, teamSize: 10, pricingStrategy: pricing, marketingSpend: budget * 0.3, strategy: 'direct' })
  }, [marketId, budget, pricing, markets])

  return (
    <Card>
      <CardHeader><CardTitle>Scenario inputs (modeled 24-month projection)</CardTitle></CardHeader>
      <CardBody>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Market</span>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="w-full rounded-md border border-border bg-surface px-2 py-1.5 outline-none">
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Budget: {usdFromThousands(budget)}</span>
            <input type="range" min={100} max={5000} step={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Pricing</span>
            <select value={pricing} onChange={(e) => setPricing(e.target.value as ScenarioParams['pricingStrategy'])} className="w-full rounded-md border border-border bg-surface px-2 py-1.5 outline-none">
              <option value="premium">Premium</option>
              <option value="mid_market">Mid-market</option>
              <option value="value">Value</option>
            </select>
          </label>
        </div>

        {result && (
          <>
            <KpiGrid>
              <Kpi label="Yr-1 revenue" value={usdFromThousands(result.expectedRevenue)} estimate />
              <Kpi label="Yr-1 profit" value={usdFromThousands(result.expectedProfit)} estimate />
              <Kpi label="Break-even" value={`${result.breakEvenMonths}mo`} estimate />
              <Kpi label="3-yr ROI" value={`${result.roiProjection}x`} estimate />
            </KpiGrid>
            <div className="mt-5">
              <Chart
                height={300}
                option={{
                  tooltip: { trigger: 'axis' },
                  legend: { data: ['Monthly profit', 'Cumulative'], top: 0, textStyle: { color: CHART.muted } },
                  xAxis: { type: 'category', data: result.projections.map((p) => `M${p.month}`) },
                  yAxis: { type: 'value', splitLine: { lineStyle: { color: CHART.grid } } },
                  series: [
                    { name: 'Monthly profit', type: 'bar', data: result.projections.map((p) => p.profit), itemStyle: { color: ACCENT.violet } },
                    { name: 'Cumulative', type: 'line', data: result.projections.map((p) => p.cumulative), itemStyle: { color: ACCENT.cyan }, smooth: true },
                  ],
                }}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
