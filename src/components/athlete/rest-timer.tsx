'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtSegundos } from '@/lib/strength-metrics'
import { Timer, Plus, X } from 'lucide-react'

const RED = 'var(--marca)'
const VERDE = '#00d084'

/**
 * Descanso entre séries — a barra que todo app de academia tem e faltava aqui.
 *
 * Começa sozinha quando o aluno marca uma série, para ele não precisar mexer
 * no celular com a mão ocupada. Fica fixa no rodapé, some ao acabar e vibra o
 * aparelho: no meio do barulho da academia, ninguém escuta um alerta sonoro.
 */
export function RestTimer({ seconds, onDone, onDismiss }: {
  seconds: number; onDone?: () => void; onDismiss: () => void
}) {
  const [restante, setRestante] = useState(seconds)
  const [total, setTotal] = useState(seconds)
  const [mounted, setMounted] = useState(false)
  const avisou = useRef(false)

  useEffect(() => setMounted(true), [])

  // Conta pelo relógio, não somando ticks: no celular a aba é suspensa quando
  // a tela apaga, e um contador por ticks atrasaria o descanso inteiro.
  const fim = useRef(Date.now() + seconds * 1000)
  useEffect(() => {
    fim.current = Date.now() + seconds * 1000
    setTotal(seconds); setRestante(seconds); avisou.current = false
  }, [seconds])

  useEffect(() => {
    const t = setInterval(() => {
      const falta = Math.max(0, (fim.current - Date.now()) / 1000)
      setRestante(falta)
      if (falta <= 0 && !avisou.current) {
        avisou.current = true
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* sem vibração: tudo bem */ }
        onDone?.()
      }
    }, 200)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  function mais(s: number) {
    fim.current += s * 1000
    setTotal(t => t + s)
    avisou.current = false
  }

  if (!mounted) return null
  const acabou = restante <= 0
  const pct = total > 0 ? Math.max(0, Math.min(100, (restante / total) * 100)) : 0

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[85] px-3 pb-3 safe-bottom pointer-events-none">
      <div className="max-w-md mx-auto rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
        style={{ background: 'var(--card)', border: `1px solid ${acabou ? VERDE : RED}66` }}>
        {/* Barra que esvazia: dá para ver quanto falta sem ler o número */}
        <div className="h-1" style={{ background: 'var(--border)' }}>
          <div className="h-full transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%`, background: acabou ? VERDE : RED }} />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <Timer className="w-5 h-5 shrink-0" style={{ color: acabou ? VERDE : RED }} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {acabou ? 'Descanso terminado' : 'Descansando'}
            </p>
            <p className="text-2xl font-black tabular-nums leading-none mt-0.5"
              style={{ color: acabou ? VERDE : 'var(--foreground)' }}>
              {fmtSegundos(restante)}
            </p>
          </div>

          {!acabou && (
            <button onClick={() => mais(15)}
              className="shrink-0 flex items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-black bg-secondary text-foreground">
              <Plus className="w-3.5 h-3.5" /> 15s
            </button>
          )}
          <button onClick={onDismiss}
            className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-black text-white flex items-center gap-1"
            style={{ background: acabou ? VERDE : RED }}>
            {acabou ? 'Bora' : <><X className="w-3.5 h-3.5" /> Pular</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
