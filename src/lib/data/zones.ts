import 'server-only'

import type { Tables } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'

export type DeliveryZone = Pick<Tables<'delivery_zones'>, 'id' | 'neighborhood' | 'fee_cents'>

/** Bairros atendidos (só os ativos, via RLS). */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await createPublicClient()
    .from('delivery_zones')
    .select('id, neighborhood, fee_cents')
    .order('sort_order')
    .order('neighborhood')

  if (error) throw new Error(`bairros: ${error.message}`)
  return data
}
