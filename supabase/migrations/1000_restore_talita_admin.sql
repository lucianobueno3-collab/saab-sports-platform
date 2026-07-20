-- Correção: a Talita é da equipe (Treinadora/Admin), não atleta.
-- Reverte o 999_fix_talita_profile.sql: desvincula a conta do cadastro de
-- atleta e restaura o perfil de staff como admin.
-- Seguro rodar mesmo que o 999 não tenha sido executado (idempotente).
--
-- Ajuste o e-mail se o login dela for diferente de saabtalita@gmail.com.

-- 1) Desvincula a conta de login de qualquer cadastro de atleta
--    (staff loga no painel; atleta cairia na área do atleta).
update public.athletes
set user_id = null
where user_id = (select id from auth.users where lower(email) = 'saabtalita@gmail.com' limit 1);

-- 2) (Re)cria o perfil de staff dela como admin.
insert into public.profiles (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Talita Saab'), 'admin'
from auth.users
where lower(email) = 'saabtalita@gmail.com'
on conflict (id) do update set role = 'admin', full_name = excluded.full_name;
