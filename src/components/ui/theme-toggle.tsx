'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, X, Check } from 'lucide-react'

type Theme = 'dark' | 'light'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('theme') as Theme) ?? 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('theme', theme)
}

export function ThemeToggle() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function select(t: Theme) {
    setTheme(t)
    applyTheme(t)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-secondary transition-colors"
        title="Aparência (claro/escuro)"
      >
        {theme === 'dark'
          ? <Moon className="w-4 h-4 text-muted-foreground" />
          : <Sun className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-foreground">Aparência</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'light' as Theme, label: 'Claro', icon: Sun, preview: '#f4f4f7', previewCard: '#ffffff', previewText: '#16161f' },
                { key: 'dark' as Theme, label: 'Escuro', icon: Moon, preview: '#0a0a0f', previewCard: '#111118', previewText: '#e8e8f0' },
              ]).map(({ key, label, icon: Icon, preview, previewCard, previewText }) => {
                const selected = theme === key
                return (
                  <button
                    key={key}
                    onClick={() => select(key)}
                    className="rounded-xl overflow-hidden text-left transition-all"
                    style={{ border: selected ? '2px solid #e8001c' : '2px solid var(--border)' }}
                  >
                    {/* Mini preview da interface */}
                    <div className="h-20 p-2.5" style={{ background: preview }}>
                      <div className="h-full rounded-lg p-2 space-y-1.5" style={{ background: previewCard, border: `1px solid ${key === 'dark' ? '#2a2a3a' : '#d9d9e3'}` }}>
                        <div className="h-1.5 w-2/3 rounded-full" style={{ background: previewText, opacity: 0.85 }} />
                        <div className="h-1.5 w-1/2 rounded-full" style={{ background: previewText, opacity: 0.35 }} />
                        <div className="h-1.5 w-3/4 rounded-full" style={{ background: '#e8001c', opacity: 0.9 }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-card">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </span>
                      {selected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-4">
              A preferência fica salva neste navegador.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
