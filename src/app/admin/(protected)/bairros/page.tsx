import type { Metadata } from 'next'

import { requireAdminPage } from '@/lib/auth'
import { ZoneManager } from './zone-manager'

export const metadata: Metadata = { title: 'Bairros' }

export default async function ZonesPage() {
  const { supabase } = await requireAdminPage()
  const { data: zones, error } = await supabase
    .from('delivery_zones')
    .select('id, neighborhood, fee_cents, is_active')
    .order('sort_order')
    .order('neighborhood')
  if (error) throw new Error(error.message)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-cocoa">Bairros atendidos</h1>
        <p className="text-sm text-muted-foreground">
          Só os bairros ativos aparecem no checkout. A taxa é somada ao pedido de entrega.
        </p>
      </div>
      <ZoneManager zones={zones} />
    </div>
  )
}
