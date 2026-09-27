'use client'

import { ShoppingBag, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { resolveCart, type ResolvedCartLine } from '@/lib/domain/cart'
import type { ProductMap } from '@/lib/domain/catalog'
import { missingForMinimum } from '@/lib/domain/pricing'
import { formatBRL } from '@/lib/format'
import { useCart, useCartHydrated } from '@/stores/cart'
import { ClosedNotice } from './closed-notice'
import { ProductImage } from './product-image'
import { QuantityStepper } from './quantity-stepper'

type Props = {
  products: ProductMap
  isOpen: boolean
  nextOpening: string | null
  minOrderCents: number
}

/** Botão flutuante com contador e subtotal + gaveta do carrinho. */
export function Cart({ products, isOpen, nextOpening, minOrderCents }: Props) {
  const [open, setOpen] = useState(false)
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const cart = useMemo(() => resolveCart(lines, products), [lines, products])

  const missing = missingForMinimum(cart.subtotalCents, minOrderCents)
  const canCheckout = isOpen && cart.itemCount > 0 && missing === 0 && !cart.hasUnavailable

  if (!hydrated || lines.length === 0) return null

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="xl"
          onClick={() => setOpen(true)}
          className="pointer-events-auto mx-auto flex h-14 w-full max-w-md justify-between px-5 shadow-lg"
          aria-label={`Ver carrinho: ${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'}, ${formatBRL(cart.subtotalCents)}`}
        >
          <span className="flex items-center gap-2">
            <span className="relative">
              <ShoppingBag className="size-5" />
              <span className="absolute -top-2 -right-2.5 flex size-5 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-cocoa">
                {cart.itemCount}
              </span>
            </span>
            <span className="ml-2">Ver carrinho</span>
          </span>
          <span className="tabular-nums">{formatBRL(cart.subtotalCents)}</span>
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] w-full max-w-lg gap-0 rounded-t-3xl"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-xl font-semibold">Seu carrinho</SheetTitle>
            <SheetDescription>
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'}
            </SheetDescription>
          </SheetHeader>

          <ul className="flex-1 space-y-3 overflow-y-auto px-4">
            {cart.lines.map((r) => (
              <CartLineItem key={r.line.id} item={r} />
            ))}
          </ul>

          <SheetFooter className="gap-3 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between text-base">
              <span>Subtotal</span>
              <strong className="tabular-nums">{formatBRL(cart.subtotalCents)}</strong>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              A taxa de entrega é calculada no próximo passo.
            </p>

            {cart.hasUnavailable && (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                Alguns itens não estão mais disponíveis. Remova-os para continuar.
              </p>
            )}
            {missing > 0 && (
              <p className="rounded-xl bg-secondary p-3 text-sm">
                Pedido mínimo de <strong>{formatBRL(minOrderCents)}</strong>. Faltam{' '}
                <strong>{formatBRL(missing)}</strong>.
              </p>
            )}
            {!isOpen && <ClosedNotice nextOpening={nextOpening} />}

            <Separator className="my-1" />

            {canCheckout ? (
              <Button
                size="xl"
                className="w-full"
                nativeButton={false}
                render={<Link href="/checkout" onClick={() => setOpen(false)} />}
              >
                Continuar
              </Button>
            ) : (
              <Button size="xl" className="w-full" disabled>
                {isOpen ? 'Continuar' : 'Loja fechada'}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CartLineItem({ item }: { item: ResolvedCartLine }) {
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const { line, product, available } = item
  const name = product?.name ?? 'Produto indisponível'

  return (
    <li className="flex gap-3 rounded-2xl border bg-card p-2.5">
      <ProductImage
        path={product?.image_path ?? null}
        alt=""
        sizes="64px"
        className="size-16 shrink-0 rounded-xl"
        muted={!available}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="leading-tight font-semibold">{name}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(line.id)}
            aria-label={`Remover ${name} do carrinho`}
          >
            <Trash2 />
          </Button>
        </div>
        {line.note && <p className="text-xs text-muted-foreground">Obs.: {line.note}</p>}
        {available ? (
          <div className="flex items-center justify-between">
            <QuantityStepper
              size="sm"
              value={line.quantity}
              onChange={(q) => setQuantity(line.id, q)}
              label={name}
            />
            <span className="font-semibold tabular-nums">{formatBRL(item.lineTotalCents)}</span>
          </div>
        ) : (
          <p className="text-xs font-semibold text-destructive">Esgotado — remova para continuar</p>
        )}
      </div>
    </li>
  )
}
