// Catálogo completo de exame de sangue (padrão de mercado), agrupado por
// categoria. Cada marcador tem unidade, faixa de referência (geral ou por sexo)
// e apelidos (para o casamento do OCR na Fase 3). Serve de base para os campos
// de armazenamento e para o comparativo em dados.

export type Sex = 'M' | 'F' | null
export type MarkerRef = { min?: number; max?: number }
export type BloodMarker = {
  key: string
  label: string
  unit: string
  decimals?: number            // casas decimais para exibição/edição
  ref?: MarkerRef | { m: MarkerRef; f: MarkerRef }
  higherBetter?: boolean       // ex.: HDL — acima da faixa não é "alterado"
  aliases?: string[]           // termos que aparecem no PDF (OCR — Fase 3)
}
export type BloodCategory = { key: string; label: string; markers: BloodMarker[] }

export const BLOOD_CATEGORIES: BloodCategory[] = [
  {
    key: 'hemograma', label: 'Hemograma',
    markers: [
      { key: 'hemoglobina', label: 'Hemoglobina', unit: 'g/dL', decimals: 1, ref: { m: { min: 13.5, max: 17.5 }, f: { min: 12, max: 16 } }, aliases: ['hemoglobina', 'hb'] },
      { key: 'hematocrito', label: 'Hematócrito', unit: '%', decimals: 1, ref: { m: { min: 41, max: 53 }, f: { min: 36, max: 46 } }, aliases: ['hematocrito', 'ht', 'hct'] },
      { key: 'hemacias', label: 'Hemácias', unit: 'milhões/mm³', decimals: 2, ref: { m: { min: 4.5, max: 5.9 }, f: { min: 4.0, max: 5.2 } }, aliases: ['hemacias', 'eritrocitos', 'rbc'] },
      { key: 'vcm', label: 'VCM', unit: 'fL', decimals: 1, ref: { min: 80, max: 100 }, aliases: ['vcm', 'mcv'] },
      { key: 'hcm', label: 'HCM', unit: 'pg', decimals: 1, ref: { min: 27, max: 33 }, aliases: ['hcm', 'mch'] },
      { key: 'chcm', label: 'CHCM', unit: 'g/dL', decimals: 1, ref: { min: 32, max: 36 }, aliases: ['chcm', 'mchc'] },
      { key: 'rdw', label: 'RDW', unit: '%', decimals: 1, ref: { min: 11.5, max: 14.5 }, aliases: ['rdw'] },
      { key: 'leucocitos', label: 'Leucócitos', unit: '/mm³', ref: { min: 4000, max: 11000 }, aliases: ['leucocitos', 'wbc', 'globulos brancos'] },
      { key: 'neutrofilos', label: 'Neutrófilos', unit: '/mm³', ref: { min: 1800, max: 7500 }, aliases: ['neutrofilos', 'segmentados'] },
      { key: 'linfocitos', label: 'Linfócitos', unit: '/mm³', ref: { min: 1000, max: 4000 }, aliases: ['linfocitos'] },
      { key: 'monocitos', label: 'Monócitos', unit: '/mm³', ref: { min: 200, max: 1000 }, aliases: ['monocitos'] },
      { key: 'eosinofilos', label: 'Eosinófilos', unit: '/mm³', ref: { min: 50, max: 500 }, aliases: ['eosinofilos'] },
      { key: 'basofilos', label: 'Basófilos', unit: '/mm³', ref: { min: 0, max: 200 }, aliases: ['basofilos'] },
      { key: 'plaquetas', label: 'Plaquetas', unit: '/mm³', ref: { min: 150000, max: 450000 }, aliases: ['plaquetas', 'plt'] },
    ],
  },
  {
    key: 'lipideos', label: 'Lipídeos (colesterol)',
    markers: [
      { key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL', ref: { max: 190 }, aliases: ['colesterol total'] },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL', ref: { max: 130 }, aliases: ['ldl', 'colesterol ldl'] },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL', higherBetter: true, ref: { m: { min: 40 }, f: { min: 50 } }, aliases: ['hdl', 'colesterol hdl'] },
      { key: 'vldl', label: 'VLDL', unit: 'mg/dL', ref: { max: 30 }, aliases: ['vldl'] },
      { key: 'nao_hdl', label: 'Colesterol não-HDL', unit: 'mg/dL', ref: { max: 160 }, aliases: ['nao hdl', 'não hdl'] },
      { key: 'triglicerides', label: 'Triglicérides', unit: 'mg/dL', ref: { max: 150 }, aliases: ['triglicerides', 'triglicerideos'] },
    ],
  },
  {
    key: 'glicidico', label: 'Glicêmico',
    markers: [
      { key: 'glicose', label: 'Glicose (jejum)', unit: 'mg/dL', ref: { min: 70, max: 99 }, aliases: ['glicose', 'glicemia'] },
      { key: 'hba1c', label: 'Hemoglobina glicada (HbA1c)', unit: '%', decimals: 1, ref: { max: 5.7 }, aliases: ['glicada', 'hba1c', 'hemoglobina glicosilada'] },
      { key: 'insulina', label: 'Insulina (jejum)', unit: 'µU/mL', decimals: 1, ref: { min: 2.6, max: 24.9 }, aliases: ['insulina'] },
      { key: 'homa_ir', label: 'HOMA-IR', unit: '', decimals: 2, ref: { max: 2.5 }, aliases: ['homa ir', 'homa-ir'] },
    ],
  },
  {
    key: 'renal', label: 'Função renal',
    markers: [
      { key: 'ureia', label: 'Ureia', unit: 'mg/dL', ref: { min: 15, max: 40 }, aliases: ['ureia'] },
      { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL', decimals: 2, ref: { m: { min: 0.7, max: 1.3 }, f: { min: 0.6, max: 1.1 } }, aliases: ['creatinina'] },
      { key: 'tfg', label: 'Taxa de filtração (eTFG)', unit: 'mL/min/1,73m²', ref: { min: 60 }, higherBetter: true, aliases: ['filtracao glomerular', 'tfg', 'egfr', 'ckd-epi'] },
      { key: 'acido_urico', label: 'Ácido úrico', unit: 'mg/dL', decimals: 1, ref: { m: { min: 3.4, max: 7.0 }, f: { min: 2.4, max: 5.7 } }, aliases: ['acido urico', 'ácido úrico'] },
    ],
  },
  {
    key: 'hepatica', label: 'Função hepática',
    markers: [
      { key: 'tgo', label: 'TGO (AST)', unit: 'U/L', ref: { max: 40 }, aliases: ['tgo', 'ast', 'aspartato'] },
      { key: 'tgp', label: 'TGP (ALT)', unit: 'U/L', ref: { max: 56 }, aliases: ['tgp', 'alt', 'alanina'] },
      { key: 'ggt', label: 'Gama GT (GGT)', unit: 'U/L', ref: { m: { min: 8, max: 61 }, f: { min: 5, max: 36 } }, aliases: ['gama gt', 'ggt', 'gama glutamil'] },
      { key: 'fosfatase_alcalina', label: 'Fosfatase alcalina', unit: 'U/L', ref: { min: 40, max: 129 }, aliases: ['fosfatase alcalina'] },
      { key: 'bilirrubina_total', label: 'Bilirrubina total', unit: 'mg/dL', decimals: 2, ref: { min: 0.3, max: 1.2 }, aliases: ['bilirrubina total'] },
      { key: 'albumina', label: 'Albumina', unit: 'g/dL', decimals: 1, ref: { min: 3.5, max: 5.2 }, aliases: ['albumina'] },
      { key: 'proteinas_totais', label: 'Proteínas totais', unit: 'g/dL', decimals: 1, ref: { min: 6.0, max: 8.3 }, aliases: ['proteinas totais'] },
    ],
  },
  {
    key: 'eletrolitos', label: 'Eletrólitos e minerais',
    markers: [
      { key: 'sodio', label: 'Sódio', unit: 'mEq/L', ref: { min: 135, max: 145 }, aliases: ['sodio'] },
      { key: 'potassio', label: 'Potássio', unit: 'mEq/L', decimals: 1, ref: { min: 3.5, max: 5.1 }, aliases: ['potassio'] },
      { key: 'cloro', label: 'Cloro', unit: 'mEq/L', ref: { min: 98, max: 107 }, aliases: ['cloro'] },
      { key: 'calcio', label: 'Cálcio', unit: 'mg/dL', decimals: 1, ref: { min: 8.6, max: 10.2 }, aliases: ['calcio total', 'calcio'] },
      { key: 'magnesio', label: 'Magnésio', unit: 'mg/dL', decimals: 1, ref: { min: 1.6, max: 2.6 }, aliases: ['magnesio'] },
      { key: 'fosforo', label: 'Fósforo', unit: 'mg/dL', decimals: 1, ref: { min: 2.5, max: 4.5 }, aliases: ['fosforo'] },
    ],
  },
  {
    key: 'ferro', label: 'Ferro e anemia',
    markers: [
      { key: 'ferro', label: 'Ferro sérico', unit: 'µg/dL', ref: { m: { min: 65, max: 175 }, f: { min: 50, max: 170 } }, aliases: ['ferro serico', 'ferro'] },
      { key: 'ferritina', label: 'Ferritina', unit: 'ng/mL', ref: { m: { min: 30, max: 400 }, f: { min: 15, max: 150 } }, aliases: ['ferritina'] },
      { key: 'transferrina', label: 'Transferrina', unit: 'mg/dL', ref: { min: 200, max: 360 }, aliases: ['transferrina'] },
      { key: 'sat_transferrina', label: 'Saturação de transferrina', unit: '%', ref: { min: 20, max: 50 }, aliases: ['saturacao de transferrina', 'saturacao transferrina'] },
      { key: 'tibc', label: 'Capacidade de ligação (TIBC)', unit: 'µg/dL', ref: { min: 240, max: 450 }, aliases: ['tibc', 'capacidade de ligacao'] },
    ],
  },
  {
    key: 'tireoide', label: 'Tireoide',
    markers: [
      { key: 'tsh', label: 'TSH', unit: 'µUI/mL', decimals: 2, ref: { min: 0.4, max: 4.0 }, aliases: ['tsh'] },
      { key: 't4_livre', label: 'T4 livre', unit: 'ng/dL', decimals: 2, ref: { min: 0.9, max: 1.7 }, aliases: ['t4 livre', 't4l'] },
      { key: 't3', label: 'T3 total', unit: 'ng/dL', ref: { min: 80, max: 200 }, aliases: ['t3 total', 't3'] },
      { key: 'anti_tpo', label: 'Anti-TPO', unit: 'UI/mL', ref: { max: 34 }, aliases: ['anti tpo', 'anti-tpo', 'antitireoperoxidase'] },
    ],
  },
  {
    key: 'vitaminas', label: 'Vitaminas',
    markers: [
      { key: 'vitamina_d', label: 'Vitamina D (25-OH)', unit: 'ng/mL', decimals: 1, ref: { min: 30, max: 100 }, aliases: ['vitamina d', '25 hidroxi', '25-oh'] },
      { key: 'vitamina_b12', label: 'Vitamina B12', unit: 'pg/mL', ref: { min: 200, max: 900 }, aliases: ['vitamina b12', 'b12', 'cobalamina'] },
      { key: 'acido_folico', label: 'Ácido fólico', unit: 'ng/mL', decimals: 1, ref: { min: 3, max: 17 }, aliases: ['acido folico', 'folato'] },
    ],
  },
  {
    key: 'hormonios', label: 'Hormônios',
    markers: [
      { key: 'testosterona_total', label: 'Testosterona total', unit: 'ng/dL', ref: { m: { min: 250, max: 1100 }, f: { min: 15, max: 70 } }, aliases: ['testosterona total'] },
      { key: 'testosterona_livre', label: 'Testosterona livre', unit: 'pg/mL', decimals: 1, aliases: ['testosterona livre'] },
      { key: 'cortisol', label: 'Cortisol (manhã)', unit: 'µg/dL', decimals: 1, ref: { min: 6.2, max: 19.4 }, aliases: ['cortisol'] },
      { key: 'shbg', label: 'SHBG', unit: 'nmol/L', decimals: 1, aliases: ['shbg'] },
      { key: 'estradiol', label: 'Estradiol', unit: 'pg/mL', decimals: 1, aliases: ['estradiol', 'e2'] },
      { key: 'lh', label: 'LH', unit: 'mUI/mL', decimals: 1, aliases: ['lh', 'hormonio luteinizante'] },
      { key: 'fsh', label: 'FSH', unit: 'mUI/mL', decimals: 1, aliases: ['fsh'] },
      { key: 'prolactina', label: 'Prolactina', unit: 'ng/mL', decimals: 1, aliases: ['prolactina'] },
      { key: 'dhea_s', label: 'DHEA-S', unit: 'µg/dL', aliases: ['dhea', 'dhea-s', 'sulfato de dehidroepiandrosterona'] },
    ],
  },
  {
    key: 'inflamacao', label: 'Inflamação e músculo',
    markers: [
      { key: 'pcr', label: 'PCR ultrassensível', unit: 'mg/L', decimals: 2, ref: { max: 1 }, aliases: ['pcr', 'proteina c reativa'] },
      { key: 'vhs', label: 'VHS', unit: 'mm/h', ref: { m: { max: 15 }, f: { max: 20 } }, aliases: ['vhs', 'hemossedimentacao'] },
      { key: 'cpk', label: 'CPK (CK)', unit: 'U/L', ref: { m: { min: 39, max: 308 }, f: { min: 26, max: 192 } }, aliases: ['cpk', 'creatinoquinase', 'ck total'] },
      { key: 'ldh', label: 'LDH', unit: 'U/L', ref: { min: 135, max: 225 }, aliases: ['ldh', 'desidrogenase latica'] },
      { key: 'homocisteina', label: 'Homocisteína', unit: 'µmol/L', decimals: 1, ref: { max: 15 }, aliases: ['homocisteina'] },
    ],
  },
]

// Mapa plano por chave, para lookups rápidos.
export const BLOOD_MARKERS: Record<string, BloodMarker & { category: string }> = (() => {
  const m: Record<string, BloodMarker & { category: string }> = {}
  for (const c of BLOOD_CATEGORIES) for (const mk of c.markers) m[mk.key] = { ...mk, category: c.key }
  return m
})()

/** Faixa de referência efetiva conforme o sexo do aluno. */
export function refFor(marker: BloodMarker, sex: Sex): MarkerRef | undefined {
  if (!marker.ref) return undefined
  if ('min' in marker.ref || 'max' in marker.ref) return marker.ref as MarkerRef
  const bySex = marker.ref as { m: MarkerRef; f: MarkerRef }
  return sex === 'F' ? bySex.f : bySex.m // padrão masculino quando o sexo não é informado
}

/** Classifica um valor contra a faixa: 'low' | 'high' | 'ok'. */
export function flagValue(marker: BloodMarker, value: number | null | undefined, sex: Sex): 'low' | 'high' | 'ok' | null {
  if (value == null || Number.isNaN(value)) return null
  const r = refFor(marker, sex)
  if (!r) return null
  if (r.min != null && value < r.min) return 'low'
  if (r.max != null && value > r.max) return marker.higherBetter ? 'ok' : 'high'
  return 'ok'
}

/** Texto curto da faixa (ex.: "70–99", "< 190", "> 40"). */
export function refLabel(marker: BloodMarker, sex: Sex): string {
  const r = refFor(marker, sex)
  if (!r) return '—'
  if (r.min != null && r.max != null) return `${r.min}–${r.max}`
  if (r.max != null) return `< ${r.max}`
  if (r.min != null) return `> ${r.min}`
  return '—'
}
