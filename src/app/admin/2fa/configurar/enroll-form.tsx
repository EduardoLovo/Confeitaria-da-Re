'use client'

import { Check, Copy, Loader2, Smartphone } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CodeInput } from '../code-input'
import { confirmEnrollment, startEnrollment, type CodeState, type Enrollment } from '../actions'

export function EnrollForm({ next }: { next?: string }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [state, action, pending] = useActionState<CodeState, FormData>(confirmEnrollment, { error: null })
  const started = useRef(false)

  // Cria o fator uma única vez ao abrir a tela.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void startEnrollment().then((result) => {
      if (result.ok) setEnrollment(result.data)
      else setLoadError(result.message)
    })
  }, [])

  async function copySecret() {
    if (!enrollment) return
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Sem permissão de área de transferência: a chave continua visível para copiar à mão.
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
        {loadError}
      </p>
    )
  }

  if (!enrollment) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-muted-foreground" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden /> Preparando…
      </p>
    )
  }

  const groupedSecret = enrollment.secret.replace(/(.{4})/g, '$1 ').trim()

  return (
    <>
      <Step n={1} title="Adicione ao seu celular">
        <a
          href={enrollment.uri}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Smartphone className="size-5" aria-hidden /> Adicionar no app de senhas
        </a>
        <p className="text-sm text-muted-foreground">
          <strong>No iPhone</strong>, este botão abre o app <strong>Senhas</strong>: escolha salvar o código (junto
          da senha deste painel, se aparecer) e confirme. Também funciona com Google Authenticator, Microsoft
          Authenticator ou Authy.
        </p>

        <details className="rounded-2xl bg-muted/60 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Está no computador ou o botão não funcionou?</summary>
          <div className="mt-3 flex flex-col items-center gap-3">
            <p className="self-start">Escaneie com a câmera do celular:</p>
            {/* QR code em SVG gerado pelo Supabase */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollment.qrCode}
              alt="QR code para configurar o app autenticador"
              width={192}
              height={192}
              className="rounded-xl bg-white p-2"
            />
            <p className="self-start">Ou digite esta chave no app (opção “inserir chave de configuração”):</p>
            <div className="flex w-full items-center gap-2">
              <code className="flex-1 rounded-lg bg-card px-3 py-2 text-center font-mono text-sm break-all select-all">
                {groupedSecret}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copySecret} aria-label="Copiar chave">
                {copied ? <Check /> : <Copy />} {copied ? 'Copiada' : 'Copiar'}
              </Button>
            </div>
          </div>
        </details>
      </Step>

      <Step n={2} title="Digite o código que apareceu">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="factorId" value={enrollment.factorId} />
          {next && <input type="hidden" name="next" value={next} />}
          <CodeInput error={state.error} />
          <Button type="submit" size="xl" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Ativar e entrar
          </Button>
        </form>
      </Step>
    </>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-rose text-sm text-cocoa" aria-hidden>
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
