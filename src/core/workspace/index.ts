/**
 * Data-workspace core: supported formats, validation, and parsing. Pure logic
 * (no DB, no Next) so it is unit-testable and shared by the upload/reprocess/
 * replace/ingest API routes and the Data Manager UI.
 *
 * Honest processing model, surfaced verbatim in the UI:
 *  - csv / xlsx / json  → parsed into columns + rows (preview, and Operations ingest)
 *  - txt                → stored with a text preview (no tabular processing)
 *  - pdf / docx         → stored as reference documents (no parsing)
 */
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB — under Vercel's request cap
export const MAX_FILE_LABEL = '4 MB'
export const SAMPLE_ROW_LIMIT = 100
export const TEXT_PREVIEW_CHARS = 2000

export type FileFormat = 'csv' | 'xlsx' | 'json' | 'pdf' | 'txt' | 'docx'
export type FileScope = 'shared' | 'operations' | 'market' | 'product'

export const SCOPES: FileScope[] = ['shared', 'operations', 'market', 'product']

export interface FormatInfo {
  format: FileFormat
  label: string
  /** What the platform actually does with the format. */
  processing: string
  tabular: boolean
}

export const SUPPORTED_FORMATS: FormatInfo[] = [
  { format: 'csv', label: 'CSV', processing: 'Parsed into columns & rows; previewable; can be ingested into Operations.', tabular: true },
  { format: 'xlsx', label: 'Excel (XLSX)', processing: 'First sheet parsed into columns & rows; previewable; can be ingested into Operations.', tabular: true },
  { format: 'json', label: 'JSON', processing: 'Array of objects parsed into columns & rows; previewable; can be ingested into Operations.', tabular: true },
  { format: 'txt', label: 'Text', processing: 'Stored with a text preview. Not parsed into tables.', tabular: false },
  { format: 'pdf', label: 'PDF', processing: 'Stored as a reference document. Not parsed.', tabular: false },
  { format: 'docx', label: 'Word (DOCX)', processing: 'Stored as a reference document. Not parsed.', tabular: false },
]

const EXTENSIONS = new Set(SUPPORTED_FORMATS.map((f) => f.format))

export function detectFormat(filename: string): FileFormat | null {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  return EXTENSIONS.has(ext as FileFormat) ? (ext as FileFormat) : null
}

export function isTabular(format: FileFormat): boolean {
  return SUPPORTED_FORMATS.find((f) => f.format === format)?.tabular ?? false
}

/** Validate name + size before any parsing. Returns an error message or null. */
export function validateUpload(filename: string, sizeBytes: number): string | null {
  const format = detectFormat(filename)
  if (!format) {
    return `Unsupported file type "${filename.split('.').pop()}". Supported: ${SUPPORTED_FORMATS.map((f) => f.label).join(', ')}.`
  }
  if (sizeBytes === 0) return 'File is empty.'
  if (sizeBytes > MAX_FILE_BYTES) {
    return `File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_FILE_LABEL}. For larger loads use the CLI ETL (see README).`
  }
  return null
}

export interface ParsedTable {
  columns: string[]
  rowCount: number
  /** First SAMPLE_ROW_LIMIT rows, for preview. */
  sampleRows: Record<string, unknown>[]
  /** All rows — used by ingest; never persisted wholesale. */
  rows: Record<string, unknown>[]
}

export interface ParseResult {
  table?: ParsedTable
  textPreview?: string
  error?: string
}

/** Parse a file buffer according to its format. Never throws — errors are values. */
export function parseBuffer(format: FileFormat, buf: Uint8Array): ParseResult {
  try {
    switch (format) {
      case 'csv':
        return parseCsv(new TextDecoder('utf-8').decode(buf))
      case 'json':
        return parseJson(new TextDecoder('utf-8').decode(buf))
      case 'xlsx':
        return parseXlsx(buf)
      case 'txt':
        return { textPreview: new TextDecoder('utf-8').decode(buf).slice(0, TEXT_PREVIEW_CHARS) }
      case 'pdf':
      case 'docx':
        return {} // stored as reference document — no parsing
    }
  } catch (e) {
    return { error: `Failed to parse ${format.toUpperCase()}: ${(e as Error).message}` }
  }
}

function toTable(rows: Record<string, unknown>[], columns: string[]): ParseResult {
  if (!rows.length) return { error: 'No data rows found.' }
  if (!columns.length) return { error: 'No columns detected (is the header row missing?).' }
  return {
    table: { columns, rowCount: rows.length, sampleRows: rows.slice(0, SAMPLE_ROW_LIMIT), rows },
  }
}

function parseCsv(text: string): ParseResult {
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  })
  const fatal = res.errors.find((e) => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter')
  if (fatal) return { error: `CSV parse error: ${fatal.message}` }
  const columns = (res.meta.fields ?? []).filter((f) => f && f.trim())
  return toTable(res.data, columns)
}

function parseJson(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'Invalid JSON.' }
  }
  if (!Array.isArray(data)) return { error: 'JSON must be an array of objects (e.g. [{"col": "value"}, …]).' }
  const rows = data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
  if (rows.length !== data.length) return { error: 'JSON array must contain only objects.' }
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return toTable(rows, columns)
}

function parseXlsx(buf: Uint8Array): ParseResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { error: 'Workbook has no sheets.' }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null })
  const columns = rows.length ? [...new Set(rows.flatMap((r) => Object.keys(r)))] : []
  return toTable(rows, columns)
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}
