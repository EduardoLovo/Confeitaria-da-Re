import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

/**
 * Hash do IP de quem fez a requisição, para o rate limit de pedidos.
 * Guardamos só o hash (com sal), nunca o IP em texto (LGPD).
 */
export async function requestIpHash(): Promise<string | null> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || null
  if (!ip) return null

  const salt = process.env.RATE_LIMIT_SALT
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new Error('Defina RATE_LIMIT_SALT nas variáveis de ambiente.')
  }
  return createHash('sha256')
    .update(`${salt ?? 'dev-salt'}:${ip}`)
    .digest('hex')
}
