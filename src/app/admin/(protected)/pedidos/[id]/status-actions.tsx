'use client'

import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ConfirmButton } from '@/components/admin/confirm-button'
import { Button } from '@/components/ui/button'
import { FINAL_STATUSES, nextStatus, STATUS_LABEL } from '@/lib/domain/order-status'
import type { FulfillmentType, OrderStatus } from '@/lib/supabase/database.types'
import { updateOrderStatus } from '../actions'
import { NotifyButton, useNotifyCustomer } from './notify-button'

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirmar pedido',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluir pedido',
}

type Props = { orderId: string; orderNumber: number; status: OrderStatus; fulfillment: FulfillmentType }

export function StatusActions({ orderId, orderNumber, status, fulfillment }: Props) {
  const [pending, startTransition] = useTransition()
  // Depois de mudar o status, destaca o "Avisar cliente".
  const [justChanged, setJustChanged] = useState(false)
  const { notify } = useNotifyCustomer(orderId)
  const next = nextStatus(status, fulfillment)
  const isFinal = FINAL_STATUSES.includes(status)

  function changeTo(target: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, target)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setJustChanged(true)
      toast.success(`Pedido #${orderNumber}: ${STATUS_LABEL[target]}`, {
        action: { label: 'Avisar cliente', onClick: notify },
        duration: 8000,
      })
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {!isFinal && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {next && (
            <Button size="xl" className="flex-1" onClick={() => changeTo(next)} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {NEXT_LABEL[next]}
            </Button>
          )}
          <ConfirmButton
            title={`Cancelar o pedido #${orderNumber}?`}
            description="O pedido sai da lista de andamento. Essa ação não pode ser desfeita."
            confirmLabel="Cancelar pedido"
            onConfirm={async () => {
              const result = await updateOrderStatus(orderId, 'cancelled')
              if (result.ok) setJustChanged(true)
              return result
            }}
            size="xl"
            className="text-destructive"
          >
            Cancelar pedido
          </ConfirmButton>
        </div>
      )}
      <NotifyButton
        orderId={orderId}
        status={status}
        highlight={justChanged}
        onNotify={() => setJustChanged(false)}
      />
    </div>
  )
}
