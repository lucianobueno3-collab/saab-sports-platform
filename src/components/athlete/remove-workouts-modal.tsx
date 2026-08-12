'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  countPlannedWorkouts, bulkDeletePlannedWorkouts,
  type BulkDeleteScope, type PlannedWorkoutRow,
} from '@/lib/supabase/queries'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'

const RED = 'var(--marca)'
const ymd = (d: Date) => d.toLocaleDateString('en-CA')

type Alcance = 'futuros' | 'periodo' | 'tudo'

/**
 * Remoção em lote dos treinos de um aluno.
 *
 * A tela mostra QUANTOS treinos serão apagados antes de habilitar o botão, e o
 * número se atualiza a cada mudança de opção. Depois de apagar, um aviso com
 * "Desfazer" fica alguns segundos na tela e recoloca tudo se for o caso.
 *
 * O padrão preserva o que o aluno já concluiu: o histórico é o registro do que
 * ele fez, e apagá-lo distorceria a carga acumulada e as conquistas. Dá para
 * incluir os concluídos, mas é uma escolha explícita e avisada.
 */
export function RemoveWorkoutsModal({ athleteId, athleteName, onClose, onRemoved }: {
  athleteId: string; athleteName?: string | null; onClose: () => void
  /** Recebe também as linhas apagadas, que é o que o "Desfazer" recoloca. */
  onRemoved: (n: number, apagados: PlannedWorkoutRow[]) => void
}) {
  const hoje = ymd(new Date())
  const [alcance, setAlcance] = useState<Alcance>('futuros')
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d) })
  const [incluirFeitos, setIncluirFeitos] = useState(false)
  const [quantos, setQuantos] = useState<number | null>(null)
  const [contando, setContando] = useState(true)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const escopo: BulkDeleteScope =
    alcance === 'futuros' ? { from: hoje, includeCompleted: incluirFeitos }
    : alcance === 'periodo' ? { from: de, to: ate, includeCompleted: incluirFeitos }
    : { includeCompleted: incluirFeitos }

  const periodoInvalido = alcance === 'periodo' && de > ate

  const chave = JSON.stringify(escopo)
  useEffect(() => {
    // Data invertida é erro de preenchimento: não vale ir ao servidor, e o
    // aviso tem de aparecer na hora em vez de esperar a contagem.
    if (periodoInvalido) { setContando(false); setQuantos(null); return }
    let vivo = true
    setContando(true); setErro(null)
    ;(async () => {
      try {
        const n = await countPlannedWorkouts(athleteId, JSON.parse(chave) as BulkDeleteScope)
        if (vivo) setQuantos(n)
      } catch {
        if (vivo) { setQuantos(null); setErro('Não foi possível contar os treinos.') }
      } finally {
        if (vivo) setContando(false)
      }
    })()
    return () => { vivo = false }
  }, [athleteId, chave, periodoInvalido])

  async function apagar() {
    setApagando(true); setErro(null)
    const res = await bulkDeletePlannedWorkouts(athleteId, escopo)
    setApagando(false)
    if (!res.ok) { setErro(res.error ?? 'Falha ao remover os treinos.'); return }
    onRemoved(res.count, res.apagados ?? [])
  }

  if (!mounted) return null
  const nada = quantos === 0
  const opcao = (v: Alcance, t: string) => (
    <button key={v} onClick={() => setAlcance(v)}
      className="flex-1 py-2 text-xs font-bold rounded-lg transition-colors"
      style={alcance === v ? { background: RED, color: '#fff' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
      {t}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black text-foreground flex items-center gap-2">
            <Trash2 className="w-4 h-4" style={{ color: RED }} /> Remover treinos em lote
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {athleteName && <p className="text-xs text-muted-foreground">Do calendário de <b className="text-foreground">{athleteName}</b>.</p>}

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">O que remover</p>
            <div className="flex gap-1.5">
              {opcao('futuros', 'De hoje em diante')}
              {opcao('periodo', 'Período')}
              {opcao('tudo', 'Tudo')}
            </div>
          </div>

          {alcance === 'periodo' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted-foreground">De
                <input type="date" value={de} onChange={e => setDe(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">Até
                <input type="date" value={ate} onChange={e => setAte(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </label>
            </div>
          )}

          <label className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
            style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <input type="checkbox" checked={incluirFeitos} onChange={e => setIncluirFeitos(e.target.checked)} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">Incluir treinos já concluídos</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                Desligado, o que o aluno já fez continua no histórico. Ligado, a carga acumulada e as conquistas dele mudam.
              </span>
            </span>
          </label>

          {/* O número, antes de confirmar */}
          <div className="rounded-xl px-4 py-3.5 text-center" style={{ background: nada || periodoInvalido ? 'var(--panel)' : 'var(--marca-14)', border: `1px solid ${nada || periodoInvalido ? 'var(--panel-border)' : 'var(--marca-44)'}` }}>
            {periodoInvalido ? (
              <span className="text-sm font-bold text-foreground">A data inicial é depois da final.</span>
            ) : contando ? (
              <span className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> contando…</span>
            ) : nada ? (
              <span className="text-sm text-muted-foreground">Nenhum treino nesse intervalo.</span>
            ) : (
              <>
                <p className="text-2xl font-black tabular-nums leading-none" style={{ color: RED }}>{quantos}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  treino{quantos === 1 ? '' : 's'} {quantos === 1 ? 'será removido' : 'serão removidos'}
                </p>
              </>
            )}
          </div>

          {!nada && !contando && !periodoInvalido && (
            <p className="text-[11px] flex items-start gap-2 leading-relaxed" style={{ color: '#f59e0b' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              Não há como desfazer. Para repor, aplique um plano de novo.
            </p>
          )}

          {erro && <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#ef444414', color: '#ef4444' }}>{erro}</p>}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary">
              Cancelar
            </button>
            <button onClick={apagar} disabled={apagando || contando || nada || periodoInvalido}
              className="flex-1 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: RED }}>
              {apagando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {apagando ? 'Removendo…' : `Remover ${quantos ?? 0}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
