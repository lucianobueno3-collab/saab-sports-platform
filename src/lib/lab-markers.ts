// Catálogo de marcadores laboratoriais — referências e leitura para atletas de endurance.
// Fontes: faixas laboratoriais usuais (BR) + literatura de medicina esportiva.
// As faixas de referência do laudo sempre têm prioridade; este catálogo preenche
// quando o PDF não traz referência e adiciona a leitura voltada ao atleta.

export type Sex = 'M' | 'F'

export type MarkerCategory =
  | 'hematologia' | 'ferro' | 'hormonal' | 'metabolico'
  | 'lipidico' | 'muscular' | 'inflamacao' | 'vitaminas' | 'renal' | 'hepatico'

export const CATEGORY_LABEL: Record<MarkerCategory, string> = {
  hematologia: 'Hematologia',
  ferro: 'Perfil do ferro',
  hormonal: 'Hormonal',
  metabolico: 'Metabólico',
  lipidico: 'Lipídico',
  muscular: 'Muscular / dano',
  inflamacao: 'Inflamação',
  vitaminas: 'Vitaminas',
  renal: 'Função renal',
  hepatico: 'Função hepática',
}

export const CATEGORY_COLOR: Record<MarkerCategory, string> = {
  hematologia: '#e8001c',
  ferro: '#ffa800',
  hormonal: '#8b5cf6',
  metabolico: '#0088ff',
  lipidico: '#f59e0b',
  muscular: '#ef4444',
  inflamacao: '#ec4899',
  vitaminas: '#00d084',
  renal: '#14b8a6',
  hepatico: '#a3e635',
}

export interface LabMarker {
  name: string                 // nome canônico (bate com o parser de PDF)
  category: MarkerCategory
  unit: string
  ref: { min: number | null; max: number | null } | { M: { min: number | null; max: number | null }; F: { min: number | null; max: number | null } }
  /** Faixa "ótima" para atletas de endurance, quando difere da normalidade clínica */
  athleteOptimal?: { min?: number; max?: number; note: string }
  /** Direção que preocupa mais no atleta: 'low' | 'high' | 'both' */
  concern: 'low' | 'high' | 'both'
  aka?: string                 // sigla/alias exibido
}

