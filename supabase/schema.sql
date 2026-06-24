-- ============================================================
-- SAAB SPORTS PLATFORM — Schema v1.0
-- Banco de dados seguro com RLS, índices e chaves únicas
-- Execute no SQL Editor do Supabase (supabase.com)
-- ============================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES (extensão da tabela auth.users do Supabase)
-- Armazena dados do coach/treinador
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  email        text unique not null,
  avatar_url   text,
  role         text not null default 'coach' check (role in ('coach', 'admin')),
  plan         text not null default 'starter' check (plan in ('starter', 'pro', 'elite')),
  max_athletes integer not null default 30,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do treinador — extensão de auth.users';

-- ============================================================
-- 2. ATHLETES (alunos do coach)
-- ============================================================
create table public.athletes (
  id                    uuid primary key default uuid_generate_v4(),
  coach_id              uuid not null references public.profiles(id) on delete cascade,

  -- Dados pessoais
  full_name             text not null,
  email                 text,
  phone                 text,
  avatar_url            text,
  birth_date            date,
  gender                text check (gender in ('M', 'F', 'other')),
  nationality           text default 'BR',

  -- Dados físicos
  weight_kg             numeric(5,2) check (weight_kg > 0 and weight_kg < 300),
  height_cm             numeric(5,1) check (height_cm > 0 and height_cm < 300),

  -- Modalidade
  primary_sport         text not null default 'running'
                          check (primary_sport in ('running','cycling','triathlon','swimming','duathlon','other')),
  secondary_sports      text[] default '{}',
  category              text,  -- ex: 'Age Group 40-44', 'Elite'
  team                  text,

  -- Limiares fisiológicos (atualizados após testes)
  ftp_watts             integer check (ftp_watts > 0 and ftp_watts < 2000),
  lthr_bpm              integer check (lthr_bpm > 0 and lthr_bpm < 250),
  max_hr_bpm            integer check (max_hr_bpm > 0 and max_hr_bpm < 250),
  resting_hr_bpm        integer check (resting_hr_bpm > 0 and resting_hr_bpm < 150),
  vo2max_ml_kg_min      numeric(5,2) check (vo2max_ml_kg_min > 0 and vo2max_ml_kg_min < 100),
  threshold_pace_sec_km integer check (threshold_pace_sec_km > 0),  -- segundos/km
  css_sec_100m          integer check (css_sec_100m > 0),           -- Critical Swim Speed

  -- PMC inicial (para não zerar histórico na importação)
  initial_ctl           numeric(8,2) not null default 0,
  initial_atl           numeric(8,2) not null default 0,
  initial_date          date,

  -- Integração TrainingPeaks
  tp_athlete_id         text unique,   -- ID no TrainingPeaks para API futura

  -- Meta
  goal                  text,
  notes                 text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Unique: um coach não pode ter dois atletas com o mesmo e-mail
  constraint uq_athlete_email_per_coach unique (coach_id, email)
);

comment on table public.athletes is 'Alunos cadastrados por treinador';
comment on column public.athletes.ftp_watts           is 'Functional Threshold Power (W)';
comment on column public.athletes.lthr_bpm            is 'Lactate Threshold Heart Rate (bpm)';
comment on column public.athletes.threshold_pace_sec_km is 'Pace limiar em segundos por km';
comment on column public.athletes.initial_ctl         is 'CTL de partida ao importar histórico antigo';

