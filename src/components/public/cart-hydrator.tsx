'use client'

import { useEffect } from 'react'

import { useCart } from '@/stores/cart'

/** Carrega o carrinho do localStorage e mantém abas diferentes sincronizadas. */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate()

    const onStorage = (event: StorageEvent) => {
      if (event.key === useCart.persist.getOptions().name) void useCart.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
