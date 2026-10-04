'use client'

/**
 * Import dialog — choose what a file is, confirm the column mapping, check the
 * data (a server dry run that reports every rejected row and duplicate), then
 * commit. Nothing is written until "Import" is pressed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { autoMap, mappingProblems, suggestKind, type ColumnMapping } from '@/core/imports'
import { IMPORT_KINDS, getImportKind } from '@/domains/import-kinds'
import type { ImportPreview, CommitResult } from '@/server/imports'
import type { WorkspaceFileDto } from '@/app/api/data/_lib'
import { Badge } from '@/ui/components/Badge'
import { cn } from '@/ui/cn'

const DOMAIN_LABEL = { operations: 'Operations', market: 'Market', product: 'Product' } as const

export function ImportDialog({ file, onClose, onImported }: { file: WorkspaceFileDto; onClose: () => void; onImported: () => void }) {
  const columns = useMemo(() => file.columns ?? [], [file.columns])
  const suggested = useMemo(() => suggestKind(columns, IMPORT_KINDS), [columns])
  const [kindId, setKindId] = useState(suggested?.id ?? IMPORT_KINDS[0].id)
  const kind = getImportKind(kindId)!
  const [mapping, setMapping] = useState<ColumnMapping>(() => autoMap(columns, kind.fields))
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const problems = mappingProblems(mapping, kind)

  const check = useCallback(
    async (k: string, m: ColumnMapping) => {
      setChecking(true)
      setError(null)
      try {
        const res = await fetch(`/api/data/files/${file.id}/import`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: k, mapping: m, dryRun: true }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? `Check failed (HTTP ${res.status}).`)
        setPreview(body.preview)
      } catch (e) {
        setPreview(null)
        setError((e as Error).message)
      } finally {
        setChecking(false)
      }
    },
    [file.id],
  )

  // Re-check whenever the kind or mapping settles (short debounce for rapid select changes).
  useEffect(() => {
    const t = setTimeout(() => check(kindId, mapping), 250)
    return () => clearTimeout(t)
  }, [kindId, mapping, check])

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !committing && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, committing])

  const changeKind = (id: string) => {
    const k = getImportKind(id)!
    setKindId(id)
    setMapping(autoMap(columns, k.fields))
    setPreview(null)
  }

  async function commit() {
    setCommitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/data/files/${file.id}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: kindId, mapping }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Import failed (HTTP ${res.status}).`)
      setResult(body.import)
      onImported()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCommitting(false)
    }
  }

  const canCommit = !result && !committing && !checking && preview && !preview.problems.length && preview.toInsert > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-fg/30 p-4 sm:items-center" role="presentation" onClick={() => !committing && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="my-8 w-full max-w-4xl rounded-2xl border border-border bg-surface shadow-pop outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="kicker">Import into analytics</p>
            <h2 id="import-title" className="mt-1 truncate font-display text-[19px] font-medium">{file.name}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {file.rowCount?.toLocaleString('en-US')} rows · {columns.length} columns · {file.format.toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} disabled={committing} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-good" />
            <p className="mt-3 font-display text-[20px] font-medium">Imported {result.inserted.toLocaleString('en-US')} rows</p>
            <p className="mt-1.5 text-sm text-muted">
              {result.duplicates > 0 && `${result.duplicates.toLocaleString('en-US')} duplicates skipped · `}
              {result.skipped > 0 && `${result.skipped.toLocaleString('en-US')} invalid rows skipped · `}
              undo anytime from Import history.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href={`/${result.domain}`} className="btn-ink">
                View {DOMAIN_LABEL[result.domain as keyof typeof DOMAIN_LABEL]} insights <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
              <button className="btn-line" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* ── Left: what & how ── */}
            <div className="border-b border-border px-6 py-5 lg:border-b-0 lg:border-r">
              <label className="block">
                <span className="kicker">This file contains</span>
                <select
                  value={kindId}
                  onChange={(e) => changeKind(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                >
                  {(['operations', 'market', 'product'] as const).map((d) => (
                    <optgroup key={d} label={DOMAIN_LABEL[d]}>
                      {IMPORT_KINDS.filter((k) => k.domain === d).map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}{suggested?.id === k.id ? ' — suggested' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs leading-relaxed text-muted">{kind.description}</p>

              <p className="kicker mt-5">Column mapping</p>
              <div className="mt-2 divide-y divide-border/70 border-y border-border/70">
                {kind.fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-3 py-1.5">
                    <span className="w-40 shrink-0 text-[13px]">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-bad" aria-label="required">*</span>}
                      {f.hint && <span className="block font-mono text-[10px] text-muted">{f.hint}</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setMapping((m) => {
                          const next = { ...m }
                          if (v) next[f.key] = v
                          else delete next[f.key]
                          return next
                        })
                      }}
                      className={cn(
                        'min-w-0 flex-1 rounded-md border bg-surface px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40',
                        f.required && !mapping[f.key] ? 'border-bad/50' : 'border-border',
                      )}
                    >
                      <option value="">— not in file —</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <a href={kind.template} className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.1em] text-muted underline decoration-border underline-offset-4 hover:text-fg">
                Example file for this type ↓
              </a>
            </div>

            {/* ── Right: the check ── */}
            <div className="px-6 py-5" aria-live="polite">
              <div className="flex items-center justify-between">
                <p className="kicker">Data check</p>
                {checking && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">checking…</span>}
              </div>

              {problems.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {problems.map((p) => (
                    <li key={p} className="rounded-lg border border-bad/30 bg-bad/[0.04] px-3 py-2 text-[13px] text-bad">{p}</li>
                  ))}
                </ul>
              )}

              {preview && !preview.problems.length && (
                <>
                  <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
                    {[
                      ['Will import', preview.toInsert, 'text-fg'],
                      ['Duplicates', preview.inFileDuplicates + preview.existingDuplicates, 'text-muted'],
                      ['Invalid', preview.skipped, preview.skipped ? 'text-warn' : 'text-muted'],
                    ].map(([label, value, tone]) => (
                      <div key={label as string} className="bg-surface px-2 py-2.5">
                        <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{label}</dt>
                        <dd className={cn('mt-1 font-display text-[20px] font-semibold tabular-nums', tone as string)}>
                          {(value as number).toLocaleString('en-US')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {preview.existingDuplicates > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {preview.existingDuplicates.toLocaleString('en-US')} row{preview.existingDuplicates === 1 ? ' is' : 's are'} already in your workspace and will be skipped.
                    </p>
                  )}

                  {Object.keys(preview.summary).length > 0 && (
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                      {Object.entries(preview.summary).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                          <dt className="text-muted">{k}</dt>
                          <dd className="text-right tabular-nums">{typeof v === 'number' ? v.toLocaleString('en-US') : v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {preview.issueCount > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-warn">
                        {preview.issueCount.toLocaleString('en-US')} value{preview.issueCount === 1 ? '' : 's'} rejected
                        {preview.issueCount > preview.issues.length && ` (first ${preview.issues.length} shown)`}
                      </p>
                      <div className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-[11.5px]">
                          <tbody>
                            {preview.issues.map((i, n) => (
                              <tr key={n} className="border-b border-border/50 last:border-0">
                                <td className="whitespace-nowrap px-2 py-1 font-mono text-muted">row {i.row}</td>
                                <td className="whitespace-nowrap px-2 py-1">{i.field}</td>
                                <td className="px-2 py-1 text-muted">{i.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {preview.sample.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-muted">How the first rows will be read</p>
                      <div className="mt-1.5 overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-border bg-surface-2/50 text-left font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              {kind.fields.filter((f) => mapping[f.key]).map((f) => (
                                <th key={f.key} className="whitespace-nowrap px-2 py-1">{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.sample.map((r, n) => (
                              <tr key={n} className="border-b border-border/40 last:border-0">
                                {kind.fields.filter((f) => mapping[f.key]).map((f) => (
                                  <td key={f.key} className="max-w-[140px] truncate whitespace-nowrap px-2 py-1 tabular-nums">{r[f.key] === null ? '—' : String(r[f.key])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {error && <p className="mt-3 rounded-lg border border-bad/30 bg-bad/[0.04] px-3 py-2 text-[13px] text-bad" role="alert">{error}</p>}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Badge tone="neutral">{DOMAIN_LABEL[kind.domain]} · {kind.label}</Badge>
                <button type="button" className="btn-ink" disabled={!canCommit} onClick={commit}>
                  {committing
                    ? 'Importing…'
                    : preview && !preview.problems.length && preview.toInsert === 0 && preview.valid > 0
                      ? 'Nothing new to import'
                      : `Import ${preview?.toInsert ? preview.toInsert.toLocaleString('en-US') + ' ' : ''}rows`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
