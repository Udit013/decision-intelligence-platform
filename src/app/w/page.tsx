import type { Metadata } from 'next'
import { ClaimWorkspace } from './ClaimWorkspace'

export const metadata: Metadata = { title: 'Open workspace', robots: { index: false } }

export default function OpenWorkspacePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <ClaimWorkspace />
    </main>
  )
}
