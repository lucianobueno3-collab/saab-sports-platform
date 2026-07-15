'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('saab-theme', dark ? 'dark' : 'light')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0a0a0f' : '#f5f5f8')
}

export function ThemeToggle() {
  // evita divergência de hidratação: só lê o DOM depois de montar
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !(dark ?? true)
    setDark(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
    >
      {dark === false ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  )
}
