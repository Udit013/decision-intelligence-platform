'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
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
      className="inline-flex items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
    >
      <Download className="h-4 w-4" />
      {busy ? 'Generating…' : 'Download PDF'}
    </button>
  )
}
