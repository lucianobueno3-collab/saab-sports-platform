-- Migration 019: admin gerencia o vínculo treinador ⇄ atleta
-- Permite ao admin ver e reatribuir o treinador (coach_id) de qualquer atleta.
-- get_my_role() é security definer (sem recursão de RLS).

drop policy if exists "athletes: admin all" on public.athletes;
create policy "athletes: admin all" on public.athletes for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
