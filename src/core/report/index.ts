/**
 * Generic executive-report PDF builder.
 *
 * All three repos shipped a near-identical jsPDF "boardroom/executive report" with
 * a branded header band, KPI grid, tables, and a decisions section. This is the
 * one builder: a domain describes a ReportDoc (brand, title, period, sections) and
 * gets a paginated PDF. Domains differ only in their accent color and which
 * sections they pass.
 */
import { jsPDF } from 'jspdf'

export interface ReportKpi {
  label: string
  value: string
  delta?: string
}

export interface ReportTable {
  title?: string
  columns: string[]
  rows: string[][]
}

export interface ReportRecommendation {
  title: string
  expectedResult: string
  confidence: number // 0..1
  recommendation?: string
}

export type ReportSection =
  | { kind: 'kpis'; title?: string; items: ReportKpi[] }
  | { kind: 'table'; table: ReportTable }
  | { kind: 'bullets'; title: string; items: string[] }
  | { kind: 'recommendations'; title: string; items: ReportRecommendation[] }

export interface ReportDoc {
  brand: string
  title: string
  subtitle?: string
  period?: string
  generatedAt?: string | Date
  /** Accent RGB; defaults to a neutral blue. */
  accent?: [number, number, number]
  /** Honest provenance note printed in the footer (e.g. "Real data: UCI Online Retail II"). */
  dataNote?: string
  sections: ReportSection[]
}

const M = 48 // page margin
const INK: [number, number, number] = [231, 236, 243]
const MUTED: [number, number, number] = [138, 148, 166]

export function buildReportPdf(doc: ReportDoc): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const accent = doc.accent ?? [56, 132, 232]
  let y = 0

  const ensureSpace = (need: number) => {
    if (y + need > H - 64) {
      pdf.addPage()
      y = M
    }
  }

  const sectionHeading = (text: string) => {
    ensureSpace(40)
    y += 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...INK)
    pdf.text(text, M, y)
    pdf.setDrawColor(accent[0], accent[1], accent[2])
    pdf.setLineWidth(1)
    pdf.line(M, y + 6, W - M, y + 6)
    y += 22
  }

  // ── Header band ──
  pdf.setFillColor(15, 18, 27)
  pdf.rect(0, 0, W, 96, 'F')
  pdf.setFillColor(accent[0], accent[1], accent[2])
  pdf.rect(0, 96, W, 3, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(doc.brand, M, 44)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...MUTED)
  pdf.text(doc.title, M, 64)
  const dt = new Date(doc.generatedAt ?? Date.now())
  pdf.setFontSize(9)
  pdf.text(
    dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    W - M,
    44,
    { align: 'right' },
  )
  if (doc.period) pdf.text(doc.period.toUpperCase(), W - M, 60, { align: 'right' })
  y = 128

  if (doc.subtitle) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...MUTED)
    const lines = pdf.splitTextToSize(doc.subtitle, W - 2 * M)
    pdf.text(lines, M, y)
    y += lines.length * 14 + 6
  }

  // ── Sections ──
  for (const section of doc.sections) {
    if (section.kind === 'kpis') {
      if (section.title) sectionHeading(section.title)
      const cols = 3
      const gap = 12
      const cardW = (W - 2 * M - gap * (cols - 1)) / cols
      const cardH = 56
      section.items.forEach((kpi, i) => {
        const col = i % cols
        if (col === 0) ensureSpace(cardH + gap)
        const x = M + col * (cardW + gap)
        const top = y
        pdf.setFillColor(22, 28, 39)
        pdf.roundedRect(x, top, cardW, cardH, 4, 4, 'F')
        pdf.setTextColor(...MUTED)
        pdf.setFontSize(8)
        pdf.text(kpi.label.toUpperCase(), x + 10, top + 16)
        pdf.setTextColor(...INK)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(15)
        pdf.text(kpi.value, x + 10, top + 38)
        if (kpi.delta) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(...MUTED)
          pdf.text(kpi.delta, x + 10, top + 50)
        }
        if (col === cols - 1 || i === section.items.length - 1) y += cardH + gap
      })
    } else if (section.kind === 'table') {
      const t = section.table
      if (t.title) sectionHeading(t.title)
      const colW = (W - 2 * M) / t.columns.length
      ensureSpace(24)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...MUTED)
      t.columns.forEach((c, i) => pdf.text(c, M + i * colW, y))
      y += 6
      pdf.setDrawColor(35, 42, 54)
      pdf.line(M, y, W - M, y)
      y += 12
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...INK)
      for (const row of t.rows) {
        ensureSpace(16)
        row.forEach((cell, i) => {
          const lines = pdf.splitTextToSize(String(cell), colW - 6)
          pdf.text(lines.slice(0, 1), M + i * colW, y)
        })
        y += 16
      }
    } else if (section.kind === 'bullets') {
      sectionHeading(section.title)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(...INK)
      for (const item of section.items) {
        const lines = pdf.splitTextToSize(item, W - 2 * M - 14)
        ensureSpace(lines.length * 14 + 4)
        pdf.setTextColor(accent[0], accent[1], accent[2])
        pdf.text('•', M, y)
        pdf.setTextColor(...INK)
        pdf.text(lines, M + 14, y)
        y += lines.length * 14 + 4
      }
    } else if (section.kind === 'recommendations') {
      sectionHeading(section.title)
      section.items.forEach((rec, i) => {
        ensureSpace(54)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(...INK)
        pdf.text(`${i + 1}. ${rec.title}`, M, y)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(accent[0], accent[1], accent[2])
        pdf.text(`${Math.round(rec.confidence * 100)}% confidence`, W - M, y, { align: 'right' })
        y += 14
        pdf.setTextColor(...MUTED)
        const exp = pdf.splitTextToSize(`Expected: ${rec.expectedResult}`, W - 2 * M)
        pdf.text(exp, M, y)
        y += exp.length * 12
        if (rec.recommendation) {
          const r = pdf.splitTextToSize(rec.recommendation, W - 2 * M)
          ensureSpace(r.length * 12)
          pdf.setTextColor(...INK)
          pdf.text(r, M, y)
          y += r.length * 12
        }
        y += 8
      })
    }
  }

  // ── Footer with honest data note on every page ──
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    if (doc.dataNote) pdf.text(doc.dataNote, M, H - 24)
    pdf.text(`${p} / ${pages}`, W - M, H - 24, { align: 'right' })
  }

  return pdf
}
