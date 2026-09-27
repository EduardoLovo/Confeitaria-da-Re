// Variáveis públicas (disponíveis no navegador). Lidas de forma estática
// para que o Next consiga embuti-las no bundle do cliente.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja .env.example).',
  )
}

export const publicEnv = { supabaseUrl, supabaseAnonKey } as const
