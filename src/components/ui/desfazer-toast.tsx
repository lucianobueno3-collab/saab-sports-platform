'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Undo2, X, Loader2, CheckCircle2 } from 'lucide-react'

/** Tempo de arrependimento. Curto o bastante para não atrapalhar, longo o
 *  bastante para dar tempo de ler o que aconteceu e reagir. */
const SEGUNDOS = 10

/**
 * Aviso do que acabou de acontecer, com a chance de voltar atrás.
 *
 * Substitui o `confirm()` do navegador nas ações destrutivas. A caixa cinza do
 * sistema interrompe antes, pergunta "tem certeza?" quando ninguém ainda sabe
 * o resultado, e depois do OK não há volta. Aqui a ação acontece na hora e o
 * desfazer fica disponível por alguns segundos — menos fricção e mais rede de
 * proteção.
 */
export function DesfazerToast({ texto, onDesfazer, onFechar }: {
  texto: string
  /** Ausente quando a ação não tem volta — aí é só um aviso. */
  onDesfazer?: () => Promise<void> | void
  onFechar: () => void
}) {
  const [restante, setRestante] = useState(SEGUNDOS)
  const [desfazendo, setDesfazendo] = useState(false)
  const [desfeito, setDesfeito] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => { setMontado(true) }, [])

  useEffect(() => {
    if (desfazendo || desfeito) return
    if (restante <= 0) { onFechar(); return }
    const t = setTimeout(() => setRestante(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [restante, desfazendo, desfeito, onFechar])

  // Depois de desfeito, some sozinho — a confirmação não precisa ficar na tela.
  useEffect(() => {
    if (!desfeito) return
    const t = setTimeout(onFechar, 2500)
    return () => clearTimeout(t)
  }, [desfeito, onFechar])

  async function desfazer() {
    if (!onDesfazer) return
    setDesfazendo(true)
    await onDesfazer()
    setDesfazendo(false)
    setDesfeito(true)
  }

  if (!montado) return null

  return createPortal(
    <div role="status" aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 z-[95] w-[calc(100%-2rem)] max-w-md safe-bottom">
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {desfeito
          ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#00d084' }} />
          : null}
        <p className="text-[13px] text-foreground flex-1 min-w-0">
          {desfeito ? 'Desfeito. Está tudo de volta.' : texto}
        </p>

        {!desfeito && onDesfazer && (
          <button onClick={desfazer} disabled={desfazendo}
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-60"
            style={{ background: '#e8001c1f', color: '#e8001c' }}>
            {desfazendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            Desfazer
            {!desfazendo && <span className="tabular-nums opacity-60">{restante}</span>}
          </button>
        )}

        <button onClick={onFechar} aria-label="Fechar aviso"
          className="shrink-0 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
    </div>,
    document.body,
  )
}
