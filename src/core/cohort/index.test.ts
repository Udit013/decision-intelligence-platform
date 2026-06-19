import { describe, it, expect } from 'vitest'
import { buildRetentionMatrix, type CohortEntry } from './index'

describe('buildRetentionMatrix', () => {
  it('computes retention rates against cohort size', () => {
    const entries: CohortEntry[] = [
      // cohort 2023-01: 4 users at offset 0
      { entityId: 'u1', cohortKey: '2023-01', periodOffset: 0 },
      { entityId: 'u2', cohortKey: '2023-01', periodOffset: 0 },
      { entityId: 'u3', cohortKey: '2023-01', periodOffset: 0 },
      { entityId: 'u4', cohortKey: '2023-01', periodOffset: 0 },
      // offset 1: 2 of them return
      { entityId: 'u1', cohortKey: '2023-01', periodOffset: 1 },
      { entityId: 'u2', cohortKey: '2023-01', periodOffset: 1 },
      // offset 2: 1 returns
      { entityId: 'u1', cohortKey: '2023-01', periodOffset: 2 },
    ]
    const rows = buildRetentionMatrix(entries)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.size).toBe(4)
    expect(r.cells[0].rate).toBe(1)
    expect(r.cells[1].rate).toBe(0.5)
    expect(r.cells[2].rate).toBe(0.25)
  })

  it('de-duplicates repeated activity within a period', () => {
    const entries: CohortEntry[] = [
      { entityId: 'u1', cohortKey: 'c', periodOffset: 0 },
      { entityId: 'u1', cohortKey: 'c', periodOffset: 1 },
      { entityId: 'u1', cohortKey: 'c', periodOffset: 1 }, // duplicate
    ]
    const rows = buildRetentionMatrix(entries)
    expect(rows[0].size).toBe(1)
    expect(rows[0].cells[1].count).toBe(1)
  })

  it('sorts cohorts chronologically and supports explicit offsets', () => {
    const entries: CohortEntry[] = [
      { entityId: 'a', cohortKey: '2023-02', periodOffset: 0 },
      { entityId: 'b', cohortKey: '2023-01', periodOffset: 0 },
      { entityId: 'b', cohortKey: '2023-01', periodOffset: 7 },
    ]
    const rows = buildRetentionMatrix(entries, [0, 7])
    expect(rows.map((r) => r.cohortKey)).toEqual(['2023-01', '2023-02'])
    expect(rows[0].cells.map((c) => c.offset)).toEqual([0, 7])
    expect(rows[0].cells[1].rate).toBe(1)
  })

  it('returns empty for no entries', () => {
    expect(buildRetentionMatrix([])).toEqual([])
  })
})
