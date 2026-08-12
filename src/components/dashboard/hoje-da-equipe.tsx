'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSemanaDaEquipe, type AlunoNaSemana } from '@/lib/supabase/queries'
import {
  painelDeHoje, estadoDoDia, totaisDaSemana, COR_DO_DIA, NOME_DO_ESTADO,
  type Motivo,
} from '@/lib/painel-treinador'
import { SkeletonSemanaDaEquipe } from '@/components/ui/skeleton'
import {
  CheckCircle2, Clock, MessageCircle, AlertTriangle,
  CalendarX, BatteryLow, ChevronRight, Moon,
} from 'lucide-react'

const RED = '#e8001c'
const DIAS_CURTOS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

const ICONE: Record<Motivo['chave'], typeof MessageCircle> = {
  'recado': MessageCircle,
  'dor': AlertTriangle,
  'faltas': CalendarX,
  'plano-acabando': Clock,
  'fadiga': BatteryLow,
}

function ymd(d: Date) { return d.toLocaleDateString('en-CA') }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
/** Segunda-feira da semana de `d`. */
function segunda(d: Date) {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7   // 0 = segunda
  return addDays(x, -dow)
}

/**
 * A equipe hoje, e a semana inteira numa grade.
 *
 * A Visão Geral respondia "qual o CTL médio do grupo" — número de relatório
 * mensal. Quem abre o painel de manhã quer saber quem treinou, quem faltou e
 * quem precisa de resposta. Antes, para descobrir isso, era preciso entrar
 * aluno por aluno.
 */
export function HojeDaEquipe() {
  const [alunos, setAlunos] = useState<AlunoNaSemana[]>([])
  const [loading, setLoading] = useState(true)

  const hoje = ymd(new Date())
  const de = ymd(segunda(new Date()))
  const ate = ymd(addDays(segunda(new Date()), 6))

  useEffect(() => {
    getSemanaDaEquipe(de, ate).then(a => { setAlunos(a); setLoading(false) }).catch(() => setLoading(false))
  }, [de, ate])

  const painel = useMemo(() => painelDeHoje(alunos, hoje), [alunos, hoje])
  const totais = useMemo(() => totaisDaSemana(alunos, hoje), [alunos, hoje])

  if (loading) {
    return <SkeletonSemanaDaEquipe />
  }
  if (alunos.length === 0) return null

  return (
    <div className="space-y-5">
      {/* Quem precisa de você — primeiro, porque é o que gera ação */}
      {painel.atencao.length > 0 && (
        <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: `1px solid ${RED}44` }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: RED + '12' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: RED }} />
            <h2 className="text-sm font-black text-foreground flex-1">Precisam de você</h2>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: RED }}>{painel.atencao.length}</span>
          </div>
          {painel.atencao.map(({ aluno, motivos }, i) => (
            <Link key={aluno.id} href={`/athletes/detail?id=${aluno.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
              style={i ? { borderTop: '1px solid var(--border)' } : undefined}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-foreground truncate">{aluno.nome}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {motivos.map(m => {
                    const Icon = ICONE[m.chave]
                    return (
                      <span key={m.chave} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Icon className="w-3 h-3 shrink-0" />{m.texto}
                      </span>
                    )
                  })}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </section>
      )}

      {/* O dia, em três colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ListaDoDia titulo="Treinaram hoje" cor="#00d084" icone={CheckCircle2} alunos={painel.fizeram} />
        <ListaDoDia titulo="Ainda não treinaram" cor="#ffa800" icone={Clock} alunos={painel.pendentes} />
        <ListaDoDia titulo="Sem treino hoje" cor="#64748b" icone={Moon} alunos={painel.semTreino} />
      </div>

      {/* A semana inteira, uma linha por aluno */}
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-black text-foreground">A semana da equipe</h2>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {totais.feitos} de {totais.planejados} treinos feitos
            {totais.furados > 0 && <span style={{ color: RED }}> · {totais.furados} não {totais.furados > 1 ? 'feitos' : 'feito'}</span>}
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
              <span className="flex-1 min-w-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Aluno</span>
              {DIAS_CURTOS.map((d, i) => (
                <span key={i} className="w-8 text-center text-[10px] font-black text-muted-foreground">{d}</span>
              ))}
            </div>
            {alunos.map((a, i) => (
              <Link key={a.id} href={`/athletes/detail?id=${a.id}`}
                className="flex items-center gap-1 px-4 py-2 hover:bg-secondary/40 transition-colors"
                style={i ? { borderTop: '1px solid var(--border)' } : undefined}>
                <span className="flex-1 min-w-0 text-[12px] font-semibold text-foreground truncate pr-2">{a.nome}</span>
                {a.dias.map(d => {
                  const estado = estadoDoDia(d, hoje)
                  const ehHoje = d.date === hoje
                  return (
                    <span key={d.date} className="w-8 flex justify-center">
                      <span
                        title={`${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })} · ${NOME_DO_ESTADO[estado]}`}
                        className="w-5 h-5 rounded-md"
                        style={{
                          background: estado === 'vazio' ? 'transparent' : COR_DO_DIA[estado],
                          border: estado === 'vazio'
                            ? '1px dashed var(--border)'
                            : ehHoje ? '2px solid var(--foreground)' : 'none',
                        }} />
                    </span>
                  )
                })}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5 border-t border-border">
          {(['feito', 'parcial', 'furado', 'pendente'] as const).map(e => (
            <span key={e} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded" style={{ background: COR_DO_DIA[e] }} />{NOME_DO_ESTADO[e]}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function ListaDoDia({ titulo, cor, icone: Icon, alunos }: {
  titulo: string; cor: string; icone: typeof CheckCircle2; alunos: AlunoNaSemana[]
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 shrink-0" style={{ color: cor }} />
        <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex-1 min-w-0">{titulo}</span>
        <span className="text-lg font-black tabular-nums leading-none" style={{ color: cor }}>{alunos.length}</span>
      </div>
      {alunos.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70">Ninguém</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {alunos.slice(0, 6).map(a => (
            <Link key={a.id} href={`/athletes/detail?id=${a.id}`}
              className="text-[12px] text-foreground hover:underline truncate">{a.nome}</Link>
          ))}
          {alunos.length > 6 && (
            <span className="text-[11px] text-muted-foreground">+{alunos.length - 6}</span>
          )}
        </div>
      )}
    </div>
  )
}