-- ============================================================
-- 3. ACTIVITIES (treinos importados via .FIT, .CSV ou API)
-- ============================================================
create table public.activities (
  id                    uuid primary key default uuid_generate_v4(),
  athlete_id            uuid not null references public.athletes(id) on delete cascade,

  -- Identificação
  name                  text,
  sport                 text not null default 'other',
  workout_type          text,  -- 'endurance', 'tempo', 'intervals', 'race', 'recovery'
  started_at            timestamptz not null,
  duration_seconds      integer not null check (duration_seconds >= 0),
  elapsed_seconds       integer check (elapsed_seconds >= 0),

  -- Distância
  distance_meters       numeric(10,2) check (distance_meters >= 0),

  -- Potência (Ciclismo / Corrida com stryd)
  avg_power_watts       integer check (avg_power_watts >= 0),
  max_power_watts       integer check (max_power_watts >= 0),
  normalized_power      integer check (normalized_power >= 0),
  intensity_factor      numeric(5,3) check (intensity_factor >= 0 and intensity_factor < 3),
  variability_index     numeric(5,3),
  tss                   numeric(8,2) check (tss >= 0),
  ftp_used              integer,    -- FTP ativo no momento da atividade

  -- Frequência cardíaca
  avg_hr_bpm            integer check (avg_hr_bpm >= 0 and avg_hr_bpm < 250),
  max_hr_bpm            integer check (max_hr_bpm >= 0 and max_hr_bpm < 250),
  hrss                  numeric(8,2),  -- HR Stress Score

  -- Corrida
  avg_pace_sec_km       integer check (avg_pace_sec_km >= 0),
  best_pace_sec_km      integer check (best_pace_sec_km >= 0),
  avg_cadence_rpm       integer check (avg_cadence_rpm >= 0 and avg_cadence_rpm < 300),

  -- Natação
  avg_pace_sec_100m     integer,
  swolf                 integer,
  stroke_count          integer,

  -- Altitude / ambiente
  elevation_gain_m      numeric(8,1) check (elevation_gain_m >= 0),
  elevation_loss_m      numeric(8,1) check (elevation_loss_m >= 0),
  avg_temperature_c     numeric(5,2),

  -- PMC snapshot (calculado no momento da importação)
  ctl_after             numeric(8,2),
  atl_after             numeric(8,2),
  tsb_after             numeric(8,2),

  -- Calorias
  calories              integer check (calories >= 0),

  -- Fonte do dado
  source                text not null default 'manual'
                          check (source in ('fit','csv','trainingpeaks_api','garmin_api','strava_api','manual')),
  external_id           text,   -- ID original no sistema fonte (evita duplicata)
  file_path             text,   -- path no Supabase Storage

  -- Raw do arquivo (para reprocessamento futuro)
  raw_data              jsonb,

  created_at            timestamptz not null default now(),

  -- Chave única: evita importar a mesma atividade duas vezes
  -- (mesmo atleta + mesma data/hora de início + mesma fonte)
  constraint uq_activity_source unique (athlete_id, source, external_id),
  constraint uq_activity_datetime unique (athlete_id, started_at, duration_seconds)
);

comment on table public.activities is 'Atividades de treino — importadas via FIT, CSV ou API';
comment on column public.activities.normalized_power is 'NP = Normalized Power (Coggan)';
comment on column public.activities.intensity_factor is 'IF = NP / FTP';
comment on column public.activities.tss             is 'TSS = Training Stress Score';
comment on column public.activities.external_id     is 'ID na fonte original — previne duplicatas';

-- ============================================================
-- 4. DAILY_METRICS (uma linha por atleta/dia — PMC + recuperação)
-- ============================================================
create table public.daily_metrics (
  id                uuid primary key default uuid_generate_v4(),
  athlete_id        uuid not null references public.athletes(id) on delete cascade,
  date              date not null,

  -- Performance Management Chart (Banister model)
  ctl               numeric(8,2) not null default 0,   -- Fitness (42d)
  atl               numeric(8,2) not null default 0,   -- Fadiga (7d)
  tsb               numeric(8,2) generated always as (ctl - atl) stored, -- Forma

  -- TSS do dia (soma de todas atividades)
  daily_tss         numeric(8,2) not null default 0,

  -- Recuperação fisiológica
  hrv_rmssd         numeric(7,3) check (hrv_rmssd >= 0),   -- ms
  hrv_sdnn          numeric(7,3) check (hrv_sdnn >= 0),    -- ms
  hrv_score         numeric(5,1) check (hrv_score between 0 and 100),
  recovery_score    numeric(5,1) check (recovery_score between 0 and 100),

  -- Sono
  sleep_hours       numeric(4,2) check (sleep_hours between 0 and 24),
  sleep_quality     numeric(5,1) check (sleep_quality between 0 and 100),
  sleep_start       time,
  sleep_end         time,

  -- Bem-estar subjetivo (RPE escala 1-10)
  stress_score      numeric(5,1) check (stress_score between 0 and 100),
  fatigue_score     numeric(5,1) check (fatigue_score between 1 and 10),
  mood_score        numeric(5,1) check (mood_score between 1 and 10),
  soreness_score    numeric(5,1) check (soreness_score between 1 and 10),

  -- FC de repouso
  resting_hr_bpm    integer check (resting_hr_bpm between 20 and 150),

  -- Peso diário (para monitorar hidratação/composição)
  weight_kg         numeric(5,2) check (weight_kg > 0 and weight_kg < 300),

  -- Fonte do registro
  source            text not null default 'calculated'
                      check (source in ('calculated','garmin','whoop','oura','polar','manual')),

  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Chave única: uma linha por atleta por dia
  constraint uq_daily_metrics_athlete_date unique (athlete_id, date)
);

