'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { ReorderButtons } from '@/components/admin/reorder-buttons'
import { Toggle } from '@/components/admin/toggle'
import { reorderProducts, setProductFlag } from './actions'

type Props = {
  id: string
  name: string
  isActive: boolean
  isAvailable: boolean
  ids: string[]
  index: number
}

export function ProductRowControls({ id, name, isActive, isAvailable, ids, index }: Props) {
  const [available, setAvailable] = useOptimistic(isAvailable)
  const [pending, startTransition] = useTransition()

  // "Esgotado" com um toque.
  function toggleAvailable() {
    startTransition(async () => {
      setAvailable(!available)
      const result = await setProductFlag(id, 'is_available', !available)
      if (!result.ok) toast.error(result.message)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggleAvailable}
        disabled={pending}
        aria-pressed={!available}
        aria-label={`${name}: ${available ? 'disponível, toque para marcar esgotado' : 'esgotado, toque para marcar disponível'}`}
        className={cn(
          'h-8 rounded-full px-3 text-xs font-bold transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          available ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive',
        )}
      >
        {available ? 'Disponível' : 'Esgotado'}
      </button>
      <Toggle
        checked={isActive}
        label={`Mostrar ${name} no cardápio`}
        visibleLabel="No cardápio"
        onChange={(value) => setProductFlag(id, 'is_active', value)}
      />
      <span className="flex-1" />
      <ReorderButtons ids={ids} index={index} label={name} onReorder={reorderProducts} />
    </div>
  )
}
