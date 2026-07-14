-- Migration 008: correções da revisão geral

-- 1. FTP de corrida (Stryd) — TSS de corrida com potência usa FTP próprio, não o de ciclismo
alter table public.athletes
  add column if not exists ftp_run_watts integer;

comment on column public.athletes.ftp_run_watts is 'FTP de corrida (Stryd), em watts — usado para TSS de corrida com potência';

-- 2. Método de cálculo do TSS na atividade (power | hr | null)
alter table public.activities
  add column if not exists tss_method text check (tss_method in ('power', 'hr'));

comment on column public.activities.tss_method is 'Como o TSS foi calculado: power (wattímetro) ou hr (frequência cardíaca)';

-- 3. Corrigir RLS recursivo em profiles (migration 005 fazia subquery na própria tabela)
--    get_my_role() é security definer e não dispara RLS — sem recursão.
drop policy if exists "profiles: admin sees all" on public.profiles;
drop policy if exists "profiles: admin updates all" on public.profiles;

create policy "profiles: admin sees all"
  on public.profiles for select
  using (public.get_my_role() = 'admin');

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.get_my_role() = 'admin');
