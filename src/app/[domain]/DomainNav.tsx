'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DomainNavItem } from '@/core/registry'
import { cn } from '@/ui/cn'

/**
 * Module index — a numbered table of contents. Vertical rail on lg+ with quiet
 * pill hover/active states; horizontal scroll strip on mobile. The active entry
 * carries the module accent on its index numeral.
 */
export function DomainNav({ domainId, items }: { domainId: string; items: DomainNavItem[] }) {
  const pathname = usePathname()
  const base = `/${domainId}`

  return (
    <nav aria-label="Module pages">
      <p className="kicker mb-2.5 hidden px-2.5 lg:block">Index</p>
      <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {items.map((item, i) => {
          const href = item.slug ? `${base}/${item.slug}` : base
          const active = item.slug ? pathname === href : pathname === base
          return (
            <li key={item.slug || 'index'} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-baseline gap-2 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[13px] transition-colors duration-150',
                  active
                    ? 'bg-surface font-semibold text-fg shadow-card'
                    : 'font-medium text-muted hover:bg-surface-2/70 hover:text-fg',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-[9px] tracking-[0.1em] transition-colors',
                    active ? 'text-[var(--accent)]' : 'text-muted/60 group-hover:text-muted',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
