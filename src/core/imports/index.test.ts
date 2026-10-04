import { describe, it, expect } from 'vitest'
import { autoMap, mappingProblems, naturalKey, parseDate, parseNumber, sanitizeMapping, suggestKind, validateRows } from './index'
import { occurrenceKeys } from './keys'
import { rowCapError, WORKSPACE_ROW_CAPS } from './limits'
import { IMPORT_KINDS, MARKET_INDICATORS, PRODUCT_EVENTS, PRODUCT_EXPERIMENTS } from '@/domains/import-kinds'

describe('parseNumber', () => {
  it('accepts common spreadsheet number formats', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber('$1,200')).toBe(1200)
    expect(parseNumber('12%')).toBe(12)
    expect(parseNumber('(45)')).toBe(-45)
    expect(parseNumber(' 7 ')).toBe(7)
    expect(parseNumber(3)).toBe(3)
  })
  it('rejects text and ambiguous values instead of coercing them', () => {
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1,2,3')).toBeNaN()
    expect(parseNumber('12abc')).toBeNaN()
    expect(parseNumber(true)).toBeNaN()
  })
})

describe('parseDate', () => {
  const now = Date.UTC(2026, 0, 1)
  it('accepts Date objects and ISO strings', () => {
    expect(parseDate('2025-03-01T10:00:00Z', now)?.toISOString()).toBe('2025-03-01T10:00:00.000Z')
    expect(parseDate(new Date('2024-01-01'), now)).toBeInstanceOf(Date)
  })
  it('rejects garbage, bare serial numbers, and implausible years', () => {
    expect(parseDate('not a date', now)).toBeNull()
    expect(parseDate(45000, now)).toBeNull()
    expect(parseDate('1899-01-01', now)).toBeNull()
    expect(parseDate('2099-01-01', now)).toBeNull()
  })
})

describe('mapping', () => {
  it('auto-maps headers by alias and never maps one column twice', () => {
    const m = autoMap(['user_id', 'Event Name', 'time', 'Plan'], PRODUCT_EVENTS.fields)
    expect(m).toEqual({ userId: 'user_id', event: 'Event Name', timestamp: 'time', plan: 'Plan' })
  })
  it('drops mapping entries that name unknown fields or columns', () => {
    expect(sanitizeMapping({ userId: 'nope', event: 'Event', bogus: 'Event' }, ['Event'], PRODUCT_EVENTS.fields)).toEqual({ event: 'Event' })
  })
  it('enforces the minimum-indicator rule for markets', () => {
    const m = autoMap(['Country', 'GDP'], MARKET_INDICATORS.fields)
    expect(mappingProblems(m, MARKET_INDICATORS).join(' ')).toMatch(/at least 3 indicator/)
  })
  it('flags a column mapped to two fields', () => {
    expect(mappingProblems({ userId: 'a', event: 'a', timestamp: 'b' }, PRODUCT_EVENTS)[0]).toMatch(/more than one field/)
  })
  it('suggests the kind that fits the columns', () => {
    expect(suggestKind(['Experiment', 'Variant', 'Users', 'Conversions'], IMPORT_KINDS)?.id).toBe('product.experiments')
    expect(suggestKind(['Invoice', 'StockCode', 'Quantity', 'Price', 'InvoiceDate'], IMPORT_KINDS)?.id).toBe('operations.order_lines')
    expect(suggestKind(['a', 'b'], IMPORT_KINDS)).toBeNull()
  })
})

describe('validateRows', () => {
  const mapping = { experiment: 'e', variant: 'v', users: 'u', conversions: 'c' }
  it('skips rows with a bad required value and reports each one', () => {
    const v = validateRows(
      [
        { e: 'A', v: 'control', u: '100', c: '10' },
        { e: 'A', v: 'b', u: '-5', c: '1' },
        { e: '', v: 'b', u: '10', c: '1' },
        { e: 'A', v: 'b', u: '10.5', c: '1' },
      ],
      PRODUCT_EXPERIMENTS,
      mapping,
    )
    expect(v.records).toHaveLength(1)
    expect(v.skipped).toBe(3)
    expect(v.issues.map((i) => i.row)).toEqual([2, 3, 4])
    expect(v.issues[0].message).toMatch(/below the minimum/)
  })
  it('keeps the row but blanks an invalid optional value', () => {
    const v = validateRows([{ m: 'X', g: 'n/a', p: '10', i: '50', e: '70' }], MARKET_INDICATORS, { name: 'm', gdpUsdBn: 'g', populationM: 'p', internetPct: 'i', easeOfBusiness: 'e' })
    expect(v.records).toHaveLength(1)
    expect(v.records[0].gdpUsdBn).toBeNull()
    expect(v.issues[0].message).toMatch(/left blank/)
  })
})

describe('de-duplication keys', () => {
  it('gives overlapping files identical keys but keeps genuine in-file repeats distinct', () => {
    const a = occurrenceKeys([['inv1', 'sku', '1'], ['inv1', 'sku', '1'], ['inv2', 'sku', '3']])
    const b = occurrenceKeys([['inv1', 'sku', '1'], ['inv2', 'sku', '3']])
    expect(a[0]).not.toBe(a[1])
    expect(b[0]).toBe(a[0])
    expect(b[1]).toBe(a[2])
  })
  it('normalizes natural keys', () => {
    expect(naturalKey('  South-Korea ')).toBe(naturalKey('south korea'))
  })
})

describe('workspace row caps', () => {
  it('allows imports up to the cap and explains when one would exceed it', () => {
    const cap = WORKSPACE_ROW_CAPS['product.events']
    expect(rowCapError('Product events', cap - 10, 10, cap)).toBeNull()
    expect(rowCapError('Product events', cap - 10, 11, cap)).toMatch(/per-workspace limit/)
  })
})
