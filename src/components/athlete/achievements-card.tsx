'use client'

import { useEffect, useState } from 'react'
import { getAchievementData } from '@/lib/supabase/queries'
import { computeAchievements, evolutionStory, type Achievement } from '@/lib/achievements'
import { Trophy, Flame, Clock, Route, CalendarCheck, Sparkles, ChevronDown } from 'lucide-react'

const RED = 'var(--marca)'
const ICONS = {
  trophy: Trophy, flame: Flame, clock: Clock,
  route: Route, calendar: CalendarCheck, sparkles: Sparkles,
} as const

/** Conquistas reais do aluno + a narrativa "onde você estava × onde está".
 *  Some quando ainda não há nada a celebrar — nunca mostra vazio triste. */
export function AchievementsCard({ athleteId }: { athleteId: string }) {
  const [items, setItems] = useState<Achievement[]>([])
  const [story, setStory] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    getAchievementData(athleteId).then(d => {
      setItems(computeAchievements(d))
      setStory(evolutionStory(d.activities))
    }).catch(() => {})
  }, [athleteId])

  if (items.length === 0 && !story) return null
  const shown = expanded ? items : items.slice(0, 3)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Trophy className="w-5 h-5" style={{ color: RED }} />
        <h3 className="text-base font-black text-foreground">Suas conquistas</h3>
      </div>

      {/* Narrativa de evolução — o texto que segura quem está começando */}
      {story && (
        <div className="px-5 py-3.5" style={{ background: `linear-gradient(135deg, var(--marca-12), transparent 70%)` }}>
          <p className="text-sm text-foreground leading-relaxed">{story}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="p-4 space-y-2">
          {shown.map(a => {
            const Icon = ICONS[a.icon]
            return (
              <div key={a.key} className="flex items-start gap-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--marca-1f)' }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: RED, width: 18, height: 18 }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{a.detail}</p>
                </div>
              </div>
            )
          })}
          {items.length > 3 && (
            <button onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Mostrar menos' : `Ver todas (${items.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
