import 'server-only'

import { connection } from 'next/server'
import { cache } from 'react'

import { nextOpeningLabel, type OpeningHours } from '@/lib/domain/store-hours'
import type { Tables } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'

export type StoreSettings = Tables<'store_settings'>

export type StoreInfo = {
  settings: StoreSettings
  hours: OpeningHours[]
  isOpen: boolean
  /** Ex.: "Abre terça às 10h". Calculado no servidor para evitar divergência de hidratação. */
  nextOpening: string | null
}

/** Configurações + horários + "aberto agora". Sempre lido na hora da requisição. */
export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  await connection()
  const supabase = createPublicClient()

  const [settings, hours, open] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('opening_hours').select('*').order('weekday'),
    supabase.rpc('is_store_open_now'),
  ])

  if (settings.error) throw new Error(`store_settings: ${settings.error.message}`)
  if (hours.error) throw new Error(`opening_hours: ${hours.error.message}`)
  if (open.error) throw new Error(`is_store_open_now: ${open.error.message}`)

  const isOpen = open.data === true
  return {
    settings: settings.data,
    hours: hours.data,
    isOpen,
    nextOpening: isOpen ? null : nextOpeningLabel(hours.data, new Date()),
  }
})
