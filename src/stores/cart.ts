import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { clampQuantity, MAX_NOTE_LENGTH, type CartLine } from '@/lib/domain/cart'

type CartState = {
  lines: CartLine[]
  add: (productId: string, quantity: number, note?: string) => void
  setQuantity: (lineId: string, quantity: number) => void
  remove: (lineId: string) => void
  clear: () => void
}

// O localStorage pode ter sido editado ou vir de uma versão antiga: valida antes de usar.
const persistedSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(99),
        note: z.string().max(MAX_NOTE_LENGTH),
      }),
    )
    .max(50),
})

function newLineId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (productId, quantity, note = '') =>
        set((state) => {
          const cleanNote = note.trim().slice(0, MAX_NOTE_LENGTH)
          const same = state.lines.find((l) => l.productId === productId && l.note === cleanNote)
          if (same) {
            return {
              lines: state.lines.map((l) =>
                l.id === same.id ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l,
              ),
            }
          }
          return {
            lines: [
              ...state.lines,
              { id: newLineId(), productId, quantity: clampQuantity(quantity), note: cleanNote },
            ],
          }
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === lineId ? { ...l, quantity: clampQuantity(quantity) } : l,
          ),
        })),

      remove: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.id !== lineId) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'confeitaria:cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Hidratamos manualmente (CartHydrator) para não divergir do HTML do servidor.
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, lines: parsed.data.lines } : current
      },
    },
  ),
)

/** true depois que o carrinho foi carregado do localStorage. */
export function useCartHydrated() {
  return useSyncExternalStore(
    (onChange) => useCart.persist.onFinishHydration(onChange),
    () => useCart.persist.hasHydrated(),
    () => false,
  )
}
