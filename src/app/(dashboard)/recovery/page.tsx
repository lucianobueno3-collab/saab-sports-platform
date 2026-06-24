'use client'

import { Topbar } from '@/components/layout/topbar'
import { Heart } from 'lucide-react'

export default function RecoveryPage() {
  return (
    <div>
      <Topbar title="Recuperação" subtitle="HRV, sono e bem-estar dos atletas" />
      <div className="p-6 flex flex-col items-center justify-center h-96 text-center">
        <div className="w-16 h-16 bg-[#00d084]/10 border border-[#00d084]/20 rounded-2xl flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-[#00d084]" />
        </div>
        <h2 className="text-base font-bold text-foreground mb-2">Recuperação em desenvolvimento</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Monitoramento de HRV, qualidade do sono, recovery score e bem-estar subjetivo — disponível após importação de dados de wearables.
        </p>
      </div>
    </div>
  )
}
