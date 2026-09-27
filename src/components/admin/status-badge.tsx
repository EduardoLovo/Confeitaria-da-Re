import { cn } from 'cn'

import { STATUS_LABEL } from '@/lib/domain/order-status'
import type { OrderStatus } from '@/lib/supabase/database.types'

const STYLES: Record<OrderStatus, string> = {
  received: 'bg-rose text-cocoa',
  confirmed: 'bg-amber-100 text-amber-900',
  out_for_delivery: 'bg-sky-100 text-sky-900',
  ready_for_pickup: 'bg-sky-100 text-sky-900',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground line-through',
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap',
        STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
