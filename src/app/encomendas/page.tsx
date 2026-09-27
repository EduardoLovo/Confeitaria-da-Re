import { CalendarClock, MessageCircle, PackageCheck, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { CustomOrderForm } from '@/components/public/custom-order-form'
import { Gallery } from '@/components/public/gallery'
import { PageHeader } from '@/components/public/page-header'
import { getCustomOrderContent } from '@/lib/data/custom-orders'
import { getStoreInfo } from '@/lib/data/store'
import { pluralize } from '@/lib/format'
import { publicImageUrl } from '@/lib/images'
import { earliestPartyDate } from '@/lib/whatsapp/custom-order-message'

export const metadata: Metadata = {
  title: 'Encomendas para festa',
  description: 'Docinhos personalizados para aniversários, casamentos, chás e batizados.',
}

export default async function EncomendasPage() {
  const [store, { flavors, gallery }] = await Promise.all([getStoreInfo(), getCustomOrderContent()])
  const { settings } = store
  const leadDays = settings.custom_min_lead_days

  return (
    <>
      <PageHeader title="Encomendas para festa" storeName={settings.name} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pt-6 pb-16">
        {/* ---------- apresentação ---------- */}
        <section className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-cocoa">
            <Sparkles className="size-4" aria-hidden /> Docinhos personalizados
          </p>
          {settings.custom_intro && <p className="text-lg leading-relaxed">{settings.custom_intro}</p>}

          <ul className="grid gap-2 sm:grid-cols-2">
            {settings.custom_min_quantity && (
              <InfoPill icon={<PackageCheck />}>
                Mínimo de <strong>{pluralize(settings.custom_min_quantity, 'docinho')}</strong> por encomenda
              </InfoPill>
            )}
            {leadDays !== null && (
              <InfoPill icon={<CalendarClock />}>
                Peça com <strong>{pluralize(leadDays, 'dia')}</strong> de antecedência
              </InfoPill>
            )}
          </ul>

          <a
            href="#encomendar"
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <MessageCircle className="size-5" aria-hidden /> Quero encomendar
          </a>
        </section>

        {/* ---------- galeria ---------- */}
        {gallery.length > 0 && (
          <section aria-labelledby="h-galeria" className="flex flex-col gap-4">
            <SectionTitle id="h-galeria" title="Trabalhos anteriores" subtitle="Toque numa foto para ampliar" />
            <Gallery photos={gallery} />
          </section>
        )}

        {/* ---------- sabores ---------- */}
        {flavors.length > 0 && (
          <section aria-labelledby="h-sabores" className="flex flex-col gap-4">
            <SectionTitle id="h-sabores" title="Sabores" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {flavors.map((flavor) => {
                const img = publicImageUrl(flavor.image_path)
                return (
                  <li key={flavor.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                    {img && (
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                        <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 className="font-sans text-base font-bold">{flavor.name}</h3>
                      {flavor.description && (
                        <p className="text-sm text-muted-foreground">{flavor.description}</p>
                      )}
                      {flavor.highlights.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5" aria-label={`Diferenciais de ${flavor.name}`}>
                          {flavor.highlights.map((h) => (
                            <li key={h} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-cocoa">
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ---------- formulário ---------- */}
        <section
          id="encomendar"
          aria-labelledby="h-encomendar"
          className="flex scroll-mt-24 flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-6"
        >
          <SectionTitle
            id="h-encomendar"
            title="Vamos montar sua encomenda?"
            subtitle="Preencha o que já souber (tudo é opcional) e continue a conversa pelo WhatsApp."
          />
          <CustomOrderForm
            storeWhatsapp={settings.whatsapp}
            flavorNames={flavors.map((f) => f.name)}
            minQuantity={settings.custom_min_quantity}
            earliestDate={leadDays !== null ? earliestPartyDate(leadDays) : null}
            leadDays={leadDays}
          />
        </section>
      </main>
    </>
  )
}

function SectionTitle({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 id={id} className="text-2xl font-semibold text-cocoa">
        {title}
      </h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function InfoPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3 text-sm [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-cocoa">
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </li>
  )
}
