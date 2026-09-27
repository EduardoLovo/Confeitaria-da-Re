import { Candy } from 'lucide-react'
import Image from 'next/image'
import { cn } from 'cn'

import { publicImageUrl } from '@/lib/images'

type Props = {
  path: string | null
  alt: string
  sizes: string
  className?: string
  priority?: boolean
  muted?: boolean
}

/** Foto do produto em proporção fixa, com um placeholder delicado quando não há foto. */
export function ProductImage({ path, alt, sizes, className, priority, muted }: Props) {
  const src = publicImageUrl(path)

  return (
    <div className={cn('relative overflow-hidden bg-secondary', className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn('object-cover', muted && 'opacity-60 grayscale')}
        />
      ) : (
        <div
          aria-hidden
          className="flex size-full items-center justify-center bg-gradient-to-br from-secondary via-cream to-rose/60"
        >
          <Candy className="size-10 text-cocoa/40" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
