'use client'

import { useEffect } from 'react'

import type { OrderStatus } from '@/lib/supabase/database.types'
import { useRecentOrders } from '@/stores/recent-orders'

type Props = { id: string; number: number; createdAt: string; status: OrderStatus }

/** Guarda este pedido no aparelho (atalho "Acompanhar meu pedido" na Home). */
export function RememberOrder({ id, number, createdAt, status }: Props) {
  const remember = useRecentOrders((s) => s.remember)

  useEffect(() => {
    // Espera o localStorage carregar para não sobrescrever a lista salva.
    const save = () => remember({ id, number, createdAt, status })
    if (useRecentOrders.persist.hasHydrated()) save()
    else return useRecentOrders.persist.onFinishHydration(save)
  }, [remember, id, number, createdAt, status])

  return null
}
