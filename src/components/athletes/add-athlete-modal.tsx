'use client'

import { useState } from 'react'
import { X, Loader2, RefreshCw, CheckCircle2, Copy, ChevronDown } from 'lucide-react'
import { adminCreateUser } from '@/lib/supabase/queries'

type Props = {
  onClose: () => void
  onSaved: () => void
}

// Senha temporária legível (fácil de ditar)
function genPassword() {
  const a = 'abcdefghijkmnpqrstuvwxyz', n = '23456789'
  const pick = (s: string, k: number) => Array.from({ length: k }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return pick(a, 1).toUpperCase() + pick(a, 3) + pick(n, 3)
}

export function AddAthleteModal({ onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [done, setDone] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: genPassword(),
    primary_sport: 'running',
    phone: '',
    weight_kg: '',
    ftp_watts: '',
    lthr_bpm: '',
    vo2max_ml_kg_min: '',
    goal: '',
  })
  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const athlete: Record<string, unknown> = { primary_sport: form.primary_sport }
    if (form.phone) athlete.phone = form.phone.trim().replace(/\s/g, '')
    if (form.weight_kg) athlete.weight_kg = parseFloat(form.weight_kg)
    if (form.ftp_watts) athlete.ftp_watts = parseInt(form.ftp_watts)
    if (form.lthr_bpm) athlete.lthr_bpm = parseInt(form.lthr_bpm)
    if (form.vo2max_ml_kg_min) athlete.vo2max_ml_kg_min = parseFloat(form.vo2max_ml_kg_min)
    if (form.goal) athlete.goal = form.goal.trim()

    const res = await adminCreateUser({
      role: 'athlete',
      email: form.email.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
      athlete,
    })
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Não foi possível criar o aluno.'); return }
    setDone({ email: form.email.trim(), password: form.password })
    onSaved()
  }

  function copyCreds() {
    if (!done) return
    navigator.clipboard?.writeText(`Acesso ao app SAAB\nE-mail: ${done.email}\nSenha temporária: ${done.password}\n(troque a senha no primeiro acesso)`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-sm font-bold text-foreground">Novo Aluno</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#00d084]"><CheckCircle2 className="w-5 h-5" /><p className="text-sm font-bold">Aluno criado com acesso!</p></div>
            <p className="text-xs text-muted-foreground">Envie estes dados para o aluno. Ele vai <b>trocar a senha</b> no primeiro login.</p>
            <div className="rounded-xl bg-background border border-border p-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">E-mail</span><span className="font-semibold text-foreground break-all">{done.email}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Senha temporária</span><span className="font-mono font-bold text-foreground">{done.password}</span></div>
            </div>
            <button onClick={copyCreds} className="w-full py-2.5 border border-border text-sm font-semibold text-foreground rounded-lg hover:bg-secondary transition-colors flex items-center justify-center gap-2">
              {copied ? <><CheckCircle2 className="w-4 h-4 text-[#00d084]" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar dados de acesso</>}
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">Concluir</button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo *</label>
              <input required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Nome do aluno" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Modalidade *</label>
              <select required value={form.primary_sport} onChange={e => set('primary_sport', e.target.value)} className={inputCls}>
                <option value="running">Corrida</option>
                <option value="cycling">Ciclismo</option>
                <option value="triathlon">Triathlon</option>
                <option value="swimming">Natação</option>
                <option value="duathlon">Duathlon</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">E-mail (login) *</label>
              <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="aluno@email.com" className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Senha temporária *</label>
              <div className="flex gap-2">
                <input required minLength={6} value={form.password} onChange={e => set('password', e.target.value)}
                  className={inputCls + ' font-mono'} />
                <button type="button" onClick={() => set('password', genPassword())} title="Gerar nova senha"
                  className="px-3 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors flex-shrink-0"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">O aluno troca esta senha no primeiro acesso.</p>
            </div>

            {/* Dados de treino — opcionais e escondidos por padrão */}
            <button type="button" onClick={() => setMore(m => !m)}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${more ? 'rotate-180' : ''}`} /> Dados de treino (opcional)
            </button>

            {more && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1.5">WhatsApp</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+5511999999999" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Peso (kg)</label>
                  <input type="number" step="0.1" min="30" max="200" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} placeholder="75.0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">FTP (W)</label>
                  <input type="number" min="50" max="600" value={form.ftp_watts} onChange={e => set('ftp_watts', e.target.value)} placeholder="250" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">LTHR (bpm)</label>
                  <input type="number" min="100" max="220" value={form.lthr_bpm} onChange={e => set('lthr_bpm', e.target.value)} placeholder="160" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">VO2max</label>
                  <input type="number" step="0.1" min="20" max="90" value={form.vo2max_ml_kg_min} onChange={e => set('vo2max_ml_kg_min', e.target.value)} placeholder="55.0" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1.5">Objetivo / Meta</label>
                  <input value={form.goal} onChange={e => set('goal', e.target.value)} placeholder="ex: Ironman SP — Nov/2026" className={inputCls} />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary transition-colors">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Criando...' : 'Criar aluno'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
