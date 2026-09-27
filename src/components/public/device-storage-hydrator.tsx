'use client'

import { useEffect } from 'react'

import { useCart } from '@/stores/cart'
import { useRecentOrders } from '@/stores/recent-orders'

// Dados guardados no aparelho da cliente (localStorage).
const STORES = [useCart, useRecentOrders]

/**
 * Carrega carrinho e pedidos recentes do localStorage depois da hidratação
 * (evita divergir do HTML do servidor) e mantém abas diferentes sincronizadas.
 */
export function DeviceStorageHydrator() {
  useEffect(() => {
    for (const store of STORES) void store.persist.rehydrate()

    const onStorage = (event: StorageEvent) => {
      for (const store of STORES) {
        if (event.key === store.persist.getOptions().name) void store.persist.rehydrate()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
