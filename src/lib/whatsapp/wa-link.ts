import { onlyDigits } from '@/lib/format'

/**
 * Link wa.me. `phone` pode vir com ou sem 55 e com máscara.
 * Número brasileiro sem DDI (10–11 dígitos) ganha o 55 automaticamente.
 */
export function waLink(phone: string, message?: string): string {
  let digits = onlyDigits(phone)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
