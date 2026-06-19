/** Prominent top-level notice that a domain runs on synthetic, modeled demo data. */
export function DemoBanner({ note }: { note: string }) {
  return (
    <div className="mb-6 rounded-lg border-2 border-warn/50 bg-warn/10 p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-warn">⚠ Demo data · modeled</span>
      </div>
      <p className="mt-1.5 text-sm text-fg">{note}</p>
    </div>
  )
}
