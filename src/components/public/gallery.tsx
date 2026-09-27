'use client'

import { Dialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'

import type { GalleryPhoto } from '@/lib/data/custom-orders'
import { publicImageUrl } from '@/lib/images'

/** Grade de fotos de trabalhos anteriores + lightbox com setas, teclado e deslizar. */
export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null)
  const touchX = useRef<number | null>(null)

  const open = index !== null
  const current = open ? photos[index] : null
  const go = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length))

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label={`Ampliar foto${photo.caption ? `: ${photo.caption}` : ` ${i + 1}`}`}
            >
              <Image
                src={publicImageUrl(photo.image_path)!}
                alt={photo.caption ?? ''}
                fill
                sizes="(min-width: 640px) 240px, 50vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root open={open} onOpenChange={(o) => !o && setIndex(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/90 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            className="fixed inset-0 z-50 flex flex-col text-white outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') go(1)
              if (e.key === 'ArrowLeft') go(-1)
            }}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return
              const dx = e.changedTouches[0].clientX - touchX.current
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
              touchX.current = null
            }}
          >
            {current && (
              <>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm tabular-nums opacity-80" aria-live="polite">
                    {index! + 1} de {photos.length}
                  </span>
                  <Dialog.Close
                    className="flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
                    aria-label="Fechar"
                  >
                    <X className="size-6" />
                  </Dialog.Close>
                </div>

                <div className="relative flex-1">
                  <Image
                    key={current.id}
                    src={publicImageUrl(current.image_path)!}
                    alt={current.caption ?? `Foto ${index! + 1}`}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    priority
                  />
                  {photos.length > 1 && (
                    <>
                      <NavButton side="left" onClick={() => go(-1)} />
                      <NavButton side="right" onClick={() => go(1)} />
                    </>
                  )}
                </div>

                <Dialog.Title className="min-h-16 px-4 py-4 text-center text-base">
                  {current.caption ?? <span className="sr-only">Foto {index! + 1}</span>}
                </Dialog.Title>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Foto anterior' : 'Próxima foto'}
      className={`absolute top-1/2 ${side === 'left' ? 'left-2' : 'right-2'} flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none`}
    >
      <Icon className="size-6" />
    </button>
  )
}
