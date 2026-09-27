import { Clock } from 'lucide-react'
import { cn } from 'cn'

type Props = { nextOpening: string | null; className?: string }

/** Aviso de loja fechada: o cardápio continua visível, mas não dá para finalizar. */
export function ClosedNotice({ nextOpening, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-border bg-card p-3 text-sm',
        className,
      )}
    >
      <Clock className="mt-0.5 size-5 shrink-0 text-cocoa" aria-hidden />
      <p>
        <strong className="font-semibold">Estamos fechados agora.</strong>{' '}
        Você pode olhar o cardápio e montar seu carrinho, mas só dá para finalizar o pedido quando
        abrirmos{nextOpening ? ` (${nextOpening.charAt(0).toLowerCase()}${nextOpening.slice(1)})` : ''}.
      </p>
    </div>
  )
}
