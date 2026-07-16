'use client'

import { useEffect, useRef } from 'react'

/**
 * Reexecuta `refresh` automaticamente:
 * - a cada `intervalMs` enquanto a página está aberta (padrão: 1h)
 * - quando o app volta do segundo plano ou a aba recupera o foco
 *   (respeitando um intervalo mínimo de `minGapMs` para não repetir à toa)
 */
export function useAutoRefresh(refresh: () => void, intervalMs = 3_600_000, minGapMs = 60_000) {
  const cb = useRef(refresh)
  cb.current = refresh
  const lastRun = useRef(Date.now())

  useEffect(() => {
    const run = () => { lastRun.current = Date.now(); cb.current() }
    const id = setInterval(run, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun.current > minGapMs) run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [intervalMs, minGapMs])
}
