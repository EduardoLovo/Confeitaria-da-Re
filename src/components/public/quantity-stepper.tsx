'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { MAX_ITEM_QUANTITY } from '@/lib/domain/cart'

type Props = {
  value: number
  onChange: (value: number) => void
  /** Nome do item, para os rótulos acessíveis. */
  label: string
  size?: 'default' | 'sm'
  className?: string
}

export function QuantityStepper({ value, onChange, label, size = 'default', className }: Props) {
  const btn = size === 'sm' ? 'icon-sm' : 'icon-touch'
  return (
    <div
      role="group"
      aria-label={`Quantidade de ${label}`}
      className={cn('inline-flex items-center gap-1 rounded-full border bg-card p-0.5', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size={btn}
        className="rounded-full"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus />
      </Button>
      <span
        aria-live="polite"
        className={cn('min-w-8 text-center font-semibold tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={btn}
        className="rounded-full"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_ITEM_QUANTITY}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus />
      </Button>
    </div>
  )
}
