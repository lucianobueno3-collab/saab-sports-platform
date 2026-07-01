'use client'

import { X, TrendingUp, Activity, Zap, Heart, Moon, Battery, Brain, Thermometer, Info } from 'lucide-react'

export type MetricKey =
  | 'ctl' | 'atl' | 'tsb' | 'tss' | 'np' | 'if' | 'ftp'
  | 'hrv' | 'body_battery' | 'sleep' | 'rem' | 'rhr' | 'stress'
  | 'wkg' | 'vo2max' | 'lthr' | 'readiness'

interface MetricDetailProps {
  metricKey: MetricKey
  value?: string | number | null
  context?: Record<string, number | string | null>
  onClose: () => void
}

interface Step {
  label: string
  expr?: string
  result?: string
  note?: string
}

interface MetricDef {
  name: string
  fullName: string
  icon: React.ReactNode
  color: string
  what: string
  formula?: string
  steps?: (ctx: Record<string, number | string | null>) => Step[]
  thresholds?: { label: string; range: string; color: string }[]
  source: string
  unit?: string
  reference?: string
}

const fmt = (v: number | string | null | undefined, decimals = 1) =>
  v == null || v === '' ? '—' : typeof v === 'number' ? v.toFixed(decimals) : v

const METRICS: Record<MetricKey, MetricDef> = {
  ctl: {
    name: 'CTL',
    fullName: 'Chronic Training Load — Fitness',
    icon: <TrendingUp className="w-4 h-4" />,
    color: '#0088ff',
    what: 'CTL representa a carga de treinamento acumulada nos últimos ~42 dias (6 semanas). É o indicador de "fitness" — quanto maior, mais adaptado ao esforço o atleta está. Calculado como uma média exponencialmente ponderada do TSS diário.',
    formula: 'CTLhoje = CTLontem × e^(−1/42) + TSShoje × (1 − e^(−1/42))',
    steps: (ctx) => {
      const ctlPrev = Number(ctx.ctl_prev ?? 0)
      const tss = Number(ctx.tss_today ?? 0)
      const decay = Math.exp(-1 / 42)
      const gain = 1 - decay
      const result = ctlPrev * decay + tss * gain
      return [
        { label: 'Constante de decaimento', expr: 'e^(−1/42)', result: decay.toFixed(6) },
        { label: 'CTL anterior', result: fmt(ctlPrev) },
        { label: 'TSS de hoje', result: fmt(tss) },
        { label: 'Parcela do passado', expr: `${fmt(ctlPrev)} × ${decay.toFixed(4)}`, result: (ctlPrev * decay).toFixed(2) },
        { label: 'Parcela de hoje', expr: `${fmt(tss)} × ${gain.toFixed(4)}`, result: (tss * gain).toFixed(2) },
        { label: 'CTL final', expr: 'soma das parcelas', result: result.toFixed(1), note: 'Janela temporal: 42 dias (τ = 42)' },
      ]
    },
    thresholds: [
      { label: 'Iniciante', range: '< 30', color: '#6677aa' },
      { label: 'Recreativo', range: '30 – 60', color: '#0088ff' },
      { label: 'Competitivo', range: '60 – 100', color: '#00d084' },
      { label: 'Elite', range: '> 100', color: '#ffa800' },
    ],
    source: 'Calculado a partir do TSS diário importado via arquivos FIT/GPX',
    reference: 'Banister et al. (1975) — Impulse-Response Model',
  },
  atl: {
    name: 'ATL',
    fullName: 'Acute Training Load — Fadiga',
    icon: <Activity className="w-4 h-4" />,
    color: '#e8001c',
    what: 'ATL representa a carga de treinamento recente, nos últimos ~7 dias. É o indicador de "fadiga" — quando alto, o atleta está sob carga pesada e a recuperação ainda não foi completa. Usa a mesma fórmula do CTL com janela de 7 dias.',
    formula: 'ATLhoje = ATLontem × e^(−1/7) + TSShoje × (1 − e^(−1/7))',
    steps: (ctx) => {
      const atlPrev = Number(ctx.atl_prev ?? 0)
      const tss = Number(ctx.tss_today ?? 0)
      const decay = Math.exp(-1 / 7)
      const gain = 1 - decay
      const result = atlPrev * decay + tss * gain
      return [
        { label: 'Constante de decaimento', expr: 'e^(−1/7)', result: decay.toFixed(6), note: 'Janela de 7 dias — reage rápido à carga' },
        { label: 'ATL anterior', result: fmt(atlPrev) },
        { label: 'TSS de hoje', result: fmt(tss) },
        { label: 'Parcela do passado', expr: `${fmt(atlPrev)} × ${decay.toFixed(4)}`, result: (atlPrev * decay).toFixed(2) },
        { label: 'Parcela de hoje', expr: `${fmt(tss)} × ${gain.toFixed(4)}`, result: (tss * gain).toFixed(2) },
        { label: 'ATL final', expr: 'soma das parcelas', result: result.toFixed(1) },
      ]
    },
    thresholds: [
      { label: 'Baixa fadiga', range: '< 40', color: '#00d084' },
      { label: 'Moderada', range: '40 – 80', color: '#ffa800' },
      { label: 'Alta fadiga', range: '> 80', color: '#e8001c' },
    ],
    source: 'Calculado a partir do TSS diário importado via arquivos FIT/GPX',
    reference: 'Banister et al. (1975) — Impulse-Response Model',
  },
  tsb: {
    name: 'TSB',
    fullName: 'Training Stress Balance — Forma',
    icon: <TrendingUp className="w-4 h-4" />,
    color: '#00d084',
    what: 'TSB é a diferença entre CTL (fitness) e ATL (fadiga). Valores positivos indicam que o atleta está "fresco" — acima da fadiga acumulada. Valores negativos indicam que a fadiga supera o fitness atual. É o indicador de "forma do dia".',
    formula: 'TSB = CTL − ATL',
    steps: (ctx) => {
      const ctl = Number(ctx.ctl ?? 0)
      const atl = Number(ctx.atl ?? 0)
      const tsb = ctl - atl
      return [
        { label: 'CTL (Fitness)', result: fmt(ctl) },
        { label: 'ATL (Fadiga)', result: fmt(atl) },
        { label: 'TSB = CTL − ATL', expr: `${fmt(ctl)} − ${fmt(atl)}`, result: (tsb >= 0 ? '+' : '') + tsb.toFixed(1) },
      ]
    },
    thresholds: [
      { label: 'Pico de forma', range: '+5 a +25', color: '#00d084' },
      { label: 'Zona saudável', range: '0 a +5', color: '#0088ff' },
      { label: 'Cansado (normal)', range: '−10 a 0', color: '#ffa800' },
      { label: 'Sobrecarga', range: '< −10', color: '#e8001c' },
      { label: 'Destreinado', range: '> +25', color: '#6677aa' },
    ],
    source: 'Derivado do CTL e ATL calculados em daily_metrics',
    reference: 'Coggan & Allen (2006) — Training and Racing with a Power Meter',
  },
  tss: {
    name: 'TSS',
    fullName: 'Training Stress Score',
    icon: <Zap className="w-4 h-4" />,
    color: '#ffa800',
    what: 'TSS quantifica o estresse fisiológico de uma atividade em função da duração, intensidade e potência normalizada. Uma atividade de exatamente 1 hora no limiar (FTP) = 100 TSS.',
    formula: 'TSS = (duração_s × NP × IF) / (FTP × 3600) × 100',
    steps: (ctx) => {
      const dur = Number(ctx.duration_s ?? 0)
      const np = Number(ctx.np ?? 0)
      const iff = Number(ctx.if ?? 0)
      const ftp = Number(ctx.ftp ?? 0)
      const tss = ftp > 0 ? (dur * np * iff) / (ftp * 3600) * 100 : 0
      return [
        { label: 'Duração (segundos)', result: fmt(dur, 0) },
        { label: 'NP — Normalized Power', result: `${fmt(np, 0)}W` },
        { label: 'IF — Intensity Factor', result: fmt(iff, 3), note: 'IF = NP / FTP' },
        { label: 'FTP do atleta', result: `${fmt(ftp, 0)}W` },
        { label: 'Numerador', expr: `${fmt(dur, 0)} × ${fmt(np, 0)} × ${fmt(iff, 3)}`, result: (dur * np * iff).toFixed(0) },
        { label: 'Denominador', expr: `${fmt(ftp, 0)} × 3600`, result: (ftp * 3600).toFixed(0) },
        { label: 'TSS final', expr: '(num / den) × 100', result: tss.toFixed(1) },
      ]
    },
    thresholds: [
      { label: 'Recuperação leve', range: '< 50', color: '#00d084' },
      { label: 'Treino moderado', range: '50 – 100', color: '#0088ff' },
      { label: 'Treino pesado', range: '100 – 150', color: '#ffa800' },
      { label: 'Treino extremo', range: '> 150', color: '#e8001c' },
    ],
    source: 'Calculado por atividade importada via arquivo FIT — campos: duration_seconds, normalized_power, intensity_factor',
    reference: 'Coggan & Allen (2006)',
  },
  np: {
    name: 'NP',
    fullName: 'Normalized Power',
    icon: <Zap className="w-4 h-4" />,
    color: '#ffa800',
    what: 'NP é uma estimativa da potência "equivalente constante" que teria o mesmo custo fisiológico que o esforço variável realizado. Calculado pela média da 4ª potência dos dados de 30 segundos, com raiz de 4ª.',
    formula: 'NP = (média(30s_power^4))^(1/4)',
    steps: () => [
      { label: '1. Coletar potência instantânea (1Hz)', note: 'Via sensor de potência no pedivela' },
      { label: '2. Calcular média móvel de 30s', note: 'Suaviza picos e vales' },
      { label: '3. Elevar cada valor à 4ª potência', note: 'Penaliza esforços acima do limiar' },
      { label: '4. Calcular média de todas as janelas', note: 'Média temporal' },
      { label: '5. Aplicar raiz 4ª (^0.25)', note: 'Volta à escala de watts — resultado é o NP' },
    ],
    source: 'Extraído do arquivo FIT exportado pelo Garmin Connect',
    reference: 'Allen & Coggan (2010)',
  },
  if: {
    name: 'IF',
    fullName: 'Intensity Factor',
    icon: <Zap className="w-4 h-4" />,
    color: '#ffa800',
    what: 'IF é a relação entre a NP de uma atividade e o FTP do atleta. Representa "qual fração do máximo sustentável foi exigida". IF = 1.0 significa que o atleta treinou exatamente no limiar por toda a atividade.',
    formula: 'IF = NP / FTP',
    steps: (ctx) => {
      const np = Number(ctx.np ?? 0)
      const ftp = Number(ctx.ftp ?? 0)
      const iff = ftp > 0 ? np / ftp : 0
      return [
        { label: 'NP da atividade', result: `${fmt(np, 0)}W` },
        { label: 'FTP do atleta', result: `${fmt(ftp, 0)}W` },
        { label: 'IF = NP / FTP', expr: `${fmt(np, 0)} / ${fmt(ftp, 0)}`, result: iff.toFixed(3) },
      ]
    },
    thresholds: [
      { label: 'Recuperação', range: '< 0.75', color: '#00d084' },
      { label: 'Resistência aeróbia', range: '0.75 – 0.85', color: '#0088ff' },
      { label: 'Zona de limiar', range: '0.85 – 1.05', color: '#ffa800' },
      { label: 'Acima do limiar', range: '> 1.05', color: '#e8001c' },
    ],
    source: 'Calculado por atividade — NP do FIT ÷ FTP cadastrado no perfil',
  },
  ftp: {
    name: 'FTP',
    fullName: 'Functional Threshold Power',
    icon: <Zap className="w-4 h-4" />,
    color: '#ffa800',
    what: 'FTP é a máxima potência que um atleta consegue manter por 60 minutos de forma constante. É a referência base para todos os cálculos de intensidade e zonas de treinamento. Estimado normalmente via teste de 20 minutos × 0,95.',
    formula: 'FTP ≈ Potência_média_20min × 0,95',
    steps: (ctx) => {
      const ftp = Number(ctx.ftp ?? 0)
      const ftpTest = ftp / 0.95
      return [
        { label: 'Potência média no teste 20min', result: `~${ftpTest.toFixed(0)}W`, note: 'Estimativa reversa' },
        { label: 'Fator de ajuste', result: '× 0,95', note: 'Compensa a diferença entre 20min e 60min' },
        { label: 'FTP resultante', result: `${fmt(ftp, 0)}W` },
      ]
    },
    source: 'Cadastrado manualmente no perfil do atleta',
  },
  hrv: {
    name: 'HRV',
    fullName: 'Heart Rate Variability — Variabilidade da Frequência Cardíaca',
    icon: <Heart className="w-4 h-4" />,
    color: '#00d084',
    what: 'HRV mede a variação de tempo entre batimentos cardíacos consecutivos (rMSSD). Valores altos indicam bom estado de recuperação e domínio parassimpático. Valores baixos indicam estresse fisiológico ou fadiga acumulada.',
    formula: 'rMSSD = √(média(ΔRR²)) × 1000 ms',
    steps: (ctx) => {
      const hrv = Number(ctx.hrv ?? 0)
      return [
        { label: '1. Registrar intervalos RR', note: 'Via Garmin em modo noturno (sleep monitoring)' },
        { label: '2. Calcular diferenças entre intervalos sucessivos', expr: 'ΔRR = RR[i+1] − RR[i]' },
        { label: '3. Elevar ao quadrado e calcular média', expr: 'média(ΔRR²)' },
        { label: '4. Aplicar raiz quadrada', expr: '√(média(ΔRR²))' },
        { label: '5. Converter para ms (×1000)', result: `${fmt(hrv, 0)} ms` },
      ]
    },
    thresholds: [
      { label: 'Treino normal', range: '≥ 37 ms', color: '#00d084' },
      { label: 'Reduzir volume', range: '34 – 36 ms', color: '#ffa800' },
      { label: 'Descanso / recuperação', range: '< 34 ms', color: '#e8001c' },
    ],
    source: 'Sincronizado automaticamente via Garmin Connect → campo hrv_ms na tabela daily_metrics',
    unit: 'ms',
    reference: 'Makivić et al. (2013); THRESHOLDS.hrv no código',
  },
  body_battery: {
    name: 'Body Battery',
    fullName: 'Body Battery — Nível de Energia (Garmin)',
    icon: <Battery className="w-4 h-4" />,
    color: '#8b5cf6',
    what: 'Body Battery é um índice proprietário Garmin (0–100) que combina HRV, qualidade do sono, stress e atividade para estimar o nível de energia disponível. Calculado ao longo do dia/noite pelo relógio.',
    formula: 'Body Battery = f(HRV_noturna, Sono, Stress, Atividade)',
    steps: () => [
      { label: 'HRV noturna', note: 'Principal fator — recuperação autonômica', },
      { label: 'Qualidade e duração do sono', note: 'REM, sono profundo, despertar' },
      { label: 'Estresse acumulado', note: 'Stress Garmin médio do dia' },
      { label: 'Atividade física realizada', note: 'Cargas de treino e atividade basal' },
      { label: 'Body Battery resultante', note: 'Algoritmo proprietário Firstbeat (fornecedor do Garmin)' },
    ],
    thresholds: [
      { label: 'Ótimo', range: '≥ 50', color: '#00d084' },
      { label: 'Zona de exaustão', range: '< 40', color: '#ffa800' },
      { label: 'Overtraining clínico', range: '< 35', color: '#e8001c' },
      { label: 'Válvula de segurança', range: '< 25', color: '#e8001c' },
    ],
    source: 'Sincronizado via Garmin Connect → campo body_battery na tabela daily_metrics',
    reference: 'Stanley et al. (2013); THRESHOLDS.bodyBattery no código',
  },
  sleep: {
    name: 'Sono',
    fullName: 'Duração Total do Sono',
    icon: <Moon className="w-4 h-4" />,
    color: '#8b5cf6',
    what: 'Total de horas dormidas registradas pelo Garmin com base em detecção de movimento e HRV. Inclui todas as fases (leve, profundo, REM). Indicador chave de recuperação — são insuficientes aumentam risco de lesão e prejudicam adaptação ao treino.',
    formula: 'Sono = tempo_inicio_sono → tempo_acordar (líquido)',
    steps: (ctx) => {
      const h = Number(ctx.sleep ?? 0)
      return [
        { label: 'Detecção de início do sono', note: 'Imobilidade + FC baixa' },
        { label: 'Detecção de despertar', note: 'Movimento + retorno FC normal' },
        { label: 'Tempo líquido dormido', result: `${fmt(h, 1)}h`, note: 'Excluindo despertares breves' },
      ]
    },
    thresholds: [
      { label: 'Meta ideal', range: '≥ 8h', color: '#00d084' },
      { label: 'Aceitável', range: '7 – 8h', color: '#0088ff' },
      { label: 'Risco de lesão +70%', range: '< 7h', color: '#ffa800' },
      { label: 'Válvula (3 noites)', range: '< 5.5h', color: '#e8001c' },
    ],
    source: 'Sincronizado via Garmin Connect → campo sleep_hours na tabela daily_metrics',
    unit: 'horas',
    reference: 'Fullagar et al. (2015); THRESHOLDS.sleep no código',
  },
  rem: {
    name: 'REM',
    fullName: 'Sono REM — Rapid Eye Movement',
    icon: <Moon className="w-4 h-4" />,
    color: '#8b5cf6',
    what: 'Percentual do sono total na fase REM. O sono REM é crítico para consolidação da memória motora (aprendizado de movimentos), regulação emocional e recuperação cognitiva. Atletas com REM < 20% têm recuperação comprometida.',
    formula: 'REM% = (duração_REM / sono_total) × 100',
    steps: (ctx) => {
      const rem = Number(ctx.rem ?? 0)
      return [
        { label: 'Garmin detecta fase REM', note: 'Via acelerómetro + FC + HRV' },
        { label: 'Duração acumulada em REM', note: 'Ciclos de ~90min ao longo da noite' },
        { label: 'Percentual do sono total', result: `${fmt(rem, 0)}%` },
      ]
    },
    thresholds: [
      { label: 'Ideal', range: '20 – 22%', color: '#00d084' },
      { label: 'Mínimo aceitável', range: '≥ 10%', color: '#ffa800' },
      { label: 'Válvula de segurança', range: '< 10%', color: '#e8001c' },
    ],
    source: 'Sincronizado via Garmin Connect → campo rem_pct na tabela daily_metrics',
    unit: '%',
    reference: 'THRESHOLDS.rem no código',
  },
  rhr: {
    name: 'FC Repouso',
    fullName: 'Frequência Cardíaca de Repouso',
    icon: <Thermometer className="w-4 h-4" />,
    color: '#e8001c',
    what: 'FC de repouso medida pelo Garmin durante o sono (mais preciso do que manual). Elevação acima da baseline pessoal pode indicar estresse fisiológico, infecção, desidratação ou overtraining. A plataforma compara com os limites absolutos configurados.',
    formula: 'FC_Repouso = mínima FC registrada durante o sono',
    steps: (ctx) => {
      const rhr = Number(ctx.rhr ?? 0)
      return [
        { label: 'FC medida durante o sono', result: `${fmt(rhr, 0)} bpm` },
        { label: 'Limiar de alerta', result: '≥ 58 bpm', note: '+5 sobre a baseline de 53 bpm' },
        { label: 'Limiar clínico', result: '≥ 62 bpm', note: 'Suspeita de infecção ou overtraining' },
        { label: 'Status atual', result: rhr >= 62 ? '⚠ Alerta clínico' : rhr >= 58 ? '⚡ Alerta leve' : '✓ Normal' },
      ]
    },
    thresholds: [
      { label: 'Normal', range: '< 58 bpm', color: '#00d084' },
      { label: 'Alerta leve', range: '58 – 61 bpm', color: '#ffa800' },
      { label: 'Alerta clínico', range: '≥ 62 bpm', color: '#e8001c' },
    ],
    source: 'Sincronizado via Garmin Connect → campo resting_hr na tabela daily_metrics',
    unit: 'bpm',
    reference: 'THRESHOLDS.rhr no código',
  },
  stress: {
    name: 'Stress',
    fullName: 'Nível de Stress Médio (Garmin)',
    icon: <Brain className="w-4 h-4" />,
    color: '#ffa800',
    what: 'Stress médio diário calculado pelo Garmin com base na variabilidade da FC ao longo do dia. Valores altos indicam domínio simpático (estado de alerta/estresse) e prejudicam a recuperação por bloquear o sono profundo.',
    formula: 'Stress = f(desvio_padrão_RR, domínio_simpático)',
    steps: (ctx) => {
      const s = Number(ctx.stress ?? 0)
      return [
        { label: 'Garmin mede HRV ao longo do dia', note: 'Via acelerómetro + óptico' },
        { label: 'Baixa HRV → alto stress (simpático)', note: 'Correlação inversa com rMSSD' },
        { label: 'Stress médio do dia', result: `${fmt(s, 0)} / 100` },
        { label: 'Limiar que bloqueia sono profundo', result: '> 35', note: 'Meerlo et al. (2008)' },
      ]
    },
    thresholds: [
      { label: 'Meta diária', range: '≤ 30', color: '#00d084' },
      { label: 'Elevado', range: '31 – 50', color: '#ffa800' },
      { label: 'Bloqueia sono profundo', range: '> 35', color: '#e8001c' },
    ],
    source: 'Sincronizado via Garmin Connect → campo stress_avg na tabela daily_metrics',
    reference: 'Meerlo et al. (2008); THRESHOLDS.stress no código',
  },
  wkg: {
    name: 'W/kg',
    fullName: 'Watts por Quilograma — Eficiência de Potência',
    icon: <Zap className="w-4 h-4" />,
    color: '#8b5cf6',
    what: 'Relação entre a potência limiar (FTP) e o peso do atleta. Principal indicador de performance em ciclismo e triathlon — permite comparar atletas de pesos diferentes e acompanhar evolução sem viés de massa corporal.',
    formula: 'W/kg = FTP / Peso',
    steps: (ctx) => {
      const ftp = Number(ctx.ftp ?? 0)
      const weight = Number(ctx.weight ?? 0)
      const wkg = weight > 0 ? ftp / weight : 0
      return [
        { label: 'FTP do atleta', result: `${fmt(ftp, 0)}W` },
        { label: 'Peso do atleta', result: `${fmt(weight, 1)} kg` },
        { label: 'W/kg = FTP / Peso', expr: `${fmt(ftp, 0)} / ${fmt(weight, 1)}`, result: wkg.toFixed(2) },
      ]
    },
    thresholds: [
      { label: 'Iniciante', range: '< 2.5', color: '#6677aa' },
      { label: 'Recreativo', range: '2.5 – 3.5', color: '#0088ff' },
      { label: 'Competitivo', range: '3.5 – 4.5', color: '#00d084' },
      { label: 'Elite', range: '> 4.5', color: '#ffa800' },
    ],
    source: 'Calculado de FTP e peso cadastrados no perfil do atleta',
  },
  vo2max: {
    name: 'VO2max',
    fullName: 'Volume Máximo de Oxigênio — Capacidade Aeróbia',
    icon: <Heart className="w-4 h-4" />,
    color: '#00d084',
    what: 'VO2max é o volume máximo de oxigênio que o organismo consegue consumir por minuto por kg de peso corporal. É o principal determinante da capacidade aeróbia de longo prazo. Valores altos permitem sustentar intensidades maiores por mais tempo.',
    formula: 'VO2max = (Potência_max × 10.8 / Peso) + 7 (estimativa)',
    steps: () => [
      { label: 'Medição direta (lab)', note: 'Teste incremental em cicloergômetro ou esteira com analisador de gases' },
      { label: 'Estimativa Garmin', note: 'Algoritmo Firstbeat — correlação FC vs velocidade/potência' },
      { label: 'Estimativa via FTP', note: 'VO2max ≈ FTP × 10.8 / Peso + 7 (aproximação Coggan)' },
    ],
    thresholds: [
      { label: 'Abaixo da média', range: '< 45', color: '#6677aa' },
      { label: 'Médio', range: '45 – 55', color: '#0088ff' },
      { label: 'Bom', range: '55 – 65', color: '#00d084' },
      { label: 'Excelente', range: '> 65', color: '#ffa800' },
    ],
    source: 'Cadastrado manualmente no perfil do atleta (resultado de teste laboratorial ou estimativa Garmin)',
    unit: 'ml/kg/min',
  },
  lthr: {
    name: 'LTHR',
    fullName: 'Lactate Threshold Heart Rate — FC no Limiar',
    icon: <Heart className="w-4 h-4" />,
    color: '#e8001c',
    what: 'LTHR é a frequência cardíaca máxima que o atleta consegue manter em equilíbrio de lactato — a intensidade na qual a produção de lactato iguala a remoção. Acima deste ponto, o lactato acumula rapidamente.',
    formula: 'LTHR ≈ FC_média_teste_30min (intensidade máxima sustentável)',
    steps: () => [
      { label: 'Teste de esforço máximo (30 min)', note: 'Atleta mantém o maior esforço possível durante 30 minutos' },
      { label: 'FC média dos últimos 20 minutos', note: 'Os primeiros 10min são excluídos — estado transiente' },
      { label: 'LTHR = FC média dos 20min finais', note: 'Equivale ao limiar láctico L2' },
    ],
    source: 'Cadastrado manualmente no perfil do atleta',
    unit: 'bpm',
    reference: 'Friel (2009) — The Triathlete\'s Training Bible',
  },
  readiness: {
    name: 'Prontidão',
    fullName: 'Nível de Prontidão para Treino',
    icon: <Activity className="w-4 h-4" />,
    color: '#00d084',
    what: 'Prontidão é o resultado do motor de regras que combina todos os indicadores de recuperação para determinar se o atleta está apto para treinar e em que intensidade. Segue hierarquia: Válvula > Vermelho > Amarelo > Verde.',
    formula: 'Prontidão = Motor_de_Regras(HRV, Body_Battery, Sono, REM, FC_Repouso, Stress)',
    steps: () => [
      { label: '1. Verificar Válvula de Segurança', note: 'Se Body Battery < 25 OU (sono < 5.5h por 3 noites) OU REM < 10% → ABORTAR TREINO' },
      { label: '2. Verificar Vermelho', note: 'HRV < 34ms OU Body Battery < 35 → CANCELAR (apenas recuperação ativa)' },
      { label: '3. Verificar Amarelo', note: 'HRV 34–36 OU Body Battery 35–39 OU Sono < 7h → ADAPTAR (volume −30%)' },
      { label: '4. Verde', note: 'Todos os critérios acima fora do limiar → TREINO NORMAL' },
      { label: 'Hierarquia', note: 'Pior condição prevalece — ex: HRV verde + BB < 25 → resultado VÁLVULA' },
    ],
    thresholds: [
      { label: 'Verde — Treino normal', range: 'Todos parâmetros OK', color: '#00d084' },
      { label: 'Amarelo — Adaptar volume', range: 'HRV/BB/Sono limítrofes', color: '#ffa800' },
      { label: 'Vermelho — Cancelar', range: 'HRV < 34 ou BB < 35', color: '#e8001c' },
      { label: 'Válvula — Abortar', range: 'BB < 25, sono < 5.5h × 3, REM < 10%', color: '#ff0055' },
    ],
    source: 'Motor de regras em src/lib/readiness.ts — função trainingReadiness()',
    reference: 'THRESHOLDS em src/lib/thresholds.ts',
  },
}

