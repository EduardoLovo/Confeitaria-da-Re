'use client'

import { Loader2, MessageCircle } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { STATUS_LABEL } from '@/lib/domain/order-status'
import type { OrderStatus } from '@/lib/supabase/database.types'
import { notifyCustomerAction } from '../actions'

/**
 * Chama notifyCustomer() no servidor e trata o resultado:
 * link wa.me (Fase 1) ou envio automático (Fase 3).
 *
 * A aba é aberta ANTES do await: navegadores (principalmente no iPhone)
 * bloqueiam window.open chamado depois de uma espera.
 */
export function useNotifyCustomer(orderId: string) {
  const [pending, startTransition] = useTransition()

  function notify() {
    const tab = window.open('', '_blank')
    startTransition(async () => {
      const result = await notifyCustomerAction(orderId)
      if (!result.ok || !result.data) {
        tab?.close()
        toast.error(result.ok ? 'Não foi possível gerar a mensagem.' : result.message)
        return
      }
      const notification = result.data
      if (notification.channel === 'wa_link') {
        if (tab) tab.location.href = notification.url
        else window.location.href = notification.url
      } else {
        tab?.close()
        toast.success('Mensagem enviada para a cliente pelo WhatsApp')
      }
    })
  }

  return { notify, pending }
}

export function NotifyButton({
  orderId,
  status,
  highlight,
  onNotify,
}: {
  orderId: string
  status: OrderStatus
  highlight?: boolean
  onNotify?: () => void
}) {
  const { notify, pending } = useNotifyCustomer(orderId)

  return (
    <button
      type="button"
      onClick={() => {
        onNotify?.()
        notify()
      }}
      disabled={pending}
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-5 font-semibold text-white shadow-sm transition hover:bg-[#197a42] focus-visible:ring-4 focus-visible:ring-[#1f8f4e]/40 focus-visible:outline-none disabled:opacity-60',
        highlight && 'animate-pulse',
      )}
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
      Avisar cliente: “{STATUS_LABEL[status]}”
    </button>
  )
}
