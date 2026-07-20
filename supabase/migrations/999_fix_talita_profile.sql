-- Correção pontual: a conta da Talita é de ATLETA, não treinadora/admin.
-- Ela ganhou um profiles de treinador no fluxo antigo (auto-cadastro por código),
-- e ficou sem vínculo com o cadastro de atleta. Este script liga a conta ao
-- atleta e remove o perfil de treinador/admin.
--
-- Ajuste o e-mail abaixo se o login dela for diferente de saabtalita@gmail.com.

-- 1) Liga a conta de login ao cadastro de atleta (para entrar na área do atleta)
update public.athletes
set user_id = (select id from auth.users where lower(email) = 'saabtalita@gmail.com' limit 1)
where full_name ilike 'Talita Saab' and user_id is null;

-- 2) Remove o perfil de treinador/admin criado por engano
delete from public.profiles
where id = (select id from auth.users where lower(email) = 'saabtalita@gmail.com' limit 1);
