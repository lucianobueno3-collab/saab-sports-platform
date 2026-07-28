'use client'

import { useEffect, useState } from 'react'
import { getPartners, savePartner, deletePartner, type PartnerRow } from '@/lib/supabase/queries'
import { Loader2, Plus, Trash2, Pencil, ExternalLink, Handshake, X } from 'lucide-react'

const RED = '#e8001c'
const cls = 'w-full rounded-lg px-3 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'

export function PartnersTab({ canManage = false }: { canManage?: boolean }) {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<PartnerRow> | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() { setLoading(true); setPartners(await getPartners(!canManage)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [canManage])

  async function addExample() {
    setBusy(true)
    await savePartner({ name: 'DUX Suplementos', url: 'https://www.duxnutrition.com', description: 'Suplementos esportivos — condições especiais para alunos.', sort: 0, active: true })
    setBusy(false); load()
  }
  async function remove(id: string) { if (confirm('Remover este parceiro?')) { await deletePartner(id); load() } }

  const open = (p: PartnerRow) => { if (p.url) window.open(p.url, '_blank', 'noopener') }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black text-foreground">Parceiros</h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {partners.length === 0 && (
              <button onClick={addExample} disabled={busy} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">Exemplo DUX</button>
            )}
            <button onClick={() => setEdit({ active: true, sort: partners.length })} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: RED }}>
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        )}
      </div>

      {partners.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {canManage ? 'Nenhum parceiro ainda. Adicione marcas para aparecerem aqui no portal do aluno.' : 'Em breve, condições especiais dos nossos parceiros.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {partners.map(p => (
            <div key={p.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: p.active ? 1 : 0.5 }}>
              <button onClick={() => open(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                  {p.logo_url
                    ? <img src={p.logo_url} alt={p.name} className="w-full h-full object-contain" />
                    : <span className="text-base font-black" style={{ color: RED }}>{p.name.slice(0, 2).toUpperCase()}</span>}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-black text-foreground truncate">{p.name} {p.url && <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />}</span>
                  {p.description && <span className="block text-xs text-muted-foreground line-clamp-2">{p.description}</span>}
                </span>
              </button>
              {canManage && (
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEdit(p)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {edit && canManage && (
        <PartnerEditor partner={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />
      )}
    </div>
  )
}

function PartnerEditor({ partner, onClose, onSaved }: { partner: Partial<PartnerRow>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(partner.name ?? '')
  const [url, setUrl] = useState(partner.url ?? '')
  const [logo, setLogo] = useState(partner.logo_url ?? '')
  const [description, setDescription] = useState(partner.description ?? '')
  const [active, setActive] = useState(partner.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Nome</span><input value={name} onChange={e => setName(e.target.value)} className={cls} placeholder="DUX Suplementos" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Link do site</span><input value={url} onChange={e => setUrl(e.target.value)} className={cls} placeholder="https://www.duxnutrition.com" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">URL do logo (opcional)</span><input value={logo} onChange={e => setLogo(e.target.value)} className={cls} placeholder="https://.../logo.png" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Descrição (opcional)</span><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={cls} placeholder="Condições especiais para alunos." /></label>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Ativo (aparece no portal)</label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-60" style={{ background: RED }}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
