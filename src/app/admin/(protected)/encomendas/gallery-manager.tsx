'use client'

import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmButton } from '@/components/admin/confirm-button'
import { ReorderButtons } from '@/components/admin/reorder-buttons'
import { Toggle } from '@/components/admin/toggle'
import { useActionForm } from '@/components/admin/use-action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { compressImage } from '@/lib/admin/compress-image'
import { IMAGES_BUCKET, publicImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/client'
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  reorderGallery,
  saveGalleryCaption,
  setGalleryActive,
} from './actions'

type Photo = { id: string; image_path: string; caption: string | null; is_active: boolean }

export function GalleryManager({ photos }: { photos: Photo[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const ids = photos.map((p) => p.id)

  // Várias fotos de uma vez: comprime, envia ao Storage e cria o registro.
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setProgress({ done: 0, total: list.length })
    const supabase = createClient()
    let failures = 0

    for (const file of list) {
      try {
        const blob = await compressImage(file)
        const path = `gallery/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`
        const { error } = await supabase.storage
          .from(IMAGES_BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
        if (error) throw error
        const result = await addGalleryPhoto(path)
        if (!result.ok) throw new Error(result.message)
      } catch (error) {
        console.error(error)
        failures++
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }

    setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
    if (failures) toast.error(`${failures} foto(s) não puderam ser enviadas.`)
    else toast.success(list.length === 1 ? 'Foto adicionada' : `${list.length} fotos adicionadas`)
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="xl"
        className="self-start"
        onClick={() => inputRef.current?.click()}
        disabled={progress !== null}
      >
        {progress ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Enviando {progress.done + 1} de {progress.total}…
          </>
        ) : (
          <>
            <ImagePlus /> Adicionar fotos
          </>
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Nenhuma foto ainda. Adicione fotos de festas que você já fez: elas aparecem na página de Encomendas.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo, index) => (
            <GalleryItem key={photo.id} photo={photo} ids={ids} index={index} />
          ))}
        </ul>
      )}
    </div>
  )
}

function GalleryItem({ photo, ids, index }: { photo: Photo; ids: string[]; index: number }) {
  const { onSubmit, pending } = useActionForm(saveGalleryCaption)
  const captionId = `caption-${photo.id}`

  return (
    <li className={`flex gap-3 rounded-2xl border bg-card p-2.5 ${photo.is_active ? '' : 'opacity-60'}`}>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
        <Image src={publicImageUrl(photo.image_path)!} alt={photo.caption ?? ''} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <form onSubmit={onSubmit} className="flex gap-1.5">
          <input type="hidden" name="id" value={photo.id} />
          <label htmlFor={captionId} className="sr-only">
            Legenda
          </label>
          <Input
            id={captionId}
            name="caption"
            defaultValue={photo.caption ?? ''}
            placeholder="Legenda (opcional)"
            maxLength={200}
            className="h-9"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-9" disabled={pending}>
            Salvar
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Toggle
            checked={photo.is_active}
            label="Mostrar foto no site"
            visibleLabel="No site"
            onChange={setGalleryActive.bind(null, photo.id)}
          />
          <span className="flex-1" />
          <ReorderButtons ids={ids} index={index} label={`foto ${index + 1}`} onReorder={reorderGallery} />
          <ConfirmButton
            title="Excluir esta foto?"
            description="Ela sai da galeria e é apagada do armazenamento."
            confirmLabel="Excluir"
            onConfirm={() => deleteGalleryPhoto(photo.id)}
            size="icon-sm"
            aria-label="Excluir foto"
          >
            <Trash2 />
          </ConfirmButton>
        </div>
      </div>
    </li>
  )
}
