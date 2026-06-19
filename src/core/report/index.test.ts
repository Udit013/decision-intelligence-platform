import { describe, it, expect } from 'vitest'
import { buildReportPdf, type ReportDoc } from './index'

const doc: ReportDoc = {
  brand: 'Decision Intelligence',
  title: 'Operations — Executive Report',
  subtitle: 'Weekly summary of demand, inventory, and customer signals.',
  period: 'weekly',
  accent: [34, 211, 238],
  dataNote: 'Real data: UCI Online Retail II',
  sections: [
    {
      kind: 'kpis',
      title: 'Headline KPIs',
      items: [
        { label: 'Revenue', value: '$1.2M', delta: '+8% WoW' },
        { label: 'Orders', value: '3,401' },
        { label: 'AOV', value: '$352' },
        { label: 'Return rate', value: '4.1%' },
      ],
    },
    {
      kind: 'recommendations',
      title: 'Top Decisions',
      items: [
        { title: 'Reorder 12 SKUs', expectedResult: 'Protect $84K revenue', confidence: 0.8, recommendation: 'Place POs now.' },
      ],
    },
    {
      kind: 'table',
      table: { title: 'Top products', columns: ['Product', 'Revenue'], rows: [['Widget', '$10K'], ['Gadget', '$8K']] },
    },
    { kind: 'bullets', title: 'Notes', items: ['Holiday peak approaching.', 'Watch overstock in furniture.'] },
  ],
}

describe('buildReportPdf', () => {
  it('produces a non-empty multi-section PDF without throwing', () => {
    const pdf = buildReportPdf(doc)
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const out = pdf.output('arraybuffer')
    expect(out.byteLength).toBeGreaterThan(500)
  })

  it('paginates when given many sections', () => {
    const big: ReportDoc = {
      ...doc,
      sections: Array.from({ length: 40 }, (_, i) => ({
        kind: 'bullets' as const,
        title: `Section ${i}`,
        items: ['line one', 'line two', 'line three'],
      })),
    }
    const pdf = buildReportPdf(big)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
  })
})
