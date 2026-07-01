import { createClient } from '@supabase/supabase-js'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const userToken = authHeader.replace('Bearer ', '')

  if (!userToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Verify calling user is admin via anon client
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { data: profile } = await anonClient.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — apenas administradores podem convidar treinadores' }), { status: 403 })
  }

  const body = await req.json()
  const { email, full_name } = body
  if (!email) return new Response(JSON.stringify({ error: 'E-mail obrigatório' }), { status: 400 })

  // Use service role to invite
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? '' },
    redirectTo: `${process.env.URL ?? 'https://saab-sports-platform.netlify.app'}/login`,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  // Update full_name in profiles if provided (trigger creates the row)
  if (full_name && data.user) {
    await adminClient.from('profiles').update({ full_name, role: 'coach' }).eq('id', data.user.id)
  }

  return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { path: '/api/invite-coach' }
