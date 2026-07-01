-- Migration 004: Add phone to profiles (coach WhatsApp for briefings)
alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is 'WhatsApp do treinador para receber briefings diários (com DDI, ex: +5511999999999)';
