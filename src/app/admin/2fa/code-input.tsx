'use client'

import { Input } from '@/components/ui/input'

/**
 * Campo de 6 dígitos. autoComplete="one-time-code" deixa o iPhone sugerir
 * o código salvo no app Senhas direto no teclado.
 */
export function CodeInput({ error }: { error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="code" className="text-sm font-medium">
        Código de 6 números
      </label>
      <Input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        placeholder="000000"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'code-error' : undefined}
        className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
      />
      {error && (
        <p id="code-error" role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
