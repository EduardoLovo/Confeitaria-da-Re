'use client'

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { ConfirmButton } from '@/components/admin/confirm-button'
import { a11y } from '@/components/admin/form-field'
import { ReorderButtons } from '@/components/admin/reorder-buttons'
import { Toggle } from '@/components/admin/toggle'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format'
import { deleteZone, reorderZones, saveZone, setZoneActive } from './actions'

type Zone = { id: string; neighborhood: string; fee_cents: number; is_active: boolean }

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

export function ZoneManager({ zones }: { zones: Zone[] }) {
  const ids = zones.map((z) => z.id)
  return (
    <div className="flex flex-col gap-3">
      <ZoneForm />
      {zones.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum bairro cadastrado. Sem bairros, só a retirada fica disponível.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zones.map((zone, index) => (
            <ZoneRow key={zone.id} zone={zone} ids={ids} index={index} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ZoneRow({ zone, ids, index }: { zone: Zone; ids: string[]; index: number }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="rounded-2xl border bg-card p-3">
        <ZoneForm zone={zone} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${zone.is_active ? '' : 'opacity-60'}`}>
      <ReorderButtons ids={ids} index={index} label={zone.neighborhood} onReorder={reorderZones} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{zone.neighborhood}</p>
        <p className="text-sm text-muted-foreground tabular-nums">Taxa {formatBRL(zone.fee_cents)}</p>
      </div>
      <Toggle checked={zone.is_active} label={`Atender ${zone.neighborhood}`} onChange={(v) => setZoneActive(zone.id, v)} />
      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Editar ${zone.neighborhood}`}>
        <Pencil />
      </Button>
      <ConfirmButton
        title={`Excluir "${zone.neighborhood}"?`}
        description="O bairro sai da lista do checkout. Pedidos antigos continuam com o nome do bairro."
        confirmLabel="Excluir"
        onConfirm={() => deleteZone(zone.id)}
        size="icon-sm"
        aria-label={`Excluir ${zone.neighborhood}`}
      >
        <Trash2 />
      </ConfirmButton>
    </li>
  )
}

function ZoneForm({ zone, onDone }: { zone?: Zone; onDone?: () => void }) {
  const [key, setKey] = useState(0)
  const { onSubmit, pending, errors } = useActionForm(saveZone, {
    onSuccess: () => (zone ? onDone?.() : setKey((k) => k + 1)),
  })
  const prefix = zone ? `zone-${zone.id}` : 'zone-new'

  return (
    <form key={key} onSubmit={onSubmit} className="flex flex-col gap-2">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      {(zone?.is_active ?? true) && <input type="hidden" name="is_active" value="on" />}
      <div className="grid grid-cols-[1fr_7rem_auto] items-start gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-name`} className="text-xs font-medium">
            Bairro
          </label>
          <Input
            {...a11y(`${prefix}-name`, errors.neighborhood)}
            name="neighborhood"
            defaultValue={zone?.neighborhood}
            maxLength={80}
            placeholder="Ex.: Vila Mariana"
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-fee`} className="text-xs font-medium">
            Taxa (R$)
          </label>
          <Input
            {...a11y(`${prefix}-fee`, errors.fee)}
            name="fee"
            inputMode="decimal"
            defaultValue={zone ? centsToInput(zone.fee_cents) : ''}
            placeholder="6,00"
            className="h-11 text-base"
          />
        </div>
        <div className="flex gap-1 self-end">
          <Button type="submit" size="lg" className="h-11" disabled={pending} aria-label={zone ? 'Salvar bairro' : 'Adicionar bairro'}>
            {zone ? <Check /> : <Plus />}
            <span className={zone ? 'sr-only' : 'hidden sm:inline'}>{zone ? 'Salvar' : 'Adicionar'}</span>
          </Button>
          {zone && (
            <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onDone} aria-label="Cancelar edição">
              <X />
            </Button>
          )}
        </div>
      </div>
      {(errors.neighborhood || errors.fee) && (
        <p id={errors.neighborhood ? `${prefix}-name-error` : `${prefix}-fee-error`} className="text-sm font-semibold text-destructive">
          {errors.neighborhood ?? errors.fee}
        </p>
      )}
    </form>
  )
}
