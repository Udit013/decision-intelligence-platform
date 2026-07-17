import { cn } from '@/ui/cn'

/**
 * Card — white surface, hairline border, soft layered shadow. Depth is quiet
 * and consistent; hierarchy comes from spacing and type, not chrome.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border/70 px-5 py-3.5', className)} {...props} />
}

/** Card titles are quiet small-caps labels; the data carries the hierarchy. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('kicker text-fg/80', className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // overflow-x-auto lets wide data tables scroll horizontally on small screens
  // instead of breaking the page layout.
  return <div className={cn('overflow-x-auto px-5 py-4', className)} {...props} />
}
