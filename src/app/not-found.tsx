import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-cocoa">Página não encontrada</h1>
      <p className="text-muted-foreground">
        O link pode estar incompleto. Se for um pedido, confira o endereço que você recebeu.
      </p>
      <Link href="/" className="font-semibold text-cocoa underline underline-offset-4">
        Voltar para o início
      </Link>
    </main>
  )
}
