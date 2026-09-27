'use client'

import { Check, MessageCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from 'cn'

import { pluralize } from '@/lib/format'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildCustomOrderMessage } from '@/lib/whatsapp/custom-order-message'
import { waLink } from '@/lib/whatsapp/wa-link'

type Props = {
  storeWhatsapp: string
  flavorNames: string[]
  minQuantity: number | null
  /** "AAAA-MM-DD": primeira data aceitável pela antecedência mínima. */
  earliestDate: string | null
  leadDays: number | null
}

/**
 * Formulário opcional que só monta a mensagem do WhatsApp.
 * Nada é enviado para o nosso servidor nem salvo no banco.
 */
export function CustomOrderForm({ storeWhatsapp, flavorNames, minQuantity, earliestDate, leadDays }: Props) {
  const id = useId()
  const [name, setName] = useState('')
  const [partyDate, setPartyDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [flavors, setFlavors] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const qty = Number.parseInt(quantity, 10)
  const qtyTooLow = minQuantity !== null && Number.isFinite(qty) && qty > 0 && qty < minQuantity
  // Comparação de strings AAAA-MM-DD funciona como comparação de datas.
  const dateTooSoon = Boolean(partyDate && earliestDate && partyDate < earliestDate)

  const href = waLink(
    storeWhatsapp,
    buildCustomOrderMessage({
      name,
      partyDate: partyDate || undefined,
      quantity: Number.isFinite(qty) ? qty : undefined,
      flavors,
      notes,
    }),
  )

  const toggleFlavor = (flavor: string) =>
    setFlavors((list) => (list.includes(flavor) ? list.filter((f) => f !== flavor) : [...list, flavor]))

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Seu nome</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={100}
          className="h-11 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-date`}>Data da festa</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={partyDate}
            min={earliestDate ?? undefined}
            onChange={(e) => setPartyDate(e.target.value)}
            aria-describedby={dateTooSoon ? `${id}-date-warn` : undefined}
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-qty`}>Quantidade aprox.</Label>
          <Input
            id={`${id}-qty`}
            type="number"
            inputMode="numeric"
            min={minQuantity ?? 1}
            step={10}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder={minQuantity ? `mín. ${minQuantity}` : 'Ex.: 100'}
            aria-describedby={qtyTooLow ? `${id}-qty-warn` : undefined}
            className="h-11 text-base"
          />
        </div>
      </div>
      {dateTooSoon && (
        <p id={`${id}-date-warn`} className="-mt-2 rounded-xl bg-secondary p-3 text-sm">
          Pedimos {pluralize(leadDays ?? 0, 'dia')} de antecedência. Mesmo assim, chame a gente: vamos ver se ainda dá tempo!
        </p>
      )}
      {qtyTooLow && (
        <p id={`${id}-qty-warn`} className="-mt-2 rounded-xl bg-secondary p-3 text-sm">
          O mínimo por encomenda é de {pluralize(minQuantity!, 'docinho')}.
        </p>
      )}

      {flavorNames.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Sabores de interesse</legend>
          <div className="flex flex-wrap gap-2">
            {flavorNames.map((flavor) => {
              const checked = flavors.includes(flavor)
              return (
                <label
                  key={flavor}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition select-none',
                    'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleFlavor(flavor)}
                  />
                  {checked && <Check className="size-4" aria-hidden />}
                  {flavor}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-notes`}>Tema da festa / observações</Label>
        <Textarea
          id={`${id}-notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ex.: aniversário de 5 anos, tema Jardim Encantado, forminhas rosa"
        />
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-6 text-base font-semibold text-white shadow-md transition hover:bg-[#197a42] focus-visible:ring-4 focus-visible:ring-[#1f8f4e]/40 focus-visible:outline-none"
      >
        <MessageCircle className="size-5" aria-hidden />
        Quero encomendar
      </a>
      <p className="-mt-1 text-center text-xs text-muted-foreground">
        Abre o WhatsApp com a mensagem pronta. Nada é salvo no site.
      </p>
    </form>
  )
}
