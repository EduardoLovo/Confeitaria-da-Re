'use client'

import { CreditCard, Loader2, MapPin, QrCode, ShieldCheck, Store, Truck } from 'lucide-react'
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
import {
  ONLINE_PAYMENT_WINDOW_MINUTES,
  paymentLabel,
  paymentMethodsFor,
  type AcceptedPaymentMethod,
} from '@/lib/domain/payment'
import { missingForMinimum } from '@/lib/domain/pricing'
import { formatBRL, maskCEP, maskPhoneBR, onlyDigits } from '@/lib/format'
import type { FulfillmentType } from '@/lib/supabase/database.types'
import { checkoutSchema, fieldErrors } from '@/lib/validation/order'
import { lookupCep } from '@/lib/viacep'
import { useCart, useCartHydrated } from '@/stores/cart'
import { useRecentOrders } from '@/stores/recent-orders'
import { ClosedNotice } from './closed-notice'

type Props = {
  products: ProductMap
  deliveryFeeCents: number
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
  neighborhood: string
  cep: string
  street: string
  streetNumber: string
  complement: string
  addressReference: string
  paymentMethod: AcceptedPaymentMethod | ''
  notes: string
}

const EMPTY: Form = {
  customerName: '',
  customerPhone: '',
  fulfillment: '',
  neighborhood: '',
  cep: '',
  street: '',
  streetNumber: '',
  complement: '',
  addressReference: '',
  paymentMethod: '',
  notes: '',
}

const PAYMENT_ICON: Record<AcceptedPaymentMethod, ReactNode> = {
  online: <ShieldCheck />,
  pix_on_delivery: <QrCode />,
  card_on_delivery: <CreditCard />,
}

function paymentOptionTitle(method: AcceptedPaymentMethod, fulfillment: FulfillmentType): string {
  return method === 'online' ? 'Pagar agora online' : paymentLabel(method, fulfillment)
}

function paymentOptionDetail(method: AcceptedPaymentMethod): string | undefined {
  return method === 'online' ? 'Pix ou cartão em até 12x, pelo checkout seguro da InfinitePay' : undefined
}

// Ordem em que o foco procura o primeiro campo com erro.
const FIELD_ORDER = [
  'customerName',
  'customerPhone',
  'fulfillment',
  'cep',
  'street',
  'streetNumber',
  'complement',
  'neighborhood',
  'addressReference',
  'paymentMethod',
  'notes',
]