export const LAB_MARKERS: LabMarker[] = [
  // ── Perfil do ferro (crítico para endurance) ──
  { name: 'Ferritina', category: 'ferro', unit: 'ng/mL', ref: { M: { min: 30, max: 400 }, F: { min: 15, max: 200 } }, concern: 'low',
    athleteOptimal: { min: 50, note: 'Endurance: alvo ≥ 50 ng/mL. Abaixo de 30 indica deficiência de ferro (mesmo sem anemia) — reduz VO₂ e recuperação.' } },
  { name: 'Ferro', category: 'ferro', unit: 'µg/dL', ref: { M: { min: 65, max: 175 }, F: { min: 50, max: 170 } }, concern: 'low', aka: 'Ferro sérico' },
  { name: 'Saturação de Transferrina', category: 'ferro', unit: '%', ref: { min: 20, max: 50 }, concern: 'low',
    athleteOptimal: { min: 25, note: 'Abaixo de 20% sugere estoque de ferro insuficiente para a demanda de treino.' } },
  { name: 'Transferrina', category: 'ferro', unit: 'mg/dL', ref: { min: 200, max: 360 }, concern: 'high' },

  // ── Hematologia ──
  { name: 'Hemoglobina', category: 'hematologia', unit: 'g/dL', ref: { M: { min: 13.5, max: 17.5 }, F: { min: 12, max: 15.5 } }, concern: 'both',
    athleteOptimal: { note: 'Atenção à "anemia diluicional do atleta": volume plasmático expandido pode baixar a Hb sem deficiência real.' } },
  { name: 'Hematócrito', category: 'hematologia', unit: '%', ref: { M: { min: 40, max: 52 }, F: { min: 36, max: 46 } }, concern: 'both' },
  { name: 'Leucócitos', category: 'hematologia', unit: '/mm³', ref: { min: 4000, max: 11000 }, concern: 'both',
    athleteOptimal: { note: 'Leucócitos cronicamente baixos podem refletir carga de treino elevada / imunossupressão.' } },
  { name: 'Plaquetas', category: 'hematologia', unit: 'mil/mm³', ref: { min: 150, max: 450 }, concern: 'both' },
  { name: 'VCM', category: 'hematologia', unit: 'fL', ref: { min: 80, max: 100 }, concern: 'both', aka: 'Volume corpuscular médio' },

  // ── Hormonal ──
  { name: 'Testosterona', category: 'hormonal', unit: 'ng/dL', ref: { M: { min: 300, max: 1000 }, F: { min: 15, max: 70 } }, concern: 'low',
    athleteOptimal: { note: 'Queda sustentada sugere overreaching / baixa disponibilidade energética (RED-S).' } },
  { name: 'Cortisol', category: 'hormonal', unit: 'µg/dL', ref: { min: 5, max: 25 }, concern: 'high',
    athleteOptimal: { max: 20, note: 'Cortisol alto crônico + testosterona baixa = marcador clássico de sobretreinamento.' } },
  { name: 'Relação T/C', category: 'hormonal', unit: '', ref: { min: null, max: null }, concern: 'low',
    athleteOptimal: { note: 'Razão testosterona/cortisol: queda > 30% do basal sinaliza fadiga acumulada.' } },
  { name: 'TSH', category: 'hormonal', unit: 'µUI/mL', ref: { min: 0.4, max: 4.0 }, concern: 'both' },
  { name: 'T4 Livre', category: 'hormonal', unit: 'ng/dL', ref: { min: 0.7, max: 1.8 }, concern: 'both' },
  { name: 'IGF-1', category: 'hormonal', unit: 'ng/mL', ref: { min: 100, max: 300 }, concern: 'low' },

  // ── Muscular / dano ──
  { name: 'CPK', category: 'muscular', unit: 'U/L', ref: { M: { min: 40, max: 300 }, F: { min: 30, max: 200 } }, concern: 'high', aka: 'Creatinoquinase',
    athleteOptimal: { note: 'Sobe fisiologicamente após treino intenso. Valores muito altos e persistentes = dano muscular / recuperação incompleta.' } },
  { name: 'LDH', category: 'muscular', unit: 'U/L', ref: { min: 120, max: 246 }, concern: 'high', aka: 'Desidrogenase láctica' },
  { name: 'TGO', category: 'hepatico', unit: 'U/L', ref: { min: 5, max: 40 }, concern: 'high', aka: 'AST' },
  { name: 'TGP', category: 'hepatico', unit: 'U/L', ref: { min: 5, max: 41 }, concern: 'high', aka: 'ALT' },
  { name: 'GGT', category: 'hepatico', unit: 'U/L', ref: { M: { min: 8, max: 61 }, F: { min: 5, max: 36 } }, concern: 'high' },

  // ── Inflamação ──
  { name: 'PCR', category: 'inflamacao', unit: 'mg/L', ref: { min: null, max: 5 }, concern: 'high', aka: 'Proteína C reativa',
    athleteOptimal: { max: 1, note: 'PCR ultrassensível: alvo < 1 mg/L. Elevação sem infecção pode indicar inflamação por sobrecarga.' } },

  // ── Vitaminas ──
  { name: 'Vitamina D', category: 'vitaminas', unit: 'ng/mL', ref: { min: 30, max: 100 }, concern: 'low',
    athleteOptimal: { min: 40, note: 'Atletas: alvo 40–60 ng/mL. Deficiência prejudica função muscular, óssea e imunidade.' } },
  { name: 'Vitamina B12', category: 'vitaminas', unit: 'pg/mL', ref: { min: 200, max: 900 }, concern: 'low' },
  { name: 'Ácido Fólico', category: 'vitaminas', unit: 'ng/mL', ref: { min: 3, max: 17 }, concern: 'low' },
  { name: 'Magnésio', category: 'vitaminas', unit: 'mg/dL', ref: { min: 1.7, max: 2.4 }, concern: 'low',
    athleteOptimal: { note: 'Importante para função neuromuscular e cãibras; perdas no suor aumentam a demanda.' } },
  { name: 'Zinco', category: 'vitaminas', unit: 'µg/dL', ref: { min: 70, max: 120 }, concern: 'low' },

  // ── Metabólico ──
  { name: 'Glicose', category: 'metabolico', unit: 'mg/dL', ref: { min: 70, max: 99 }, concern: 'both' },
  { name: 'Hemoglobina Glicada', category: 'metabolico', unit: '%', ref: { min: null, max: 5.7 }, concern: 'high', aka: 'HbA1c' },
  { name: 'Insulina', category: 'metabolico', unit: 'µUI/mL', ref: { min: 2, max: 25 }, concern: 'high' },

  // ── Lipídico ──
  { name: 'Colesterol Total', category: 'lipidico', unit: 'mg/dL', ref: { min: null, max: 190 }, concern: 'high' },
  { name: 'HDL', category: 'lipidico', unit: 'mg/dL', ref: { M: { min: 40, max: null }, F: { min: 50, max: null } }, concern: 'low' },
  { name: 'LDL', category: 'lipidico', unit: 'mg/dL', ref: { min: null, max: 130 }, concern: 'high' },
  { name: 'Triglicerídeos', category: 'lipidico', unit: 'mg/dL', ref: { min: null, max: 150 }, concern: 'high' },

  // ── Renal ──
  { name: 'Creatinina', category: 'renal', unit: 'mg/dL', ref: { M: { min: 0.7, max: 1.3 }, F: { min: 0.6, max: 1.1 } }, concern: 'high',
    athleteOptimal: { note: 'Pode ser fisiologicamente mais alta em atletas com muita massa muscular.' } },
  { name: 'Ureia', category: 'renal', unit: 'mg/dL', ref: { min: 15, max: 40 }, concern: 'high',
    athleteOptimal: { note: 'Ureia elevada pós-bloco intenso pode indicar catabolismo proteico / recuperação insuficiente.' } },
  { name: 'Ácido Úrico', category: 'renal', unit: 'mg/dL', ref: { M: { min: 3.4, max: 7 }, F: { min: 2.4, max: 6 } }, concern: 'high' },
]

