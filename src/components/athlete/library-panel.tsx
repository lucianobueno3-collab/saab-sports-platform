'use client'

import { useMemo, useState } from 'react'
import type { WorkoutLibraryRow } from '@/lib/supabase/queries'
import { agruparBiblioteca } from '@/lib/library-groups'
import { StructureBar } from '@/components/athlete/structured-builder'
import {
  Search, X, ChevronRight, Library, Footprints, Bike, Waves, Dumbbell,
  Activity as ActIcon, GripVertical,
} from 'lucide-react'

const SPORTS: Record<string, { color: string; icon: typeof Footprints }> = {
  running: { color: '#ff6b00', icon: Footprints },
  cycling: { color: '#0088ff', icon: Bike },
  swimming: { color: '#00b4d8', icon: Waves },
  strength: { color: 'var(--marca)', icon: Dumbbell },
  triathlon: { color: '#8b5cf6', icon: ActIcon },
}
const infoDe = (s: string) => SPORTS[s] ?? { color: '#64748b', icon: ActIcon }

/**
 * Biblioteca encostada no calendário, no estilo do TrainingPeaks.
 *
 * Os treinos ficam em pastas que abrem e fecham, e cada um pode ser arrastado
 * direto para um dia. Sem isso o treinador tinha de abrir o dia, procurar na
 * lista e escolher — três passos para o que agora é um gesto.
 *
 * Tocar num treino também funciona: em celular e tablet não há arrastar, e
 * exigir o mouse deixaria a tela inútil fora do computador.
 */
export function LibraryPanel({ itens, onDragStart, onDragEnd, onPick, onClose }: {
  itens: WorkoutLibraryRow[]
  onDragStart: (w: WorkoutLibraryRow) => void
  onDragEnd: () => void
  /** Toque num treino — alternativa ao arrastar, para telas sem mouse. */
  onPick?: (w: WorkoutLibraryRow) => void
  onClose?: () => void
}) {
  const [busca, setBusca] = useState('')
  const [fechados, setFechados] = useState<Set<string>>(new Set())

  const grupos = useMemo(() => agruparBiblioteca(itens, busca), [itens, busca])
  // Buscando, tudo abre: esconder resultado atrás de pasta fechada é frustrante.
  const buscando = busca.trim().length > 0

  function alternar(nome: string) {
    setFechados(prev => {
      const p = new Set(prev)
      if (p.has(nome)) p.delete(nome); else p.add(nome)
      return p
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border shrink-0">
        <Library className="w-4 h-4 shrink-0 text-muted-foreground" />
        <p className="text-sm font-black text-foreground flex-1 min-w-0">Biblioteca</p>
        {onClose && (
          <button onClick={onClose} aria-label="Fechar biblioteca" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-3.5 py-2.5 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar"
            className="w-full pl-8 pr-7 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          {busca && (
            <button onClick={() => setBusca('')} aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {grupos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-8 px-3 leading-relaxed">
            {buscando ? 'Nenhum treino encontrado.' : 'Biblioteca vazia. Carregue um plano em Treinos → Planos de treinamento.'}
          </p>
        ) : grupos.map(g => {
          const aberto = buscando || !fechados.has(g.nome)
          return (
            <div key={g.nome} className="mb-0.5">
              <button onClick={() => alternar(g.nome)}
                className="w-full flex items-center gap-1.5 px-1.5 py-2 rounded-lg hover:bg-secondary/60 text-left">
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${aberto ? 'rotate-90' : ''}`} />
                <span className="text-[12px] font-bold text-foreground flex-1 min-w-0 truncate">{g.nome}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">({g.treinos.length})</span>
              </button>

              {aberto && (
                <div className="pl-3">
                  {g.treinos.map(w => {
                    const info = infoDe(w.sport)
                    const Icon = info.icon
                    return (
                      <div key={w.id} draggable
                        onDragStart={() => onDragStart(w)} onDragEnd={onDragEnd}
                        onClick={() => onPick?.(w)}
                        title="Arraste para um dia do calendário"
                        className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-secondary/60">
                        <GripVertical className="w-3 h-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: info.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-foreground truncate">{w.title}</span>
                          <span className="block text-[10px] text-muted-foreground tabular-nums">
                            {[w.duration_min ? `${w.duration_min} min` : null, w.tss ? `${w.tss} TSS` : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {w.structure && w.structure.length > 0 && (
                          <span className="hidden 2xl:block w-10 shrink-0"><StructureBar structure={w.structure} height={5} /></span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
