'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DomainNavItem } from '@/core/registry'
import { cn } from '@/ui/cn'

/**
 * Module index — a numbered table of contents (print convention), not a
 * sidebar of icon buttons. Vertical rail on lg+; horizontal scroll strip on
 * mobile. The active entry carries the module accent on its index numeral.
 */
export function DomainNav({ domainId, items }: { domainId: string; items: DomainNavItem[] }) {
  const pathname = usePathname()
  const base = `/${domainId}`

  return (
    <nav aria-label="Module pages" className="lg:border-t-2 lg:border-t-fg lg:pt-3">
      <p className="kicker mb-2 hidden lg:block">Index</p>
      <ol className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {items.map((item, i) => {
          const href = item.slug ? `${base}/${item.slug}` : base
          const active = item.slug ? pathname === href : pathname === base
          return (
            <li key={item.slug || 'index'} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-baseline gap-2 whitespace-nowrap border-b-2 border-transparent py-1 text-[13px] transition-colors lg:border-b lg:border-b-border/60 lg:py-1.5',
                  active ? 'border-b-fg font-semibold text-fg lg:border-b-border/60' : 'text-muted hover:text-fg',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-[9px] tracking-[0.1em]',
                    active ? 'text-[var(--accent)]' : 'text-muted/70 group-hover:text-muted',
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
