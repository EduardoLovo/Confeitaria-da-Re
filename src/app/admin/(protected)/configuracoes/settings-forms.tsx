'use client'

import { Loader2 } from 'lucide-react'

import { a11y, FormField, inputClass } from '@/components/admin/form-field'
import { ImageField } from '@/components/admin/image-field'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { STATUS_LABEL } from '@/lib/domain/order-status'
import { WEEKDAY_LABEL, type OpeningHours } from '@/lib/domain/store-hours'
import { maskPhoneBR } from '@/lib/format'
import type { OrderStatus, Tables } from '@/lib/supabase/database.types'
import { TEMPLATE_PLACEHOLDERS } from '@/lib/validation/admin'
import { saveCustomSettings, saveOpeningHours, saveStoreSettings, saveTemplates } from './actions'

type Settings = Tables<'store_settings'>

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

function SaveButton({ pending, label = 'Salvar' }: { pending: boolean; label?: string }) {
  return (
    <Button type="submit" size="xl" className="self-end" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />} {label}
    </Button>
  )
}

export function StoreForm({ settings }: { settings: Settings }) {
  const { onSubmit, pending, errors } = useActionForm(saveStoreSettings)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ImageField
        name="logo_path"
        folder="store"
        defaultPath={settings.logo_path}
        label="Logo (opcional — sem logo enviada, o site usa a imagem padrão)"
        aspect="wide"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Nome da loja" error={errors.name}>
          <Input {...a11y('name', errors.name)} name="name" defaultValue={settings.name} maxLength={80} className={inputClass} />
        </FormField>
        <FormField id="tagline" label="Frase de apresentação" error={errors.tagline}>
          <Input
            {...a11y('tagline', errors.tagline)}
            name="tagline"
            defaultValue={settings.tagline ?? ''}
            maxLength={120}
            className={inputClass}
          />
        </FormField>
        <FormField id="whatsapp" label="WhatsApp da loja" error={errors.whatsapp} hint="Recebe os pedidos e as encomendas.">
          <Input
            {...a11y('whatsapp', errors.whatsapp)}
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={maskPhoneBR(settings.whatsapp.slice(2))}
            className={inputClass}
          />
        </FormField>
        <FormField id="instagram_handle" label="Instagram (só o @)" error={errors.instagram_handle}>
          <Input
            {...a11y('instagram_handle', errors.instagram_handle)}
            name="instagram_handle"
            defaultValue={settings.instagram_handle ?? ''}
            placeholder="minhaloja"
            className={inputClass}
          />
        </FormField>
      </div>
      <FormField id="pickup_address" label="Endereço de retirada" error={errors.pickup_address}>
        <Input
          {...a11y('pickup_address', errors.pickup_address)}
          name="pickup_address"
          defaultValue={settings.pickup_address ?? ''}
          maxLength={200}
          className={inputClass}
        />
      </FormField>
      <FormField id="min_order" label="Pedido mínimo (R$)" error={errors.min_order} hint="Use 0 para não ter mínimo.">
        <Input
          {...a11y('min_order', errors.min_order)}
          name="min_order"
          inputMode="decimal"
          defaultValue={centsToInput(settings.min_order_cents)}
          className={`${inputClass} max-w-40`}
        />
      </FormField>
      <SaveButton pending={pending} />
    </form>
  )
}

export function HoursForm({ hours }: { hours: OpeningHours[] }) {
  const { onSubmit, pending, errors } = useActionForm(saveOpeningHours)
  // Segunda primeiro, domingo por último.
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {order.map((weekday) => {
          const day = hours.find((h) => h.weekday === weekday)
          const error = errors[`opens-${weekday}`] ?? errors[`closes-${weekday}`]
          return (
            <li key={weekday} className="flex flex-col gap-1 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex w-36 cursor-pointer items-center gap-2 font-semibold">
                  <Switch name={`open-${weekday}`} value="on" defaultChecked={day ? !day.is_closed : false} />
                  {WEEKDAY_LABEL[weekday]}
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <label className="sr-only" htmlFor={`opens-${weekday}`}>
                    Abre às ({WEEKDAY_LABEL[weekday]})
                  </label>
                  <Input
                    id={`opens-${weekday}`}
                    name={`opens-${weekday}`}
                    type="time"
                    defaultValue={day?.opens?.slice(0, 5) ?? '10:00'}
                    aria-invalid={Boolean(error) || undefined}
                    className="h-10 w-28"
                  />
                  <span aria-hidden>às</span>
                  <label className="sr-only" htmlFor={`closes-${weekday}`}>
                    Fecha às ({WEEKDAY_LABEL[weekday]})
                  </label>
                  <Input
                    id={`closes-${weekday}`}
                    name={`closes-${weekday}`}
                    type="time"
                    defaultValue={day?.closes?.slice(0, 5) ?? '19:00'}
                    aria-invalid={Boolean(error) || undefined}
                    className="h-10 w-28"
                  />
                </div>
              </div>
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Dia desligado = fechado. Os horários são de Brasília.</p>
      <SaveButton pending={pending} label="Salvar horários" />
    </form>
  )
}

export function CustomSettingsForm({ settings }: { settings: Settings }) {
  const { onSubmit, pending, errors } = useActionForm(saveCustomSettings)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField id="custom_intro" label="Texto de apresentação" error={errors.custom_intro}>
        <Textarea
          {...a11y('custom_intro', errors.custom_intro)}
          name="custom_intro"
          defaultValue={settings.custom_intro ?? ''}
          maxLength={1000}
          rows={4}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="custom_min_quantity" label="Quantidade mínima" error={errors.custom_min_quantity}>
          <Input
            {...a11y('custom_min_quantity', errors.custom_min_quantity)}
            name="custom_min_quantity"
            inputMode="numeric"
            defaultValue={settings.custom_min_quantity ?? ''}
            placeholder="Ex.: 50"
            className={inputClass}
          />
        </FormField>
        <FormField id="custom_min_lead_days" label="Antecedência (dias)" error={errors.custom_min_lead_days}>
          <Input
            {...a11y('custom_min_lead_days', errors.custom_min_lead_days)}
            name="custom_min_lead_days"
            inputMode="numeric"
            defaultValue={settings.custom_min_lead_days ?? ''}
            placeholder="Ex.: 7"
            className={inputClass}
          />
        </FormField>
      </div>
      <SaveButton pending={pending} />
    </form>
  )
}

const TEMPLATE_ORDER: OrderStatus[] = [
  'received',
  'confirmed',
  'out_for_delivery',
  'ready_for_pickup',
  'completed',
  'cancelled',
]

export function TemplatesForm({ templates }: { templates: Partial<Record<OrderStatus, string>> }) {
  const { onSubmit, pending, errors } = useActionForm(saveTemplates)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="rounded-xl bg-secondary/70 p-3 text-sm">
        Você pode usar: {TEMPLATE_PLACEHOLDERS.map((p) => <code key={p} className="mx-0.5 rounded bg-card px-1">{p}</code>)}
        . Eles são trocados pelos dados do pedido.
      </p>
      {TEMPLATE_ORDER.map((status) => {
        const id = `tpl-${status}`
        return (
          <FormField key={status} id={id} label={STATUS_LABEL[status]} error={errors[id]}>
            <Textarea {...a11y(id, errors[id])} name={id} defaultValue={templates[status] ?? ''} maxLength={1000} rows={2} />
          </FormField>
        )
      })}
      <SaveButton pending={pending} label="Salvar mensagens" />
    </form>
  )
}
