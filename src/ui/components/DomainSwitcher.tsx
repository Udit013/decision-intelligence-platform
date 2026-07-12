import Link from 'next/link'
import { DOMAINS, type DomainModule } from '@/core/registry'
import { cn } from '@/ui/cn'

const ACCENT_HEX: Record<DomainModule['accent'], string> = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  lime: 'var(--color-lime)',
}

/**
 * Module tabs — all three modules are always visible in the masthead as
 * numbered text tabs (no dropdown to open, one click to switch). The active
 * tab carries its module's accent as an underline rule.
 */
export function DomainSwitcher({ current }: { current: DomainModule }) {
  return (
    <nav aria-label="Modules" className="flex items-stretch gap-5">
      {DOMAINS.map((d, i) => {
        const active = d.id === current.id
        return (
          <Link
            key={d.id}
            href={`/${d.id}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-baseline gap-1.5 border-b-2 pb-2 pt-2.5 text-sm transition-colors',
              active
                ? 'border-[color:var(--tab)] font-semibold text-fg'
                : 'border-transparent text-muted hover:text-fg',
            )}
            style={{ ['--tab' as string]: ACCENT_HEX[d.accent] }}
          >
            <span className="font-mono text-[9px] tracking-[0.1em] text-muted group-hover:text-fg">
              {String(i + 1).padStart(2, '0')}
            </span>
            {d.label}
          </Link>
        )
      })}
    </nav>
  )
}
