'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'

import type { ActionResult } from '@/lib/admin/action-result'

/**
 * Envia o formulário para uma Server Action mostrando toast e erros por campo.
 * Usamos onSubmit (e não <form action>) porque o React 19 limpa o formulário
 * depois de toda action — e a pessoa perderia o que digitou se houvesse erro.
 */
export function useActionForm(
  action: (formData: FormData) => Promise<ActionResult<unknown>>,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await action(formData)
      if (result.ok) {
        setErrors({})
        toast.success(result.message ?? 'Salvo!')
        onSuccess?.()
      } else {
        setErrors(result.errors ?? {})
        toast.error(result.message)
      }
    })
  }

  return { onSubmit, pending, errors }
}
