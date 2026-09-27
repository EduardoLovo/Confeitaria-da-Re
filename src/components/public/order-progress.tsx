import { Check, X } from 'lucide-react'
import { cn } from 'cn'

import { STATUS_LABEL, statusFlow } from '@/lib/domain/order-status'
import type { FulfillmentType, OrderStatus } from '@/lib/supabase/database.types'

type Props = { status: OrderStatus; fulfillment: FulfillmentType }

/** Linha do tempo do pedido: Recebido → Confirmado → … → Concluído. */
export function OrderProgress({ status, fulfillment }: Props) {
  if (status === 'cancelled') {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 font-semibold text-destructive">
        <X className="size-5" aria-hidden /> Pedido cancelado
      </p>
    )
  }

  const flow = statusFlow(fulfillment)
  const current = flow.indexOf(status)

  return (
    <ol className="flex flex-col gap-0" aria-label="Andamento do pedido">
      {flow.map((step, i) => {
        const done = i < current || status === 'completed'
        const active = i === current && status !== 'completed'
        return (
          <li key={step} className="flex gap-3" aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold',
                  done && 'border-success bg-success text-white',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !done && !active && 'border-border bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              {i < flow.length - 1 && (
                <span className={cn('my-0.5 w-0.5 flex-1 min-h-5', done ? 'bg-success' : 'bg-border')} />
              )}
            </div>
            <p
              className={cn(
                'pt-0.5 pb-4 text-sm',
                active ? 'font-bold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {STATUS_LABEL[step]}
              {active && <span className="sr-only"> (etapa atual)</span>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
