import { describe, it, expect } from 'vitest'
import { autoMap, mappingProblems, validateRows } from '@/core/imports'
import { ORDER_LINES } from '@/domains/import-kinds'
import { buildOrderRecords } from './ingest'

describe('order-line mapping', () => {
  it('maps Online Retail II style headers', () => {
    const m = autoMap(['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country'], ORDER_LINES.fields)
    expect(mappingProblems(m, ORDER_LINES)).toEqual([])
    expect(m.invoice).toBe('Invoice')
    expect(m.unitPrice).toBe('Price')
    expect(m.customerId).toBe('Customer ID')
  })

  it('maps generic order-line headers (case/space insensitive)', () => {
    const m = autoMap(['order_id', 'SKU', 'qty', 'unit price', 'Order Date'], ORDER_LINES.fields)
    expect(mappingProblems(m, ORDER_LINES)).toEqual([])
    expect(m.invoice).toBe('order_id')
    expect(m.stockCode).toBe('SKU')
    expect(m.invoiceDate).toBe('Order Date')
  })

  it('reports missing required fields', () => {
    const problems = mappingProblems(autoMap(['name', 'city'], ORDER_LINES.fields), ORDER_LINES)
    expect(problems[0]).toMatch(/Order ID.*Quantity/)
  })
})

describe('buildOrderRecords', () => {
  const columns = ['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country']
  const mapping = autoMap(columns, ORDER_LINES.fields)
  const row = (over: Record<string, unknown> = {}) => ({
    Invoice: 'A100', StockCode: 'SKU1', Description: 'RED MUG', Quantity: '2',
    InvoiceDate: '2024-03-01', Price: '5.5', 'Customer ID': 'C1', Country: 'UK', ...over,
  })

  it('builds normalized customers/products/invoices/lines', () => {
    const v = validateRows([row(), row({ Invoice: 'A101', StockCode: 'SKU2', Description: 'JUMBO BAG' })], ORDER_LINES, mapping)
    const rec = buildOrderRecords(v.records)
    expect(rec.lines).toHaveLength(2)
    expect(rec.invoices).toHaveLength(2)
    expect(rec.products).toHaveLength(2)
    expect(rec.customers).toHaveLength(1)
    expect(rec.lines[0].lineRevenue).toBe(11)
    expect(rec.products.find((p) => p.stockCode === 'SKU2')!.category).toBe('Bags & Storage')
    expect(v.skipped).toBe(0)
  })

  it('skips malformed rows and reports each with its row number', () => {
    const v = validateRows([row(), row({ Quantity: 'not-a-number' }), row({ InvoiceDate: 'garbage' }), row({ Invoice: '' })], ORDER_LINES, mapping)
    expect(v.records).toHaveLength(1)
    expect(v.skipped).toBe(3)
    expect(v.issues.map((i) => i.row)).toEqual([2, 3, 4])
  })

  it('flags credit notes and negative quantities as returns', () => {
    const v = validateRows([row({ Invoice: 'C555', Quantity: '-1' })], ORDER_LINES, mapping)
    expect(buildOrderRecords(v.records).invoices[0].isReturn).toBe(true)
  })
})
