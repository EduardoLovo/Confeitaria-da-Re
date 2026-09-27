import { Pencil, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { requireAdminPage } from '@/lib/auth'
import { formatBRL } from '@/lib/format'
import { ProductImage } from '@/components/public/product-image'
import { CategoryManager } from './category-manager'
import { ProductRowControls } from './product-row-controls'

export const metadata: Metadata = { title: 'Produtos' }

export default async function ProductsPage() {
  const { supabase } = await requireAdminPage()

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, slug, is_active, products (id, name, price_cents, image_path, is_active, is_available)')
    .order('sort_order')
    .order('name')
    .order('sort_order', { referencedTable: 'products' })
    .order('name', { referencedTable: 'products' })
  if (error) throw new Error(error.message)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-cocoa">Produtos</h1>
        {categories.length > 0 && (
          <Button size="lg" nativeButton={false} render={<Link href="/admin/produtos/novo" />}>
            <Plus /> Novo produto
          </Button>
        )}
      </div>

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          is_active: c.is_active,
          productCount: c.products.length,
        }))}
      />

      {categories.map((category) => {
        const productIds = category.products.map((p) => p.id)
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id={`cat-${category.id}`} className="text-xl font-semibold text-cocoa">
                {category.name}
                {!category.is_active && (
                  <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">(oculta)</span>
                )}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={`/admin/produtos/novo?categoria=${category.id}`} />}
              >
                <Plus /> Adicionar
              </Button>
            </div>

            {category.products.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum produto nesta categoria.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {category.products.map((product, index) => (
                  <li
                    key={product.id}
                    className={`flex gap-3 rounded-2xl border bg-card p-2.5 ${product.is_active ? '' : 'opacity-60'}`}
                  >
                    <ProductImage
                      path={product.image_path}
                      alt=""
                      sizes="56px"
                      className="size-14 shrink-0 rounded-xl"
                      muted={!product.is_available}
                    />
                    {/* No celular: nome/preço em cima e controles embaixo. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="leading-tight font-semibold">{product.name}</p>
                          <p className="text-sm text-muted-foreground tabular-nums">{formatBRL(product.price_cents)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/admin/produtos/${product.id}`} />}
                          aria-label={`Editar ${product.name}`}
                          className="sm:order-last"
                        >
                          <Pencil />
                        </Button>
                      </div>
                      <ProductRowControls
                        id={product.id}
                        name={product.name}
                        isActive={product.is_active}
                        isAvailable={product.is_available}
                        ids={productIds}
                        index={index}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
