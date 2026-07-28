-- ─────────────────────────────────────────────────────────────────────────
-- Pagamento da matrícula (integração Hotmart via webhook)
--
-- O webhook `hotmart-webhook` (service role) recebe os eventos de compra do
-- Hotmart e marca a anamnese correspondente (casada pelo e-mail do comprador)
-- como paga/reembolsada. O treinador vê o selo "Pago" no painel de Matrículas
-- e aplica o plano com segurança, sabendo que o pagamento foi confirmado.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.anamneses
  add column if not exists paid_at        timestamptz,
  add column if not exists payment_status text,   -- approved | refunded | chargeback | canceled
  add column if not exists payment_ref    text,   -- id da transação (ex.: HP...)
  add column if not exists payment_source text;   -- ex.: 'hotmart'

create index if not exists idx_anamneses_payment on public.anamneses (payment_status, paid_at desc);
