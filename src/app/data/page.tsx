import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/ui/components/Logo'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { SUPPORTED_FORMATS, MAX_FILE_LABEL } from '@/core/workspace'
import { DataManager } from './DataManager'
import { WorkspacePanel } from './WorkspacePanel'
import { IMPORT_KINDS } from '@/domains/import-kinds'

export const metadata = {
  title: 'Data Manager · CoreSight IQ',
  description: 'Upload your own CSV, Excel or JSON data and import it into Operations, Market or Product analytics.',
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
            Bring your own data. Upload a CSV, Excel or JSON file, import it as order lines, market
            indicators, competitor shares, product events, experiment results or a backlog — and the matching
            module switches from the sample to your numbers. Every import is checked first and can be undone.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <DataManager />
          </div>

          <aside className="min-w-0 space-y-4">
            <WorkspacePanel />

            <Card>
              <CardHeader><CardTitle>What you can import</CardTitle></CardHeader>
              <CardBody className="divide-y divide-border p-0">
                {IMPORT_KINDS.map((k) => (
                  <div key={k.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium">{k.label}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">{k.domain}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      Needs {k.fields.filter((f) => f.required).map((f) => f.label).join(', ')}.{' '}
                      <a href={k.template} className="text-fg underline decoration-border underline-offset-2 hover:decoration-fg">Template ↓</a>
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>How importing works</CardTitle></CardHeader>
              <CardBody>
                <ol className="list-decimal space-y-2 pl-4 text-xs text-muted">
                  <li><strong className="text-fg">Upload</strong> — files are size-checked and parsed; you can preview, rename, replace or delete them.</li>
                  <li><strong className="text-fg">Map &amp; check</strong> — choose what the file contains; columns are auto-matched and every value is validated. Rejected rows are listed with the reason.</li>
                  <li><strong className="text-fg">Import</strong> — rows are written in one transaction. Rows you already imported are skipped, so overlapping exports never double-count.</li>
                  <li><strong className="text-fg">Undo</strong> — any import can be undone exactly from Import history.</li>
                </ol>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Supported formats</CardTitle></CardHeader>
              <CardBody className="space-y-2.5">
                {SUPPORTED_FORMATS.map((f) => (
                  <div key={f.format}>
                    <Badge tone={f.tabular ? 'accent' : 'neutral'}>{f.label}</Badge>
                    <p className="mt-1 text-xs text-muted">{f.processing}</p>
                  </div>
                ))}
                <p className="border-t border-border pt-2 text-xs text-muted">Up to <strong>{MAX_FILE_LABEL}</strong> and 25,000 rows per import — split larger exports into several files.</p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
