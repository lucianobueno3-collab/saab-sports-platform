# Migrations

## ⚠️ Pendência: schema base não versionado

As migrations deste diretório começam em `001` — as tabelas principais (`athletes`, `activities`, `profiles`, `daily_metrics`), as views (`v_athlete_summary`) e as funções (`recalculate_pmc`, `get_my_role`) foram criadas direto no Supabase e **não estão versionadas aqui**. Sem isso, não é possível recriar o banco em um ambiente novo.

### Como gerar o `000_base_schema.sql`

1. Instalar o [Docker Desktop](https://docs.docker.com/desktop) (pré-requisito do CLI do Supabase para dump)
2. Pegar a connection string em: Supabase Dashboard → Project Settings → Database → Connection string (URI)
3. Rodar:

```bash
npx supabase db dump --db-url "postgresql://postgres:[SENHA]@db.gafckgnikbsuvmfwdqiz.supabase.co:5432/postgres" -f supabase/migrations/000_base_schema.sql
```

4. Commitar o arquivo gerado.

## Ordem de aplicação

Aplicar no SQL Editor do Supabase Dashboard, em ordem numérica. Cada migration é idempotente (`if not exists` / `drop policy if exists`) sempre que possível.

| # | Arquivo | O que faz |
|---|---------|-----------|
| 001 | recovery_columns | Colunas de recuperação em daily_metrics |
| 002 | hrv_body_battery | HRV e Body Battery |
| 003 | athlete_phone | WhatsApp do atleta |
| 004 | coach_phone | WhatsApp do coach |
| 005 | admin_rls | RLS de admin (⚠ substituída pela 008) |
| 006 | lthr_by_sport | LTHR por modalidade (bike/run/swim) |
| 007 | athlete_portal | Tabelas do portal: lesões, exames, composição corporal, nutrição, provas, metas |
| 008 | fixes_review | FTP de corrida (Stryd), tss_method, correção do RLS recursivo da 005 |
