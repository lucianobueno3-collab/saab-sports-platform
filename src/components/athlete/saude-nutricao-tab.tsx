'use client'

import { useState } from 'react'
import { SaudeTab } from './saude-tab'
import { NutricaoTab } from './nutricao-tab'
import { Heart, Utensils } from 'lucide-react'

const RED = '#e8001c'

/** Área unificada de Saúde + Nutrição (mesma ficha, com sub-abas).
 *  Usada tanto no portal do aluno quanto na ficha do treinador. */
export function SaudeNutricaoTab({ athleteId, sex }: { athleteId: string; sex: 'M' | 'F' | null }) {
  const [sub, setSub] = useState<'saude' | 'nutricao'>('saude')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-secondary w-full sm:w-fit">
        {([['saude', 'Saúde', Heart], ['nutricao', 'Nutrição', Utensils]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-colors"
            style={sub === k ? { background: RED, color: '#fff' } : { color: 'var(--muted-foreground)' }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === 'saude'
        ? <SaudeTab athleteId={athleteId} sex={sex} />
        : <NutricaoTab athleteId={athleteId} />}
    </div>
  )
}
