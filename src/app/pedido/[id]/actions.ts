'use server'

import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/admin'

/** Marca que a cliente quer acompanhar o pedido pelo WhatsApp. */
export async function markWantsWhatsappUpdates(orderId: string): Promise<void> {
  const parsed = z.uuid().safeParse(orderId)
  if (!parsed.success) return

  const { error } = await createServiceClient()
    .from('orders')
    .update({ wants_whatsapp_updates: true })
    .eq('id', parsed.data)

  if (error) console.error('[markWantsWhatsappUpdates]', error)
}
