import { ArrowRight, Clock, AtSign, Gift, MapPin, MessageCircle, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { OpenStatus } from '@/components/public/open-status'
import { TrackOrderShortcut } from '@/components/public/track-order-shortcut'
import { getStoreInfo } from '@/lib/data/store'
import { groupOpeningHours } from '@/lib/domain/store-hours'
import { publicImageUrl } from '@/lib/images'
import { waLink } from '@/lib/whatsapp/wa-link'

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStoreInfo()
  return {
    title: { absolute: settings.name },
    description: settings.tagline ?? undefined,
  }
}

export default async function Home() {
  const { settings, hours, isOpen, nextOpening } = await getStoreInfo()
  // Logo enviada pelo painel (Storage) tem prioridade; senão usa a de /public.
  const logo = publicImageUrl(settings.logo_path) ?? '/Logo.png'

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* fundo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-rose/40 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-md flex-col gap-8 px-4 pt-12 pb-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="relative aspect-[828/765] w-64 overflow-hidden rounded-3xl border-4 border-card shadow-lg">
            <Image
              src={logo}
              alt={`Logo ${settings.name}`}
              fill
              sizes="256px"
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-cocoa">{settings.name}</h1>
          {settings.tagline && <p className="text-muted-foreground">{settings.tagline}</p>}
          <OpenStatus isOpen={isOpen} nextOpening={nextOpening} />
        </header>

        <TrackOrderShortcut />

        <nav aria-label="Como você quer comprar?" className="flex flex-col gap-4">
          <PathCard
            href="/pronta-entrega"
            icon={<ShoppingBag className="size-7" />}
            title="Delivery"
            description="Docinhos prontos para hoje, com entrega ou retirada."
            tone="cocoa"
          />
          <PathCard
            href="/encomendas"
            icon={<Gift className="size-7" />}
            title="Encomendas para festa"
            description="Docinhos personalizados para aniversários, casamentos e chás."
            tone="rose"
          />
        </nav>

        <section aria-labelledby="h-horarios" className="rounded-3xl border bg-card p-5">
          <h2 id="h-horarios" className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Clock className="size-5 text-cocoa" aria-hidden /> Horário de funcionamento
          </h2>
          <dl className="space-y-1.5 text-sm">
            {groupOpeningHours(hours).map((g) => (
              <div key={g.days} className="flex justify-between gap-4">
                <dt className="font-semibold capitalize">{g.days}</dt>
                <dd className={g.hours === 'Fechado' ? 'text-muted-foreground' : ''}>{g.hours}</dd>
              </div>
            ))}
          </dl>
          {settings.pickup_address && (
            <p className="mt-4 flex items-start gap-2 border-t pt-4 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-cocoa" aria-hidden />
              <span>
                <span className="font-semibold">Retirada:</span> {settings.pickup_address}
              </span>
            </p>
          )}
        </section>

        <footer className="flex flex-col items-center gap-4">
          <div className="flex justify-center gap-3">
            <a
              href={waLink(settings.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
            {settings.instagram_handle && (
              <a
                href={`https://instagram.com/${settings.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <AtSign className="size-4" aria-hidden /> Instagram
              </a>
            )}
          </div>
          <Link
            href="/privacidade"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Política de Privacidade
          </Link>
        </footer>
      </div>
    </main>
  )
}

function PathCard({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
  tone: 'cocoa' | 'rose'
}) {
  const styles =
    tone === 'cocoa'
      ? 'bg-cocoa text-cream hover:bg-cocoa/90'
      : 'bg-rose text-cocoa hover:bg-rose/85'
  const iconBg = tone === 'cocoa' ? 'bg-cream/15' : 'bg-card/60'

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-3xl p-5 shadow-md transition focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none ${styles}`}
    >
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${iconBg}`} aria-hidden>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-heading text-xl font-semibold">{title}</span>
        <span className="block text-sm opacity-90">{description}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" aria-hidden />
    </Link>
  )
}
