/**
 * Loader + data-quality profiler for the UCI "Online Retail II" .xlsx.
 * Shared by the ETL (scripts/etl-operations.ts) and the offline metrics script
 * (scripts/operations-metrics.ts) so both see the exact same normalized rows.
 */
import * as XLSX from 'xlsx'
import path from 'node:path'

export interface RetailRow {
  invoice: string
  stockCode: string
  description: string | null
  quantity: number
  price: number
  invoiceDate: Date
  customerId: string | null
  country: string | null
  /** Credit note / cancellation: Invoice prefixed with 'C'. */
  isCancellation: boolean
}

export const DATA_PATH = path.resolve(process.cwd(), 'data/online_retail_II.xlsx')

type RawRow = {
  Invoice?: string | number
  StockCode?: string | number
  Description?: string
  Quantity?: number
  InvoiceDate?: string | number | Date
  Price?: number
  'Customer ID'?: number | string
  Country?: string
}

/** Parse every sheet of the workbook into normalized rows. */
export function loadRetailRows(file = DATA_PATH): RetailRow[] {
  const wb = XLSX.readFile(file, { cellDates: true })
  const rows: RetailRow[] = []
  for (const sheetName of wb.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[sheetName], { raw: true })
    for (const r of raw) {
      const invoice = String(r.Invoice ?? '').trim()
      const stockCode = String(r.StockCode ?? '').trim()
      if (!invoice || !stockCode) continue
      const date = r.InvoiceDate instanceof Date ? r.InvoiceDate : new Date(r.InvoiceDate as string)
      if (isNaN(date.getTime())) continue
      const cid = r['Customer ID']
      const desc = r.Description === undefined || r.Description === null ? '' : String(r.Description).trim()
      const country = r.Country === undefined || r.Country === null ? '' : String(r.Country).trim()
      rows.push({
        invoice,
        stockCode,
        description: desc || null,
        quantity: Number(r.Quantity ?? 0),
        price: Number(r.Price ?? 0),
        invoiceDate: date,
        customerId: cid === undefined || cid === null || cid === '' ? null : String(cid).replace(/\.0$/, ''),
        country: country || null,
        isCancellation: invoice.toUpperCase().startsWith('C'),
      })
    }
  }
  return rows
}

export interface DataQuality {
  totalRows: number
  dateMin: string
  dateMax: string
  cancellations: number
  missingCustomerId: number
  nonPositiveQuantity: number
  nonPositivePrice: number
  missingDescription: number
  exactDuplicates: number
  distinctInvoices: number
  distinctCustomers: number
  distinctProducts: number
  distinctCountries: number
  ukShare: number
  /** Rows that survive cleaning (valid sale lines kept for analytics). */
  cleanSaleRows: number
}

/** Profile raw rows; this is printed PRE-SEED so data quality is visible before load. */
export function profile(rows: RetailRow[]): DataQuality {
  const seen = new Set<string>()
  let exactDuplicates = 0
  let cancellations = 0
  let missingCustomerId = 0
  let nonPositiveQuantity = 0
  let nonPositivePrice = 0
  let missingDescription = 0
  let uk = 0
  let cleanSaleRows = 0
  const invoices = new Set<string>()
  const customers = new Set<string>()
  const products = new Set<string>()
  const countries = new Set<string>()
  let min = Infinity
  let max = -Infinity

  for (const r of rows) {
    const key = `${r.invoice}|${r.stockCode}|${r.quantity}|${r.price}|${r.invoiceDate.getTime()}`
    if (seen.has(key)) exactDuplicates++
    else seen.add(key)

    if (r.isCancellation) cancellations++
    if (!r.customerId) missingCustomerId++
    if (r.quantity <= 0) nonPositiveQuantity++
    if (r.price <= 0) nonPositivePrice++
    if (!r.description) missingDescription++
    if (r.country === 'United Kingdom') uk++

    invoices.add(r.invoice)
    if (r.customerId) customers.add(r.customerId)
    products.add(r.stockCode)
    if (r.country) countries.add(r.country)
    const t = r.invoiceDate.getTime()
    if (t < min) min = t
    if (t > max) max = t

    // A clean sale line: not a cancellation, positive qty & price.
    if (!r.isCancellation && r.quantity > 0 && r.price > 0) cleanSaleRows++
  }

  return {
    totalRows: rows.length,
    dateMin: new Date(min).toISOString().slice(0, 10),
    dateMax: new Date(max).toISOString().slice(0, 10),
    cancellations,
    missingCustomerId,
    nonPositiveQuantity,
    nonPositivePrice,
    missingDescription,
    exactDuplicates,
    distinctInvoices: invoices.size,
    distinctCustomers: customers.size,
    distinctProducts: products.size,
    distinctCountries: countries.size,
    ukShare: rows.length ? uk / rows.length : 0,
    cleanSaleRows,
  }
}

export function printQuality(q: DataQuality): void {
  const pct = (n: number) => `${((n / q.totalRows) * 100).toFixed(1)}%`
  console.log('\n────────────── DATA QUALITY (UCI Online Retail II) ──────────────')
  console.log(`total rows              : ${q.totalRows.toLocaleString()}`)
  console.log(`date range              : ${q.dateMin} → ${q.dateMax}`)
  console.log(`distinct invoices       : ${q.distinctInvoices.toLocaleString()}`)
  console.log(`distinct customers      : ${q.distinctCustomers.toLocaleString()}`)
  console.log(`distinct products       : ${q.distinctProducts.toLocaleString()}`)
  console.log(`distinct countries      : ${q.distinctCountries} (UK share ${(q.ukShare * 100).toFixed(1)}%)`)
  console.log(`cancellations (C-inv)   : ${q.cancellations.toLocaleString()} (${pct(q.cancellations)})`)
  console.log(`missing Customer ID     : ${q.missingCustomerId.toLocaleString()} (${pct(q.missingCustomerId)})`)
  console.log(`non-positive quantity   : ${q.nonPositiveQuantity.toLocaleString()} (${pct(q.nonPositiveQuantity)})`)
  console.log(`non-positive price      : ${q.nonPositivePrice.toLocaleString()} (${pct(q.nonPositivePrice)})`)
  console.log(`missing description     : ${q.missingDescription.toLocaleString()} (${pct(q.missingDescription)})`)
  console.log(`exact duplicate rows    : ${q.exactDuplicates.toLocaleString()} (${pct(q.exactDuplicates)})`)
  console.log(`clean sale rows kept    : ${q.cleanSaleRows.toLocaleString()} (${pct(q.cleanSaleRows)})`)
  console.log('──────────────────────────────────────────────────────────────────\n')
}
