'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Recarrega os dados do servidor de tempos em tempos (só com a aba visível). */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router, intervalMs])

  return null
}
