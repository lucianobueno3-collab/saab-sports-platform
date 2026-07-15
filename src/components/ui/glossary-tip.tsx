'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface GlossaryTipProps {
  term: string
  children: React.ReactNode
}

export function GlossaryTip({ term, children }: GlossaryTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      <span className="font-bold text-foreground">{term}</span>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        tabIndex={-1}
        type="button"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span className="absolute bottom-full left-0 mb-2 z-50 w-64 bg-popover border border-border rounded-xl p-3 shadow-2xl text-xs text-muted-foreground leading-relaxed pointer-events-none">
          <span className="font-semibold text-foreground text-sm block mb-1">{term}</span>
          {children}
          <span className="absolute top-full left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border" />
        </span>
      )}
    </span>
  )
}

// Standalone info icon tooltip (for section headers)
interface InfoTipProps {
  children: React.ReactNode
}

export function InfoTip({ children }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        type="button"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 bg-popover border border-border rounded-xl p-3 shadow-2xl text-xs text-muted-foreground leading-relaxed pointer-events-none">
          {children}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border" />
        </span>
      )}
    </span>
  )
}
