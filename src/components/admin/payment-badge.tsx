import { cn } from 'cn'

import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/supabase/database.types'

type Props = {
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  className?: string
}

/**
 * Situação do pagamento, ao lado do status:
 * "Pago" (online confirmado), "A receber" (na entrega/retirada) ou
 * "Pago após cancelar" (a loja precisa decidir: aceitar ou devolver).
 * Pedido aguardando pagamento não ganha selo: o próprio status já diz.
 */
export function PaymentBadge({ status, paymentMethod, paymentStatus, className }: Props) {
  const badge =
    paymentStatus === 'paid' && status === 'cancelled'
      ? { label: 'Pago após cancelar', style: 'bg-destructive/15 text-destructive' }
      : paymentStatus === 'paid'
        ? { label: 'Pago', style: 'bg-success/15 text-success' }
        : paymentMethod !== 'online' && status !== 'cancelled'
          ? { label: 'A receber', style: 'bg-muted text-muted-foreground' }
          : null
  if (!badge) return null

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap',
        badge.style,
        className,
      )}
    >
      {badge.label}
    </span>
  )
}
