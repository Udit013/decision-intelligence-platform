'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DomainNavItem } from '@/core/registry'
import { cn } from '@/ui/cn'

export function DomainNav({ domainId, items }: { domainId: string; items: DomainNavItem[] }) {
  const pathname = usePathname()
  const base = `/${domainId}`

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base
        const active = item.slug ? pathname === href : pathname === base
        return (
          <Link
            key={item.slug || 'index'}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg',
              active && 'bg-surface font-medium text-fg',
            )}
            style={active ? { boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
