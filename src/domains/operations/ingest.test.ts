import { describe, it, expect } from 'vitest'
import { mapColumns, buildRecords } from './ingest'

describe('mapColumns', () => {
  it('maps Online Retail II style headers', () => {
    const { mapping, missing } = mapColumns(['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country'])
    expect(missing).toEqual([])
    expect(mapping.invoice).toBe('Invoice')
    expect(mapping.unitPrice).toBe('Price')
    expect(mapping.customerId).toBe('Customer ID')
  })

  it('maps generic order-line headers (case/space insensitive)', () => {
    const { mapping, missing } = mapColumns(['order_id', 'SKU', 'qty', 'unit price', 'Order Date'])
    expect(missing).toEqual([])
    expect(mapping.invoice).toBe('order_id')
    expect(mapping.stockCode).toBe('SKU')
    expect(mapping.invoiceDate).toBe('Order Date')
  })

  it('reports missing required fields', () => {
    const { missing } = mapColumns(['name', 'city'])
    expect(missing).toContain('invoice')
    expect(missing).toContain('quantity')
    expect(missing.length).toBe(5)
  })
})

describe('buildRecords', () => {
  const { mapping } = mapColumns(['Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country'])
  const row = (over: Record<string, unknown> = {}) => ({
    Invoice: 'A100',
    StockCode: 'SKU1',
    Description: 'RED MUG',
    Quantity: '2',
    InvoiceDate: '2024-03-01',
    Price: '5.5',
    'Customer ID': 'C1',
    Country: 'UK',
    ...over,
  })

  it('builds normalized customers/products/invoices/lines', () => {
    const rec = buildRecords([row(), row({ Invoice: 'A101', StockCode: 'SKU2', Description: 'JUMBO BAG' })], mapping)
    expect(rec.lines).toHaveLength(2)
    expect(rec.invoices).toHaveLength(2)
    expect(rec.products).toHaveLength(2)
    expect(rec.customers).toHaveLength(1)
    expect(rec.lines[0].lineRevenue).toBe(11)
    // category derived from description via the labeled assumptions
    expect(rec.products.find((p) => p.stockCode === 'SKU2')!.category).toBe('Bags & Storage')
    expect(rec.skipped).toBe(0)
  })

  it('skips malformed rows and counts them', () => {
    const rec = buildRecords(
      [row(), row({ Quantity: 'not-a-number' }), row({ InvoiceDate: 'garbage' }), row({ Invoice: '' })],
      mapping,
    )
    expect(rec.lines).toHaveLength(1)
    expect(rec.skipped).toBe(3)
  })

  it('flags credit notes and negative quantities as returns', () => {
    const rec = buildRecords([row({ Invoice: 'C555', Quantity: '-1' })], mapping)
    expect(rec.invoices[0].isReturn).toBe(true)
  })
})
