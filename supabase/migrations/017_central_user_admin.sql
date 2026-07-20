-- Migration 017: cadastro central de acesso
-- Admin e treinadores criam contas manualmente (e-mail + senha temporária).
-- A criação em si roda na Netlify Function admin-create-user (service role);
-- aqui ajustamos o trigger e limpamos resquícios do auto-cadastro antigo.

-- ─── Trigger de novo usuário ciente de atleta ───────────────────────────────
-- Contas de atleta (user_metadata.account_type = 'athlete') NÃO recebem linha
-- em profiles — senão o atleta herdaria acesso de treinador via RLS.
-- A identidade do atleta vem de athletes.user_id.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') = 'athlete' then
    return new;
  end if;
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── Limpeza de segurança ───────────────────────────────────────────────────
-- Contas já vinculadas como atleta (fluxo antigo por código) podem ter ganhado
-- um profiles de treinador pelo trigger anterior. Remove esses profiles órfãos,
-- preservando quem também é coach de algum atleta (evita violar a FK coach_id).
delete from public.profiles p
where p.id in (select user_id from public.athletes where user_id is not null)
  and p.id not in (select coach_id from public.athletes where coach_id is not null);
