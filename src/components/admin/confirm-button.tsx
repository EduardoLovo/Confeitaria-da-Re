'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ActionResult } from '@/lib/admin/action-result'

type Props = {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => Promise<ActionResult<unknown>>
  children: ReactNode
  variant?: 'destructive' | 'default'
  size?: 'sm' | 'icon-sm' | 'default' | 'xl'
  className?: string
  'aria-label'?: string
}

/** Botão que pede confirmação antes de uma ação irreversível (excluir, cancelar). */
export function ConfirmButton({
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  children,
  variant = 'destructive',
  size = 'sm',
  className,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm()
      if (result.ok) {
        if (result.message) toast.success(result.message)
        setOpen(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === 'destructive' ? 'ghost' : 'outline'}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={rest['aria-label']}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Voltar
            </Button>
            <Button
              type="button"
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={confirm}
              disabled={pending}
            >
              {pending ? 'Aguarde…' : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
