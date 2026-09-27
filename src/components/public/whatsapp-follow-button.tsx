'use client'

import { MessageCircle } from 'lucide-react'
import { useState } from 'react'

import { markWantsWhatsappUpdates } from '@/app/pedido/[id]/actions'

type Props = { orderId: string; href: string; alreadyFollowing: boolean }

/**
 * Abre o WhatsApp da loja com a mensagem pronta e registra no pedido que a
 * cliente quer acompanhar. É um link de verdade (não depende do JS para abrir).
 */
export function WhatsappFollowButton({ orderId, href, alreadyFollowing }: Props) {
  const [following, setFollowing] = useState(alreadyFollowing)

  return (
    <div className="flex flex-col gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setFollowing(true)
          void markWantsWhatsappUpdates(orderId)
        }}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-6 text-base font-semibold text-white shadow-md transition hover:bg-[#197a42] focus-visible:ring-4 focus-visible:ring-[#1f8f4e]/40 focus-visible:outline-none"
      >
        <MessageCircle className="size-5" aria-hidden />
        Quer acompanhar seu pedido pelo WhatsApp?
      </a>
      {following && (
        <p className="text-center text-sm text-muted-foreground" role="status">
          Combinado! Vamos te avisar pelo WhatsApp a cada etapa 💬
        </p>
      )}
    </div>
  )
}
