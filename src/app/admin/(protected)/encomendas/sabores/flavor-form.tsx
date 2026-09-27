'use client'

import { Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'

import { ConfirmButton } from '@/components/admin/confirm-button'
import { a11y, FormField, inputClass } from '@/components/admin/form-field'
import { ImageField } from '@/components/admin/image-field'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Tables } from '@/lib/supabase/database.types'
import { SwitchRow } from '../../produtos/product-form'
import { deleteFlavor, saveFlavor } from '../actions'

type Flavor = Pick<Tables<'custom_flavors'>, 'id' | 'name' | 'description' | 'image_path' | 'highlights' | 'is_active'>

export function FlavorForm({ flavor }: { flavor?: Flavor }) {
  const { onSubmit, pending, errors } = useActionForm(saveFlavor)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-6">
      {flavor && <input type="hidden" name="id" value={flavor.id} />}

      <ImageField name="image_path" folder="flavors" defaultPath={flavor?.image_path} label="Foto (opcional)" />

      <FormField id="name" label="Nome do sabor" error={errors.name}>
        <Input {...a11y('name', errors.name)} name="name" defaultValue={flavor?.name} maxLength={80} className={inputClass} />
      </FormField>

      <FormField id="description" label="Descrição (opcional)" error={errors.description}>
        <Textarea
          {...a11y('description', errors.description)}
          name="description"
          defaultValue={flavor?.description ?? ''}
          maxLength={500}
          rows={3}
        />
      </FormField>

      <FormField
        id="highlights"
        label="Ingredientes / diferenciais"
        error={errors.highlights}
        hint="Separe por vírgula. Ex.: Chocolate belga, Granulado belga, Forminhas personalizadas"
      >
        <Input
          {...a11y('highlights', errors.highlights)}
          name="highlights"
          defaultValue={flavor?.highlights.join(', ') ?? ''}
          className={inputClass}
        />
      </FormField>

      <div className="rounded-xl bg-muted/50 p-3">
        <SwitchRow name="is_active" defaultChecked={flavor?.is_active ?? true} label="Mostrar na página de encomendas" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {flavor ? (
          <ConfirmButton
            title={`Excluir "${flavor.name}"?`}
            description="O sabor sai da página de encomendas."
            confirmLabel="Excluir sabor"
            onConfirm={() => deleteFlavor(flavor.id)}
            size="xl"
            className="text-destructive"
          >
            <Trash2 /> Excluir
          </ConfirmButton>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="xl" nativeButton={false} render={<Link href="/admin/encomendas" />}>
            Voltar
          </Button>
          <Button type="submit" size="xl" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Salvar
          </Button>
        </div>
      </div>
    </form>
  )
}
