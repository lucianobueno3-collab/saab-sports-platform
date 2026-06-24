'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  onClose: () => void
  onSaved: () => void
}

export function AddAthleteModal({ onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    primary_sport: 'running',
    weight_kg: '',
    ftp_watts: '',
    lthr_bpm: '',
    vo2max_ml_kg_min: '',
    goal: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError('Sessão expirada.'); setLoading(false); return }

    const payload: Record<string, unknown> = {
      coach_id: user.id,
      full_name: form.full_name.trim(),
      primary_sport: form.primary_sport,
    }
    if (form.email) payload.email = form.email.trim()
    if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg)
    if (form.ftp_watts) payload.ftp_watts = parseInt(form.ftp_watts)
    if (form.lthr_bpm) payload.lthr_bpm = parseInt(form.lthr_bpm)
    if (form.vo2max_ml_kg_min) payload.vo2max_ml_kg_min = parseFloat(form.vo2max_ml_kg_min)
    if (form.goal) payload.goal = form.goal.trim()

    const { error } = await sb.from('athletes').insert(payload)
    if (error) {
      setError(error.message.includes('uq_athlete_email') ? 'Já existe um aluno com este email.' : error.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Novo Aluno</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo *</label>
              <input required value={form.full_name} onChange={e => set('full_name', e.target.value)}
                placeholder="Nome do atleta"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="atleta@email.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Modalidade *</label>
              <select required value={form.primary_sport} onChange={e => set('primary_sport', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                <option value="running">Corrida</option>
                <option value="cycling">Ciclismo</option>
                <option value="triathlon">Triathlon</option>
                <option value="swimming">Natação</option>
                <option value="duathlon">Duathlon</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Peso (kg)</label>
              <input type="number" step="0.1" min="30" max="200" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)}
                placeholder="75.0"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">FTP (W)</label>
              <input type="number" min="50" max="600" value={form.ftp_watts} onChange={e => set('ftp_watts', e.target.value)}
                placeholder="250"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">LTHR (bpm)</label>
              <input type="number" min="100" max="220" value={form.lthr_bpm} onChange={e => set('lthr_bpm', e.target.value)}
                placeholder="160"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">VO2max (ml/kg/min)</label>
              <input type="number" step="0.1" min="20" max="90" value={form.vo2max_ml_kg_min} onChange={e => set('vo2max_ml_kg_min', e.target.value)}
                placeholder="55.0"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1.5">Objetivo / Meta</label>
              <input value={form.goal} onChange={e => set('goal', e.target.value)}
                placeholder="ex: Ironman SP — Novembro 2025"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
