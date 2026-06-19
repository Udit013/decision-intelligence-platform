import { buildFunnel, buildRetention, buildAdoption, buildSegments } from '../analytics'
import { RETENTION_OFFSETS } from '../generator'
import { PRODUCT_META } from '../config'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Kpi, KpiGrid, PageHeader } from '@/ui/components/Kpi'
import { DemoBanner } from '@/ui/components/DemoBanner'
import { FunnelChart, RetentionCurve, CohortHeatmap } from './AnalyticsCharts'

export default function Analytics() {
  const funnel = buildFunnel()
  const { matrix, pooled } = buildRetention()
  const adoption = buildAdoption()
  const segments = buildSegments()
  const r = (o: number) => pooled.find((p) => p.offset === o)?.ratePct ?? 0

  return (
    <>
      <PageHeader title="Funnels & Cohorts" tagline="Activation funnel, D1–D90 retention, feature adoption & engagement segments — all measured." />
      <DemoBanner note={PRODUCT_META.demoNote} />

      <KpiGrid>
        <Kpi label="D1 retention" value={`${r(1)}%`} sub="measured" />
        <Kpi label="D7 retention" value={`${r(7)}%`} sub="measured" />
        <Kpi label="D30 retention" value={`${r(30)}%`} sub="measured" />
        <Kpi label="D90 retention" value={`${r(90)}%`} sub="measured" />
      </KpiGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Activation funnel (overall {funnel.overall}%)</CardTitle></CardHeader>
          <CardBody><FunnelChart steps={funnel.steps} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Retention curve D1–D90 (measured)</CardTitle></CardHeader>
          <CardBody><RetentionCurve pooled={pooled} /></CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Retention by signup cohort (via core/cohort)</CardTitle></CardHeader>
        <CardBody><CohortHeatmap matrix={matrix} offsets={RETENTION_OFFSETS} /></CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Feature adoption</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {adoption.slice(0, 8).map((a) => (
                  <tr key={a.slug} className="border-b border-border/50">
                    <td className="py-1.5">{a.name}{a.isCore && <span className="ml-1 text-[10px] text-muted">core</span>}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.adoptionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Engagement segments (core/segmentation)</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {segments.map((s) => (
                  <tr key={s.segment} className="border-b border-border/50">
                    <td className="py-1.5">{s.segment}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.count} users</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{s.avgFeatures} feat avg</td>
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
