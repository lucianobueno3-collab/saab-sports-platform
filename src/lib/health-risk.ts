// Painel de risco clínico do atleta — cruza exames de sangue, carga de treino,
// fisiologia (HRV/sono) e histórico de lesões para levantar alertas acionáveis.
//
// Não é diagnóstico: é triagem. Cada alerta diz o que foi observado, por que
// importa no esporte e o que fazer — e sempre aponta os dados que o geraram,
// para o médico conferir. As regras seguem consensos usados em medicina
// esportiva (anemia do atleta, RED-S, fratura por estresse, overtraining).

import { BLOOD_MARKERS, refFor, type Sex } from './blood-markers'

export type RiskLevel = 'alto' | 'medio' | 'info'
export type RiskAlert = {
  key: string
  level: RiskLevel
  title: string
  why: string           // por que importa para o atleta
  action: string        // o que fazer
  evidence: string[]    // dados que dispararam o alerta
}

export type RiskInput = {
  sex: Sex
  /** valores mais recentes por marcador (chave do catálogo → valor) */
  blood: Record<string, number>
  /** data do exame mais recente (ISO), para sinalizar exame vencido */
  bloodDate?: string | null
  tsb?: number | null
  ctl?: number | null
  hrv?: number | null
  hrvBaseline?: number | null
  sleepHours?: number | null
  restingHr?: number | null
  /** lesões (para recorrência e lesões ósseas) */
  injuries?: { injury_type: string; location: string; started_at: string; resolved_at: string | null }[]
}

const LEVEL_ORDER: Record<RiskLevel, number> = { alto: 0, medio: 1, info: 2 }
const has = (b: Record<string, number>, k: string) => typeof b[k] === 'number' && !Number.isNaN(b[k])
const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString('pt-BR') : String(v))

/** Marcadores fora da faixa de referência, já com rótulo pronto. */
export function outOfRange(blood: Record<string, number>, sex: Sex): { key: string; label: string; value: number; unit: string; dir: 'low' | 'high' }[] {
  const out: { key: string; label: string; value: number; unit: string; dir: 'low' | 'high' }[] = []
  for (const [key, value] of Object.entries(blood)) {
    const m = BLOOD_MARKERS[key]
    if (!m) continue
    const r = refFor(m, sex)
    if (!r) continue
    if (r.min != null && value < r.min) out.push({ key, label: m.label, value, unit: m.unit, dir: 'low' })
    else if (r.max != null && value > r.max && !m.higherBetter) out.push({ key, label: m.label, value, unit: m.unit, dir: 'high' })
  }
  return out
}

