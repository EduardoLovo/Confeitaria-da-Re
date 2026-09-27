import type { Metadata } from 'next'

import { Toggle } from '@/components/admin/toggle'
import { requireAdminPage } from '@/lib/auth'
import { getStoreInfo } from '@/lib/data/store'
import type { OrderStatus } from '@/lib/supabase/database.types'
import { setOpenSwitch } from './actions'
import { CustomSettingsForm, HoursForm, StoreForm, TemplatesForm } from './settings-forms'

export const metadata: Metadata = { title: 'Configurações' }

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage()
  const [store, templates] = await Promise.all([
    getStoreInfo(),
    supabase.from('whatsapp_templates').select('status, body'),
  ])
  if (templates.error) throw new Error(templates.error.message)
  const { settings, hours, isOpen, nextOpening } = store
  const templateMap = Object.fromEntries(templates.data.map((t) => [t.status, t.body])) as Partial<
    Record<OrderStatus, string>
  >

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-cocoa">Configurações</h1>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-primary/20 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Receber pedidos</h2>
            <p className="text-sm text-muted-foreground">
              Desligue para fechar a loja agora (feriado, imprevisto). Ligado, a loja abre conforme os horários abaixo.
            </p>
          </div>
          <Toggle checked={settings.is_open_switch} label="Receber pedidos" onChange={setOpenSwitch} />
        </div>
        <p className={`text-sm font-semibold ${isOpen ? 'text-success' : 'text-muted-foreground'}`}>
          Agora: {isOpen ? 'Aberto' : `Fechado${nextOpening ? ` · ${nextOpening}` : ''}`}
        </p>
      </section>

      <Section title="Dados da loja">
        <StoreForm settings={settings} />
      </Section>

      <Section title="Horário de funcionamento" description="Também é o horário de retirada mostrado no checkout.">
        <HoursForm hours={hours} />
      </Section>

      <Section id="encomendas" title="Encomendas para festa">
        <CustomSettingsForm settings={settings} />
      </Section>

      <Section
        title="Mensagens de WhatsApp"
        description="Texto enviado à cliente em cada mudança de status (botão “Avisar cliente” nos pedidos)."
      >
        <TemplatesForm templates={templateMap} />
      </Section>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-32 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}
