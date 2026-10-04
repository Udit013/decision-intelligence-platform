import Link from 'next/link'
import { getImportKind } from '@/domains/import-kinds'
import { Card, CardBody } from './Card'

/** A page section that needs an import type the visitor hasn't loaded yet. */
export function MissingData({ kind, why }: { kind: string; why: string }) {
  const spec = getImportKind(kind)
  if (!spec) return null
  return (
    <Card>
      <CardBody className="py-9 text-center">
        <p className="kicker text-[var(--accent)]">{spec.label} needed</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          {why} Import a file as <strong className="font-medium text-fg">{spec.label}</strong> — it needs{' '}
          {spec.fields.filter((f) => f.required).map((f) => f.label).join(', ')}.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/data" className="btn-ink">Upload data</Link>
          <a href={spec.template} className="btn-line">Download template</a>
        </div>
      </CardBody>
    </Card>
  )
}