export function assessHealthRisk(input: RiskInput): RiskAlert[] {
  const { blood: b, sex } = input
  const alerts: RiskAlert[] = []
  const isF = sex === 'F'

  // ── Ferro / anemia do atleta ────────────────────────────────────────────
  // Corredores perdem ferro por hemólise de impacto, suor e perdas GI.
  // Ferritina baixa derruba desempenho ANTES de a hemoglobina cair.
  if (has(b, 'ferritina')) {
    const f = b.ferritina
    const limite = isF ? 30 : 40 // limiar esportivo é maior que o laboratorial
    if (f < 15) {
      alerts.push({
        key: 'ferro_depleted', level: 'alto',
        title: 'Depleção de ferro',
        why: 'Ferritina muito baixa compromete transporte de oxigênio e a resposta ao treino — causa clássica de queda de rendimento e fadiga persistente.',
        action: 'Investigar causa (perdas, ingestão) e avaliar reposição de ferro com acompanhamento médico.',
        evidence: [`Ferritina ${fmt(f)} ng/mL`],
      })
    } else if (f < limite) {
      alerts.push({
        key: 'ferro_baixo', level: 'medio',
        title: 'Ferro em nível subótimo para atleta',
        why: `Ferritina abaixo de ${limite} ng/mL já limita adaptação ao treino em endurance, mesmo com hemoglobina normal.`,
        action: 'Revisar ingestão de ferro e considerar reavaliação em 8–12 semanas.',
        evidence: [`Ferritina ${fmt(f)} ng/mL`],
      })
    }
  }
  if (has(b, 'hemoglobina')) {
    const hb = b.hemoglobina
    const min = isF ? 12 : 13.5
    if (hb < min) {
      const ev = [`Hemoglobina ${fmt(hb)} g/dL`]
      if (has(b, 'ferritina')) ev.push(`Ferritina ${fmt(b.ferritina)} ng/mL`)
      alerts.push({
        key: 'anemia', level: 'alto',
        title: 'Anemia',
        why: 'Hemoglobina abaixo do esperado reduz diretamente o VO₂ e a capacidade de sustentar ritmo.',
        action: 'Avaliação médica para tipificar a anemia antes de aumentar carga de treino.',
        evidence: ev,
      })
    }
  }

  // ── Vitamina D / saúde óssea → fratura por estresse ─────────────────────
  if (has(b, 'vitamina_d')) {
    const d = b.vitamina_d
    const boneInjury = (input.injuries ?? []).some(i => /fratura|estresse|periostite|canela|tibia|tíbia|metatars/i.test(`${i.injury_type} ${i.location}`))
    if (d < 20) {
      alerts.push({
        key: 'vitd_deficiencia', level: 'alto',
        title: 'Deficiência de vitamina D',
        why: 'Vitamina D baixa prejudica a saúde óssea e é fator de risco reconhecido para fratura por estresse em corredores.',
        action: 'Reposição orientada e reavaliação em 3 meses. Cuidado ao subir volume de impacto nesse período.',
        evidence: [`Vitamina D ${fmt(d)} ng/mL`],
      })
    } else if (d < 30) {
      alerts.push({
        key: 'vitd_insuficiencia', level: 'medio',
        title: 'Vitamina D insuficiente',
        why: 'Faixa insuficiente para atleta de impacto; associada a maior risco ósseo e a mais infecções respiratórias.',
        action: 'Ajustar exposição solar/suplementação e reavaliar.',
        evidence: [`Vitamina D ${fmt(d)} ng/mL`],
      })
    }
    if (d < 30 && boneInjury) {
      alerts.push({
        key: 'risco_fratura', level: 'alto',
        title: 'Risco elevado de fratura por estresse',
        why: 'Vitamina D baixa combinada com histórico de lesão óssea/de impacto multiplica o risco de nova fratura por estresse.',
        action: 'Progredir volume de impacto com cautela e avaliar densitometria e ingestão de cálcio.',
        evidence: [`Vitamina D ${fmt(d)} ng/mL`, 'Histórico de lesão óssea/impacto'],
      })
    }
  }

  // ── RED-S / baixa disponibilidade energética ────────────────────────────
  // Sinais laboratoriais: testosterona/estradiol baixos, T3 baixo, ferritina baixa.
  const redsFlags: string[] = []
  if (!isF && has(b, 'testosterona_total') && b.testosterona_total < 250) redsFlags.push(`Testosterona ${fmt(b.testosterona_total)} ng/dL`)
  if (isF && has(b, 'estradiol') && b.estradiol < 20) redsFlags.push(`Estradiol ${fmt(b.estradiol)} pg/mL`)
  if (has(b, 't3') && b.t3 < 80) redsFlags.push(`T3 ${fmt(b.t3)} ng/dL`)
  if (has(b, 'ferritina') && b.ferritina < 30) redsFlags.push(`Ferritina ${fmt(b.ferritina)} ng/mL`)
  if (redsFlags.length >= 2) {
    alerts.push({
      key: 'red_s', level: 'alto',
      title: 'Sinais de baixa disponibilidade energética (RED-S)',
      why: 'A combinação de hormônios e marcadores baixos sugere que a ingestão não está cobrindo o gasto do treino — impacta osso, imunidade, humor e desempenho.',
      action: 'Avaliação conjunta de médico e nutricionista; revisar ingestão calórica antes de aumentar carga.',
      evidence: redsFlags,
    })
  }

  // ── Tireoide ────────────────────────────────────────────────────────────
  if (has(b, 'tsh')) {
    const t = b.tsh
    if (t > 4) alerts.push({
      key: 'tsh_alto', level: 'medio',
      title: 'TSH acima da referência',
      why: 'Hipotireoidismo (mesmo subclínico) cursa com fadiga, ganho de peso e queda de rendimento.',
      action: 'Confirmar com T4 livre e avaliação médica.',
      evidence: [`TSH ${fmt(t)} µUI/mL`, ...(has(b, 't4_livre') ? [`T4 livre ${fmt(b.t4_livre)} ng/dL`] : [])],
    })
    else if (t < 0.4) alerts.push({
      key: 'tsh_baixo', level: 'medio',
      title: 'TSH abaixo da referência',
      why: 'Pode indicar hipertireoidismo — cursa com taquicardia, perda de peso e intolerância ao esforço.',
      action: 'Confirmar com T4 livre e avaliação médica.',
      evidence: [`TSH ${fmt(t)} µUI/mL`],
    })
  }

  // ── Dano muscular / recuperação ─────────────────────────────────────────
  if (has(b, 'cpk')) {
    const ck = b.cpk
    const teto = isF ? 192 : 308
    if (ck > teto * 3) alerts.push({
      key: 'ck_alto', level: 'medio',
      title: 'CPK muito elevada',
      why: 'Indica dano muscular importante. Se não for reflexo de um treino/prova recente, merece investigação.',
      action: 'Confirmar contexto (treino forte nas 72h?), hidratação e repetir fora de período de carga.',
      evidence: [`CPK ${fmt(ck)} U/L`],
    })
  }

  // ── Inflamação ──────────────────────────────────────────────────────────
  if (has(b, 'pcr') && b.pcr > 3) alerts.push({
    key: 'pcr_alto', level: 'medio',
    title: 'PCR elevada',
    why: 'Inflamação sistêmica acima do esperado — pode indicar infecção, sobrecarga ou risco cardiovascular.',
    action: 'Correlacionar com quadro clínico; evitar treino intenso enquanto houver processo agudo.',
    evidence: [`PCR ${fmt(b.pcr)} mg/L`],
  })

  // ── Metabólico / cardiovascular ─────────────────────────────────────────
  if (has(b, 'glicose') && b.glicose >= 100) alerts.push({
    key: 'glicemia', level: b.glicose >= 126 ? 'alto' : 'medio',
    title: b.glicose >= 126 ? 'Glicemia em faixa de diabetes' : 'Glicemia em faixa de pré-diabetes',
    why: 'Alteração glicêmica muda a resposta ao treino e exige acompanhamento clínico.',
    action: 'Confirmar com nova coleta e hemoglobina glicada.',
    evidence: [`Glicose ${fmt(b.glicose)} mg/dL`, ...(has(b, 'hba1c') ? [`HbA1c ${fmt(b.hba1c)}%`] : [])],
  })
  if (has(b, 'ldl') && b.ldl > 160) alerts.push({
    key: 'ldl_alto', level: 'medio',
    title: 'LDL elevado',
    why: 'Risco cardiovascular aumentado — relevante mesmo em atletas, sobretudo com histórico familiar.',
    action: 'Avaliar risco global e conduta dietética/medicamentosa com o médico.',
    evidence: [`LDL ${fmt(b.ldl)} mg/dL`, ...(has(b, 'colesterol_total') ? [`Colesterol total ${fmt(b.colesterol_total)} mg/dL`] : [])],
  })

  // ── Função renal e hepática ─────────────────────────────────────────────
  if (has(b, 'tfg') && b.tfg < 60) alerts.push({
    key: 'tfg_baixa', level: 'alto',
    title: 'Filtração glomerular reduzida',
    why: 'Sugere comprometimento renal; muda conduta sobre hidratação, anti-inflamatórios e suplementos.',
    action: 'Avaliação médica antes de qualquer suplementação e revisão do uso de AINEs.',
    evidence: [`eTFG ${fmt(b.tfg)} mL/min/1,73m²`],
  })
  if ((has(b, 'tgo') && b.tgo > 120) || (has(b, 'tgp') && b.tgp > 168)) alerts.push({
    key: 'hepatica', level: 'medio',
    title: 'Enzimas hepáticas elevadas',
    why: 'Pode refletir dano muscular do treino, mas valores muito altos exigem descartar causa hepática.',
    action: 'Correlacionar com CPK e repetir longe de período de carga intensa.',
    evidence: [
      ...(has(b, 'tgo') ? [`TGO ${fmt(b.tgo)} U/L`] : []),
      ...(has(b, 'tgp') ? [`TGP ${fmt(b.tgp)} U/L`] : []),
    ],
  })

  // ── Carga de treino × recuperação (overtraining) ────────────────────────
  const tsb = input.tsb
  if (typeof tsb === 'number' && tsb < -30) {
    const ev = [`TSB ${tsb.toFixed(0)}`]
    if (typeof input.ctl === 'number') ev.push(`CTL ${input.ctl.toFixed(0)}`)
    alerts.push({
      key: 'fadiga_alta', level: tsb < -40 ? 'alto' : 'medio',
      title: 'Fadiga acumulada elevada',
      why: 'Saldo de forma muito negativo aumenta risco de lesão e de overreaching não funcional.',
      action: 'Considerar semana de recuperação antes de nova carga forte.',
      evidence: ev,
    })
  }
  if (typeof input.hrv === 'number' && typeof input.hrvBaseline === 'number' && input.hrvBaseline > 0) {
    const drop = (1 - input.hrv / input.hrvBaseline) * 100
    if (drop >= 20) alerts.push({
      key: 'hrv_queda', level: 'medio',
      title: 'Queda importante da variabilidade cardíaca',
      why: 'HRV bem abaixo da linha de base sinaliza estresse fisiológico — treino intenso nesse estado rende pouco e machuca mais.',
      action: 'Priorizar sono e treino leve até a HRV voltar à faixa habitual.',
      evidence: [`HRV ${input.hrv.toFixed(0)} ms (base ${input.hrvBaseline.toFixed(0)} ms, −${drop.toFixed(0)}%)`],
    })
  }
  if (typeof input.sleepHours === 'number' && input.sleepHours < 6) alerts.push({
    key: 'sono_baixo', level: 'medio',
    title: 'Sono insuficiente',
    why: 'Abaixo de 6h a recuperação hormonal e a consolidação do treino ficam comprometidas, com mais risco de lesão.',
    action: 'Trabalhar higiene do sono antes de aumentar volume.',
    evidence: [`Sono ${input.sleepHours.toFixed(1)} h`],
  })

  // ── Lesão recorrente no mesmo local ─────────────────────────────────────
  const byLocation = new Map<string, number>()
  for (const i of input.injuries ?? []) {
    const k = i.location.trim().toLowerCase()
    if (k) byLocation.set(k, (byLocation.get(k) ?? 0) + 1)
  }
  for (const [loc, n] of byLocation) {
    if (n >= 2) alerts.push({
      key: `lesao_recorrente_${loc}`, level: 'medio',
      title: `Lesão recorrente — ${loc}`,
      why: 'Repetição no mesmo local indica causa não resolvida (biomecânica, carga ou força).',
      action: 'Investigar fator causal e incluir trabalho preventivo específico na rotina.',
      evidence: [`${n} episódios registrados`],
    })
  }

  // ── Exame de sangue desatualizado ───────────────────────────────────────
  if (input.bloodDate) {
    const months = (Date.now() - new Date(input.bloodDate + 'T12:00:00').getTime()) / (30 * 86400000)
    if (months > 12) alerts.push({
      key: 'exame_vencido', level: 'info',
      title: 'Exame de sangue desatualizado',
      why: 'O último exame tem mais de 12 meses — o acompanhamento perde precisão.',
      action: 'Solicitar nova coleta para atualizar o painel.',
      evidence: [`Último exame em ${new Date(input.bloodDate + 'T12:00:00').toLocaleDateString('pt-BR')}`],
    })
  }

  return alerts.sort((a, b2) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b2.level])
}
