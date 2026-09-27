import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Sessão só importa no painel. O site público não passa pelo proxy.
  matcher: ['/admin/:path*'],
}
