'use client'

import { Bell, BellOff } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { isAudioUnlocked, playChime, unlockAudio } from '@/lib/admin/chime'
import { formatBRL } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'

type Connection = 'connecting' | 'live' | 'offline'

const SOUND_KEY = 'painel:som'
const TITLE_PREFIX = /^\(\d+\) Novo pedido! · /

/** A pessoa está com a lista de pedidos aberta e visível? */
function isWatchingOrders(pathname: string) {
  return pathname === '/admin/pedidos' && document.visibilityState === 'visible'
}

/**
 * Fica no layout do painel: escuta pedidos novos (Supabase Realtime, que
 * respeita o RLS — só admins recebem) e avisa com som, vibração, toast,
 * título da aba e notificação do navegador. Também atualiza as listas.
 */
export function OrdersRealtime() {
  const router = useRouter()
  const pathname = usePathname()
  const [connection, setConnection] = useState<Connection>('connecting')
  const [soundOn, setSoundOn] = useState(false)
  const [unseen, setUnseen] = useState(0)
  // Abriu a lista de pedidos pelo menu: zera o contador (ajuste de estado na renderização).
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (pathname === '/admin/pedidos') setUnseen(0)
  }

  const soundRef = useRef(soundOn)
  const pathnameRef = useRef(pathname)
  const wasOffline = useRef(false)

  useEffect(() => {
    soundRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Preferência de som: salva no aparelho. O áudio em si só destrava com um toque.
  useEffect(() => {
    let wanted = false
    try {
      wanted = localStorage.getItem(SOUND_KEY) === '1'
    } catch {}
    if (!wanted) return
    const unlock = () => {
      void unlockAudio().then((ok) => setSoundOn(ok))
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Assinatura do Realtime.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function subscribe() {
      await supabase.auth.getSession()
      await supabase.realtime.setAuth()
      if (!active) return

      channel = supabase
        .channel('admin-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const order = payload.new as { id: string; number: number; customer_name: string; total_cents: number }
          if (soundRef.current) playChime()
          navigator.vibrate?.([200, 100, 200])
          if (!isWatchingOrders(pathnameRef.current)) setUnseen((n) => n + 1)
          toast(`🛎️ Novo pedido #${order.number}`, {
            description: `${order.customer_name} · ${formatBRL(order.total_cents)}`,
            duration: 20_000,
            action: {
              label: 'Ver',
              onClick: () => {
                setUnseen(0)
                router.push(`/admin/pedidos/${order.id}`)
              },
            },
          })
          if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`Novo pedido #${order.number}`, {
              body: `${order.customer_name} · ${formatBRL(order.total_cents)}`,
              tag: order.id,
            })
          }
          router.refresh()
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => router.refresh())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnection('live')
            // Voltou depois de cair: busca o que pode ter chegado nesse meio tempo.
            if (wasOffline.current) router.refresh()
            wasOffline.current = false
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnection('offline')
            wasOffline.current = true
          }
        })
    }

    void subscribe()
    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [router])

  // Rede de segurança: atualiza a lista de pedidos a cada minuto.
  useEffect(() => {
    if (!pathname.startsWith('/admin/pedidos')) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 60_000)
    return () => window.clearInterval(id)
  }, [pathname, router])

  // Título da aba: "(2) Novo pedido! · …" enquanto houver pedidos não vistos.
  useEffect(() => {
    const clean = document.title.replace(TITLE_PREFIX, '')
    document.title = unseen > 0 ? `(${unseen}) Novo pedido! · ${clean}` : clean
  }, [unseen, pathname])

  // Voltou para a aba na lista de pedidos: considera vistos.
  useEffect(() => {
    const onVisible = () => {
      if (isWatchingOrders(pathnameRef.current)) setUnseen(0)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function toggleSound() {
    if (soundOn) {
      setSoundOn(false)
      try {
        localStorage.setItem(SOUND_KEY, '0')
      } catch {}
      return
    }
    const ok = isAudioUnlocked() || (await unlockAudio())
    if (!ok) {
      toast.error('Seu navegador não liberou o som.')
      return
    }
    setSoundOn(true)
    playChime()
    try {
      localStorage.setItem(SOUND_KEY, '1')
    } catch {}
    // Aproveita o toque para pedir notificações do sistema (opcional).
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold',
          connection === 'live' ? 'text-success' : connection === 'offline' ? 'text-destructive' : 'text-muted-foreground',
        )}
        role="status"
        title={
          connection === 'live'
            ? 'Recebendo pedidos em tempo real'
            : connection === 'offline'
              ? 'Sem conexão em tempo real — a lista atualiza a cada minuto'
              : 'Conectando…'
        }
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            connection === 'live' ? 'animate-pulse bg-success' : connection === 'offline' ? 'bg-destructive' : 'bg-muted-foreground',
          )}
        />
        <span className="hidden sm:inline">
          {connection === 'live' ? 'Ao vivo' : connection === 'offline' ? 'Offline' : 'Conectando'}
        </span>
        <span className="sr-only sm:hidden">
          {connection === 'live' ? 'Ao vivo' : connection === 'offline' ? 'Offline' : 'Conectando'}
        </span>
      </span>
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          soundOn ? 'bg-success/15 text-success' : 'animate-pulse bg-rose text-cocoa',
        )}
      >
        {soundOn ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
        {soundOn ? 'Som ligado' : 'Ativar som'}
      </button>
    </div>
  )
}
