'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { verifyCode, type CodeState } from '../actions'
import { CodeInput } from '../code-input'

export function VerifyForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCode, { error: null })

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <CodeInput error={state.error} />
      <Button type="submit" size="xl" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Entrar
      </Button>
    </form>
  )
}