comment on table public.daily_metrics    is 'Métricas diárias: PMC + recuperação + bem-estar';
comment on column public.daily_metrics.tsb is 'Gerado automaticamente: CTL - ATL';

-- ============================================================
-- 5. ATHLETE_THRESHOLDS (histórico de testes fisiológicos)
-- Mantém o histórico de FTP, LTHR, VO2max ao longo do tempo
-- ============================================================
create table public.athlete_thresholds (
  id              uuid primary key default uuid_generate_v4(),
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  test_date       date not null,
  test_type       text not null check (test_type in ('ftp_test','lthr_test','vo2max_test','pace_test','css_test','ramp_test','other')),

  -- Valores medidos
  ftp_watts       integer check (ftp_watts > 0),
  lthr_bpm        integer check (lthr_bpm > 0),
  max_hr_bpm      integer check (max_hr_bpm > 0),
  vo2max          numeric(5,2) check (vo2max > 0),
  threshold_pace_sec_km integer check (threshold_pace_sec_km > 0),
  css_sec_100m    integer check (css_sec_100m > 0),
  weight_kg       numeric(5,2),

  protocol        text,  -- ex: '20min FTP test', 'Ramp Test', 'LTHR Friel'
  notes           text,
  created_at      timestamptz not null default now(),

  constraint uq_threshold_per_type_date unique (athlete_id, test_type, test_date)
);

comment on table public.athlete_thresholds is 'Histórico de testes fisiológicos por atleta';

-- ============================================================
-- 6. ACTIVITY_LAPS (voltas/segmentos de cada atividade)
-- ============================================================
create table public.activity_laps (
  id                uuid primary key default uuid_generate_v4(),
  activity_id       uuid not null references public.activities(id) on delete cascade,
  lap_index         integer not null check (lap_index >= 0),

  start_time        timestamptz,
  duration_seconds  integer check (duration_seconds >= 0),
  distance_meters   numeric(10,2) check (distance_meters >= 0),
  avg_power_watts   integer,
  max_power_watts   integer,
  avg_hr_bpm        integer,
  max_hr_bpm        integer,
  avg_pace_sec_km   integer,
  avg_cadence       integer,
  elevation_gain_m  numeric(7,1),

  created_at        timestamptz not null default now(),

  constraint uq_lap_per_activity unique (activity_id, lap_index)
);

comment on table public.activity_laps is 'Detalhamento de voltas por atividade (dados do .FIT)';

-- ============================================================
-- 7. IMPORT_LOGS (rastreabilidade de cada importação)
-- ============================================================
create table public.import_logs (
  id              uuid primary key default uuid_generate_v4(),
  coach_id        uuid not null references public.profiles(id) on delete cascade,
  athlete_id      uuid references public.athletes(id) on delete set null,

  file_name       text not null,
  file_type       text not null check (file_type in ('fit','csv')),
  file_size_bytes integer,
  file_path       text,

  status          text not null default 'pending'
                    check (status in ('pending','processing','success','partial','error')),
  activities_found     integer default 0,
  activities_imported  integer default 0,
  activities_skipped   integer default 0,  -- duplicatas ignoradas
  activities_failed    integer default 0,

  error_message   text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,

  created_at      timestamptz not null default now()
);

