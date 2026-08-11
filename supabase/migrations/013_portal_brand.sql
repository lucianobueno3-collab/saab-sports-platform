-- Migration 013: marca do portal do aluno (white-label SAAB / Caqui Pro)

alter table public.athletes
  add column if not exists portal_brand text not null default 'saab'
  check (portal_brand in ('saab', 'caqui'));

comment on column public.athletes.portal_brand is 'Identidade visual do portal do aluno: saab (padrão) ou caqui (Caqui Pro)';

-- Recria a RPC do portal para retornar também a marca
create or replace function public.portal_get_athlete(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes%rowtype;
  v_metrics jsonb;
  v_activities jsonb;
begin
  select * into v_athlete from public.athletes where portal_token = p_token;
  if not found then
    return null;
  end if;

  select to_jsonb(m) into v_metrics
  from (
    select date, ctl, atl, tsb, hrv_ms, body_battery, sleep_hours, rem_pct, resting_hr
    from public.daily_metrics
    where athlete_id = v_athlete.id
    order by date desc
    limit 1
  ) m;

  select coalesce(jsonb_agg(a), '[]'::jsonb) into v_activities
  from (
    select name, sport, started_at, duration_seconds, distance_meters, tss
    from public.activities
    where athlete_id = v_athlete.id
    order by started_at desc
    limit 5
  ) a;

  return jsonb_build_object(
    'full_name', v_athlete.full_name,
    'primary_sport', v_athlete.primary_sport,
    'portal_brand', coalesce(v_athlete.portal_brand, 'saab'),
    'metrics', v_metrics,
    'activities', v_activities
  );
end;
$$;

grant execute on function public.portal_get_athlete(uuid) to anon;
