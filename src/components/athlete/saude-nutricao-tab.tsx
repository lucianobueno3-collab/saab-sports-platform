'use client'

import { useState } from 'react'
import { SaudeTab } from './saude-tab'
import { NutricaoTab } from './nutricao-tab'
import { BloodExams } from './blood-exams'
import { Heart, Utensils, FlaskConical } from 'lucide-react'

const RED = '#e8001c'

/** Área unificada de Saúde + Nutrição + Exames (mesma ficha, com sub-abas).
 *  Usada tanto no portal do aluno quanto na ficha do treinador. */
export function SaudeNutricaoTab({ athleteId, sex }: { athleteId: string; sex: 'M' | 'F' | null }) {
  const [sub, setSub] = useState<'saude' | 'nutricao' | 'exames'>('saude')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-secondary w-full sm:w-fit">
        {([['saude', 'Saúde', Heart], ['nutricao', 'Nutrição', Utensils], ['exames', 'Exames', FlaskConical]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={sub === k ? { background: RED, color: '#fff' } : { color: 'var(--muted-foreground)' }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === 'saude' && <SaudeTab athleteId={athleteId} sex={sex} />}
      {sub === 'nutricao' && <NutricaoTab athleteId={athleteId} />}
      {sub === 'exames' && <BloodExams athleteId={athleteId} sex={sex} />}
    </div>
  )
}
