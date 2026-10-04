/**
 * Normalizes validated order-line records (see core/imports + ORDER_LINES) into
 * the Operations schema: customers / products / invoices / lines. Pure — the
 * server import writer adds workspace/import ids and content keys.
 */
import type { ParsedRecord } from '@/core/imports'
import { deriveCategory, assumedCostRatioFor } from './assumptions'

export interface OrderRecords {
  customers: { customerId: string; country: string | null; firstSeen: Date; lastSeen: Date }[]
  products: { stockCode: string; description: string | null; category: string; assumedCostRatio: number }[]
  invoices: { invoice: string; invoiceDate: Date; customerId: string | null; country: string | null; isReturn: boolean }[]
  lines: { invoice: string; stockCode: string; quantity: number; unitPrice: number; lineRevenue: number; invoiceDate: Date }[]
}

export function buildOrderRecords(records: ParsedRecord[]): OrderRecords {
  const customers = new Map<string, { country: string | null; first: Date; last: Date }>()
  const products = new Map<string, string | null>()
  const invoices = new Map<string, { date: Date; customerId: string | null; country: string | null; isReturn: boolean }>()
  const lines: OrderRecords['lines'] = []

  for (const r of records) {
    const invoice = r.invoice as string
    const stockCode = r.stockCode as string
    const quantity = r.quantity as number
    const unitPrice = r.unitPrice as number
    const date = r.invoiceDate as Date
    const description = (r.description as string | null) ?? null
    const customerId = (r.customerId as string | null) ?? null
    const country = (r.country as string | null) ?? null

    if (!products.has(stockCode) || (products.get(stockCode) === null && description)) products.set(stockCode, description)
    if (customerId) {
      const c = customers.get(customerId)
      if (!c) customers.set(customerId, { country, first: date, last: date })
      else {
        if (date < c.first) c.first = date
        if (date > c.last) c.last = date
      }
    }
    const inv = invoices.get(invoice)
    const isReturn = invoice.toUpperCase().startsWith('C') || quantity < 0
    if (!inv) invoices.set(invoice, { date, customerId, country, isReturn })
    else {
      if (date < inv.date) inv.date = date
      inv.isReturn ||= isReturn
    }
    lines.push({ invoice, stockCode, quantity, unitPrice, lineRevenue: Math.round(quantity * unitPrice * 100) / 100, invoiceDate: date })
  }

  return {
    customers: [...customers.entries()].map(([customerId, c]) => ({ customerId, country: c.country, firstSeen: c.first, lastSeen: c.last })),
    products: [...products.entries()].map(([stockCode, description]) => {
      const category = deriveCategory(description)
      return { stockCode, description, category, assumedCostRatio: assumedCostRatioFor(category) }
    }),
    invoices: [...invoices.entries()].map(([invoice, v]) => ({ invoice, invoiceDate: v.date, customerId: v.customerId, country: v.country, isReturn: v.isReturn })),
    lines,
  }
}
