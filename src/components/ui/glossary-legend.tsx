'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'

export interface GlossaryTerm {
  abbr: string
  full: string
  description: string
  color?: string
}

const ALL_TERMS: Record<string, GlossaryTerm> = {
  CTL: {
    abbr: 'CTL',
    full: 'Chronic Training Load — Fitness',
    description: 'Média ponderada do TSS dos últimos 42 dias. Representa o nível de condicionamento físico acumulado. Quanto maior, mais apto o atleta.',
    color: '#0088ff',
  },
  ATL: {
    abbr: 'ATL',
    full: 'Acute Training Load — Fadiga',
    description: 'Média ponderada do TSS dos últimos 7 dias. Representa a fadiga recente. Sobe rápido após treinos intensos e cai com o descanso.',
    color: '#e8001c',
  },
  TSB: {
    abbr: 'TSB',
    full: 'Training Stress Balance — Forma',
    description: 'TSB = CTL − ATL. Positivo (+) = atleta fresco e pronto para competir. Negativo (−) = atleta fatigado, ainda absorvendo o treino.',
    color: '#00d084',
  },
  TSS: {
    abbr: 'TSS',
    full: 'Training Stress Score — Stress do treino',
    description: 'Pontuação que quantifica o esforço de cada treino. TSS 100 = 1 hora exatamente no FTP. TSS 150 = sessão muito intensa ou longa.',
    color: '#ffa800',
  },
  FTP: {
    abbr: 'FTP',
    full: 'Functional Threshold Power — Limiar de Potência',
    description: 'Potência máxima que o atleta consegue manter por ~1 hora (watts). Base para calcular TSS, IF e zonas de treinamento.',
    color: '#ffa800',
  },
  NP: {
    abbr: 'NP',
    full: 'Normalized Power — Potência Normalizada',
    description: 'Estimativa da potência "equivalente" de um esforço variável. Sempre ≥ potência média. Calcula melhor o custo fisiológico real do treino.',
    color: '#0088ff',
  },
  IF: {
    abbr: 'IF',
    full: 'Intensity Factor — Fator de Intensidade',
    description: 'IF = NP ÷ FTP. IF 1.0 = treino no FTP. IF > 1.05 = muito intenso (impossível de manter >60 min). IF < 0.75 = zona de recuperação.',
    color: '#a855f7',
  },
  PMC: {
    abbr: 'PMC',
    full: 'Performance Management Chart',
    description: 'Gráfico que mostra a evolução de CTL (fitness), ATL (fadiga) e TSB (forma) ao longo do tempo. Ferramenta central do planejamento de periodização.',
    color: '#888899',
  },
  LTHR: {
    abbr: 'LTHR',
    full: 'Lactate Threshold Heart Rate — FC Limiar',
    description: 'Frequência cardíaca no limiar anaeróbico. Define as zonas de treino cardíacas. Geralmente medido em teste de campo de 30 minutos.',
    color: '#e8001c',
  },
  VO2MAX: {
    abbr: 'VO₂max',
    full: 'Consumo Máximo de Oxigênio',
    description: 'Volume máximo de oxigênio que o atleta consegue utilizar por minuto por kg de peso corporal (ml/kg/min). Indicador do potencial aeróbico máximo.',
    color: '#00d084',
  },
  WKG: {
    abbr: 'W/kg',
    full: 'Watts por Quilograma',
    description: 'FTP dividido pelo peso corporal. Indica a potência relativa — essencial para avaliar performance em subidas e comparar atletas de pesos diferentes.',
    color: '#00d084',
  },
  BPM: {
    abbr: 'bpm',
    full: 'Batimentos por Minuto',
    description: 'Frequência cardíaca. Em repouso: valores abaixo de 60 bpm são comuns em atletas bem treinados. Pulso de repouso alto pode indicar fadiga ou sobrecarga.',
    color: '#e8001c',
  },
}

interface GlossaryLegendProps {
  terms: (keyof typeof ALL_TERMS)[]
  defaultOpen?: boolean
}

export function GlossaryLegend({ terms, defaultOpen = false }: GlossaryLegendProps) {
  const [open, setOpen] = useState(defaultOpen)

  const items = terms.map(k => ALL_TERMS[k]).filter(Boolean)
  if (items.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors text-left"
        type="button"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          Glossário de Abreviações
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-border">
          {items.map(item => (
            <div key={item.abbr} className="bg-secondary/20 rounded-lg p-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-black" style={{ color: item.color ?? '#aaaacc' }}>{item.abbr}</span>
                <span className="text-[10px] text-muted-foreground font-medium truncate">{item.full}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
