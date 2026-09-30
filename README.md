# Cardápio digital — Confeitaria da Re

Cardápio próprio (sem comissão de marketplace) para uma confeitaria de docinhos:

- **Delivery / pronta entrega** (`/pronta-entrega`): catálogo por categoria, carrinho, checkout com entrega ou retirada e página de acompanhamento do pedido.
- **Encomendas para festa** (`/encomendas`): portfólio (galeria, sabores) e um formulário que monta a mensagem e abre o WhatsApp da loja. Nada é salvo.
- **Painel** (`/admin`): pedidos em tempo real com alerta sonoro, fluxo de status com botão “Avisar cliente”, produtos, sabores, galeria e configurações (inclusive a taxa de entrega, única para todos os endereços).

Fase 1: **sem pagamento online** (paga na entrega/retirada) e **sem API do WhatsApp** (links `wa.me`). A arquitetura já está preparada para as Fases 2 e 3 (veja [Próximas fases](#próximas-fases)).

**Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 + shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage, Realtime) · Zod · Vitest · Vercel.

---

## Rodando localmente

Pré-requisitos: **Node.js 20.9+** e um projeto no [Supabase](https://supabase.com) (plano gratuito serve). Não é preciso Docker: o banco fica na nuvem.

```bash
npm install
cp .env.example .env.local      # preencha as variáveis (veja abaixo)
npx supabase login              # abre o navegador para autorizar a CLI
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:seed                 # aplica as migrations + dados de exemplo
npm run dev                     # http://localhost:3000
```

> O `db:seed` só deve ser usado na primeira vez. Depois, para aplicar migrations novas, use `npm run db:push`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm test` | Testes (Vitest) |
| `npm run typecheck` | Gera os tipos das rotas e roda o TypeScript |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica migrations pendentes no projeto linkado |
| `npm run db:seed` | Aplica migrations **e** o `supabase/seed.sql` |
| `npm run db:types` | Regenera `src/lib/supabase/database.types.ts` a partir do banco |

> **Windows:** se o CSS parar de atualizar no `npm run dev` (classes novas sem efeito), pare o servidor (Ctrl+C) e rode de novo.

---

## Variáveis de ambiente

Em **Supabase → Project Settings → API Keys** e **Data API**:

| Variável | Onde usar | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador + servidor | Chave **publishable** (`sb_publishable_…`) ou a antiga **anon** |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | Chave **secret** (`sb_secret_…`) ou a antiga **service_role**. Ignora o RLS: nunca exponha no navegador nem use o prefixo `NEXT_PUBLIC_` |
| `SITE_URL` | servidor (opcional) | Endereço público do site para o link de acompanhamento nas mensagens (`{link}`). Na Vercel o domínio de produção é detectado sozinho; preencha se usar domínio próprio, ex.: `https://www.confeitariadare.com.br` |
| `RATE_LIMIT_SALT` | servidor | Texto aleatório longo para o hash de IP do limite de pedidos. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CALLMEBOT_PHONE` / `CALLMEBOT_APIKEY` | servidor (opcional) | WhatsApp da loja (DDI+DDD, só dígitos) e chave do CallMeBot para o aviso de pedido novo. Sem elas, o aviso não é enviado |

---

## Criando o usuário admin

O cadastro público fica **desligado**. O acesso ao painel exige duas coisas: ser um usuário do Supabase Auth **e** estar na tabela `admin_users`.

1. Supabase → **Authentication → Sign In / Providers** → desligue **“Allow new users to sign up”** (uma vez só).
2. **Authentication → Users → Add user → Create new user**: e-mail, senha forte, marque **“Auto Confirm User”**.
3. **SQL Editor** (troque o e-mail):

   ```sql
   insert into admin_users (user_id)
   select id from auth.users where email = 'dona@exemplo.com';
   ```

4. Entre em `/admin`. No primeiro acesso, o painel pede para **ativar a verificação em duas etapas** (obrigatória): um código de 6 números gerado no celular (app **Senhas** do iPhone, Google Authenticator, Microsoft Authenticator ou Authy).

### Verificação em duas etapas (2FA)

- Login = e-mail + senha **e** o código do app. Sem o código, o banco (RLS) não libera nada do painel: a função `is_admin()` exige sessão `aal2`.
- Confira em **Supabase → Authentication → Multi-Factor** se **TOTP** está habilitado (vem ligado por padrão).
- **Perdeu o celular?** Supabase → **Authentication → Users** → abra o usuário → remova o fator MFA. No próximo login o painel pede para configurar de novo.

Para **remover** um admin: `delete from admin_users where user_id = (select id from auth.users where email = '…');`

---

## Deploy na Vercel

1. Suba o código para um repositório no GitHub (o `.env.local` **não** vai junto; ele está no `.gitignore`).
2. Na [Vercel](https://vercel.com): **Add New → Project**, importe o repositório. O framework (Next.js) é detectado sozinho.
3. Em **Environment Variables**, cadastre as 4 variáveis acima (Production e Preview).
4. **Deploy**.
5. Recomendado: em **Settings → Functions → Function Region**, escolha a região mais próxima do seu projeto Supabase (para Supabase em São Paulo, `gru1`). Isso deixa o site mais rápido.
6. Domínio próprio (opcional): **Settings → Domains**.
7. Coloque o link no Instagram 🎉

Migrations novas: rode `npm run db:push` **antes** de publicar o código que depende delas.

---

## Como funciona

### Estrutura

```
src/
  app/
    page.tsx                    Home
    pronta-entrega/             Catálogo (Delivery)
    checkout/                   Checkout + Server Action createOrder
    pedido/[id]/                Confirmação/acompanhamento (UUID na URL)
    encomendas/                 Encomendas para festa
    admin/login/                Login
    admin/(protected)/          Painel (pedidos, produtos, encomendas, configurações)
  components/public | admin | ui
  lib/
    data/                       Leituras no servidor (loja, catálogo, pedidos)
    domain/                     Regras puras (status, horários, carrinho, preços)
    validation/                 Schemas Zod (checkout e painel)
    notifications/              notifyCustomer() — ponto único de notificação
    whatsapp/                   Links wa.me e mensagem de encomenda
    supabase/                   Clientes (servidor, navegador, público, service_role)
  proxy.ts                      Renova a sessão e protege /admin (antigo "middleware")
supabase/
  migrations/                   Schema, funções, RLS, Storage, permissões
  seed.sql                      Dados de exemplo
tests/                          Vitest
```

### Segurança

- **Preços e totais sempre calculados no banco.** O navegador envia só produto, quantidade e observação. A função SQL `create_order()` (transação única) confere: loja aberta, produtos ativos e disponíveis, endereço completo (a taxa de entrega é a fixa da loja), pedido mínimo, troco, e o **rate limit** (3 pedidos por IP a cada 10 min; o IP é guardado só como hash). Ela só pode ser executada pela `service_role`.
- **RLS em todas as tabelas.** O público lê apenas catálogo, sabores, galeria e configurações ativos. **Pedidos nunca são legíveis publicamente**: a página `/pedido/[id]` busca no servidor pelo UUID e mostra só campos seguros.
- **Admin** = logado **e** em `admin_users` (função `is_admin()`). Mesmo logado, o admin só consegue alterar o **status** de um pedido; valores, itens e dados da cliente ficam imutáveis. As transições de status são validadas por trigger, e o histórico é registrado automaticamente.
- **Fotos:** bucket `images` com leitura pública pela URL, sem listagem pública; upload e exclusão só para admin. As fotos são redimensionadas e convertidas para WebP no navegador antes do upload.
- Todas as entradas passam por **Zod** (no navegador para mensagens por campo e de novo no servidor).
- **Cabeçalhos de segurança** em `next.config.ts`: Content Security Policy (o navegador só conversa com o próprio site, o Supabase e o ViaCEP), proteção contra o site ser embutido em outro (clickjacking), HSTS, `nosniff` e `Referrer-Policy`. **Ao adicionar um serviço usado no navegador** (ex.: gateway de pagamento, analytics), inclua o domínio dele na CSP, ou ele será bloqueado.
- **Cookies:** o site público não grava cookies (o carrinho fica no `localStorage` do aparelho). Só o painel usa cookies, os de sessão do login, que são estritamente necessários. Por isso não há banner de cookies; se um dia entrar Google Analytics, Meta Pixel ou similar, será preciso pedir consentimento (LGPD).

### Loja aberta

“Aberto agora” = **interruptor “Receber pedidos”** (Configurações) **E** dentro do horário do dia, no fuso `America/Sao_Paulo`. A regra oficial é a função SQL `is_store_open_now()`, usada pelo site e pela criação de pedidos.

### Status do pedido

- Entrega: `Recebido → Confirmado → Saiu para entrega → Concluído`
- Retirada: `Recebido → Confirmado → Pronto para retirada → Concluído`
- `Cancelado` a partir de qualquer etapa antes de Concluído.

A cada mudança, o botão **“Avisar cliente”** abre o WhatsApp da cliente com o texto daquele status (editável em Configurações → Mensagens; placeholders `{nome}`, `{numero}`, `{total}`, `{loja}`, `{endereco_retirada}` e `{link}`, que é o link de acompanhamento do pedido). A página do pedido da cliente se atualiza sozinha a cada 30 s.

**Acompanhamento sem conta:** a cliente não precisa de login. O link do pedido (com um código impossível de adivinhar) é o acesso: ele abre logo após o pedido, vai nas mensagens de WhatsApp (`{link}`) e fica salvo no aparelho, o que faz a Home mostrar o atalho **“Acompanhar meu pedido”** por 3 dias enquanto o pedido estiver em andamento.

### Pedidos em tempo real

O painel assina o Supabase Realtime (tabela `orders`, filtrada pelo RLS). Em cada pedido novo: som (toque em **“Ativar som”** uma vez, exigência dos navegadores), vibração no celular, aviso na tela, contador no título da aba e notificação do sistema se permitida. O indicador **Ao vivo / Offline** mostra a conexão; como rede de segurança, a lista também se atualiza a cada minuto.

Além disso, se `CALLMEBOT_PHONE` e `CALLMEBOT_APIKEY` estiverem definidas, a loja recebe no WhatsApp um resumo do pedido (primeiro nome, itens, total e link do painel), enviado pelo [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) logo após a confirmação (`src/lib/notifications/notify-owner.ts`). Uma falha no envio nunca afeta o pedido; só aparece no log.

---

## Próximas fases

### Fase 2 — pagamento online
- `orders` já tem `payment_status` (hoje sempre `pending`), `payment_provider` e `payment_reference`.
- Adicionar: gerar a cobrança (Pix/cartão) no gateway logo após `createOrder`, um Route Handler de **webhook** (`src/app/api/webhooks/<gateway>/route.ts`) que valida a assinatura e marca `payment_status = 'paid'`, e ajustar as opções de pagamento no checkout.

### Fase 3 — WhatsApp Cloud API
- Trocar **apenas** o final de `notifyCustomer()` em `src/lib/notifications/notify-customer.ts` pela chamada à API, devolvendo `{ channel: 'whatsapp_api', sent: true }`. O botão do painel já trata esse retorno (mostra “Mensagem enviada” em vez de abrir o WhatsApp).
- Para envio automático a cada status, chame `notifyCustomer()` dentro de `updateOrderStatus()` quando `wants_whatsapp_updates` for verdadeiro.

---

## Dados de exemplo

O `seed.sql` cria configurações da loja, horários (ter–sáb, 10h–19h), 4 categorias e 12 produtos, taxa de entrega de R$ 8,00, 6 sabores e as mensagens de WhatsApp. Troque tudo pelo painel; nada disso exige mexer no código.
