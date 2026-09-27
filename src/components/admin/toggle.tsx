'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import type { ActionResult } from '@/lib/admin/action-result'

type Props = {
  checked: boolean
  label: string
  /** Texto visível ao lado do switch (se omitido, o label fica só para leitores de tela). */
  visibleLabel?: string
  onChange: (value: boolean) => Promise<ActionResult>
}

/** Liga/desliga com um toque, com resposta imediata na tela. */
export function Toggle({ checked, label, visibleLabel, onChange }: Props) {
  const [optimistic, setOptimistic] = useOptimistic(checked)
  const [pending, startTransition] = useTransition()

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <Switch
        checked={optimistic}
        disabled={pending}
        aria-label={visibleLabel ? undefined : label}
        onCheckedChange={(value) =>
          startTransition(async () => {
            setOptimistic(value)
            const result = await onChange(value)
            if (!result.ok) toast.error(result.message)
          })
        }
      />
      {visibleLabel && <span className="whitespace-nowrap">{visibleLabel}</span>}
    </label>
  )
}
