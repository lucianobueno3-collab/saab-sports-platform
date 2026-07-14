-- Migration 009: anexos PDF nas abas Saúde e Nutrição

-- Tabela de documentos do atleta
create table if not exists public.athlete_documents (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid references public.athletes(id) on delete cascade not null,
  area          text not null check (area in ('saude', 'nutricao')),
  file_name     text not null,
  storage_path  text not null,
  uploaded_at   timestamptz default now()
);

alter table public.athlete_documents enable row level security;

create policy "coach_documents" on public.athlete_documents
  using (athlete_id in (select id from public.athletes where coach_id = auth.uid()));

-- Bucket privado para os PDFs
insert into storage.buckets (id, name, public)
values ('athlete-docs', 'athlete-docs', false)
on conflict (id) do nothing;

-- Storage: coach acessa apenas arquivos de atletas próprios
-- (o caminho do arquivo começa com o id do atleta: {athlete_id}/{arquivo}.pdf)
create policy "coach_docs_select" on storage.objects for select
  using (
    bucket_id = 'athlete-docs'
    and exists (
      select 1 from public.athletes
      where id::text = (storage.foldername(name))[1] and coach_id = auth.uid()
    )
  );

create policy "coach_docs_insert" on storage.objects for insert
  with check (
    bucket_id = 'athlete-docs'
    and exists (
      select 1 from public.athletes
      where id::text = (storage.foldername(name))[1] and coach_id = auth.uid()
    )
  );

create policy "coach_docs_delete" on storage.objects for delete
  using (
    bucket_id = 'athlete-docs'
    and exists (
      select 1 from public.athletes
      where id::text = (storage.foldername(name))[1] and coach_id = auth.uid()
    )
  );
