/**
 * Provenance notice — a ruled editorial note, not an alert card. States plainly
 * that a module runs on synthetic, modeled demo data.
 */
export function DemoBanner({ note }: { note: string }) {
  return (
    <aside className="mb-6 border-y border-border py-3 pl-4" style={{ boxShadow: 'inset 2px 0 0 var(--color-warn)' }}>
      <p className="kicker text-warn">Synthetic data · modeled</p>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-fg">{note}</p>
    </aside>
  )
}
