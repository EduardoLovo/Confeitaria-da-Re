import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { FINAL_STATUSES } from '@/lib/domain/order-status'
import type { OrderStatus } from '@/lib/supabase/database.types'

/**
 * Pedidos feitos (ou abertos) neste aparelho, para a cliente voltar ao
 * acompanhamento sem precisar de conta. Fica só no navegador dela; o link
 * do pedido já é a "chave" de acesso, então nada novo é exposto.
 */
export type RecentOrder = {
  id: string
  number: number
  createdAt: string
  /** Último status visto na página do pedido (pode estar desatualizado). */
  status: OrderStatus
}

const MAX_STORED = 10
/** Por quanto tempo um pedido em andamento aparece no atalho da Home. */
export const SHOW_FOR_MS = 3 * 24 * 60 * 60 * 1000

type State = {
  orders: RecentOrder[]
  remember: (order: RecentOrder) => void
}

const statusSchema = z.enum(['awaiting_payment', 'received','confirmed', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled'])
const persistedSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.uuid(),
        number: z.number().int().positive(),
        createdAt: z.iso.datetime({ offset: true }),
        status: statusSchema,
      }),
    )
    .max(50),
})

export const useRecentOrders = create<State>()(
  persist(
    (set) => ({
      orders: [],
      remember: (order) =>
        set((state) => {
          const others = state.orders.filter((o) => o.id !== order.id)
          const next = [order, ...others]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, MAX_STORED)
          return { orders: next }
        }),
    }),
    {
      name: 'confeitaria:pedidos',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ orders: state.orders }),
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, orders: parsed.data.orders } : current
      },
    },
  ),
)

export function useRecentOrdersHydrated() {
  return useSyncExternalStore(
    (onChange) => useRecentOrders.persist.onFinishHydration(onChange),
    () => useRecentOrders.persist.hasHydrated(),
    () => false,
  )
}

/**
 * Pedidos para o atalho "Acompanhar meu pedido": recentes e que ainda não
 * foram vistos como concluídos/cancelados. Mais novo primeiro, no máximo 3.
 */
export function ordersToTrack(orders: RecentOrder[], now: number): RecentOrder[] {
  return orders
    .filter((o) => now - new Date(o.createdAt).getTime() < SHOW_FOR_MS)
    .filter((o) => !FINAL_STATUSES.includes(o.status))
    .slice(0, 3)
}
