'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getMeetups, saveMeetup, deleteMeetup, toggleMeetupPresence, uploadMeetupPhoto,
  getMeetupSuggestions, getMyRole,
  type MeetupRow, type MeetupParticipant, type MeetupSuggestion,
} from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import {
  Users, MapPin, Clock, Plus, X, Loader2, Check, Trash2, Camera,
  Sparkles, ShieldCheck, ExternalLink, CalendarDays, Pencil,
} from 'lucide-react'

const RED = '#e8001c'
const TYPES = [
  { v: 'leve', t: 'Leve / regenerativo' }, { v: 'longao', t: 'Longão' },
  { v: 'intervalado', t: 'Intervalado / tiros' }, { v: 'forca', t: 'Força' }, { v: 'livre', t: 'Livre' },
]
const SPORTS = [{ v: 'running', t: 'Corrida' }, { v: 'cycling', t: 'Ciclismo' }, { v: 'swimming', t: 'Natação' }, { v: 'other', t: 'Outro' }]

const todayISO = () => new Date().toLocaleDateString('en-CA')
const paceStr = (s: number | null) => (s == null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
const paceSec = (v: string) => { const m = v.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null }
function dayLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const diff = Math.round((d.getTime() - new Date(todayISO() + 'T12:00:00').getTime()) / 86400000)
  const base = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  return diff === 0 ? `Hoje · ${base}` : diff === 1 ? `Amanhã · ${base}` : base
}

/** "Treinar junto": encontros da comunidade + sugestão automática a partir
 *  dos treinos já planejados. */
