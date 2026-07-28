-- ─────────────────────────────────────────────────────────────────────────
-- Função get_my_role() — papel do usuário logado (admin/coach), sem recursão.
--
-- Usada pelas policies de RLS desde a migração 008/019, mas nunca havia sido
-- versionada num arquivo (foi criada manualmente no banco). Este arquivo a
-- torna canônica e idempotente. Security definer para não recursar no RLS de
-- profiles. plpgsql para poder ser criada mesmo antes de profiles existir.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (select role from public.profiles where id = auth.uid());
end;
$$;

grant execute on function public.get_my_role() to authenticated;
