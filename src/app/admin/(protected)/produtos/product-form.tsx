'use client'

import { Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'

import { ConfirmButton } from '@/components/admin/confirm-button'
import { a11y, FormField, inputClass, selectClass } from '@/components/admin/form-field'
import { ImageField } from '@/components/admin/image-field'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Tables } from '@/lib/supabase/database.types'
import { deleteProduct, saveProduct } from './actions'

type Product = Pick<
  Tables<'products'>,
  'id' | 'category_id' | 'name' | 'description' | 'price_cents' | 'image_path' | 'is_active' | 'is_available'
>

type Props = {
  categories: { id: string; name: string }[]
  product?: Product
  defaultCategoryId?: string
}

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

export function ProductForm({ categories, product, defaultCategoryId }: Props) {
  const { onSubmit, pending, errors } = useActionForm(saveProduct)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-6">
      {product && <input type="hidden" name="id" value={product.id} />}

      <ImageField name="image_path" folder="products" defaultPath={product?.image_path} />

      <FormField id="name" label="Nome" error={errors.name}>
        <Input {...a11y('name', errors.name)} name="name" defaultValue={product?.name} maxLength={120} className={inputClass} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="category_id" label="Categoria" error={errors.category_id}>
          <select
            {...a11y('category_id', errors.category_id)}
            name="category_id"
            defaultValue={product?.category_id ?? defaultCategoryId ?? categories[0]?.id}
            className={selectClass}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="price" label="Preço (R$)" error={errors.price}>
          <Input
            {...a11y('price', errors.price)}
            name="price"
            inputMode="decimal"
            defaultValue={product ? centsToInput(product.price_cents) : ''}
            placeholder="4,50"
            className={inputClass}
          />
        </FormField>
      </div>

      <FormField id="description" label="Descrição curta (opcional)" error={errors.description}>
        <Textarea
          {...a11y('description', errors.description)}
          name="description"
          defaultValue={product?.description ?? ''}
          maxLength={500}
          rows={3}
        />
      </FormField>

      <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
        <SwitchRow name="is_active" defaultChecked={product?.is_active ?? true} label="Mostrar no cardápio" />
        <SwitchRow name="is_available" defaultChecked={product?.is_available ?? true} label="Disponível (desligado = Esgotado)" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {product ? (
          <ConfirmButton
            title={`Excluir "${product.name}"?`}
            description="O produto sai do cardápio. Pedidos antigos continuam com o nome e o preço registrados."
            confirmLabel="Excluir produto"
            onConfirm={() => deleteProduct(product.id)}
            size="xl"
            className="text-destructive"
          >
            <Trash2 /> Excluir
          </ConfirmButton>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="xl" nativeButton={false} render={<Link href="/admin/produtos" />}>
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

/** Switch que participa do FormData (envia "on" quando ligado). */
export function SwitchRow({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
      {label}
      <Switch name={name} value="on" defaultChecked={defaultChecked} />
    </label>
  )
}
