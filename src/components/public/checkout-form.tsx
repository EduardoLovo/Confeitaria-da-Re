'use client'

import { Banknote, CreditCard, Loader2, MapPin, QrCode, ShieldCheck, Store, Truck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { cn } from 'cn'

import { createOrder } from '@/app/checkout/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { resolveCart } from '@/lib/domain/cart'
import type { ProductMap } from '@/lib/domain/catalog'
import { paymentLabel } from '@/lib/domain/payment'
import { missingForMinimum } from '@/lib/domain/pricing'
import { formatBRL, maskCEP, maskPhoneBR, onlyDigits, parseBRLToCents } from '@/lib/format'
import type { FulfillmentType, PaymentMethod } from '@/lib/supabase/database.types'
import { checkoutSchema, fieldErrors } from '@/lib/validation/order'
import { lookupCep, normalizeName } from '@/lib/viacep'
import { useCart, useCartHydrated } from '@/stores/cart'
import { ClosedNotice } from './closed-notice'

type Zone = { id: string; neighborhood: string; fee_cents: number }

type Props = {
  products: ProductMap
  zones: Zone[]
  isOpen: boolean
  nextOpening: string | null
  minOrderCents: number
  pickupAddress: string | null
  pickupHours: { days: string; hours: string }[]
}

type Form = {
  customerName: string
  customerPhone: string
  fulfillment: FulfillmentType | ''
  deliveryZoneId: string
  cep: string
  street: string
  streetNumber: string
  complement: string
  addressReference: string
  paymentMethod: PaymentMethod | ''
  changeFor: string
  notes: string
}

const EMPTY: Form = {
  customerName: '',
  customerPhone: '',
  fulfillment: '',
  deliveryZoneId: '',
  cep: '',
  street: '',
  streetNumber: '',
  complement: '',
  addressReference: '',
  paymentMethod: '',
  changeFor: '',
  notes: '',
}

// Ordem em que o foco procura o primeiro campo com erro.
const FIELD_ORDER = [
  'customerName',
  'customerPhone',
  'fulfillment',
  'cep',
  'deliveryZoneId',
  'street',
  'streetNumber',
  'complement',
  'addressReference',
  'paymentMethod',
  'changeForCents',
  'notes',
]

export function CheckoutForm(props: Props) {
  const { products, zones, isOpen, nextOpening, minOrderCents, pickupAddress, pickupHours } = props
  const router = useRouter()
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const clearCart = useCart((s) => s.clear)
  const cart = useMemo(() => resolveCart(lines, products), [lines, products])

  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notFound' | 'zoneNotServed'>('idle')
  const [pending, startTransition] = useTransition()
  const [placed, setPlaced] = useState(false)
  const errorBoxRef = useRef<HTMLDivElement>(null)

  const cepRequest = useRef<AbortController | null>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const zone = zones.find((z) => z.id === form.deliveryZoneId)
  const feeCents = form.fulfillment === 'delivery' ? (zone?.fee_cents ?? null) : 0
  const totalCents = cart.subtotalCents + (feeCents ?? 0)
  const missing = missingForMinimum(cart.subtotalCents, minOrderCents)
  const minZoneFee = zones.length ? Math.min(...zones.map((z) => z.fee_cents)) : null

  // Autocompleta rua e bairro pelo CEP (opcional), assim que tiver 8 dígitos.
  function handleCepChange(value: string) {
    const masked = maskCEP(value)
    set('cep', masked)
    cepRequest.current?.abort()

    const digits = onlyDigits(masked)
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }

    const controller = new AbortController()
    cepRequest.current = controller
    setCepStatus('loading')
    lookupCep(digits, controller.signal)
      .then((address) => {
        if (controller.signal.aborted) return
        if (!address) return setCepStatus('notFound')
        const match = zones.find((z) => normalizeName(z.neighborhood) === normalizeName(address.neighborhood))
        setForm((f) => ({
          ...f,
          street: f.street || address.street,
          deliveryZoneId: match ? match.id : f.deliveryZoneId,
        }))
        setCepStatus(match || !address.neighborhood ? 'idle' : 'zoneNotServed')
      })
      .catch(() => {
        if (!controller.signal.aborted) setCepStatus('notFound')
      })
  }

  // Leva o foco ao primeiro campo com erro (ou à mensagem geral).
  useEffect(() => {
    const first = FIELD_ORDER.find((k) => errors[k])
    if (first) document.getElementById(`f-${first}`)?.focus()
    else if (formError) errorBoxRef.current?.focus()
  }, [errors, formError])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    let changeForCents: number | undefined
    if (form.paymentMethod === 'cash' && form.changeFor.trim()) {
      const parsed = parseBRLToCents(form.changeFor)
      if (parsed === null || parsed === 0) {
        setErrors({ changeForCents: 'Informe um valor válido, ex.: 50,00' })
        return
      }
      if (parsed < totalCents) {
        setErrors({ changeForCents: `O troco precisa ser para ${formatBRL(totalCents)} ou mais` })
        return
      }
      changeForCents = parsed
    }

    const input = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      fulfillment: form.fulfillment,
      paymentMethod: form.paymentMethod,
      changeForCents,
      notes: form.notes,
      items: cart.lines
        .filter((r) => r.available)
        .map((r) => ({ productId: r.line.productId, quantity: r.line.quantity, note: r.line.note })),
      ...(form.fulfillment === 'delivery' && {
        deliveryZoneId: form.deliveryZoneId,
        cep: form.cep,
        street: form.street,
        streetNumber: form.streetNumber,
        complement: form.complement,
        addressReference: form.addressReference,
      }),
    }

    const parsed = checkoutSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }

    startTransition(async () => {
      const result = await createOrder(input)
      if (result.ok) {
        setPlaced(true)
        clearCart()
        router.replace(`/pedido/${result.orderId}`)
        return
      }
      setErrors(result.fieldErrors ?? {})
      setFormError(result.message)
      if (result.refresh) router.refresh()
    })
  }

  // ---------- estados especiais ----------
  if (placed) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center" role="status">
        <Loader2 className="size-8 animate-spin text-cocoa" aria-hidden />
        <p className="font-semibold">Pedido enviado! Abrindo a confirmação…</p>
      </div>
    )
  }

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" aria-label="Carregando" />
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">Seu carrinho está vazio</p>
        <Button size="xl" nativeButton={false} render={<Link href="/pronta-entrega" />}>
          Ver o cardápio
        </Button>
      </div>
    )
  }

  const blocked = !isOpen || missing > 0 || cart.hasUnavailable || cart.itemCount === 0

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {!isOpen && <ClosedNotice nextOpening={nextOpening} />}

      {/* ---------- dados ---------- */}
      <Section title="Seus dados">
        <Field id="customerName" label="Nome" error={errors.customerName}>
          <Input
            {...fieldProps('customerName', errors)}
            value={form.customerName}
            onChange={(e) => set('customerName', e.target.value)}
            autoComplete="name"
            maxLength={100}
            placeholder="Como podemos te chamar?"
          />
        </Field>
        <Field
          id="customerPhone"
          label="WhatsApp"
          error={errors.customerPhone}
          hint="Usamos para falar sobre o seu pedido."
        >
          <Input
            {...fieldProps('customerPhone', errors, true)}
            value={form.customerPhone}
            onChange={(e) => set('customerPhone', maskPhoneBR(e.target.value))}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
          />
        </Field>
      </Section>

      {/* ---------- recebimento ---------- */}
      <Section title="Como você quer receber?">
        <fieldset
          id="f-fulfillment"
          tabIndex={-1}
          aria-invalid={Boolean(errors.fulfillment)}
          aria-describedby={errors.fulfillment ? 'e-fulfillment' : undefined}
          className="grid grid-cols-2 gap-3 outline-none"
        >
          <legend className="sr-only">Forma de recebimento</legend>
          <RadioCard
            name="fulfillment"
            checked={form.fulfillment === 'delivery'}
            onChange={() => set('fulfillment', 'delivery')}
            icon={<Truck />}
            title="Entrega"
            detail={minZoneFee !== null ? `a partir de ${formatBRL(minZoneFee)}` : undefined}
          />
          <RadioCard
            name="fulfillment"
            checked={form.fulfillment === 'pickup'}
            onChange={() => set('fulfillment', 'pickup')}
            icon={<Store />}
            title="Retirada"
            detail="Grátis"
          />
        </fieldset>
        <FieldError id="fulfillment" error={errors.fulfillment} />

        {form.fulfillment === 'delivery' && (
          <div className="flex flex-col gap-4 pt-1">
            <Field
              id="cep"
              label="CEP (opcional)"
              error={errors.cep}
              hint={
                cepStatus === 'loading'
                  ? 'Buscando endereço…'
                  : cepStatus === 'notFound'
                    ? 'Não encontramos esse CEP. Preencha o endereço abaixo.'
                    : cepStatus === 'zoneNotServed'
                      ? 'Seu bairro pode não estar na nossa área de entrega. Confira a lista abaixo.'
                      : 'Preenche a rua automaticamente.'
              }
            >
              <Input
                {...fieldProps('cep', errors, true)}
                value={form.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                className="h-11 max-w-40 text-base"
              />
            </Field>

            <Field id="deliveryZoneId" label="Bairro" error={errors.deliveryZoneId}>
              <select
                {...fieldProps('deliveryZoneId', errors)}
                value={form.deliveryZoneId}
                onChange={(e) => set('deliveryZoneId', e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              >
                <option value="">Selecione o bairro</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.neighborhood} — {formatBRL(z.fee_cents)}
                  </option>
                ))}
              </select>
            </Field>
            <p className="-mt-2 text-xs text-muted-foreground">
              Não achou seu bairro? Escolha retirada ou chame a gente no WhatsApp.
            </p>

            <Field id="street" label="Rua" error={errors.street}>
              <Input
                {...fieldProps('street', errors)}
                value={form.street}
                onChange={(e) => set('street', e.target.value)}
                autoComplete="address-line1"
                maxLength={150}
              />
            </Field>

            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Field id="streetNumber" label="Número" error={errors.streetNumber}>
                <Input
                  {...fieldProps('streetNumber', errors)}
                  value={form.streetNumber}
                  onChange={(e) => set('streetNumber', e.target.value)}
                  inputMode="numeric"
                  maxLength={20}
                />
              </Field>
              <Field id="complement" label="Complemento" error={errors.complement}>
                <Input
                  {...fieldProps('complement', errors)}
                  value={form.complement}
                  onChange={(e) => set('complement', e.target.value)}
                  autoComplete="address-line2"
                  maxLength={100}
                  placeholder="Apto, bloco…"
                />
              </Field>
            </div>

            <Field id="addressReference" label="Ponto de referência (opcional)" error={errors.addressReference}>
              <Input
                {...fieldProps('addressReference', errors)}
                value={form.addressReference}
                onChange={(e) => set('addressReference', e.target.value)}
                maxLength={150}
                placeholder="Ex.: portão azul, ao lado da padaria"
              />
            </Field>
          </div>
        )}

        {form.fulfillment === 'pickup' && (
          <div className="space-y-3 rounded-2xl bg-secondary/60 p-4 text-sm">
            {pickupAddress && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-cocoa" aria-hidden />
                <span>
                  <strong>Endereço para retirada:</strong> {pickupAddress}
                </span>
              </p>
            )}
            <div>
              <p className="mb-1 font-semibold">Horários de retirada</p>
              <dl className="space-y-0.5">
                {pickupHours.map((g) => (
                  <div key={g.days} className="flex justify-between gap-4">
                    <dt className="capitalize">{g.days}</dt>
                    <dd>{g.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-muted-foreground">Avisamos pelo WhatsApp quando estiver pronto.</p>
          </div>
        )}
      </Section>

      {/* ---------- pagamento ---------- */}
      <Section title="Pagamento" description="O pagamento é feito na entrega ou na retirada.">
        <fieldset
          id="f-paymentMethod"
          tabIndex={-1}
          aria-invalid={Boolean(errors.paymentMethod)}
          aria-describedby={errors.paymentMethod ? 'e-paymentMethod' : undefined}
          className="grid gap-2 outline-none"
        >
          <legend className="sr-only">Forma de pagamento</legend>
          {(
            [
              ['pix_on_delivery', <QrCode key="i" />],
              ['cash', <Banknote key="i" />],
              ['card_on_delivery', <CreditCard key="i" />],
            ] as const
          ).map(([method, icon]) => (
            <RadioCard
              key={method}
              name="paymentMethod"
              checked={form.paymentMethod === method}
              onChange={() => set('paymentMethod', method)}
              icon={icon}
              title={paymentLabel(method, form.fulfillment || undefined)}
              inline
            />
          ))}
        </fieldset>
        <FieldError id="paymentMethod" error={errors.paymentMethod} />

        {form.paymentMethod === 'cash' && (
          <Field
            id="changeForCents"
            label="Troco para quanto? (opcional)"
            error={errors.changeForCents}
            hint="Deixe em branco se não precisar de troco."
          >
            <div className="relative max-w-48">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                {...fieldProps('changeForCents', errors, true)}
                value={form.changeFor}
                onChange={(e) => set('changeFor', e.target.value.replace(/[^\d,.]/g, ''))}
                inputMode="decimal"
                placeholder="50,00"
                className="h-11 pl-9 text-base"
              />
            </div>
          </Field>
        )}
      </Section>

      {/* ---------- observações ---------- */}
      <Section title="Observações do pedido">
        <Field id="notes" label="Alguma observação? (opcional)" error={errors.notes} srOnlyLabel>
          <Textarea
            {...fieldProps('notes', errors)}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ex.: é presente, pode caprichar no laço 🎀"
          />
        </Field>
      </Section>

      {/* ---------- resumo ---------- */}
      <Section title="Resumo">
        <ul className="space-y-2 text-sm">
          {cart.lines.map(({ line, product, available, lineTotalCents }) => (
            <li key={line.id} className={cn('flex justify-between gap-3', !available && 'text-destructive')}>
              <span>
                <strong className="tabular-nums">{line.quantity}×</strong> {product?.name ?? 'Produto indisponível'}
                {!available && ' (esgotado)'}
                {line.note && <span className="block text-xs text-muted-foreground">Obs.: {line.note}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{available ? formatBRL(lineTotalCents) : '—'}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatBRL(cart.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Taxa de entrega</dt>
            <dd className="tabular-nums">
              {form.fulfillment === 'pickup'
                ? 'Grátis'
                : feeCents === null
                  ? form.fulfillment === 'delivery'
                    ? 'Selecione o bairro'
                    : '—'
                  : formatBRL(feeCents)}
            </dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatBRL(totalCents)}</dd>
          </div>
        </dl>

        {cart.hasUnavailable && (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            Alguns itens esgotaram.{' '}
            <Link href="/pronta-entrega" className="font-semibold underline">
              Volte ao cardápio
            </Link>{' '}
            e remova-os do carrinho.
          </p>
        )}
        {missing > 0 && (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            O pedido mínimo é de <strong>{formatBRL(minOrderCents)}</strong>. Faltam{' '}
            <strong>{formatBRL(missing)}</strong>.{' '}
            <Link href="/pronta-entrega" className="font-semibold underline">
              Adicionar mais docinhos
            </Link>
          </p>
        )}
      </Section>

      <p className="flex gap-2 px-1 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        <span>
          <strong>Privacidade:</strong> usamos seu nome, WhatsApp e endereço só para preparar, entregar e
          falar com você sobre este pedido. Não compartilhamos seus dados com terceiros (LGPD).
        </span>
      </p>

      {formError && (
        <div
          ref={errorBoxRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive outline-none"
        >
          {formError}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button type="submit" size="xl" className="h-14 w-full" disabled={blocked || pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Enviando pedido…
            </>
          ) : !isOpen ? (
            'Loja fechada'
          ) : (
            <>Fazer pedido · {formatBRL(totalCents)}</>
          )}
        </Button>
      </div>
    </form>
  )
}

// ---------- peças de UI ----------

function fieldProps(key: string, errors: Record<string, string>, describedByHint = false) {
  const describedBy = [errors[key] ? `e-${key}` : null, describedByHint ? `h-${key}` : null]
    .filter(Boolean)
    .join(' ')
  return {
    id: `f-${key}`,
    name: key,
    'aria-invalid': Boolean(errors[key]) || undefined,
    'aria-describedby': describedBy || undefined,
    className: 'h-11 text-base',
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-cocoa">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  srOnlyLabel,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  srOnlyLabel?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`f-${id}`} className={srOnlyLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`h-${id}`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  )
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={`e-${id}`} className="text-sm font-semibold text-destructive">
      {error}
    </p>
  )
}

function RadioCard({
  name,
  checked,
  onChange,
  icon,
  title,
  detail,
  inline,
}: {
  name: string
  checked: boolean
  onChange: () => void
  icon: ReactNode
  title: string
  detail?: string
  inline?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-2xl border-2 bg-card p-3 transition [&_svg]:size-5 [&_svg]:shrink-0',
        'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        inline ? 'items-center' : 'flex-col items-start',
        checked ? 'border-primary bg-secondary/50' : 'border-border hover:border-rose',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cn('text-cocoa', checked && 'text-primary')} aria-hidden>
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </span>
    </label>
  )
}
