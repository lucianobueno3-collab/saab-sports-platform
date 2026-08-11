'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPartners, savePartner, deletePartner, uploadPartnerLogo, type PartnerRow } from '@/lib/supabase/queries'
import { Loader2, Plus, Trash2, Pencil, X, Handshake, Upload, ExternalLink } from 'lucide-react'

const RED = '#e8001c'
const cls = 'w-full rounded-lg px-3 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'

export function PartnersManager() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<PartnerRow> | null>(null)

  async function load() { setLoading(true); setPartners(await getPartners(false)); setLoading(false) }
  useEffect(() => { load() }, [])

  async function remove(id: string) { if (confirm('Remover este parceiro?')) { await deletePartner(id); load() } }

  return (
    <section className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-primary" />
          <h2 className="text-base font-black text-foreground">Parceiros</h2>
          <span className="text-xs text-muted-foreground">(aparecem no portal do aluno como propaganda)</span>
        </div>
        <button onClick={() => setEdit({ active: true, sort: partners.length })} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: RED }}>
          <Plus className="w-3.5 h-3.5" /> Adicionar parceiro
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum parceiro cadastrado. Clique em "Adicionar parceiro" e envie o logo.</p>
      ) : (
        <div className="space-y-2">
          {partners.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', opacity: p.active ? 1 : 0.5 }}>
              <span className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/5">
                {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-full h-full object-contain" /> : <span className="text-sm font-black" style={{ color: RED }}>{p.name.slice(0, 2).toUpperCase()}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate flex items-center gap-1">{p.name} {!p.active && <span className="text-[10px] text-muted-foreground">(inativo)</span>}</p>
                {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">{p.url} <ExternalLink className="w-3 h-3" /></a>}
              </div>
              <button onClick={() => setEdit(p)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(p.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {edit && <PartnerEditor partner={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </section>
  )
}

function PartnerEditor({ partner, onClose, onSaved }: { partner: Partial<PartnerRow>; onClose: () => void; onSaved: () => void }) {
  const sb = createClient()
  const [name, setName] = useState(partner.name ?? '')
  const [url, setUrl] = useState(partner.url ?? '')
  const [logo, setLogo] = useState(partner.logo_url ?? '')
  const [description, setDescription] = useState(partner.description ?? '')
  const [active, setActive] = useState(partner.active ?? true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) { setError('Envie um arquivo de imagem.'); return }
    setUploading(true); setError(null)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setUploading(false); setError('Sessão expirada.'); return }
    const res = await uploadPartnerLogo(user.id, file)
    setUploading(false)
    if (!res.ok || !res.url) { setError(res.error ?? 'Falha ao enviar a imagem.'); return }
    setLogo(res.url)
  }

  async function save() {
    if (!name.trim()) { setError('Informe o nome.'); return }
    setSaving(true); setError(null)
    const res = await savePartner({ id: partner.id, name: name.trim(), url: url.trim() || null, logo_url: logo.trim() || null, description: description.trim() || null, sort: partner.sort ?? 0, active })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Falha ao salvar.'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-foreground">{partner.id ? 'Editar parceiro' : 'Novo parceiro'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Logo (upload de foto) */}
          <div>
            <span className="block text-xs font-semibold text-muted-foreground mb-1.5">Logo / imagem de propaganda</span>
            <div className="flex items-center gap-3">
              <span className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/5 border border-border">
                {logo ? <img src={logo} alt="logo" className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground">sem logo</span>}
              </span>
              <div>
                <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Enviar imagem
                </button>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
                <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG. Ideal: logo em fundo transparente ou banner.</p>
              </div>
            </div>
          </div>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Nome</span><input value={name} onChange={e => setName(e.target.value)} className={cls} placeholder="DUX Suplementos" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Link do site</span><input value={url} onChange={e => setUrl(e.target.value)} className={cls} placeholder="https://www.duxnutrition.com" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Descrição (opcional)</span><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={cls} placeholder="Condições especiais para alunos SAAB." /></label>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Ativo (aparece no portal do aluno)</label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-60" style={{ background: RED }}>{saving ? 'Salvando…' : 'Salvar parceiro'}</button>
        </div>
      </div>
    </div>
  )
}
