'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { DOMAINS, type DomainModule } from '@/core/registry'
import { cn } from '@/ui/cn'

const ACCENT_HEX: Record<DomainModule['accent'], string> = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  lime: 'var(--color-lime)',
}

export function DomainSwitcher({ current }: { current: DomainModule }) {
  const pathname = usePathname()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5',
          'text-sm font-semibold outline-none transition-colors hover:bg-surface-2',
        )}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: ACCENT_HEX[current.accent] }}
        />
        {current.label}
        <ChevronDown className="h-4 w-4 text-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 rounded-lg border border-border bg-surface p-1 shadow-xl"
        >
          {DOMAINS.map((d) => {
            const active = d.id === current.id
            return (
              <DropdownMenu.Item key={d.id} asChild>
                <Link
                  href={`/${d.id}`}
                  className={cn(
                    'flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 outline-none',
                    'transition-colors hover:bg-surface-2 focus:bg-surface-2',
                    active && 'bg-surface-2',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: ACCENT_HEX[d.accent] }}
                    />
                    {d.label}
                    {active && pathname?.startsWith(`/${d.id}`) && (
                      <span className="ml-auto text-[10px] font-mono text-muted">current</span>
                    )}
                  </span>
                  <span className="pl-4 text-xs text-muted">{d.tagline}</span>
                </Link>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
