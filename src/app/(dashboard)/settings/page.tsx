'use client'

import { useState, useEffect, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Settings, Loader2, MessageCircle, CheckCircle2, Camera, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/auth-context'
import { uploadAvatar } from '@/lib/supabase/queries'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // troca da própria senha
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdErr, setPwdErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const sb = createClient()
    sb.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? '')
        setPhone((data as { phone?: string }).phone ?? '')
        setAvatarUrl((data as { avatar_url?: string }).avatar_url ?? null)
      }
    })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    const sb = createClient()
    await sb.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', user.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarErr(null)
    if (!file.type.startsWith('image/')) { setAvatarErr('Escolha um arquivo de imagem.'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarErr('Imagem muito grande (máx. 5MB).'); return }
    setUploading(true)
    const res = await uploadAvatar(user.id, file)
    if (res.ok && res.url) {
      const sb = createClient()
      await sb.from('profiles').update({ avatar_url: res.url }).eq('id', user.id)
      setAvatarUrl(res.url)
    } else {
      setAvatarErr(res.error ?? 'Falha ao enviar a foto.')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdErr(null)
    if (p1.length < 6) { setPwdErr('A senha deve ter ao menos 6 caracteres.'); return }
    if (p1 !== p2) { setPwdErr('As senhas não coincidem.'); return }
    setPwdSaving(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: p1 })
    setPwdSaving(false)
    if (error) { setPwdErr(/different from the old/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : error.message); return }
    setP1(''); setP2(''); setPwdSaved(true); setTimeout(() => setPwdSaved(false), 3000)
  }

  const initials = (fullName || user?.email || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  return (
    <div>
      <Topbar title="Configurações" subtitle="Perfil e preferências da conta" />
      <div className="p-6 max-w-lg space-y-5">

        {/* Perfil */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Perfil do Treinador</h2>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Foto de perfil */}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden group flex-shrink-0"
              style={{ background: '#e8001c22', border: '1.5px solid #e8001c55' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <span className="text-lg font-black text-primary">{initials}</span>}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </span>
            </button>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {uploading ? 'Enviando...' : 'Trocar foto'}
              </button>
              <p className="text-[10px] text-muted-foreground mt-1.5">JPG ou PNG, até 5MB.</p>
              {avatarErr && <p className="text-[10px] text-red-400 mt-1">{avatarErr}</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input
                value={user?.email ?? ''}
                disabled
                className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* WhatsApp do treinador */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25d366]" />
                  WhatsApp para briefings (seu número)
                </span>
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+5511999999999"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Com DDI. Ex: +5511999999999. Usado para enviar o briefing diário da Central de Alertas direto para você.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
                {saved ? 'Salvo!' : 'Salvar'}
              </button>
              <button type="button" onClick={signOut}
                className="px-4 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary transition-colors">
                Sair da conta
              </button>
            </div>
          </form>
        </div>

        {/* Alterar senha */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Alterar senha</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nova senha</label>
              <input type="password" value={p1} onChange={e => setP1(e.target.value)} minLength={6} placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Confirmar nova senha</label>
              <input type="password" value={p2} onChange={e => setP2(e.target.value)} minLength={6} placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>
            {pwdErr && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{pwdErr}</p>}
            <button type="submit" disabled={pwdSaving || !p1 || !p2}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pwdSaved ? <CheckCircle2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              {pwdSaved ? 'Senha alterada!' : 'Alterar senha'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
