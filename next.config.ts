import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : '*.supabase.co'
const isDev = process.env.NODE_ENV === 'development'

/**
 * Content Security Policy: de onde o navegador pode carregar scripts, imagens
 * e fazer requisições. Sem nonces (guia oficial do Next "Without Nonces"),
 * para manter o cache das páginas. Se incluir um serviço novo no navegador
 * (ex.: gateway de pagamento na Fase 2), adicione o domínio aqui.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://${supabaseHost}`,
  "font-src 'self'",
  // Supabase (dados, upload de fotos, Realtime via WebSocket) e ViaCEP (busca de CEP).
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://viacep.com.br${isDev ? ' ws: http://localhost:*' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Impede que o site seja aberto dentro de outro site (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  // O navegador não "adivinha" o tipo dos arquivos.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Não vaza o endereço completo (ex.: link do pedido) para outros sites.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Recursos do aparelho que o site não usa ficam bloqueados.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Sempre HTTPS (2 anos). Só vale em produção (o navegador ignora em http://localhost).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