export function CheckoutForm(props: Props) {
  const { products, deliveryFeeCents, isOpen, nextOpening, minOrderCents, pickupAddress, pickupHours } = props
  const router = useRouter()
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const clearCart = useCart((s) => s.clear)
  const rememberOrder = useRecentOrders((s) => s.remember)
  const cart = useMemo(() => resolveCart(lines, products), [lines, products])

  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notFound'>('idle')
  const [pending, startTransition] = useTransition()
  /** Depois do pedido: abrindo a confirmação ou indo para o pagamento. */
  const [placed, setPlaced] = useState<'confirmation' | 'payment' | null>(null)
  const errorBoxRef = useRef<HTMLDivElement>(null)

  const cepRequest = useRef<AbortController | null>(null)

  /** Entrega só tem pagamento online: já deixa marcado. Na retirada, a cliente escolhe. */
  function chooseFulfillment(fulfillment: FulfillmentType) {
    set('fulfillment', fulfillment)
    const allowed = paymentMethodsFor(fulfillment)
    setForm((f) => ({
      ...f,
      paymentMethod: allowed.length === 1 ? allowed[0] : f.paymentMethod,
    }))
  }

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

  // null = ainda não escolheu a forma de recebimento.
  const feeCents = form.fulfillment === 'delivery' ? deliveryFeeCents : form.fulfillment === 'pickup' ? 0 : null
  const totalCents = cart.subtotalCents + (feeCents ?? 0)
  const missing = missingForMinimum(cart.subtotalCents, minOrderCents)

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
        setForm((f) => ({
          ...f,
          street: f.street || address.street,
          neighborhood: f.neighborhood || address.neighborhood,
        }))
        setCepStatus('idle')
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

    const input = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      fulfillment: form.fulfillment,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      items: cart.lines
        .filter((r) => r.available)
        .map((r) => ({ productId: r.line.productId, quantity: r.line.quantity, note: r.line.note })),
      ...(form.fulfillment === 'delivery' && {
        neighborhood: form.neighborhood,
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
        const online = parsed.data.paymentMethod === 'online'
        rememberOrder({
          id: result.orderId,
          number: result.orderNumber,
          createdAt: new Date().toISOString(),
          status: online ? 'awaiting_payment' : 'received',
        })
        clearCart()
        if (result.paymentUrl) {
          setPlaced('payment')
          // Checkout da InfinitePay (outro site): volta para /pedido/[id]/pagamento.
          window.location.assign(result.paymentUrl)
          return
        }
        // Sem link agora (falha na InfinitePay): a página do pedido tem o "Pagar agora".
        setPlaced('confirmation')
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
        <p className="font-semibold">
          {placed === 'payment' ? 'Pedido registrado! Abrindo o pagamento…' : 'Pedido enviado! Abrindo a confirmação…'}
        </p>
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
            onChange={() => chooseFulfillment('delivery')}
            icon={<Truck />}
            title="Entrega"
            detail={deliveryFeeCents > 0 ? formatBRL(deliveryFeeCents) : 'Grátis'}
          />
          <RadioCard
            name="fulfillment"
            checked={form.fulfillment === 'pickup'}
            onChange={() => chooseFulfillment('pickup')}
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
                    : 'Preenche a rua e o bairro automaticamente.'
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

            <Field id="neighborhood" label="Bairro" error={errors.neighborhood}>
              <Input
                {...fieldProps('neighborhood', errors)}
                value={form.neighborhood}
                onChange={(e) => set('neighborhood', e.target.value)}
                autoComplete="address-level3"
                maxLength={80}
              />
            </Field>

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
      <Section
        title="Pagamento"
        description={
          form.fulfillment === 'delivery'
            ? 'Para entrega, o pagamento é feito agora, online.'
            : form.fulfillment === 'pickup'
              ? 'Pague agora online ou na hora da retirada.'
              : undefined
        }
      >
        {form.fulfillment ? (
          <fieldset
            id="f-paymentMethod"
            tabIndex={-1}
            aria-invalid={Boolean(errors.paymentMethod)}
            aria-describedby={errors.paymentMethod ? 'e-paymentMethod' : undefined}
            className="grid gap-2 outline-none"
          >
            <legend className="sr-only">Forma de pagamento</legend>
            {paymentMethodsFor(form.fulfillment).map((method) => (
              <RadioCard
                key={method}
                name="paymentMethod"
                checked={form.paymentMethod === method}
                onChange={() => set('paymentMethod', method)}
                icon={PAYMENT_ICON[method]}
                title={paymentOptionTitle(method, form.fulfillment as FulfillmentType)}
                detail={paymentOptionDetail(method)}
                inline
              />
            ))}
          </fieldset>
        ) : (
          <p id="f-paymentMethod" tabIndex={-1} className="text-sm text-muted-foreground outline-none">
            Escolha entrega ou retirada para ver as formas de pagamento.
          </p>
        )}
        <FieldError id="paymentMethod" error={errors.paymentMethod} />
        {form.paymentMethod === 'online' && (
          <p className="rounded-xl bg-secondary/60 p-3 text-sm">
            Ao fazer o pedido, você vai para a página de pagamento. Seu pedido é confirmado assim que o pagamento
            for aprovado; você tem <strong>{ONLINE_PAYMENT_WINDOW_MINUTES} minutos</strong> para pagar.
          </p>
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
            placeholder=""
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
              {feeCents === null ? '—' : feeCents === 0 ? 'Grátis' : formatBRL(feeCents)}
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
          falar com você sobre este pedido. Não vendemos nem usamos seus dados para outros fins.{' '}
          <Link href="/privacidade" target="_blank" className="underline underline-offset-2">
            Política de Privacidade
          </Link>
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
          ) : form.paymentMethod === 'online' ? (
            <>Ir para o pagamento · {formatBRL(totalCents)}</>
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
