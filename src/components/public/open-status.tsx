import { cn } from 'cn'

type Props = { isOpen: boolean; nextOpening: string | null; className?: string }

export function OpenStatus({ isOpen, nextOpening, className }: Props) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
        isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 rounded-full', isOpen ? 'animate-pulse bg-success' : 'bg-muted-foreground/60')}
      />
      {isOpen ? 'Aberto agora' : 'Fechado'}
      {!isOpen && nextOpening && <span className="font-normal">· {nextOpening}</span>}
    </p>
  )
}
