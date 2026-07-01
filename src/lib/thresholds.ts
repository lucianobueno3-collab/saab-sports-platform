// Central thresholds — single source of truth for all rules and UI colors.
// No magic numbers anywhere else; telas and motor de regras only import from here.

export const THRESHOLDS = {
  // HRV noturno (ms) — semáforo de prontidão
  hrv: {
    green_min: 37,   // >= 37 → verde (treino normal)
    yellow_min: 34,  // 34–36 → amarelo (reduzir volume)
                     // < 34 → vermelho (descanso)
  },

  // Body Battery Garmin (0–100)
  bodyBattery: {
    exhaustion_max: 40,    // < 40 = zona de exaustão (76.7% dos dias no relatório-piloto)
    overtraining_max: 35,  // < 35 = zona clínica de overtraining (Stanley 2013)
    safety_floor: 25,      // < 25 = válvula de segurança — aborta treino independente do HRV
    target_min: 50,        // meta de recuperação
  },

  // Stress Garmin (0–100)
  stress: {
    target_max: 30,              // meta diária
    blocks_deep_sleep_above: 35, // acima de 35 bloqueia sono profundo (Meerlo et al. 2008)
  },

  // Duração do sono (horas)
  sleep: {
    target_hours: 8.0,
    min_safe_hours: 5.5,        // < 5.5h por 3 noites → válvula de segurança
    injury_risk_below: 7.0,     // < 7h crônico → +70% risco lesão (Fullagar et al. 2015)
    short_night_threshold: 6.0, // "noite curta" para KPI % noites < 6h
  },

  // REM
  rem: {
    target_pct_min: 20,   // meta mínima de % REM
    target_pct_max: 22,   // ideal
    safety_floor_pct: 10, // < 10% → válvula de segurança
  },

  // FC de repouso (bpm)
  rhr: {
    warning_bpm: 58,          // >= 58 (+5 da média de 53) → alerta
    clinical_bpm: 62,         // >= 62 → bandeira clínica isolada (suspeita de infecção)
    delta_above_baseline: 5,  // delta sobre a baseline pessoal
  },
} as const

// Evidências científicas — usadas na View 7
export const EVIDENCE = [
  {
    id: 'fullagar2015',
    title: 'Risco de Lesão',
    threshold: 'Sono < 7h',
    impact: '+70% risco de lesão musculoesquelética',
    reference: 'Fullagar et al., 2015',
    field: 'sleep_hours' as const,
    limitValue: 7.0,
  },
  {
    id: 'stanley2013',
    title: 'Zona de Fadiga',
    threshold: 'Body Battery < 35',
    impact: 'Overtraining clínico',
    reference: 'Stanley et al., 2013',
    field: 'body_battery' as const,
    limitValue: 35,
  },
  {
    id: 'meerlo2008',
    title: 'Ciclo Vicioso',
    threshold: 'Stress > 35',
    impact: 'Bloqueia sono profundo → reduz REM',
    reference: 'Meerlo et al., 2008',
    field: 'stress_avg' as const,
    limitValue: 35,
  },
] as const

// Protocolo de 8 semanas
export const PHASE_PROTOCOL = [
  { fase: 1, semanas: '1–2', nome: 'Estabilização', meta_sono_h: 7.0, foco: 'Reduzir noites <6h para menos de 20%' },
  { fase: 2, semanas: '3–4', nome: 'Melhoria', meta_sono_h: 7.5, projecao: 'Body Battery sobe para 45+' },
  { fase: 3, semanas: '5–8', nome: 'Otimização', meta_sono_h: 8.0, resultado: 'Recuperação plena e Stress <30' },
] as const
