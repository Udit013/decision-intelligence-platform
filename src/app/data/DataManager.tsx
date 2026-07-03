'use client'

/**
 * Data Manager — client UI for the shared data workspace.
 * Upload (drag-drop or picker, multi-file, per-file progress), then preview,
 * rename, re-scope, replace, reprocess, ingest-to-Operations, and delete.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  UploadCloud, Trash2, Eye, RefreshCw, Pencil, Database, X, FileText, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/ui/components/Card'
import { Badge } from '@/ui/components/Badge'
import { cn } from '@/ui/cn'
import { MAX_FILE_LABEL, SCOPES, formatBytes, isTabular, type FileFormat, type FileScope } from '@/core/workspace'
import type { WorkspaceFileDto } from '@/app/api/data/_lib'

interface UploadItem {
  key: string
  filename: string
  progress: number // 0..100
  error?: string
}

const SCOPE_LABEL: Record<FileScope, string> = { shared: 'Shared (all modules)', operations: 'Operations only', market: 'Market only', product: 'Product only' }

/** XHR upload for real progress events (fetch has none for uploads). */
function uploadWithProgress(url: string, form: FormData, onProgress: (pct: number) => void) {
  return new Promise<{ status: number; body: { file?: WorkspaceFileDto; error?: string } }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      try {
        resolve({ status: xhr.status, body: JSON.parse(xhr.responseText || '{}') })
      } catch {
        resolve({ status: xhr.status, body: { error: 'Unexpected server response.' } })
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(form)
  })
}

