import type { DomainPageProps } from '@/domains/pages'
import { getProductDataset } from '../dataset'
import { RETENTION_OFFSETS } from '../generator'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid, PageHeader, EmptyState } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { FunnelChart, RetentionCurve, CohortHeatmap } from './AnalyticsCharts'

const TAGLINE = 'Activation funnel, D1–D90 retention, feature adoption & engagement segments — all measured.'

export default async function Analytics({ searchParams }: DomainPageProps) {
  const ds = await getProductDataset(searchParams)
  if (!ds.hasEvents) {
    return (
      <>
        <PageHeader title="Funnels & Cohorts" tagline={TAGLINE} />
        <EmptyState domain="product" />
      </>
    )
  }
  const demo = ds.source.kind === 'demo'
  const { matrix, pooled } = ds.retention
  const point = (o: number) => pooled.find((p) => p.offset === o)
  const kpi = (o: number) => {
    const p = point(o)
    return p?.ratePct === null || p === undefined
      ? { value: '—', sub: 'not enough history yet' }
      : { value: `${p.ratePct}%`, sub: demo ? 'measured' : `${p.eligible.toLocaleString('en-US')} users measured` }
  }

  return (
    <>
      <PageHeader title="Funnels & Cohorts" tagline={TAGLINE} />
      {demo && <DemoBanner note={PRODUCT_META.demoNote} />}

      <KpiGrid>
        {[1, 7, 30, 90].map((o) => (
          <Kpi key={o} label={`D${o} retention`} {...kpi(o)} />
        ))}
      </KpiGrid>
      <p className="mt-2 text-xs leading-relaxed text-muted">{ds.retention.definition}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{demo ? 'Activation funnel' : 'Funnel'} (overall {ds.funnel?.overall ?? 0}%)</CardTitle></CardHeader>
          <CardBody>
            {ds.funnel ? <FunnelChart steps={ds.funnel.steps} /> : <p className="text-sm text-muted">Need at least two distinct events to build a funnel.</p>}
            {!demo && ds.eventNames.length >= 2 && (
              <form method="get" className="mt-4 border-t border-border pt-4">
                <p className="kicker">Funnel steps · in order</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <label key={i} className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-4 font-mono">{i + 1}</span>
                      <select
                        name="step"
                        defaultValue={ds.funnelSteps[i] ?? ''}
                        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                      >
                        <option value="">—</option>
                        {ds.eventNames.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <button type="submit" className="btn-line mt-3">Update funnel</button>
                <p className="mt-2 text-[11px] text-muted">A user counts at a step only if they did it after the previous step.</p>
              </form>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Retention curve D1–D90 (measured)</CardTitle></CardHeader>
          <CardBody><RetentionCurve pooled={pooled.filter((p) => p.offset > 0)} /></CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Retention by {demo ? 'signup' : 'first-seen'} cohort</CardTitle></CardHeader>
        <CardBody className="overflow-x-auto"><CohortHeatmap matrix={matrix} offsets={RETENTION_OFFSETS} /></CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{demo ? 'Feature adoption' : 'Event adoption'}</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {ds.adoption.slice(0, 10).map((a) => (
                  <tr key={a.slug} className="border-b border-border/50">
                    <td className="py-1.5">{a.name}{a.isCore && <span className="ml-1 text-[10px] text-muted">core</span>}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{a.users.toLocaleString('en-US')}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.adoptionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Engagement segments (quintiles)</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {ds.segments.map((s) => (
                  <tr key={s.segment} className="border-b border-border/50">
                    <td className="py-1.5">{s.segment}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.count.toLocaleString('en-US')} users</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{s.avgFeatures} {demo ? 'feat' : 'events'} avg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
