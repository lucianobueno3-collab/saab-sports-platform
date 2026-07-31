// Catálogo de medidas corporais (bioimpedância + antropometria), no mesmo
// espírito do catálogo de exames de sangue: cada medida tem categoria, rótulo,
// unidade e a direção desejável — o que permite colorir a variação entre
// medições (ganhar massa magra é bom; ganhar % de gordura, não).

export type BodyCategory = 'composicao' | 'circunferencia' | 'dobra'
export type BodyMetricDef = {
  key: string
  label: string
  unit: string
  category: BodyCategory
  decimals?: number
  /** direção desejável da variação — usada só para colorir o delta */
  better?: 'up' | 'down'
  aliases?: string[]
}

export const BODY_CATEGORY_LABEL: Record<BodyCategory, string> = {
  composicao: 'Composição corporal',
  circunferencia: 'Circunferências',
  dobra: 'Dobras cutâneas',
}
export const BODY_CATEGORY_COLOR: Record<BodyCategory, string> = {
  composicao: '#e8001c',
  circunferencia: '#0088ff',
  dobra: '#00b4d8',
}

export const BODY_METRICS: BodyMetricDef[] = [
  // ── Composição (o que a balança de impedância entrega) ──────────────────
  { key: 'peso', label: 'Peso', unit: 'kg', category: 'composicao', decimals: 1, aliases: ['peso', 'peso atual', 'massa corporal'] },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', category: 'composicao', decimals: 1, better: 'down', aliases: ['imc', 'indice de massa corporal'] },
  { key: 'percentual_gordura', label: 'Gordura corporal', unit: '%', category: 'composicao', decimals: 1, better: 'down', aliases: ['percentual de gordura', '% gordura', 'gordura corporal', 'massa gorda %'] },
  { key: 'massa_gorda', label: 'Massa gorda', unit: 'kg', category: 'composicao', decimals: 1, better: 'down', aliases: ['massa gorda', 'massa de gordura'] },
  { key: 'massa_magra', label: 'Massa magra', unit: 'kg', category: 'composicao', decimals: 1, better: 'up', aliases: ['massa magra', 'massa livre de gordura'] },
  { key: 'massa_muscular', label: 'Massa muscular', unit: 'kg', category: 'composicao', decimals: 1, better: 'up', aliases: ['massa muscular', 'musculo esqueletico'] },
  { key: 'massa_ossea', label: 'Massa óssea', unit: 'kg', category: 'composicao', decimals: 2, aliases: ['massa ossea', 'massa ossea total'] },
  { key: 'agua_corporal', label: 'Água corporal', unit: '%', category: 'composicao', decimals: 1, aliases: ['agua corporal', 'agua total', 'hidratacao'] },
  { key: 'gordura_visceral', label: 'Gordura visceral', unit: '', category: 'composicao', better: 'down', aliases: ['gordura visceral', 'nivel de gordura visceral'] },
  { key: 'taxa_metabolica', label: 'Taxa metabólica basal', unit: 'kcal', category: 'composicao', aliases: ['taxa metabolica', 'tmb', 'metabolismo basal'] },
  { key: 'idade_metabolica', label: 'Idade metabólica', unit: 'anos', category: 'composicao', better: 'down', aliases: ['idade metabolica'] },

  // ── Circunferências ─────────────────────────────────────────────────────
  { key: 'ombro', label: 'Ombro', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'peitoral', label: 'Peitoral', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'cintura', label: 'Cintura', unit: 'cm', category: 'circunferencia', decimals: 1, better: 'down' },
  { key: 'abdomen', label: 'Abdômen', unit: 'cm', category: 'circunferencia', decimals: 1, better: 'down' },
  { key: 'quadril', label: 'Quadril', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'braco_direito', label: 'Braço direito', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'braco_esquerdo', label: 'Braço esquerdo', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'antebraco_direito', label: 'Antebraço direito', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'antebraco_esquerdo', label: 'Antebraço esquerdo', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'coxa_direita', label: 'Coxa direita', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'coxa_esquerda', label: 'Coxa esquerda', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'panturrilha_direita', label: 'Panturrilha direita', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'panturrilha_esquerda', label: 'Panturrilha esquerda', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'punho_direito', label: 'Punho direito', unit: 'cm', category: 'circunferencia', decimals: 1 },
  { key: 'punho_esquerdo', label: 'Punho esquerdo', unit: 'cm', category: 'circunferencia', decimals: 1 },

  // ── Dobras cutâneas ─────────────────────────────────────────────────────
  { key: 'dobra_triceps', label: 'Tríceps', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_subescapular', label: 'Subescapular', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_suprailiaca', label: 'Supra-ilíaca', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_abdominal', label: 'Abdominal', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_coxa', label: 'Coxa', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_peitoral', label: 'Peitoral', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_axilar', label: 'Axilar média', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
  { key: 'dobra_panturrilha', label: 'Panturrilha', unit: 'mm', category: 'dobra', decimals: 1, better: 'down' },
]

export const BODY_METRIC_BY_KEY: Record<string, BodyMetricDef> = Object.fromEntries(
  BODY_METRICS.map(m => [m.key, m]),
)

/** Cor da variação entre duas medições, conforme a direção desejável. */
export function deltaColor(def: BodyMetricDef | undefined, delta: number): string {
  if (!def?.better || delta === 0) return 'var(--muted-foreground)'
  const good = def.better === 'up' ? delta > 0 : delta < 0
  return good ? '#00d084' : '#f59e0b'
}
