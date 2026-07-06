import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { clearBizCache, seedDefaultServices } from '../lib/db.js'
import { requestAndSubscribe } from '../lib/push.js'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  const timeout = new Promise(resolve => setTimeout(resolve, 5000, null))
  const query = supabase.from('profiles').select('*').eq('id', userId).single()
    .then(({ data }) => data)
  return Promise.race([query, timeout])
}

async function fetchUserBusinesses(userId) {
  const { data } = await supabase
    .from('user_businesses')
    .select('business_id, role, businesses(id, name)')
    .eq('user_id', userId)
  return (data || []).map(r => ({
    id: r.business_id,
    name: r.businesses?.name || 'Unnamed Business',
    role: r.role,
  }))
}

async function fetchPlan(businessId) {
  if (!businessId) return 'free'
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('business_id', businessId)
    .single()
  return data?.plan || 'free'
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [plan, setPlan]           = useState('free')
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]     = useState(true)

  async function applySession(authUser) {
    const profile = await fetchProfile(authUser.id)
    if (!profile) { setUser(null); return null }
    const u = { ...profile, email: authUser.email }
    setUser(u)
    fetchPlan(profile.business_id).then(setPlan)
    if (profile.role === 'owner' || profile.role === 'co_owner') {
      // Ensure this user is in user_businesses (auto-seeds existing accounts)
      supabase.from('user_businesses').upsert(
        { user_id: authUser.id, business_id: profile.business_id, role: profile.role },
        { onConflict: 'user_id,business_id' }
      ).then(() => fetchUserBusinesses(authUser.id).then(setBusinesses))
       .catch(() => fetchUserBusinesses(authUser.id).then(setBusinesses))
    }
    return u
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await applySession(session.user)
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearBizCache()
        setUser(null)
        setPlan('free')
        setBusinesses([])
      } else if (session?.user) {
        await applySession(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const u = await applySession(data.user)
    return u  // null if no profile yet — caller redirects to signup
  }

  async function logout() {
    clearBizCache()
    await supabase.auth.signOut()
    setUser(null)
    setPlan('free')
    setBusinesses([])
  }

  async function refreshUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    await applySession(authUser)
  }

  async function refreshPlan() {
    if (user?.business_id) fetchPlan(user.business_id).then(setPlan)
  }

  async function switchBusiness(targetBizId) {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ business_id: targetBizId })
      .eq('id', user.id)
    if (error) throw new Error(error.message)
    clearBizCache()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) await applySession(authUser)
    fetchPlan(targetBizId).then(setPlan)
  }

  async function createBusiness(name) {
    if (!user) return null
    const bizName = name.trim() || (user.name + "'s Business")
    const { data: newBiz, error } = await supabase
      .from('businesses')
      .insert({ name: bizName })
      .select()
      .single()
    if (error) throw new Error(error.message)
    await supabase.from('user_businesses').upsert(
      { user_id: user.id, business_id: newBiz.id, role: 'owner' },
      { onConflict: 'user_id,business_id' }
    )
    await seedDefaultServices(newBiz.id)
    await switchBusiness(newBiz.id)
    return newBiz
  }

  // Subscribe to push notifications whenever the logged-in user changes
  useEffect(() => {
    if (user?.id && user?.business_id) {
      requestAndSubscribe(user.id, user.business_id)
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, plan, businesses, login, logout, refreshUser, refreshPlan, switchBusiness, createBusiness }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