export function MeetupsTab({ athleteId, athleteName }: { athleteId: string | null; athleteName?: string | null }) {
  const [meetups, setMeetups] = useState<MeetupRow[]>([])
  const [parts, setParts] = useState<MeetupParticipant[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<MeetupSuggestion[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [modal, setModal] = useState<null | { edit?: MeetupRow; prefill?: MeetupSuggestion }>(null)

  async function load() {
    const { meetups, participants, myUserId } = await getMeetups()
    setMeetups(meetups); setParts(participants); setMyUserId(myUserId)
    setLoading(false)
  }
  useEffect(() => {
    load()
    getMyRole().then(setRole).catch(() => {})
    if (athleteId) getMeetupSuggestions(athleteId).then(setSuggestions).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId])

  const isStaff = role === 'coach' || role === 'admin'
  const goingOf = (id: string) => parts.filter(p => p.meetup_id === id)
  const iAmGoing = (id: string) => goingOf(id).some(p => p.user_id === myUserId)
  const canManage = (m: MeetupRow) => isStaff || (!!myUserId && m.created_by === myUserId)

  async function togglePresence(m: MeetupRow) {
    setBusy(m.id)
    await toggleMeetupPresence(m.id, !iAmGoing(m.id), athleteId, athleteName?.split(' ')[0] ?? null)
    await load(); setBusy(null)
  }
  async function remove(m: MeetupRow) {
    if (!confirm('Excluir este encontro?')) return
    await deleteMeetup(m.id); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-base font-black text-foreground">Treinar junto</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Marque um treino com a galera — ou entre num que já existe.</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: RED }}>
          <Plus className="w-4 h-4" /> Criar encontro
        </button>
      </div>

      {/* ── Sugestões: quem tem treino parecido ─────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setModal({ prefill: s })}
              className="w-full text-left rounded-2xl p-4 transition-colors hover:brightness-105"
              style={{ background: `linear-gradient(135deg, ${RED}14, transparent 65%)`, border: `1px solid ${RED}3d` }}>
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: RED + '22' }}>
                  <Sparkles className="w-5 h-5" style={{ color: RED }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">
                    {s.count} {s.count === 1 ? 'pessoa tem' : 'pessoas têm'} um treino parecido com o seu
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {dayLabel(s.date)} · {s.title}{s.durationMin ? ` · ${s.durationMin}min` : ''}
                  </p>
                  <p className="text-[11px] mt-1 font-bold" style={{ color: RED }}>
                    {s.names.join(', ')} — bora juntos? Toque para marcar.
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Lista de encontros ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : meetups.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Users className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-bold text-foreground mt-2">Nenhum encontro marcado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Treinar acompanhado é o que faz a diferença entre desistir e continuar. Marque o primeiro — dia, hora e onde encontrar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetups.map(m => {
            const going = goingOf(m.id)
            const mine = iAmGoing(m.id)
            const full = m.max_people != null && going.length >= m.max_people && !mine
            const cancelled = m.status === 'cancelled'
            return (
              <div key={m.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: cancelled ? 0.6 : 1 }}>
                {m.location_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.location_photo_url} alt="Ponto de encontro" className="w-full h-32 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider capitalize" style={{ color: RED }}>{dayLabel(m.meetup_date)}</p>
                      <h4 className="text-base font-black text-foreground leading-tight mt-0.5">{m.title}</h4>
                    </div>
                    {canManage(m) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setModal({ edit: m })} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(m)} className="p-1.5 text-red-400 hover:text-red-500" aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.meetup_time}</span>
                    {m.distance_km && <span>{m.distance_km} km</span>}
                    {(m.pace_min_sec || m.pace_max_sec) && (
                      <span className="font-bold" style={{ color: '#0088ff' }}>
                        ritmo {paceStr(m.pace_min_sec) ?? '?'}–{paceStr(m.pace_max_sec) ?? '?'}/km
                      </span>
                    )}
                    {m.no_one_left_behind && (
                      <span className="inline-flex items-center gap-1 font-bold" style={{ color: '#00d084' }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> ninguém fica pra trás
                      </span>
                    )}
                  </div>

                  {/* Ponto de encontro */}
                  <div className="mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: RED }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{m.location_name}</p>
                      {m.location_notes && <p className="text-[11px] text-muted-foreground mt-0.5">{m.location_notes}</p>}
                      {m.location_url && (
                        <a href={m.location_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold mt-1 hover:underline" style={{ color: '#0088ff' }}>
                          Abrir no mapa <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {m.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{m.notes}</p>}

                  {/* Quem vai */}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        {going.length === 0 ? 'Ninguém confirmou ainda — seja o primeiro'
                          : <><strong className="text-foreground">{going.length}</strong> {going.length === 1 ? 'confirmado' : 'confirmados'}
                            {m.max_people ? ` de ${m.max_people}` : ''}: {going.map(p => p.display_name ?? 'atleta').slice(0, 4).join(', ')}{going.length > 4 ? '…' : ''}</>}
                      </p>
                      {m.creator_name && <p className="text-[10px] text-muted-foreground/80 mt-0.5">Anfitrião: {m.creator_name}</p>}
                    </div>
                    {!cancelled && (
                      <button onClick={() => togglePresence(m)} disabled={busy === m.id || full}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-black transition-colors disabled:opacity-50"
                        style={mine ? { background: 'var(--panel)', color: 'var(--muted-foreground)', border: '1px solid var(--panel-border)' } : { background: RED, color: '#fff' }}>
                        {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {mine ? 'Vou' : full ? 'Lotado' : 'Eu vou'}
                      </button>
                    )}
                  </div>
                  {cancelled && <p className="text-xs font-bold mt-2" style={{ color: '#ef4444' }}>Encontro cancelado</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <MeetupModal athleteId={athleteId} edit={modal.edit} prefill={modal.prefill}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}

function MeetupModal({ athleteId, edit, prefill, onClose, onSaved }: {
  athleteId: string | null; edit?: MeetupRow; prefill?: MeetupSuggestion
  onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState(edit?.title ?? prefill?.title ?? '')
  const [sport, setSport] = useState(edit?.sport ?? prefill?.sport ?? 'running')
  const [type, setType] = useState(edit?.workout_type ?? 'leve')
  const [date, setDate] = useState(edit?.meetup_date ?? prefill?.date ?? todayISO())
  const [time, setTime] = useState(edit?.meetup_time ?? '06:00')
  const [locName, setLocName] = useState(edit?.location_name ?? '')
  const [locNotes, setLocNotes] = useState(edit?.location_notes ?? '')
  const [locUrl, setLocUrl] = useState(edit?.location_url ?? '')
  const [photo, setPhoto] = useState<string | null>(edit?.location_photo_url ?? null)
  const [paceMin, setPaceMin] = useState(edit?.pace_min_sec ? paceStr(edit.pace_min_sec)! : '')
  const [paceMax, setPaceMax] = useState(edit?.pace_max_sec ? paceStr(edit.pace_max_sec)! : '')
  const [dist, setDist] = useState(edit?.distance_km?.toString() ?? '')
  const [maxPeople, setMaxPeople] = useState(edit?.max_people?.toString() ?? '')
  const [nolb, setNolb] = useState(edit?.no_one_left_behind ?? true)
  const [notes, setNotes] = useState(edit?.notes ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function pickPhoto(file: File) {
    setUploading(true); setErr(null)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const res = await uploadMeetupPhoto(user?.id ?? 'anon', file)
    setUploading(false)
    if (!res.ok) { setErr(res.error ?? 'Falha ao enviar a foto.'); return }
    setPhoto(res.url ?? null)
  }

  async function save() {
    if (!title.trim() || !locName.trim()) { setErr('Preencha o título e o ponto de encontro.'); return }
    setSaving(true); setErr(null)
    const res = await saveMeetup({
      athlete_id: athleteId,
      title: title.trim(), sport, workout_type: type,
      meetup_date: date, meetup_time: time,
      location_name: locName.trim(), location_notes: locNotes.trim() || null,
      location_url: locUrl.trim() || null, location_photo_url: photo,
      pace_min_sec: paceSec(paceMin), pace_max_sec: paceSec(paceMax),
      distance_km: dist ? parseFloat(dist.replace(',', '.')) : null,
      max_people: maxPeople ? parseInt(maxPeople) : null,
      no_one_left_behind: nolb, notes: notes.trim() || null,
    }, edit?.id)
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? 'Falha ao salvar.'); return }
    onSaved()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /> {edit ? 'Editar encontro' : 'Novo encontro'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3.5">
          {prefill && (
            <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: RED + '14', color: RED }}>
              Pré-preenchido a partir do seu treino — {prefill.names.join(', ')} {prefill.count === 1 ? 'tem' : 'têm'} algo parecido nesse dia.
            </p>
          )}

          <label className="text-xs font-semibold text-muted-foreground block">Título
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Longão de sábado no parque" className={`${inCls} mt-1`} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">Data
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Horário
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={`${inCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Modalidade
              <select value={sport} onChange={e => setSport(e.target.value)} className={`${inCls} mt-1`}>
                {SPORTS.map(s => <option key={s.v} value={s.v}>{s.t}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Tipo de treino
              <select value={type} onChange={e => setType(e.target.value)} className={`${inCls} mt-1`}>
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.t}</option>)}
              </select>
            </label>
          </div>

          {/* Ponto de encontro */}
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: RED }}>Ponto de encontro</p>
            <input value={locName} onChange={e => setLocName(e.target.value)} placeholder="ex: Parque da Cidade — portaria principal" className={inCls} />
            <input value={locNotes} onChange={e => setLocNotes(e.target.value)} placeholder="Referência: ex: do lado da banca de jornal" className={inCls} />
            <input value={locUrl} onChange={e => setLocUrl(e.target.value)} placeholder="Link do Google Maps (opcional)" className={inCls} />
            <label className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${uploading ? 'opacity-60' : ''}`}
              style={{ background: 'var(--background)', border: '1px dashed var(--border)', color: 'var(--foreground)' }}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" style={{ color: RED }} />}
              {uploading ? 'Enviando…' : photo ? 'Trocar foto do ponto' : 'Adicionar foto do ponto'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = '' }} />
            </label>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Ponto de encontro" className="w-full h-28 object-cover rounded-lg" />
            )}
            <p className="text-[10px] text-muted-foreground">A foto elimina a insegurança de chegar e não achar o grupo — vale muito para quem vai pela primeira vez.</p>
          </div>

          {/* Ritmo — o que tira o medo de "ser o mais lento" */}
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0088ff' }}>Ritmo e distância</p>
            <div className="grid grid-cols-3 gap-2.5">
              <label className="text-[10px] font-semibold text-muted-foreground">Do ritmo
                <input value={paceMin} onChange={e => setPaceMin(e.target.value)} placeholder="6:30" className={`${inCls} mt-1`} />
              </label>
              <label className="text-[10px] font-semibold text-muted-foreground">Até
                <input value={paceMax} onChange={e => setPaceMax(e.target.value)} placeholder="7:30" className={`${inCls} mt-1`} />
              </label>
              <label className="text-[10px] font-semibold text-muted-foreground">Distância (km)
                <input inputMode="decimal" value={dist} onChange={e => setDist(e.target.value)} placeholder="8" className={`${inCls} mt-1`} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={nolb} onChange={e => setNolb(e.target.checked)} className="accent-primary w-4 h-4" />
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#00d084' }} /> Ninguém fica pra trás (o grupo reagrupa)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">Vagas (opcional)
              <input type="number" min="1" value={maxPeople} onChange={e => setMaxPeople(e.target.value)} placeholder="sem limite" className={`${inCls} mt-1`} />
            </label>
          </div>

          <label className="text-xs font-semibold text-muted-foreground block">Observações
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="ex: leve água, tem bebedouro no meio do percurso" className={`${inCls} mt-1 resize-none`} />
          </label>

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Salvando…' : edit ? 'Salvar' : 'Criar encontro'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