export function DataManager() {
  const [files, setFiles] = useState<WorkspaceFileDto[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [scope, setScope] = useState<FileScope>('shared')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<WorkspaceFileDto | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/data/files', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setFiles(body.files)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
      setFiles([])
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 6000)
  }

  async function handleFiles(list: FileList | File[]) {
    const picked = Array.from(list)
    for (const f of picked) {
      const key = `${f.name}-${Date.now()}-${Math.random()}`
      setUploads((u) => [...u, { key, filename: f.name, progress: 0 }])
      const form = new FormData()
      form.append('file', f)
      form.append('scope', scope)
      try {
        const { status, body } = await uploadWithProgress('/api/data/upload', form, (pct) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: pct } : x))),
        )
        if (status !== 201) {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: body.error ?? `Upload failed (HTTP ${status}).` } : x)))
        } else {
          setUploads((u) => u.filter((x) => x.key !== key))
        }
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)))
      }
      await refresh()
    }
  }

  async function act(id: string, fn: () => Promise<Response>) {
    setBusyId(id)
    try {
      const res = await fn()
      const body = await res.json().catch(() => ({}))
      if (!res.ok) flash(body.error ?? `Action failed (HTTP ${res.status}).`)
      else if (body.ingested) {
        flash(
          `Ingested into Operations: ${body.ingested.lines.toLocaleString()} lines, ${body.ingested.invoices.toLocaleString()} invoices` +
            (body.ingested.skipped ? ` (${body.ingested.skipped} rows skipped)` : '') + '. Analytics refreshed.',
        )
      }
    } catch (e) {
      flash((e as Error).message)
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  const rename = (f: WorkspaceFileDto) => {
    const name = window.prompt('Rename dataset:', f.name)?.trim()
    if (!name || name === f.name) return
    act(f.id, () => fetch(`/api/data/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }))
  }

  const remove = (f: WorkspaceFileDto) => {
    if (!window.confirm(`Delete "${f.name}"? This cannot be undone.`)) return
    act(f.id, () => fetch(`/api/data/files/${f.id}`, { method: 'DELETE' }))
  }

  const changeScope = (f: WorkspaceFileDto, next: string) =>
    act(f.id, () => fetch(`/api/data/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: next }) }))

  const reprocess = (f: WorkspaceFileDto) => act(f.id, () => fetch(`/api/data/files/${f.id}/reprocess`, { method: 'POST' }))

  const ingest = (f: WorkspaceFileDto) => {
    if (!window.confirm(`Load "${f.name}" (${f.rowCount?.toLocaleString()} rows) into the Operations analytics?`)) return
    act(f.id, () => fetch(`/api/data/files/${f.id}/ingest-operations`, { method: 'POST' }))
  }

  const startReplace = (f: WorkspaceFileDto) => {
    replaceTarget.current = f.id
    replaceRef.current?.click()
  }

  return (
    <>
      {/* ── Dropzone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => pickerRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickerRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-border bg-surface hover:border-[var(--accent)]/50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-[var(--accent)]" />
        <p className="mt-3 text-sm font-semibold">Drag & drop files here, or click to browse</p>
        <p className="mt-1 text-xs text-muted">CSV · XLSX · JSON · TXT · PDF · DOCX — up to {MAX_FILE_LABEL} each, multiple files supported</p>
        <label className="mt-4 flex items-center gap-2 text-xs text-muted" onClick={(e) => e.stopPropagation()}>
          Upload into:
          <select value={scope} onChange={(e) => setScope(e.target.value as FileScope)} className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none">
            {SCOPES.map((s) => (
              <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <input ref={pickerRef} type="file" multiple hidden accept=".csv,.xlsx,.json,.pdf,.txt,.docx" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {/* hidden picker for Replace */}
      <input
        ref={replaceRef}
        type="file"
        hidden
        accept=".csv,.xlsx,.json,.pdf,.txt,.docx"
        onChange={(e) => {
          const f = e.target.files?.[0]
          const id = replaceTarget.current
          e.target.value = ''
          if (!f || !id) return
          const form = new FormData()
          form.append('file', f)
          act(id, () => fetch(`/api/data/files/${id}/reprocess`, { method: 'POST', body: form }))
        }}
      />

      {/* ── In-flight uploads ── */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((u) => (
            <div key={u.key} className={cn('rounded-md border px-4 py-2.5', u.error ? 'border-bad/40 bg-bad/5' : 'border-border bg-surface')}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{u.filename}</span>
                {u.error ? (
                  <button onClick={() => setUploads((x) => x.filter((i) => i.key !== u.key))} aria-label="Dismiss" className="text-muted hover:text-fg">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="font-mono text-xs text-muted">{u.progress}%</span>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-xs text-bad">{u.error}</p>
              ) : (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {notice && <div className="mt-4 rounded-md border border-info/40 bg-info/5 px-4 py-2.5 text-sm">{notice}</div>}

      {/* ── File list ── */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Workspace files</CardTitle></CardHeader>
        <CardBody>
          {files === null && <p className="py-6 text-center text-sm text-muted">Loading…</p>}
          {loadError && <p className="py-6 text-center text-sm text-bad">{loadError}</p>}
          {files?.length === 0 && !loadError && (
            <p className="py-8 text-center text-sm text-muted">
              No files yet — drop your first dataset above. Tabular files (CSV/XLSX/JSON) become previewable datasets;
              CSV order lines can be loaded straight into the Operations analytics.
            </p>
          )}
          {!!files?.length && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                  <th className="py-2">Name</th>
                  <th className="py-2">Format</th>
                  <th className="py-2 text-right">Size</th>
                  <th className="py-2 text-right">Rows</th>
                  <th className="py-2">Scope</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className={cn('border-b border-border/50', busyId === f.id && 'opacity-50')}>
                    <td className="max-w-[220px] py-2 pr-2">
                      <span className="block truncate font-medium" title={f.originalFilename}>{f.name}</span>
                      {f.ingestedAt && <span className="text-[10px] text-good">ingested into Operations</span>}
                    </td>
                    <td className="py-2"><Badge tone="neutral">{f.format.toUpperCase()}</Badge></td>
                    <td className="py-2 text-right tabular-nums">{formatBytes(f.sizeBytes)}</td>
                    <td className="py-2 text-right tabular-nums">{f.rowCount?.toLocaleString() ?? '—'}</td>
                    <td className="py-2">
                      <select
                        value={f.scope}
                        onChange={(e) => changeScope(f, e.target.value)}
                        aria-label={`Scope for ${f.name}`}
                        className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs outline-none"
                      >
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      {f.status === 'ready' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-good"><CheckCircle2 className="h-3.5 w-3.5" /> ready</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-bad" title={f.error ?? ''}><AlertTriangle className="h-3.5 w-3.5" /> error</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="Preview" onClick={() => setPreview(f)}><Eye className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Rename" onClick={() => rename(f)}><Pencil className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Replace with a new file" onClick={() => startReplace(f)}><UploadCloud className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Reprocess (re-parse stored file)" onClick={() => reprocess(f)}><RefreshCw className="h-4 w-4" /></IconBtn>
                        {isTabular(f.format as FileFormat) && f.status === 'ready' && !f.ingestedAt && (
                          <IconBtn title="Load into Operations analytics" onClick={() => ingest(f)}><Database className="h-4 w-4" /></IconBtn>
                        )}
                        <IconBtn title="Delete" onClick={() => remove(f)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* ── Preview modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted" />
                <span className="font-semibold">{preview.name}</span>
                <Badge tone="neutral">{preview.format.toUpperCase()}</Badge>
              </div>
              <button onClick={() => setPreview(null)} aria-label="Close preview" className="text-muted hover:text-fg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5">
              {preview.sampleRows?.length ? (
                <>
                  <p className="mb-3 text-xs text-muted">
                    {preview.rowCount?.toLocaleString()} rows · {preview.columns?.length} columns · showing first {preview.sampleRows.length}
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                        {preview.columns?.map((c) => <th key={c} className="py-1.5 pr-3">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.slice(0, 25).map((row, i) => (
                        <tr key={i} className="border-b border-border/40">
                          {preview.columns?.map((c) => (
                            <td key={c} className="max-w-[160px] truncate py-1.5 pr-3" title={String(row[c] ?? '')}>{String(row[c] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : preview.textPreview ? (
                <pre className="whitespace-pre-wrap text-xs text-muted">{preview.textPreview}</pre>
              ) : (
                <p className="text-sm text-muted">
                  {preview.status === 'error'
                    ? `This file failed to parse: ${preview.error}`
                    : 'Stored as a reference document — no tabular preview for this format.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn('rounded-md border border-border bg-surface p-1.5 transition-colors', danger ? 'text-bad hover:bg-bad/10' : 'text-muted hover:bg-surface-2 hover:text-fg')}
    >
      {children}
    </button>
  )
}
