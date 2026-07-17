/**
 * Provenance notice — a softly tinted note stating that a module runs on
 * synthetic, modeled demo data. Quiet, but always present.
 */
export function DemoBanner({ note }: { note: string }) {
  return (
    <aside className="mb-6 rounded-xl border border-warn/20 bg-warn/[0.06] px-4 py-3.5">
      <p className="kicker text-warn">Synthetic data · modeled</p>
      <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-fg/85">{note}</p>
    </aside>
  )
}
