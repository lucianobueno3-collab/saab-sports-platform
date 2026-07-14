-- Migration 010: avaliação física completa na composição corporal

-- Altura do atleta (para cálculo de IMC)
alter table public.athletes
  add column if not exists height_cm numeric;

comment on column public.athletes.height_cm is 'Altura em cm — usada para IMC (peso / altura²)';

-- Métricas de avaliação física (antropometria)
alter table public.body_composition
  add column if not exists fat_mass_kg        numeric,  -- Massa Gorda (kg)
  add column if not exists lean_mass_kg       numeric,  -- Massa Magra (kg)
  add column if not exists lean_mass_pct      numeric,  -- % Massa Magra
  add column if not exists waist_hip_ratio    numeric,  -- Razão cintura/quadril
  add column if not exists body_density       numeric,  -- Densidade Corporal
  add column if not exists skinfold_sum_mm    numeric,  -- Soma de dobras (mm)
  add column if not exists arm_muscle_area    numeric,  -- Área Muscular do Braço — AMB (cm²)
  add column if not exists arm_fat_area       numeric;  -- Área de Gordura do Braço — AGB (cm²)
