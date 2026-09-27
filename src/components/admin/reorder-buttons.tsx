'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/admin/action-result'

type Props = {
  ids: string[]
  index: number
  label: string
  onReorder: (ids: string[]) => Promise<ActionResult>
}

/** Setas ↑ ↓ para mudar a ordem (mais fácil que arrastar no celular). */
export function ReorderButtons({ ids, index, label, onReorder }: Props) {
  const [pending, startTransition] = useTransition()

  function move(delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]
    startTransition(async () => {
      const result = await onReorder(next)
      if (!result.ok) toast.error(result.message)
    })
  }

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => move(-1)}
        disabled={pending || index === 0}
        aria-label={`Mover ${label} para cima`}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => move(1)}
        disabled={pending || index === ids.length - 1}
        aria-label={`Mover ${label} para baixo`}
      >
        <ArrowDown />
      </Button>
    </div>
  )
}
