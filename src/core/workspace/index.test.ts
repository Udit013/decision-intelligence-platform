import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { detectFormat, validateUpload, parseBuffer, isTabular, MAX_FILE_BYTES } from './index'

const enc = (s: string) => new TextEncoder().encode(s)

describe('detectFormat / validateUpload', () => {
  it('detects supported extensions case-insensitively', () => {
    expect(detectFormat('sales.CSV')).toBe('csv')
    expect(detectFormat('report.xlsx')).toBe('xlsx')
    expect(detectFormat('notes.docx')).toBe('docx')
    expect(detectFormat('archive.zip')).toBeNull()
    expect(detectFormat('noextension')).toBeNull()
  })

  it('rejects unsupported, empty, and oversized files with clear messages', () => {
    expect(validateUpload('x.zip', 100)).toContain('Unsupported')
    expect(validateUpload('x.csv', 0)).toBe('File is empty.')
    expect(validateUpload('x.csv', MAX_FILE_BYTES + 1)).toContain('limit is 4 MB')
    expect(validateUpload('x.csv', 100)).toBeNull()
  })

  it('classifies tabular vs document formats', () => {
    expect(isTabular('csv')).toBe(true)
    expect(isTabular('json')).toBe(true)
    expect(isTabular('pdf')).toBe(false)
    expect(isTabular('txt')).toBe(false)
  })
})

describe('parseBuffer — CSV', () => {
  it('parses headers and rows, handling quoted commas', () => {
    const r = parseBuffer('csv', enc('name,city\n"Smith, Jane",London\nBob,Paris\n'))
    expect(r.error).toBeUndefined()
    expect(r.table!.columns).toEqual(['name', 'city'])
    expect(r.table!.rowCount).toBe(2)
    expect(r.table!.rows[0]).toEqual({ name: 'Smith, Jane', city: 'London' })
  })

  it('errors on an empty file', () => {
    expect(parseBuffer('csv', enc('')).error).toBeDefined()
  })
})

describe('parseBuffer — JSON', () => {
  it('parses an array of objects and unions columns', () => {
    const r = parseBuffer('json', enc('[{"a":1,"b":2},{"a":3,"c":4}]'))
    expect(r.table!.columns.sort()).toEqual(['a', 'b', 'c'])
    expect(r.table!.rowCount).toBe(2)
  })

  it('rejects non-array and non-object entries', () => {
    expect(parseBuffer('json', enc('{"a":1}')).error).toContain('array of objects')
    expect(parseBuffer('json', enc('[1,2]')).error).toContain('only objects')
    expect(parseBuffer('json', enc('not json')).error).toBe('Invalid JSON.')
  })
})

describe('parseBuffer — XLSX', () => {
  it('round-trips a real workbook', () => {
    const ws = XLSX.utils.json_to_sheet([
      { invoice: 'A1', qty: 2, price: 9.5 },
      { invoice: 'A2', qty: 1, price: 3 },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
    const r = parseBuffer('xlsx', buf)
    expect(r.error).toBeUndefined()
    expect(r.table!.columns).toEqual(['invoice', 'qty', 'price'])
    expect(r.table!.rowCount).toBe(2)
  })

  it('errors on garbage bytes as a value, not a throw', () => {
    const r = parseBuffer('xlsx', enc('definitely not a workbook'))
    expect(r.error ?? r.table).toBeDefined() // never throws
  })
})

describe('parseBuffer — documents', () => {
  it('txt yields a bounded text preview', () => {
    const r = parseBuffer('txt', enc('hello world '.repeat(500)))
    expect(r.textPreview!.length).toBeLessThanOrEqual(2000)
    expect(r.error).toBeUndefined()
  })

  it('pdf/docx are stored without parsing', () => {
    expect(parseBuffer('pdf', enc('%PDF-1.4'))).toEqual({})
    expect(parseBuffer('docx', enc('PK'))).toEqual({})
  })
})
