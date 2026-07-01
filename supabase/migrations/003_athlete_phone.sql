-- Migration 003: Add phone number to athletes
-- Run this in Supabase SQL Editor

alter table public.athletes
  add column if not exists phone text;

comment on column public.athletes.phone is 'WhatsApp/telefone do atleta (com DDI, ex: +5511999999999)';
