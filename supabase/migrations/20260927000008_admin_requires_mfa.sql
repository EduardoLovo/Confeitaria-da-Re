-- =============================================================
-- Verificação em duas etapas (TOTP) obrigatória para o painel.
--
-- is_admin_member(): o usuário está em admin_users (usado pelo fluxo de login
--   para decidir se mostra a tela do código / de configuração).
-- is_admin(): membro E sessão verificada com o segundo fator (aal2).
--   É a função usada em TODAS as políticas RLS e do Storage; então, sem o
--   código do app autenticador, o banco não libera nada do painel, mesmo
--   com a senha correta.
--
-- Perdeu o celular? No Supabase: Authentication → Users → (usuário) →
-- remover o fator MFA. No próximo login o painel pede para configurar de novo.
-- =============================================================

create or replace function public.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin_member()
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

revoke execute on function public.is_admin_member() from public;
grant execute on function public.is_admin_member() to authenticated, service_role;
