import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/public/page-header'
import { getStoreInfo } from '@/lib/data/store'
import { maskPhoneBR } from '@/lib/format'
import { waLink } from '@/lib/whatsapp/wa-link'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como tratamos os seus dados pessoais, de acordo com a LGPD.',
}

/** Atualize esta data sempre que mudar o texto da política. */
const LAST_UPDATED = '27 de setembro de 2026'

/*
 * Texto-base escrito a partir do que o site realmente faz. Não substitui a
 * revisão de um profissional. Se o site passar a coletar outros dados ou usar
 * novos serviços (pagamento online, Meta Pixel, Google Analytics…), atualize.
 */
export default async function PrivacyPage() {
  const { settings } = await getStoreInfo()
  const whatsappDisplay = maskPhoneBR(settings.whatsapp.slice(2))
  const contactLink = waLink(settings.whatsapp, 'Olá! Tenho uma solicitação sobre os meus dados pessoais.')

  return (
    <>
      <PageHeader title="Política de Privacidade" storeName={settings.name} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16">
        <article className="flex flex-col gap-8 text-[15px] leading-relaxed">
          <header className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
            <p>
              Esta política explica, de forma simples, quais dados pessoais a <strong>{settings.name}</strong>{' '}
              coleta pelo site, para que usa e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados
              (LGPD — Lei nº 13.709/2018).
            </p>
          </header>

          <Section title="1. Quem cuida dos seus dados">
            <p>
              A <strong>{settings.name}</strong> é a responsável (controladora) pelos dados pessoais tratados neste
              site. Para qualquer assunto sobre os seus dados, fale com a gente pelo WhatsApp{' '}
              <ExternalLink href={contactLink}>{whatsappDisplay}</ExternalLink>
              {settings.instagram_handle && (
                <>
                  {' '}
                  ou pelo Instagram{' '}
                  <ExternalLink href={`https://instagram.com/${settings.instagram_handle}`}>
                    @{settings.instagram_handle}
                  </ExternalLink>
                </>
              )}
              .
            </p>
          </Section>

          <Section title="2. Quais dados coletamos e para quê">
            <Table
              rows={[
                [
                  'Nome e WhatsApp',
                  'Identificar o seu pedido e falar com você sobre ele (confirmação, entrega, retirada, dúvidas).',
                ],
                [
                  'Endereço de entrega (rua, número, complemento, referência, bairro e CEP)',
                  'Entregar o pedido e calcular a taxa de entrega. Só é pedido quando você escolhe entrega.',
                ],
                [
                  'Itens, observações e forma de pagamento escolhida',
                  'Preparar o pedido exatamente como você pediu e combinar o pagamento na entrega ou retirada.',
                ],
                [
                  'Um código gerado a partir do endereço de internet (IP) do aparelho',
                  'Evitar abusos, como muitos pedidos falsos seguidos. Guardamos só esse código embaralhado, nunca o IP em si.',
                ],
              ]}
            />
            <p>
              Não pedimos CPF, documentos, dados de cartão ou senhas. O pagamento é feito na entrega ou na retirada,
              diretamente com a gente.
            </p>
          </Section>

          <Section title="3. Por que podemos usar esses dados (base legal)">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Execução do pedido</strong> (art. 7º, V da LGPD): os dados do pedido são necessários para
                preparar, entregar e atender você.
              </li>
              <li>
                <strong>Legítimo interesse</strong> (art. 7º, IX): o código do IP, usado apenas para a segurança do
                site e para evitar pedidos falsos.
              </li>
              <li>
                <strong>Obrigações legais</strong> (art. 7º, II): quando precisarmos guardar informações de vendas por
                exigência da lei.
              </li>
            </ul>
          </Section>

          <Section title="4. Encomendas para festa">
            <p>
              O formulário da página de Encomendas <strong>não envia nem guarda nada no nosso site</strong>: ele
              apenas monta uma mensagem e abre o seu WhatsApp. A conversa acontece no WhatsApp, que segue também as
              regras de privacidade da própria plataforma.
            </p>
          </Section>

          <Section title="5. Com quem os dados são compartilhados">
            <p>Não vendemos nem alugamos os seus dados. Eles só passam por serviços necessários para o site funcionar:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Supabase</strong> — armazena com segurança os pedidos e o cardápio (banco de dados).
              </li>
              <li>
                <strong>Vercel</strong> — hospeda o site.
              </li>
              <li>
                <strong>ViaCEP</strong> — quando você digita o CEP, ele é consultado nesse serviço público para
                preencher a rua automaticamente. Só o CEP é enviado.
              </li>
              <li>
                <strong>WhatsApp</strong> — quando você escolhe falar com a gente ou acompanhar o pedido por lá.
              </li>
            </ul>
            <p>
              Alguns desses serviços podem armazenar dados em servidores fora do Brasil, com medidas de segurança
              compatíveis com a LGPD. Também podemos compartilhar dados se uma autoridade exigir por lei.
            </p>
          </Section>

          <Section title="6. Cookies e dados no seu aparelho">
            <p>
              O site <strong>não usa cookies de rastreamento, publicidade ou análise</strong>. O seu carrinho fica
              salvo apenas no seu próprio aparelho (no armazenamento do navegador), para você não perder os itens ao
              fechar a página; você pode apagá-lo limpando os dados do navegador. A única área com cookies é o painel
              interno da loja, usado pela equipe para fazer login.
            </p>
          </Section>

          <Section title="7. Por quanto tempo guardamos">
            <p>
              Guardamos os dados dos pedidos pelo tempo necessário para atender você e para cumprir obrigações legais,
              como registros de vendas. Quando não forem mais necessários, ou se você pedir, os seus dados pessoais
              são excluídos ou tornados anônimos, exceto o que a lei nos obrigue a manter.
            </p>
          </Section>

          <Section title="8. Seus direitos">
            <p>Pela LGPD (art. 18), você pode, a qualquer momento e sem custo:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>confirmar se tratamos os seus dados e ter acesso a eles;</li>
              <li>corrigir dados incompletos ou desatualizados;</li>
              <li>pedir a exclusão ou a anonimização dos seus dados;</li>
              <li>saber com quem os seus dados foram compartilhados;</li>
              <li>pedir a portabilidade dos seus dados;</li>
              <li>se opor a algum uso que você considere inadequado.</li>
            </ul>
            <p>
              É só chamar no <ExternalLink href={contactLink}>WhatsApp</ExternalLink>. Para a sua segurança, podemos
              confirmar que o pedido é seu antes de atender. Você também pode reclamar à Autoridade Nacional de
              Proteção de Dados (ANPD) em{' '}
              <ExternalLink href="https://www.gov.br/anpd">gov.br/anpd</ExternalLink>.
            </p>
          </Section>

          <Section title="9. Segurança">
            <p>
              O site usa conexão segura (HTTPS), controle de acesso no banco de dados (os pedidos não ficam visíveis
              para o público) e acesso ao painel restrito à equipe da loja, com login. O link de acompanhamento do seu
              pedido tem um código único e difícil de adivinhar; evite compartilhá-lo, porque quem tiver o link pode ver
              os dados daquele pedido.
            </p>
          </Section>

          <Section title="10. Mudanças nesta política">
            <p>
              Podemos atualizar esta política quando o site mudar (por exemplo, se passarmos a aceitar pagamento
              online). A data da última atualização fica sempre no topo desta página.
            </p>
          </Section>
        </article>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-cocoa">{title}</h2>
      {children}
    </section>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y rounded-2xl border bg-card">
      {rows.map(([data, purpose]) => (
        <div key={data} className="flex flex-col gap-1 p-3 sm:grid sm:grid-cols-[14rem_1fr] sm:gap-4">
          <dt className="font-semibold">{data}</dt>
          <dd className="text-muted-foreground">{purpose}</dd>
        </div>
      ))}
    </dl>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-cocoa underline underline-offset-4"
    >
      {children}
    </a>
  )
}
