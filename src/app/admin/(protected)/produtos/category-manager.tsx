'use client'

import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { a11y, inputClass } from '@/components/admin/form-field'
import { ConfirmButton } from '@/components/admin/confirm-button'
import { ReorderButtons } from '@/components/admin/reorder-buttons'
import { Toggle } from '@/components/admin/toggle'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteCategory, reorderCategories, saveCategory, setCategoryActive } from './actions'

type Category = { id: string; name: string; is_active: boolean; productCount: number }

/** Lista de categorias: criar, renomear, ocultar, ordenar e excluir. */
export function CategoryManager({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(categories.length === 0)
  const ids = categories.map((c) => c.id)

  return (
    <section className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-4 text-left font-semibold"
      >
        <span>Categorias ({categories.length})</span>
        <ChevronDown className={`size-5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t p-4">
          <ul className="flex flex-col gap-2">
            {categories.map((c, index) => (
              <CategoryRow key={c.id} category={c} ids={ids} index={index} />
            ))}
          </ul>
          <NewCategoryForm />
          <p className="text-xs text-muted-foreground">
            Categorias ocultas (switch desligado) não aparecem no cardápio, mesmo com produtos ativos.
          </p>
        </div>
      )}
    </section>
  )
}

function CategoryRow({ category, ids, index }: { category: Category; ids: string[]; index: number }) {
  const [editing, setEditing] = useState(false)
  const { onSubmit, pending, errors } = useActionForm(saveCategory, { onSuccess: () => setEditing(false) })
  const inputId = `cat-name-${category.id}`

  return (
    <li className="flex items-center gap-2 rounded-xl bg-muted/50 p-2">
      <ReorderButtons ids={ids} index={index} label={category.name} onReorder={reorderCategories} />
      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={category.id} />
          {category.is_active && <input type="hidden" name="is_active" value="on" />}
          <label htmlFor={inputId} className="sr-only">
            Nome da categoria
          </label>
          <Input
            {...a11y(inputId, errors.name)}
            name="name"
            defaultValue={category.name}
            maxLength={80}
            autoFocus
            className="h-9 flex-1"
          />
          <Button type="submit" size="icon-sm" disabled={pending} aria-label="Salvar nome">
            <Check />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="Cancelar">
            <X />
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 font-semibold">
            {category.name}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              ({category.productCount} {category.productCount === 1 ? 'produto' : 'produtos'})
            </span>
          </span>
          <Toggle
            checked={category.is_active}
            label={`Mostrar categoria ${category.name} no cardápio`}
            onChange={(value) => setCategoryActive(category.id, value)}
          />
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Renomear ${category.name}`}>
            <Pencil />
          </Button>
          <ConfirmButton
            title={`Excluir "${category.name}"?`}
            description={
              category.productCount > 0
                ? 'Esta categoria ainda tem produtos. Mova ou exclua os produtos antes.'
                : 'A categoria será removida do cardápio.'
            }
            confirmLabel="Excluir"
            onConfirm={() => deleteCategory(category.id)}
            size="icon-sm"
            aria-label={`Excluir ${category.name}`}
          >
            <Trash2 />
          </ConfirmButton>
        </>
      )}
    </li>
  )
}

function NewCategoryForm() {
  const [key, setKey] = useState(0)
  const { onSubmit, pending, errors } = useActionForm(saveCategory, { onSuccess: () => setKey((k) => k + 1) })

  return (
    <form key={key} onSubmit={onSubmit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="is_active" value="on" />
        <label htmlFor="new-category" className="sr-only">
          Nova categoria
        </label>
        <Input
          {...a11y('new-category', errors.name)}
          name="name"
          placeholder="Nova categoria, ex.: Bombons"
          maxLength={80}
          className={`${inputClass} flex-1`}
        />
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          <Plus /> Criar
        </Button>
      </div>
      {errors.name && (
        <p id="new-category-error" className="text-sm font-semibold text-destructive">
          {errors.name}
        </p>
      )}
    </form>
  )
}
