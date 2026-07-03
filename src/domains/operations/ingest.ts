/**
 * Maps an uploaded tabular file onto the Operations transaction schema so user
 * data can power the real analytics. Pure logic (no DB) — the API route feeds it
 * parsed rows and writes the records it returns.
 *
 * Column mapping is heuristic by header name (case/space-insensitive), covering
 * the common exports (Online Retail II, Superstore-style, generic order lines).
 * Required: invoice, stock code, quantity, unit price, date.
 * Optional: description, customer id, country.
 */
import { deriveCategory, assumedCostRatioFor } from './assumptions'

export const INGEST_ROW_LIMIT = 25_000

const FIELD_ALIASES: Record<RequiredField | OptionalField, string[]> = {
  invoice: ['invoice', 'invoiceno', 'invoicenumber', 'orderid', 'orderno', 'ordernumber'],
  stockCode: ['stockcode', 'sku', 'productid', 'productcode', 'itemid', 'itemcode'],
  quantity: ['quantity', 'qty', 'units'],
  unitPrice: ['price', 'unitprice', 'unitcost', 'saleprice'],
  invoiceDate: ['invoicedate', 'date', 'orderdate', 'transactiondate', 'datetime'],
  description: ['description', 'productname', 'itemname', 'product'],
  customerId: ['customerid', 'customer', 'customerno', 'clientid'],
  country: ['country', 'region', 'market'],
}

type RequiredField = 'invoice' | 'stockCode' | 'quantity' | 'unitPrice' | 'invoiceDate'
type OptionalField = 'description' | 'customerId' | 'country'
const REQUIRED: RequiredField[] = ['invoice', 'stockCode', 'quantity', 'unitPrice', 'invoiceDate']

export type ColumnMapping = Partial<Record<RequiredField | OptionalField, string>>

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, '')

/** Map file columns to schema fields. Returns the mapping or the missing fields. */
export function mapColumns(columns: string[]): { mapping: ColumnMapping; missing: RequiredField[] } {
  const byNorm = new Map(columns.map((c) => [norm(c), c]))
  const mapping: ColumnMapping = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [RequiredField | OptionalField, string[]][]) {
    for (const alias of aliases) {
      const col = byNorm.get(alias)
      if (col !== undefined) {
        mapping[field] = col
        break
      }
    }
  }
  const missing = REQUIRED.filter((f) => !(f in mapping))
  return { mapping, missing }
}

export interface IngestRecords {
  customers: { customerId: string; country: string | null; firstSeen: Date; lastSeen: Date }[]
  products: { stockCode: string; description: string | null; category: string; assumedCostRatio: number }[]
  invoices: { invoice: string; invoiceDate: Date; customerId: string | null; country: string | null; isReturn: boolean }[]
  lines: { invoice: string; stockCode: string; quantity: number; unitPrice: number; lineRevenue: number; invoiceDate: Date }[]
  /** Rows dropped (bad number / unparseable date / blank keys). */
  skipped: number
}

/** Build normalized schema records from parsed rows using the mapping. */
export function buildRecords(rows: Record<string, unknown>[], mapping: ColumnMapping): IngestRecords {
  const customers = new Map<string, { country: string | null; first: Date; last: Date }>()
  const products = new Map<string, string | null>()
  const invoices = new Map<string, { date: Date; customerId: string | null; country: string | null; isReturn: boolean }>()
  const lines: IngestRecords['lines'] = []
  let skipped = 0

  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

  for (const row of rows) {
    const invoice = str(row[mapping.invoice!])
    const stockCode = str(row[mapping.stockCode!])
    const quantity = Number(row[mapping.quantity!])
    const unitPrice = Number(row[mapping.unitPrice!])
    const rawDate = row[mapping.invoiceDate!]
    const date = rawDate instanceof Date ? rawDate : new Date(str(rawDate))

    if (!invoice || !stockCode || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || isNaN(date.getTime())) {
      skipped++
      continue
    }

    const description = mapping.description ? str(row[mapping.description]) || null : null
    const customerId = mapping.customerId ? str(row[mapping.customerId]) || null : null
    const country = mapping.country ? str(row[mapping.country]) || null : null

    if (!products.has(stockCode)) products.set(stockCode, description)
    if (customerId) {
      const c = customers.get(customerId)
      if (!c) customers.set(customerId, { country, first: date, last: date })
      else {
        if (date < c.first) c.first = date
        if (date > c.last) c.last = date
      }
    }
    const inv = invoices.get(invoice)
    if (!inv) {
      invoices.set(invoice, { date, customerId, country, isReturn: invoice.toUpperCase().startsWith('C') || quantity < 0 })
    } else if (date < inv.date) inv.date = date

    lines.push({
      invoice,
      stockCode,
      quantity,
      unitPrice,
      lineRevenue: Math.round(quantity * unitPrice * 100) / 100,
      invoiceDate: date,
    })
  }

  return {
    customers: [...customers.entries()].map(([customerId, c]) => ({ customerId, country: c.country, firstSeen: c.first, lastSeen: c.last })),
    products: [...products.entries()].map(([stockCode, description]) => {
      const category = deriveCategory(description)
      return { stockCode, description, category, assumedCostRatio: assumedCostRatioFor(category) }
    }),
    invoices: [...invoices.entries()].map(([invoice, v]) => ({ invoice, invoiceDate: v.date, customerId: v.customerId, country: v.country, isReturn: v.isReturn })),
    lines,
    skipped,
  }
}
