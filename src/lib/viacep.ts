import { z } from 'zod'

const viaCepSchema = z.object({
  logradouro: z.string().optional(),
  bairro: z.string().optional(),
  localidade: z.string().optional(),
  uf: z.string().optional(),
  erro: z.union([z.boolean(), z.string()]).optional(),
})

export type CepAddress = { street: string; neighborhood: string; city: string; state: string }

/** Consulta o ViaCEP (chamado do navegador). Retorna null se não encontrar. */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  if (!res.ok) return null
  const parsed = viaCepSchema.safeParse(await res.json())
  if (!parsed.success || parsed.data.erro) return null

  return {
    street: parsed.data.logradouro ?? '',
    neighborhood: parsed.data.bairro ?? '',
    city: parsed.data.localidade ?? '',
    state: parsed.data.uf ?? '',
  }
}

/** "Saúde " → "saude", para comparar bairros. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}
