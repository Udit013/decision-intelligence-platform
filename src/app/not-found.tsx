import Link from 'next/link'
import { Logo } from '@/ui/components/Logo'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="kicker mt-10">404 — not found</p>
      <h1 className="mt-3 font-display text-3xl font-medium leading-tight">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        The link may be outdated. Head back to the platform and pick a module from there.
      </p>
      <Link href="/" className="btn-line mt-8">
        ← Back to CoreSight IQ
      </Link>
    </main>
  )
}
