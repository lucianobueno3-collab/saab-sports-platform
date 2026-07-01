-- Migration 005: Admin can see all profiles + deactivate coaches

-- Admin sees all profiles
create policy "profiles: admin sees all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update any profile (to change role/active status)
create policy "profiles: admin updates all"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Add active column to profiles so admin can deactivate a coach
alter table public.profiles
  add column if not exists active boolean not null default true;

comment on column public.profiles.active is 'Treinador ativo na plataforma';
