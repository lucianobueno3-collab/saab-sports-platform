-- Migration 026: staff (treinador/admin) gerencia os dados de treino de
-- qualquer atleta ("todos veem todos" também na escrita dos dados de treino).
--
-- Problema: as policies de activities/daily_metrics/... exigiam que o atleta
-- pertencesse ao coach logado (athletes.coach_id = auth.uid()), sem bypass de
-- admin. Importar treinos/métricas de um atleta de outro coach dava
-- "row-level security policy violation" (42501).
--
-- Solução: policies ADITIVAS liberando INSERT/UPDATE/DELETE/SELECT para quem
-- é coach ou admin (get_my_role() é security definer — sem recursão de RLS).
-- Coexistem com as policies de dono e de autoacesso do atleta (combinam por OR).

drop policy if exists "activities: staff manage all" on public.activities;
create policy "activities: staff manage all" on public.activities for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

drop policy if exists "daily_metrics: staff manage all" on public.daily_metrics;
create policy "daily_metrics: staff manage all" on public.daily_metrics for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

do $$
begin
  if to_regclass('public.athlete_thresholds') is not null then
    execute 'drop policy if exists "thresholds: staff manage all" on public.athlete_thresholds';
    execute 'create policy "thresholds: staff manage all" on public.athlete_thresholds for all
      using (public.get_my_role() in (''coach'', ''admin''))
      with check (public.get_my_role() in (''coach'', ''admin''))';
  end if;
  if to_regclass('public.activity_laps') is not null then
    execute 'drop policy if exists "laps: staff manage all" on public.activity_laps';
    execute 'create policy "laps: staff manage all" on public.activity_laps for all
      using (public.get_my_role() in (''coach'', ''admin''))
      with check (public.get_my_role() in (''coach'', ''admin''))';
  end if;
end $$;
