'use client'

import { Clock, Loader2, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { startPayment } from '@/app/pedido/[id]/actions'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'

type Props = {
  orderId: string
  totalCents: number
  expiresAt: string
  /** Voltou do checkout sem pagamento confirmado (?pagamento=pendente). */
  returnedUnpaid: boolean
}

/** Pedido online aguardando pagamento: tempo restante + "Pagar agora". */
export function PaymentPanel({ orderId, totalCents, expiresAt, returnedUnpaid }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const remainingMs = useRemaining(expiresAt)
  const expired = remainingMs <= 0

  // Venceu com a página aberta: busca o estado atualizado no servidor.
  useEffect(() => {
    if (expired) router.refresh()
  }, [expired, router])

  function pay() {
    setError(null)
    startTransition(async () => {
      const result = await startPayment(orderId)
      if (result.ok) window.location.assign(result.url)
      else {
        setError(result.message)
        router.refresh()
      }
    })
  }

  if (expired) {
    return (
      <p className="rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive" role="status">
        O prazo para pagar este pedido terminou. Faça um novo pedido, por favor.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-primary bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-cocoa">Falta só o pagamento</h2>
      <p className="text-sm">
        Seu pedido será confirmado assim que o pagamento de <strong>{formatBRL(totalCents)}</strong> for aprovado.
      </p>

      {returnedUnpaid && (
        <p className="rounded-xl bg-secondary p-3 text-sm" role="status">
          Ainda não recebemos a confirmação do pagamento. Se você já pagou, aguarde um instante: esta página se
          atualiza sozinha.
        </p>
      )}

      <p className="flex items-center gap-2 text-sm" aria-live="off">
        <Clock className="size-4 shrink-0 text-cocoa" aria-hidden />
        <span>
          Tempo para pagar: <strong className="tabular-nums" suppressHydrationWarning>
            {formatRemaining(remainingMs)}
          </strong>
        </span>
      </p>

      <Button size="xl" className="h-14 w-full" onClick={pay} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Abrindo o pagamento…
          </>
        ) : (
          <>Pagar agora · {formatBRL(totalCents)}</>
        )}
      </Button>
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        Pix ou cartão, pelo checkout seguro da InfinitePay.
      </p>
    </section>
  )
}

/** Milissegundos até `iso`, atualizado a cada segundo. */
function useRemaining(iso: string): number {
  const target = new Date(iso).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return Math.max(0, target - now)
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}
