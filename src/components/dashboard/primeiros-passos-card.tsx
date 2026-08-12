'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getEstadoDaMontagem } from '@/lib/supabase/queries'
import { passosDoTreinador, montagemCompleta, type Passo } from '@/lib/primeiros-passos'
import { CheckCircle2, Circle, ChevronRight, Rocket } from 'lucide-react'

const RED = '#e8001c'

/**
 * Primeiros passos, no topo do painel.
 *
 * Ninguém era apresentado ao app: quem entra pela primeira vez encontra um
 * menu cheio e nenhuma indicação de por onde começar. E dá para chegar longe
 * com a montagem pela metade — o caso mais comum é o aluno com plano mas sem
 * ritmo de limiar, que recebe "88–98%" em vez de minutos por quilômetro.
 *
 * Some sozinho quando os três passos estão feitos, e volta se um aluno novo
 * entrar sem ritmo. Não há botão de fechar de propósito: o que o faz sumir é
 * resolver, não esconder.
 */
export function PrimeirosPassosCard() {
  const [passos, setPassos] = useState<Passo[] | null>(null)

  useEffect(() => {
    getEstadoDaMontagem()
      .then(e => setPassos(passosDoTreinador(e)))
      .catch(() => setPassos(null))
  }, [])

  if (!passos || montagemCompleta(passos)) return null

  const feitos = passos.filter(p => p.feito).length

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Rocket className="w-4 h-4 shrink-0" style={{ color: RED }} />
        <h2 className="text-sm font-black text-foreground flex-1">Primeiros passos</h2>
        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{feitos} de {passos.length}</span>
      </div>

      {passos.map((p, i) => (
        <Link key={p.chave} href={p.href}
          className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
          style={i ? { borderTop: '1px solid var(--border)' } : undefined}>
          {p.feito
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#00d084' }} />
            : <Circle className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground/50" />}
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] font-bold ${p.feito ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {p.titulo}
            </span>
            {!p.feito && <span className="block text-[11px] text-muted-foreground mt-0.5">{p.porque}</span>}
          </span>
          {!p.feito && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
        </Link>
      ))}
    </section>
  )
}