comment on table public.import_logs is 'Log de todas as importações de arquivos';

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

-- athletes
create index idx_athletes_coach_id        on public.athletes(coach_id);
create index idx_athletes_coach_active    on public.athletes(coach_id, active);
create index idx_athletes_primary_sport   on public.athletes(primary_sport);
create index idx_athletes_tp_id           on public.athletes(tp_athlete_id) where tp_athlete_id is not null;

-- activities (as mais consultadas — índices críticos)
create index idx_activities_athlete_id    on public.activities(athlete_id);
create index idx_activities_athlete_date  on public.activities(athlete_id, started_at desc);
create index idx_activities_started_at    on public.activities(started_at desc);
create index idx_activities_sport         on public.activities(athlete_id, sport);
create index idx_activities_source        on public.activities(source);
create index idx_activities_tss_notnull   on public.activities(athlete_id, tss) where tss is not null;

-- daily_metrics (PMC — acessado com frequência para gráficos)
create index idx_daily_metrics_athlete_date on public.daily_metrics(athlete_id, date desc);
create index idx_daily_metrics_date         on public.daily_metrics(date desc);

-- athlete_thresholds
create index idx_thresholds_athlete_date on public.athlete_thresholds(athlete_id, test_date desc);

-- activity_laps
create index idx_laps_activity_id on public.activity_laps(activity_id);

