'use client'

import { useState } from 'react'
import { buildReportPdf, type ReportDoc } from '@/core/report'

/** Shared executive-report download button — builds the PDF client-side. */
export function ReportButton({ doc, filename }: { doc: ReportDoc; filename: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      onClick={() => {
        setBusy(true)
        try {
          buildReportPdf(doc).save(filename)
        } finally {
          setBusy(false)
        }
      }}
      className="btn-ink"
    >
      {busy ? 'Generating…' : 'Download PDF ↓'}
    </button>
  )
}
