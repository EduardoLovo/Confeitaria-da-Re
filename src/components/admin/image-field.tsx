'use client'

import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'

import { Button } from '@/components/ui/button'
import { compressImage } from '@/lib/admin/compress-image'
import { IMAGES_BUCKET, publicImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/client'

type Props = {
  /** Nome do campo escondido que vai no FormData (ex.: "image_path"). */
  name: string
  /** Pasta no bucket: "products", "flavors", "gallery", "store". */
  folder: string
  defaultPath?: string | null
  label?: string
  aspect?: 'square' | 'wide'
  /** Upload direto (sem formulário), ex.: galeria. */
  onUploaded?: (path: string) => void
}

/**
 * Escolhe uma foto, comprime no navegador e envia direto para o Storage
 * (o RLS do bucket só aceita admin). O caminho resultante vai num input
 * escondido; a Server Action do formulário grava no banco.
 */
export function ImageField({ name, folder, defaultPath, label = 'Foto', aspect = 'square', onUploaded }: Props) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState(defaultPath ?? '')
  const [uploading, setUploading] = useState(false)
  const url = publicImageUrl(path)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const newPath = `${folder}/${crypto.randomUUID()}.${ext}`
      const { error } = await createClient()
        .storage.from(IMAGES_BUCKET)
        .upload(newPath, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
      if (error) throw error
      setPath(newPath)
      onUploaded?.(newPath)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error && error.message ? error.message : 'Não foi possível enviar a foto.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium" id={`${id}-label`}>
          {label}
        </span>
      )}
      <input type="hidden" name={name} value={path} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-labelledby={`${id}-label`}
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-secondary/50 text-muted-foreground transition hover:border-rose focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            aspect === 'square' ? 'size-28' : 'aspect-[4/3] w-40',
          )}
        >
          {url ? (
            <Image src={url} alt="" fill sizes="160px" className="object-cover" />
          ) : (
            <ImagePlus className="size-8" aria-hidden />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-card/70">
              <Loader2 className="size-6 animate-spin text-cocoa" aria-label="Enviando foto" />
            </span>
          )}
        </button>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {url ? 'Trocar foto' : 'Escolher foto'}
          </Button>
          {url && !onUploaded && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPath('')} disabled={uploading}>
              <Trash2 /> Remover
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
