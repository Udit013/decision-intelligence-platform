import type { DomainModule } from '@/core/registry'

/**
 * Registry accent key → CSS variable. Single source of truth for the map that
 * was previously copy-pasted into the layout, switcher, and landing page.
 */
export const ACCENT_HEX: Record<DomainModule['accent'], string> = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  lime: 'var(--color-lime)',
}
