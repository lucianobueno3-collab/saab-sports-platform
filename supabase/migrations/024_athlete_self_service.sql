-- Migration 024: autoatendimento do atleta (ficha completa própria)
-- O atleta logado passa a poder LER e INCLUIR/EDITAR os próprios dados:
-- documentos, composição corporal, provas, metas, saúde e dados físicos.
-- Políticas ADITIVAS (coexistem com as do treinador — RLS combina por OR).
-- my_athlete_id() é security definer (sem recursão de RLS).

-- Helper de escopo do atleta logado -----------------------------------------
-- (usa a função existente public.my_athlete_id())

-- Documentos (exames, bioimpedância, fotos) ----------------------------------
drop policy if exists "athlete_self_documents" on public.athlete_documents;
create policy "athlete_self_documents" on public.athlete_documents for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Composição corporal --------------------------------------------------------
drop policy if exists "athlete_self_bodycomp" on public.body_composition;
create policy "athlete_self_bodycomp" on public.body_composition for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Provas / competições -------------------------------------------------------
drop policy if exists "athlete_self_competitions" on public.competitions;
create policy "athlete_self_competitions" on public.competitions for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Metas ----------------------------------------------------------------------
drop policy if exists "athlete_self_goals" on public.athlete_goals;
create policy "athlete_self_goals" on public.athlete_goals for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Saúde: lesões e exames -----------------------------------------------------
drop policy if exists "athlete_self_injuries" on public.injuries;
create policy "athlete_self_injuries" on public.injuries for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

drop policy if exists "athlete_self_exams" on public.medical_exams;
create policy "athlete_self_exams" on public.medical_exams for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Prontuário médico (tabelas da migração 013) --------------------------------
do $$
begin
  if to_regclass('public.medical_records') is not null then
    execute 'drop policy if exists "athlete_self_records" on public.medical_records';
    execute 'create policy "athlete_self_records" on public.medical_records for all
      using (athlete_id = public.my_athlete_id())
      with check (athlete_id = public.my_athlete_id())';
  end if;
  if to_regclass('public.athlete_medical_profile') is not null then
    execute 'drop policy if exists "athlete_self_medprofile" on public.athlete_medical_profile';
    execute 'create policy "athlete_self_medprofile" on public.athlete_medical_profile for all
      using (athlete_id = public.my_athlete_id())
      with check (athlete_id = public.my_athlete_id())';
  end if;
end $$;

-- Planos de nutrição (atleta gerencia os próprios) --------------------------
drop policy if exists "athlete_self_nutrition" on public.nutrition_plans;
create policy "athlete_self_nutrition" on public.nutrition_plans for all
  using (athlete_id = public.my_athlete_id())
  with check (athlete_id = public.my_athlete_id());

-- Dados físicos: o atleta edita o próprio cadastro (peso, FTP, limiares...) ---
-- (leitura já existe via athlete_self_select da migração 016)
drop policy if exists "athlete_self_update" on public.athletes;
create policy "athlete_self_update" on public.athletes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage: o atleta anexa/baixa/remove os próprios arquivos ------------------
-- Os documentos ficam em athlete-docs sob a pasta {athlete_id}/...
drop policy if exists "athlete_docs_self_all" on storage.objects;
create policy "athlete_docs_self_all" on storage.objects for all
  to authenticated
  using (bucket_id = 'athlete-docs' and (storage.foldername(name))[1] = public.my_athlete_id()::text)
  with check (bucket_id = 'athlete-docs' and (storage.foldername(name))[1] = public.my_athlete_id()::text);
