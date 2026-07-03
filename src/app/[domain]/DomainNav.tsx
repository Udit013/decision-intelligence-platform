'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DomainNavItem } from '@/core/registry'
import { cn } from '@/ui/cn'

export function DomainNav({ domainId, items }: { domainId: string; items: DomainNavItem[] }) {
  const pathname = usePathname()
  const base = `/${domainId}`

  return (
    // Horizontal scroll strip on mobile, vertical rail on lg+.
    <nav
      aria-label="Module pages"
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
    >
      {items.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base
        const active = item.slug ? pathname === href : pathname === base
        return (
          <Link
            key={item.slug || 'index'}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md border-b-2 border-l-0 border-transparent px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg lg:border-b-0 lg:border-l-2',
              // Accent underline on mobile, accent left-rail on desktop.
              active && 'border-[color:var(--accent)] bg-surface font-medium text-fg',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
