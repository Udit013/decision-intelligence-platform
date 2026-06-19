import { Card, CardBody } from '@/ui/components/Card'

/**
 * Phase 0 scaffold placeholder. Every domain page renders this until its engine
 * is wired in a later phase. It states which phase delivers the page so the
 * skeleton is honest about what's real vs pending.
 */
export function Placeholder({
  title,
  tagline,
  phase,
}: {
  title: string
  tagline: string
  phase: string
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted">{tagline}</p>
      <Card className="mt-6">
        <CardBody className="py-10 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Scaffold
          </p>
          <p className="mt-2 text-sm text-muted">
            This view is wired in {phase}. Phase 0 establishes the shell, routing,
            unified schema, and the domain registry.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
