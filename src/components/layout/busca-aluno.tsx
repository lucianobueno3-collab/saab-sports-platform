'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, X } from 'lucide-react'

type Aluno = { id: string; full_name: string; primary_sport: string }

const LABEL: Record<string, string> = {
  running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação',
  triathlon: 'Triathlon', duathlon: 'Duathlon', other: 'Outro',
}

/** Sem acento e em minúscula: "josé" acha "Jose" e vice-versa. */
function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function filtrarAlunos(alunos: Aluno[], termo: string): Aluno[] {
  const t = normalizar(termo.trim())
  if (!t) return []
  return alunos.filter(a => normalizar(a.full_name).includes(t)).slice(0, 8)
}

/**
 * Busca por aluno, no topo do menu.
 *
 * Não existia busca em lugar nenhum do painel: com trinta alunos, achar um
 * exigia rolar a lista. A carga é leve — o nome de todos cabe numa consulta
 * só, feita uma vez ao abrir.
 */
export function BuscaAluno() {
  const router = useRouter()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [foco, setFoco] = useState(-1)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createClient().from('athletes').select('id, full_name, primary_sport')
      .eq('active', true).order('full_name')
      .then(({ data }) => { setAlunos((data ?? []) as Aluno[]); setCarregando(false) })
  }, [])

  const achados = useMemo(() => filtrarAlunos(alunos, termo), [alunos, termo])
  useEffect(() => { setFoco(-1) }, [termo])

  // Clique fora fecha a lista, senão ela fica pendurada sobre o menu.
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setTermo('')
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  function abrir(a: Aluno) {
    setTermo('')
    router.push(`/athletes/detail?id=${a.id}`)
  }

  function teclado(e: React.KeyboardEvent) {
    if (achados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(i => Math.min(i + 1, achados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(achados[Math.max(foco, 0)]) }
    else if (e.key === 'Escape') setTermo('')
  }

  return (
    <div ref={caixa} className="relative px-3 pt-3">
      <Search className="w-3.5 h-3.5 absolute left-6 top-1/2 -translate-y-1/2 mt-1.5 text-muted-foreground pointer-events-none" />
      <input
        value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={teclado}
        placeholder={carregando ? 'Carregando…' : 'Buscar aluno'}
        aria-label="Buscar aluno"
        className="w-full pl-8 pr-7 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
      {carregando && <Loader2 className="w-3.5 h-3.5 absolute right-6 top-1/2 -translate-y-1/2 mt-1.5 animate-spin text-muted-foreground" />}
      {!carregando && termo && (
        <button onClick={() => setTermo('')} aria-label="Limpar busca"
          className="absolute right-5 top-1/2 -translate-y-1/2 mt-1.5 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {termo.trim() && (
        <div className="absolute left-3 right-3 mt-1 z-50 rounded-lg overflow-hidden shadow-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {achados.length === 0 ? (
            <p className="px-3 py-2.5 text-[11px] text-muted-foreground">Nenhum aluno com esse nome.</p>
          ) : achados.map((a, i) => (
            <button key={a.id} onClick={() => abrir(a)} onMouseEnter={() => setFoco(i)}
              className="w-full text-left px-3 py-2 hover:bg-secondary/60"
              style={i === foco ? { background: 'var(--secondary)' } : undefined}>
              <span className="block text-[12px] font-semibold text-foreground truncate">{a.full_name}</span>
              <span className="block text-[10px] text-muted-foreground">{LABEL[a.primary_sport] ?? a.primary_sport}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
