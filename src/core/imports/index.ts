/**
 * Import engine — the domain-agnostic part of turning an uploaded table into
 * validated records: header → field mapping, typed parsing, range checks, and an
 * issue report. Pure and client-safe (row hashing lives in ./keys).
 *
 * Validation policy: a bad value in a REQUIRED field skips the row; a bad value
 * in an OPTIONAL field is reported and stored as null. Nothing is coerced
 * silently — every rejection is listed with its row number.
 */
import type { DomainKey } from '@/core/tenancy'

export type FieldType = 'string' | 'number' | 'integer' | 'date'

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  required?: boolean
  /** Normalized header names that auto-map to this field. */
  aliases: string[]
  min?: number
  max?: number
  maxLength?: number
  hint?: string
}

export interface ImportKindSpec {
  id: string
  domain: DomainKey
  label: string
  description: string
  fields: FieldSpec[]
  /** Path under /public of a small example file with the expected columns. */
  template: string
  /** Extra rule: at least `count` of `keys` must be mapped (e.g. scoring inputs). */
  atLeast?: { keys: string[]; count: number; message: string }
}

export type ColumnMapping = Record<string, string>
export type RecordValue = string | number | Date | null
export type ParsedRecord = Record<string, RecordValue>

export interface ImportIssue {
  /** 1-based data row number (header excluded), as a spreadsheet user sees it minus the header. */
  row: number
  field: string
  message: string
}

export interface ValidationResult {
  records: ParsedRecord[]
  /** Source row number of each record (parallel to `records`). */
  rowNumbers: number[]
  skipped: number
  issues: ImportIssue[]
  /** Total issues found (the `issues` list is capped). */
  issueCount: number
}

export const MAX_REPORTED_ISSUES = 50

export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Header-based auto mapping: first alias that matches a column wins; one column per field. */
export function autoMap(columns: string[], fields: FieldSpec[]): ColumnMapping {
  const byNorm = new Map<string, string>()
  for (const c of columns) if (!byNorm.has(normalizeHeader(c))) byNorm.set(normalizeHeader(c), c)
  const used = new Set<string>()
  const mapping: ColumnMapping = {}
  for (const f of fields) {
    for (const alias of [normalizeHeader(f.key), normalizeHeader(f.label), ...f.aliases]) {
      const col = byNorm.get(alias)
      if (col !== undefined && !used.has(col)) {
        mapping[f.key] = col
        used.add(col)
        break
      }
    }
  }
  return mapping
}

/** Keeps only entries that name a real column and a real field. */
export function sanitizeMapping(raw: unknown, columns: string[], fields: FieldSpec[]): ColumnMapping {
  const out: ColumnMapping = {}
  if (!raw || typeof raw !== 'object') return out
  const cols = new Set(columns)
  const keys = new Set(fields.map((f) => f.key))
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (keys.has(k) && typeof v === 'string' && cols.has(v)) out[k] = v
  }
  return out
}

/** Human-readable problems with a mapping that block the import entirely. */
export function mappingProblems(mapping: ColumnMapping, kind: ImportKindSpec): string[] {
  const problems: string[] = []
  const missing = kind.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label)
  if (missing.length) problems.push(`Map the required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`)
  if (kind.atLeast) {
    const have = kind.atLeast.keys.filter((k) => mapping[k]).length
    if (have < kind.atLeast.count) problems.push(kind.atLeast.message)
  }
  const cols = Object.values(mapping)
  const dup = cols.find((c, i) => cols.indexOf(c) !== i)
  if (dup) problems.push(`Column "${dup}" is mapped to more than one field.`)
  return problems
}

/** Suggests the kind whose required fields best match the columns (null if none fully match). */
export function suggestKind(columns: string[], kinds: ImportKindSpec[]): ImportKindSpec | null {
  let best: { kind: ImportKindSpec; score: number } | null = null
  for (const kind of kinds) {
    const mapping = autoMap(columns, kind.fields)
    if (mappingProblems(mapping, kind).length) continue
    const score = Object.keys(mapping).length / kind.fields.length
    if (!best || score > best.score) best = { kind, score }
  }
  return best?.kind ?? null
}

const blank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Parses "1,234.5", "$1,234", "12%", "(45)" (accounting negative). Returns NaN when not numeric. */
export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean' || v instanceof Date) return NaN
  let s = String(v).trim()
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/^[£$€¥₹]\s*/, '').replace(/\s*[£$€¥₹%]$/, '')
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN
  const n = Number(s)
  return negative ? -n : n
}

const MIN_DATE = Date.UTC(1990, 0, 1)

/** Accepts Date objects, ISO strings, and common spreadsheet date-time text. */
export function parseDate(v: unknown, now = Date.now()): Date | null {
  let d: Date
  if (v instanceof Date) d = v
  else if (typeof v === 'number') return null // bare serials are ambiguous; SheetJS gives Dates for real date cells
  else d = new Date(String(v).trim())
  const t = d.getTime()
  if (Number.isNaN(t) || t < MIN_DATE || t > now + 366 * 86_400_000) return null
  return d
}

export function validateRows(
  rows: Record<string, unknown>[],
  kind: ImportKindSpec,
  mapping: ColumnMapping,
  now = Date.now(),
): ValidationResult {
  const records: ParsedRecord[] = []
  const rowNumbers: number[] = []
  const issues: ImportIssue[] = []
  let issueCount = 0
  let skipped = 0
  const report = (row: number, field: string, message: string) => {
    issueCount++
    if (issues.length < MAX_REPORTED_ISSUES) issues.push({ row, field, message })
  }

  rows.forEach((raw, i) => {
    const rowNo = i + 1
    const rec: ParsedRecord = {}
    let skip = false
    for (const f of kind.fields) {
      const col = mapping[f.key]
      const v = col === undefined ? undefined : raw[col]
      if (blank(v)) {
        if (f.required) {
          report(rowNo, f.label, 'is empty')
          skip = true
        }
        rec[f.key] = null
        continue
      }
      let value: RecordValue = null
      let problem: string | null = null
      if (f.type === 'string') {
        const s = String(v).trim()
        if (f.maxLength && s.length > f.maxLength) problem = `is longer than ${f.maxLength} characters`
        else value = s
      } else if (f.type === 'date') {
        value = parseDate(v, now)
        if (!value) problem = `"${String(v).slice(0, 40)}" is not a valid date`
      } else {
        const n = parseNumber(v)
        if (!Number.isFinite(n)) problem = `"${String(v).slice(0, 40)}" is not a number`
        else if (f.type === 'integer' && !Number.isInteger(n)) problem = `${n} is not a whole number`
        else if (f.min !== undefined && n < f.min) problem = `${n} is below the minimum of ${f.min}`
        else if (f.max !== undefined && n > f.max) problem = `${n} is above the maximum of ${f.max}`
        else value = n
      }
      if (problem) {
        report(rowNo, f.label, problem + (f.required ? ' — row skipped' : ' — left blank'))
        if (f.required) skip = true
        rec[f.key] = null
      } else rec[f.key] = value
    }
    if (skip) skipped++
    else {
      records.push(rec)
      rowNumbers.push(rowNo)
    }
  })
  return { records, rowNumbers, skipped, issues, issueCount }
}

/** Lowercase alphanumeric key for natural-key de-duplication ("South Korea" ≡ "south-korea"). */
export function naturalKey(s: string): string {
  return s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200)
}
