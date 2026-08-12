'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { cargaDe } from '@/lib/carga'
import { ZONE_FEEL, ZONE_PURPOSE } from '@/components/athlete/zone-time'
import { X, HelpCircle } from 'lucide-react'

/**
 * A carga do treino em palavras, no lugar de "47 TSS".
 *
 * O número é a linguagem do treinador; "carga moderada" é a do aluno. Tocar
 * abre a explicação — quem quiser o número continua tendo acesso, mas ele
 * deixa de ser a primeira coisa que aparece.
 */
export function CargaChip({ tss, className = '' }: { tss: number | null | undefined; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const nivel = cargaDe(tss)
  if (!nivel) return null

  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setAberto(true) }}
        title="O que é carga?"
        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${className}`}
        style={{ background: nivel.cor + '1f', color: nivel.cor }}>
        {nivel.rotulo}
        <HelpCircle className="w-3 h-3 opacity-60" />
      </button>
      {aberto && <GlossarioAluno tss={tss ?? null} onClose={() => setAberto(false)} />}
    </>
  )
}

/**
 * O que os números do treino querem dizer.
 *
 * O glossário do app existia só nas telas do treinador — justamente quem já
 * sabe o que é TSS. Esta é a versão do aluno: sem fórmula, com o número
 * disponível para quem quiser.
 */
export function GlossarioAluno({ tss, onClose }: { tss: number | null; onClose: () => void }) {
  const nivel = cargaDe(tss)
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto safe-bottom"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-black text-foreground">Entendendo o treino</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Carga</h3>
            {nivel && (
              <p className="text-sm text-foreground leading-relaxed">
                Este treino tem <b style={{ color: nivel.cor }}>carga {nivel.rotulo.toLowerCase()}</b>. {nivel.descricao}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              A carga mistura o tempo e a intensidade num número só: uma hora bem forte pesa mais que duas horas
              soltas. É por ela que seu treinador equilibra a semana — não dá para empilhar treino duro atrás
              de treino duro.
            </p>
            {tss != null && (
              <p className="text-[11px] text-muted-foreground/70 tabular-nums">
                Na escala técnica: {Math.round(tss)} TSS, onde 100 equivale a uma hora no seu ritmo de limiar.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Ritmo de limiar</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              É o ritmo mais forte que você sustenta por cerca de uma hora. Todos os seus treinos são calculados
              a partir dele: quando o treino diz <b className="text-foreground">90%</b>, é 90% desse ritmo.
              Por isso o mesmo plano serve para quem corre a 4:00/km e para quem corre a 8:00/km.
            </p>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">As intensidades</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A forma mais confiável de conferir se está no ritmo certo é a respiração:
            </p>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              {([1, 2, 3, 4, 5] as const).map((z, i) => (
                <div key={z} className="px-3.5 py-2.5" style={i ? { borderTop: '1px solid var(--panel-border)' } : undefined}>
                  <p className="text-[13px] font-bold text-foreground">{ZONE_FEEL[z]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ZONE_PURPOSE[z]}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Dificuldade (0 a 10)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ao concluir um treino você dá uma nota de quanto ele custou. Não existe resposta certa — é o seu
              esforço, do seu jeito. É com isso que seu treinador percebe quando a semana está pesada demais,
              mesmo que os números digam o contrário.
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
