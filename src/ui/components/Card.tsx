import { cn } from '@/ui/cn'

/**
 * Panel — the ledger's container. A hairline box with a 2px ink rule on top
 * (a print convention: rules, not shadows, create structure). No elevation,
 * no rounded-xl, no hover lift.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border border-border border-t-2 border-t-fg bg-surface', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border px-5 py-3', className)} {...props} />
}

/** Panel titles are set as small-caps mono labels, not bold sans headings. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('kicker text-fg', className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // overflow-x-auto lets wide data tables scroll horizontally on small screens
  // instead of breaking the page layout.
  return <div className={cn('overflow-x-auto px-5 py-4', className)} {...props} />
}
