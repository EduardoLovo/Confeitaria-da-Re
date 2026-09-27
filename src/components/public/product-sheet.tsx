'use client'

import { useId, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { clampQuantity, MAX_NOTE_LENGTH } from '@/lib/domain/cart'
import type { CatalogProduct } from '@/lib/domain/catalog'
import { formatBRL } from '@/lib/format'
import { useCart } from '@/stores/cart'
import { ProductImage } from './product-image'
import { QuantityStepper } from './quantity-stepper'

type Props = {
  product: CatalogProduct | null
  onClose: () => void
}

/** Detalhe do produto: foto grande, quantidade e observação. */
export function ProductSheet({ product, onClose }: Props) {
  return (
    <Sheet open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-t-3xl p-0"
        // No celular, focar a observação abriria o teclado por cima da foto.
        initialFocus={(type) => type === 'keyboard' || type === 'mouse'}
      >
        {/* key: reinicia quantidade/observação a cada produto aberto */}
        {product && <ProductForm key={product.id} product={product} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function ProductForm({ product, onDone }: { product: CatalogProduct; onDone: () => void }) {
  const add = useCart((s) => s.add)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const noteId = useId()
  const soldOut = !product.is_available

  function handleAdd() {
    add(product.id, quantity, note)
    toast.success(`${quantity}× ${product.name} no carrinho`)
    onDone()
  }

  return (
    <>
      <ProductImage
        path={product.image_path}
        alt={product.name}
        sizes="(min-width: 512px) 512px, 100vw"
        className="aspect-[4/3] w-full"
        priority
        muted={soldOut}
      />

      <div className="flex flex-col gap-4 p-5">
        <div className="space-y-1.5">
          {soldOut && <Badge variant="secondary">Esgotado</Badge>}
          <SheetTitle className="text-2xl font-semibold">{product.name}</SheetTitle>
          {product.description ? (
            <SheetDescription className="text-base">{product.description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Detalhes do produto</SheetDescription>
          )}
          <p className="text-lg font-semibold text-cocoa">{formatBRL(product.price_cents)}</p>
        </div>

        {soldOut ? (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Este docinho acabou por hoje. Volte mais tarde ou escolha outro sabor 💕
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={noteId}>Observação (opcional)</Label>
              <Textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Ex.: embalar separado…"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3 pb-[env(safe-area-inset-bottom)]">
              <QuantityStepper
                value={quantity}
                onChange={(v) => setQuantity(clampQuantity(v))}
                label={product.name}
              />
              <Button size="xl" className="flex-1" onClick={handleAdd}>
                Adicionar · {formatBRL(product.price_cents * quantity)}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