-- import_logs
create index idx_import_logs_coach_id    on public.import_logs(coach_id, created_at desc);
create index idx_import_logs_athlete_id  on public.import_logs(athlete_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — nenhum dado vazado entre coaches
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.athletes          enable row level security;
alter table public.activities        enable row level security;
alter table public.daily_metrics     enable row level security;
alter table public.athlete_thresholds enable row level security;
alter table public.activity_laps     enable row level security;
alter table public.import_logs       enable row level security;

-- profiles: cada coach vê/edita apenas o próprio perfil
create policy "profiles: owner only"
  on public.profiles for all
  using (id = auth.uid());

-- athletes: coach vê apenas seus próprios atletas
create policy "athletes: coach owns"
  on public.athletes for all
  using (coach_id = auth.uid());

-- activities: acesso via athlete que pertence ao coach
create policy "activities: via athlete owner"
  on public.activities for all
  using (
    exists (
      select 1 from public.athletes a
      where a.id = activities.athlete_id
        and a.coach_id = auth.uid()
    )
  );

-- daily_metrics: idem
create policy "daily_metrics: via athlete owner"
  on public.daily_metrics for all
  using (
    exists (
      select 1 from public.athletes a
      where a.id = daily_metrics.athlete_id
        and a.coach_id = auth.uid()
    )
  );

-- athlete_thresholds: idem
create policy "thresholds: via athlete owner"
  on public.athlete_thresholds for all
  using (
    exists (
      select 1 from public.athletes a
      where a.id = athlete_thresholds.athlete_id
        and a.coach_id = auth.uid()
    )
  );

-- activity_laps: via activity → athlete → coach
create policy "laps: via activity owner"
  on public.activity_laps for all
  using (
    exists (
      select 1
      from public.activities ac
      join public.athletes a on a.id = ac.athlete_id
      where ac.id = activity_laps.activity_id
        and a.coach_id = auth.uid()
    )
  );

-- import_logs: coach vê apenas os próprios logs
create policy "import_logs: coach owns"
  on public.import_logs for all
  using (coach_id = auth.uid());

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_athletes_updated_at
  before update on public.athletes
  for each row execute function public.set_updated_at();

create trigger trg_daily_metrics_updated_at
  before update on public.daily_metrics
  for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGER — cria profile automaticamente ao criar usuário
-- (Supabase chama isso quando alguém faz sign-up)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- VIEW: athlete_summary (visão consolidada para o dashboard)
-- ============================================================
create or replace view public.v_athlete_summary as
select
  a.id,
  a.coach_id,
  a.full_name,
  a.primary_sport,
  a.active,
  a.ftp_watts,
  a.lthr_bpm,
  a.vo2max_ml_kg_min,
  a.weight_kg,
  -- PMC mais recente
  dm.date          as last_metrics_date,
  dm.ctl,
  dm.atl,
  dm.tsb,
  dm.hrv_score,
  dm.recovery_score,
  dm.sleep_hours,
  -- Status calculado
  case
    when dm.tsb > 10 and dm.ctl > 60 then 'peak'
    when dm.tsb > 5                  then 'fresh'
    when dm.tsb >= -10               then 'fit'
    when dm.tsb >= -25               then 'tired'
    else                                  'overreaching'
  end as status,
  -- Último treino
  last_act.started_at  as last_activity_at,
  last_act.sport       as last_activity_sport,
  last_act.tss         as last_activity_tss,
  -- W/kg
  round((a.ftp_watts::numeric / nullif(a.weight_kg, 0))::numeric, 2) as watts_per_kg
from public.athletes a
-- última linha de daily_metrics
left join lateral (
  select * from public.daily_metrics dm2
  where dm2.athlete_id = a.id
  order by dm2.date desc
  limit 1
) dm on true
-- última atividade
left join lateral (
  select * from public.activities ac
  where ac.athlete_id = a.id
  order by ac.started_at desc
  limit 1
) last_act on true;

comment on view public.v_athlete_summary is 'Visão consolidada para o dashboard — leitura otimizada';

-- ============================================================
-- FUNÇÃO: upsert_daily_metrics
-- Recalcula CTL/ATL para um atleta a partir de uma data
-- Chamada após cada importação de atividade
-- ============================================================
create or replace function public.recalculate_pmc(
  p_athlete_id  uuid,
  p_from_date   date default current_date - interval '180 days'
)
returns void language plpgsql security definer as $$
declare
  r               record;
  v_ctl           numeric := 0;
  v_atl           numeric := 0;
  v_tss           numeric := 0;
  v_date          date;
  v_end_date      date := current_date;
  ctl_decay       numeric := exp(-1.0/42);
  atl_decay       numeric := exp(-1.0/7);
  v_init          record;
begin
  -- Busca CTL/ATL do ponto inicial (dia anterior ao from_date)
  select ctl, atl into v_ctl, v_atl
  from public.daily_metrics
  where athlete_id = p_athlete_id
    and date = p_from_date - interval '1 day';

  if not found then
    -- Usa os valores iniciais do atleta
    select initial_ctl, initial_atl into v_ctl, v_atl
    from public.athletes
    where id = p_athlete_id;
    v_ctl := coalesce(v_ctl, 0);
    v_atl := coalesce(v_atl, 0);
  end if;

  v_date := p_from_date;

  while v_date <= v_end_date loop
    -- Soma TSS de todas as atividades do dia
    select coalesce(sum(tss), 0) into v_tss
    from public.activities
    where athlete_id = p_athlete_id
      and started_at::date = v_date
      and tss is not null;

    -- Modelo de Banister
    v_ctl := v_ctl * ctl_decay + v_tss * (1 - ctl_decay);
    v_atl := v_atl * atl_decay + v_tss * (1 - atl_decay);

    -- Upsert no daily_metrics
    insert into public.daily_metrics (athlete_id, date, ctl, atl, daily_tss, source)
    values (p_athlete_id, v_date, round(v_ctl, 2), round(v_atl, 2), v_tss, 'calculated')
    on conflict (athlete_id, date) do update
      set ctl       = round(v_ctl, 2),
          atl       = round(v_atl, 2),
          daily_tss = v_tss,
          updated_at = now();

    v_date := v_date + interval '1 day';
  end loop;
end;
$$;

comment on function public.recalculate_pmc is
  'Recalcula CTL/ATL/TSB a partir de uma data. Chame após importar atividades.';
