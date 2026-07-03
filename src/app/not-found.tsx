import Link from 'next/link'
import { Logo } from '@/ui/components/Logo'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-8 font-mono text-xs uppercase tracking-widest text-muted">404 — Not found</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">This page doesn&apos;t exist.</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The link may be outdated. Head back to the platform and pick a module from there.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        ← Back to CoreSight IQ
      </Link>
    </main>
  )
}
