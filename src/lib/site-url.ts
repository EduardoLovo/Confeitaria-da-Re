import 'server-only'

/**
 * Endereço público do site, para montar links absolutos (ex.: acompanhamento
 * do pedido enviado pelo WhatsApp).
 *
 * 1. SITE_URL, se definido (use quando tiver domínio próprio: https://confeitariadare.com.br)
 * 2. Na Vercel, o domínio de produção do projeto (variável automática)
 * 3. Em desenvolvimento, http://localhost:3000
 */
export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

export function orderTrackingUrl(orderId: string): string {
  return `${getSiteUrl()}/pedido/${orderId}`
}
