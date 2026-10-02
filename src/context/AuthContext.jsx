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
    .select('business_id, role, businesses(id, name, invite_code)')
    .eq('user_id', userId)
  return (data || []).map(r => ({
    id: r.business_id,
    name: r.businesses?.name || 'Unnamed Business',
    role: r.role,
    invite_code: r.businesses?.invite_code || '',
  }))
}

async function fetchPlan(businessId, role) {
  if (!businessId) return 'free'

  // Primary: security-definer RPC — bypasses subscriptions RLS entirely.
  const { data: rpcPlan, error: rpcErr } = await supabase.rpc('get_business_plan', { p_business_id: businessId })

  // Fast return: RPC succeeded and returned a paid plan — nothing more to do.
  if (!rpcErr && rpcPlan && rpcPlan !== 'free') return rpcPlan

  // Fallback: query subscriptions directly.
  // Fires when:
  //   - RPC errored (function not deployed, expired JWT, any network issue)
  //   - RPC returned null (e.g. auth.uid() was null inside the function)
  //   - User is an owner/co_owner and the RPC returned 'free' — verify, because the
  //     RPC's auth check (profiles.business_id match) can fail during signup races or
  //     multi-business scenarios, causing it to return 'free' even for paid plans.
  const isOwner = role === 'owner' || role === 'co_owner'
  if (rpcErr || !rpcPlan || isOwner) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('business_id', businessId)
      .maybeSingle()
    if (sub?.plan) return sub.plan
  }

  return rpcPlan || 'free'
}

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [plan, setPlan]             = useState('free')
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)

  async function applySession(authUser) {
    const profile = await fetchProfile(authUser.id)
    if (!profile) { setUser(null); return null }

    // If the profile row has no business_id (can happen for legacy rows or
    // during signup before the profile is fully written), fall back to
    // user_businesses which is written separately and may already have it.
    let businessId = profile.business_id
    if (!businessId) {
      const { data: ub } = await supabase
        .from('user_businesses')
        .select('business_id')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle()
      businessId = ub?.business_id ?? null
    }

    const u = { ...profile, email: authUser.email, business_id: businessId }
    const resolvedPlan = await fetchPlan(businessId, profile.role)
    setUser(u)
    setPlan(resolvedPlan)

    if (businessId && (profile.role === 'owner' || profile.role === 'co_owner')) {
      // Ensure this user is in user_businesses (auto-seeds existing accounts).
      // Use the resolved businessId (not profile.business_id which may be null).
      supabase.from('user_businesses').upsert(
        { user_id: authUser.id, business_id: businessId, role: profile.role },
        { onConflict: 'user_id,business_id' }
      ).then(() => fetchUserBusinesses(authUser.id).then(setBusinesses))
       .catch(() => fetchUserBusinesses(authUser.id).then(setBusinesses))
    }
    return u
  }

  useEffect(() => {
    // getSession() is the single source of truth for the initial load.
    // onAuthStateChange also fires INITIAL_SESSION on mount, which would
    // cause a second concurrent applySession call — so we handle initial
    // state here only and ignore INITIAL_SESSION in the listener below.
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
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // TOKEN_REFRESHED is intentionally excluded: the Supabase client updates
        // its JWT automatically — re-running applySession on every token refresh
        // causes a race where fetchProfile/fetchPlan runs with a briefly-stale
        // auth context, returns free, and overwrites the correct plan.
        // INITIAL_SESSION is excluded because getSession() above handles it.
        if (session?.user) await applySession(session.user)
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
    if (user?.business_id) fetchPlan(user.business_id, user.role).then(setPlan)
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
    fetchPlan(targetBizId, user?.role).then(setPlan)
  }

  async function createBusiness(name) {
    if (!user) return null
    const bizName = name.trim() || (user.name + "'s Business")
    // RPC creates the business and the owner membership atomically; a plain
    // insert().select() fails RLS because the membership doesn't exist yet.
    const { data: newBizId, error } = await supabase.rpc('create_owned_business', { p_name: bizName })
    if (error) throw new Error(error.message)
    const newBiz = { id: newBizId, name: bizName }
    // Switch first: the services RLS policy only allows writes to the current business.
    await switchBusiness(newBiz.id)
    await seedDefaultServices(newBiz.id)
    return newBiz
  }

  // Subscribe to push notifications whenever the logged-in user changes
  useEffect(() => {
    if (user?.id && user?.business_id) {
      requestAndSubscribe(user.id, user.business_id)
    }
  }, [user?.id])

  // Always keep the Provider in the tree so context consumers never read the
  // null default. Moving the spinner inside the Provider (rather than returning
  // a bare <div> that replaces the Provider) prevents React's Concurrent Mode
  // from re-mounting all consumers when loading flips to false.
  return (
    <AuthContext.Provider value={{ user, plan, businesses, loading, login, logout, refreshUser, refreshPlan, switchBusiness, createBusiness }}>
      {loading ? (
        <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-line-strong border-t-fg rounded-full animate-spin" />
          <p className="text-fg-subtle text-sm">Loading…</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
