import { getCategoryComparison } from '../data'
import { assembleRootCause } from '../rootcause'
import { gbp } from '../format'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { PageHeader, EmptyState } from '@/ui/components/Kpi'

export default async function RootCause() {
  let rc = null
  try {
    const cats = await getCategoryComparison(90)
    if (cats.length && cats.some((c) => c.current || c.prior)) rc = assembleRootCause({ metricLabel: 'Revenue', categories: cats })
  } catch {
    rc = null
  }
  if (!rc) {
    return (
      <>
        <PageHeader title="Root Cause" tagline="What drove the revenue change." />
        <EmptyState />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Root Cause" tagline="Decomposes the last 90 days of revenue vs the prior 90 by category." />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{rc.summary}</CardTitle>
          <Badge tone={rc.changePct >= 0 ? 'good' : 'bad'}>{rc.changePct >= 0 ? '+' : ''}{rc.changePct}%</Badge>
        </CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                <th className="py-2">Driver</th>
                <th className="py-2 text-right">Prior</th>
                <th className="py-2 text-right">Current</th>
                <th className="py-2 text-right">Change</th>
                <th className="py-2 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {rc.drivers.map((d) => (
                <tr key={`${d.dimension}-${d.name}`} className="border-b border-border/50">
                  <td className="py-2"><span className="text-muted">{d.dimension}:</span> {d.name}</td>
                  <td className="py-2 text-right tabular-nums">{gbp(d.prior)}</td>
                  <td className="py-2 text-right tabular-nums">{gbp(d.current)}</td>
                  <td className={`py-2 text-right tabular-nums ${d.change >= 0 ? 'text-good' : 'text-bad'}`}>{gbp(d.change)}</td>
                  <td className="py-2 text-right tabular-nums">{d.contributionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 space-y-1">
            {rc.recommendations.map((r, i) => (
              <p key={i} className="text-sm text-muted">• {r}</p>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  )
}
