import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

type Props = {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

/** Rótulo + campo + dica/erro. O campo deve usar o mesmo `id`. */
export function FormField({ id, label, error, hint, children, className }: Props) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export const inputClass = 'h-11 text-base'
export const selectClass =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

/** Props de acessibilidade para um campo com possível erro. */
export function a11y(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}