export function MetricDetailSheet({ metricKey, value, context = {}, onClose }: MetricDetailProps) {
  const def = METRICS[metricKey]
  if (!def) return null

  const steps = def.steps ? def.steps(context) : []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-2xl"
        style={{ background: '#0d0d14', borderLeft: '1px solid #1e1e2e' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg" style={{ background: def.color + '20', color: def.color }}>
              {def.icon}
            </span>
            <div>
              <p className="text-base font-black" style={{ color: def.color }}>{def.name}</p>
              <p className="text-[10px] text-muted-foreground">{def.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1e1e2e] rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">

          {/* Current value */}
          {value != null && value !== '' && (
            <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: def.color + '10', border: `1px solid ${def.color}30` }}>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Valor atual</p>
                <p className="text-3xl font-black" style={{ color: def.color }}>
                  {value}{def.unit ? ` ${def.unit}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* What is it */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Info className="w-3 h-3" /> O que é
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{def.what}</p>
          </div>

          {/* Formula */}
          {def.formula && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Fórmula</p>
              <div className="rounded-lg px-4 py-3 font-mono text-xs" style={{ background: '#0a0a0f', border: '1px solid #1a1a28', color: def.color }}>
                {def.formula}
              </div>
            </div>
          )}

          {/* Calculation steps */}
          {steps.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Sequência do cálculo</p>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="rounded-lg px-4 py-3" style={{ background: '#0a0a0f', border: '1px solid #1a1a28' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
                          style={{ background: def.color + '20', color: def.color }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{step.label}</p>
                          {step.expr && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{step.expr}</p>}
                          {step.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{step.note}</p>}
                        </div>
                      </div>
                      {step.result && (
                        <span className="text-sm font-black flex-shrink-0" style={{ color: def.color }}>{step.result}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thresholds */}
          {def.thresholds && (
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Interpretação dos valores</p>
              <div className="space-y-1.5">
                {def.thresholds.map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    style={{ background: t.color + '10', border: `1px solid ${t.color}30` }}>
                    <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
                    <span className="text-[10px] font-mono" style={{ color: t.color + 'cc' }}>{t.range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          <div className="rounded-lg px-4 py-3" style={{ background: '#0a0a0f', border: '1px solid #1a1a28' }}>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Origem dos dados</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{def.source}</p>
            {def.reference && (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 italic">{def.reference}</p>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
