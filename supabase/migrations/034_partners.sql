-- ─────────────────────────────────────────────────────────────────────────
-- Parceiros (marcas exibidas no portal do aluno, com link para o site)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text,
  logo_url    text,
  description text,
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_partners_active on public.partners (active, sort);

alter table public.partners enable row level security;

-- Staff (treinador/admin) gerencia os parceiros.
drop policy if exists partners_staff_all on public.partners;
create policy partners_staff_all on public.partners
  for all
  using (public.get_my_role() in ('coach', 'admin'))
  with check (public.get_my_role() in ('coach', 'admin'));

-- Qualquer usuário autenticado vê os parceiros ativos (aparecem no portal).
drop policy if exists partners_read on public.partners;
create policy partners_read on public.partners
  for select
  using (active = true);
