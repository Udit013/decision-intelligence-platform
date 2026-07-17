import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/ui/components/Logo'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { SUPPORTED_FORMATS, MAX_FILE_LABEL } from '@/core/workspace'
import { DataManager } from './DataManager'

export const metadata = {
  title: 'Data Manager · CoreSight IQ',
  description: 'Upload, preview, and manage datasets shared across all CoreSight IQ modules.',
}

export default function DataPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="hover:opacity-75"><Logo /></Link>
          <span className="kicker hidden sm:block">Data manager</span>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg underline decoration-border underline-offset-4 hover:decoration-fg"
          >
            <ArrowLeft className="h-3 w-3" /> Modules
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-7">
          <h1 className="font-display text-[30px] font-medium leading-[1.1] tracking-[-0.01em]">Data Manager</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
            One shared workspace for all modules. Upload once and every module can see the dataset by
            default — or scope a file to a single module. Tabular files can be loaded directly into the
            Operations analytics.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <DataManager />
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Supported formats</CardTitle></CardHeader>
              <CardBody className="space-y-2.5">
                {SUPPORTED_FORMATS.map((f) => (
                  <div key={f.format}>
                    <Badge tone={f.tabular ? 'accent' : 'neutral'}>{f.label}</Badge>
                    <p className="mt-1 text-xs text-muted">{f.processing}</p>
                  </div>
                ))}
                <p className="border-t border-border pt-2 text-xs text-muted">Max file size: <strong>{MAX_FILE_LABEL}</strong> per file. Larger loads: use the CLI ETL (see README).</p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
              <CardBody>
                <ol className="list-decimal space-y-2 pl-4 text-xs text-muted">
                  <li><strong className="text-fg">Upload</strong> — drag files in (or click). Each file is validated and parsed; errors are shown per file.</li>
                  <li><strong className="text-fg">Preview & manage</strong> — inspect columns and sample rows; rename, re-scope, replace, reprocess, or delete anytime.</li>
                  <li><strong className="text-fg">Use it</strong> — CSV/XLSX/JSON order lines (invoice, SKU, quantity, price, date) can be ingested into the Operations analytics with one click. Column names are auto-detected.</li>
                </ol>
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
                  Market and Product run on labeled synthetic engines; workspace files scoped to them are
                  stored and previewable, and shown as available datasets in those modules.
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