export const MARKER_BY_NAME = new Map(LAB_MARKERS.map(m => [m.name.toLowerCase(), m]))

export function findMarker(name: string): LabMarker | undefined {
  const n = name.toLowerCase().trim()
  return MARKER_BY_NAME.get(n) ?? LAB_MARKERS.find(m => m.name.toLowerCase() === n || m.aka?.toLowerCase() === n)
}

export function markerRef(m: LabMarker, sex: Sex | null): { min: number | null; max: number | null } {
  if ('M' in m.ref) return m.ref[sex ?? 'M']
  return m.ref
}

export type MarkerStatus = 'low' | 'high' | 'normal' | 'suboptimal' | 'unknown'

/** Classifica um valor: fora da referência clínica, ou dentro mas fora do ótimo do atleta. */
export function classifyValue(
  marker: LabMarker | undefined,
  value: number | null,
  sex: Sex | null,
  refOverride?: { min: number | null; max: number | null },
): MarkerStatus {
  if (value == null) return 'unknown'
  const ref = refOverride && (refOverride.min != null || refOverride.max != null)
    ? refOverride
    : marker ? markerRef(marker, sex) : { min: null, max: null }
  if (ref.min != null && value < ref.min) return 'low'
  if (ref.max != null && value > ref.max) return 'high'
  // dentro da faixa clínica — verifica alvo do atleta
  if (marker?.athleteOptimal) {
    const o = marker.athleteOptimal
    if ((o.min != null && value < o.min) || (o.max != null && value > o.max)) return 'suboptimal'
  }
  if (ref.min == null && ref.max == null && !marker) return 'unknown'
  return 'normal'
}

export const STATUS_STYLE: Record<MarkerStatus, { label: string; color: string }> = {
  low:        { label: 'Baixo',       color: '#e8001c' },
  high:       { label: 'Alto',        color: '#ffa800' },
  normal:     { label: 'Normal',      color: '#00d084' },
  suboptimal: { label: 'Subótimo',    color: '#0088ff' },
  unknown:    { label: '—',           color: 'var(--muted-foreground)' },
}
