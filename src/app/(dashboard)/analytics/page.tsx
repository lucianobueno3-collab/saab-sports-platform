'use client'

import { Topbar } from '@/components/layout/topbar'
import { TrendingUp } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div>
      <Topbar title="Analytics" subtitle="Análise de performance por atleta" />
      <div className="p-6 flex flex-col items-center justify-center h-96 text-center">
        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-base font-bold text-foreground mb-2">Analytics em desenvolvimento</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Gráficos avançados de evolução de performance, comparativo entre atletas e análise de tendências — disponível em breve.
        </p>
      </div>
    </div>
  )
}
