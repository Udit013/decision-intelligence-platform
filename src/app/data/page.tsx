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
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="hover:opacity-80"><Logo /></Link>
          <span className="text-border">/</span>
          <span className="text-sm font-semibold">Data Manager</span>
          <Link href="/" className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to modules
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Data Manager</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          One shared workspace for all modules. Upload once and every module can see the dataset by
          default — or scope a file to a single module. Tabular files can be loaded directly into the
          Operations analytics.
        </p>

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
