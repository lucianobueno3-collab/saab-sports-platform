-- Migration 027: cruzar treino PLANEJADO com o REALIZADO (importado)
-- Liga cada treino programado (planned_workouts) à atividade (activities) do
-- mesmo dia e modalidade, para exibir "planejado vs realizado" juntos.

alter table public.planned_workouts
  add column if not exists activity_id uuid references public.activities(id) on delete set null;

create index if not exists idx_planned_workouts_activity on public.planned_workouts(activity_id);

-- Faz o "match": liga treinos planejados ainda sem realizado a uma atividade
-- do mesmo atleta, mesmo dia e mesma modalidade. Idempotente (só liga os que
-- ainda não têm activity_id). Retorna quantos foram vinculados.
-- security definer para cruzar planned_workouts x activities sem esbarrar na
-- RLS; protegido para staff (coach/admin) ou o próprio atleta.
create or replace function public.match_planned_activities(p_athlete uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count int := 0;
begin
  if not (public.get_my_role() in ('coach', 'admin') or public.my_athlete_id() = p_athlete) then
    return 0;
  end if;

  update public.planned_workouts pw
    set activity_id = a.id, completed = true, updated_at = now()
  from public.activities a
  where pw.athlete_id = p_athlete
    and pw.activity_id is null
    and pw.date between p_from and p_to
    and a.athlete_id = p_athlete
    and (a.started_at at time zone 'UTC')::date = pw.date
    and lower(a.sport) = lower(pw.sport)
    and not exists (select 1 from public.planned_workouts p2 where p2.activity_id = a.id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.match_planned_activities(uuid, date, date) to authenticated;
